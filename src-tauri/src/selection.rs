use std::{collections::HashMap, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{
    ipc::Response, AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tokio::sync::oneshot;
use xcap::image::{imageops, RgbaImage};

use crate::capture::{encode_png, err, store, to_pixels, xcap_monitor, CaptureInfo, Rect};

// ponytail: macOS reports some system UI as windows; a name denylist keeps them out of the picker.
const SYSTEM_APPS: [&str; 6] = [
    "Window Server",
    "Dock",
    "Control Center",
    "SystemUIServer",
    "Notification Center",
    "Spotlight",
];

#[derive(Clone, Serialize)]
pub struct PickableWindow {
    id: u32,
    title: String,
    rect: Rect,
}

#[derive(Serialize)]
pub struct OverlayInfo {
    width: f64,
    height: f64,
    windows: Vec<PickableWindow>,
}

struct Frame {
    image: RgbaImage,
    width: f64,
    height: f64,
    windows: Vec<PickableWindow>,
}

enum Picked {
    Region(RgbaImage),
    Window(u32, String),
}

#[derive(Default)]
pub struct Selection(Mutex<Option<Session>>);

struct Session {
    frames: HashMap<String, Frame>,
    done: oneshot::Sender<Option<Picked>>,
}

#[derive(Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Region,
    Window,
}

/// A window's rectangle relative to the monitor, if it overlaps it and is big enough to pick.
fn visible_rect(
    (x, y, w, h): (i32, i32, u32, u32),
    (mx, my, mw, mh): (i32, i32, u32, u32),
) -> Option<Rect> {
    let (x, y) = (i64::from(x) - i64::from(mx), i64::from(y) - i64::from(my));
    let (w64, h64) = (i64::from(w), i64::from(h));
    let overlaps = x < i64::from(mw) && y < i64::from(mh) && x + w64 > 0 && y + h64 > 0;
    (overlaps && w >= 40 && h >= 40).then(|| Rect {
        x: x as f64,
        y: y as f64,
        w: f64::from(w),
        h: f64::from(h),
    })
}

/// Visible windows (front to back) that overlap the monitor, relative to its origin.
fn windows_on(monitor: &xcap::Monitor) -> Vec<PickableWindow> {
    let (Ok(mx), Ok(my), Ok(mw), Ok(mh)) =
        (monitor.x(), monitor.y(), monitor.width(), monitor.height())
    else {
        return vec![];
    };
    let own = std::process::id();
    xcap::Window::all()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|w| {
            let app = w.app_name().unwrap_or_default();
            if w.pid().ok()? == own || w.is_minimized().ok()? || SYSTEM_APPS.contains(&app.as_str())
            {
                return None;
            }
            let bounds = (w.x().ok()?, w.y().ok()?, w.width().ok()?, w.height().ok()?);
            let rect = visible_rect(bounds, (mx, my, mw, mh))?;
            let title = w.title().ok().filter(|t| !t.is_empty()).unwrap_or(app);
            Some(PickableWindow {
                id: w.id().ok()?,
                title,
                rect,
            })
        })
        .collect()
}

fn overlay_window(
    app: &AppHandle,
    label: &str,
    m: &tauri::Monitor,
    kind: Kind,
) -> Result<(), String> {
    let query = if kind == Kind::Window {
        "window"
    } else {
        "region"
    };
    let url = WebviewUrl::App(format!("overlay.html?kind={query}").into());
    let (p, s, k) = (m.position(), m.size(), m.scale_factor());
    let w = WebviewWindowBuilder::new(app, label, url)
        .title("Daguerre selection")
        .position(f64::from(p.x) / k, f64::from(p.y) / k)
        .inner_size(f64::from(s.width) / k, f64::from(s.height) / k)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .visible_on_all_workspaces(true)
        // The overlay shows itself once the frozen frame has loaded, so there is no blank flash.
        .visible(false)
        .build()
        .map_err(err)?;
    #[cfg(target_os = "macos")]
    {
        // Above the menu bar and Dock (NSScreenSaverWindowLevel).
        let win = w.clone();
        app.run_on_main_thread(move || {
            if let Ok(ns) = win.ns_window() {
                let ns = ns.cast::<objc2::runtime::AnyObject>();
                unsafe {
                    let _: () = objc2::msg_send![ns, setLevel: 1000isize];
                }
            }
        })
        .map_err(err)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        // Exact placement on mixed-DPI setups, then borderless fullscreen to cover the taskbar.
        w.set_position(tauri::PhysicalPosition::new(p.x, p.y))
            .map_err(err)?;
        w.set_size(tauri::PhysicalSize::new(s.width, s.height))
            .map_err(err)?;
        w.set_fullscreen(true).map_err(err)?;
    }
    Ok(())
}

fn close_overlays(app: &AppHandle) {
    for (label, w) in app.webview_windows() {
        if label.starts_with("overlay-") {
            let _ = w.destroy();
        }
    }
}

/// Freezes every monitor, lets the user drag a region (or click a window), and stores the result.
/// Resolves to `None` when cancelled.
#[tauri::command]
pub async fn select(app: AppHandle, kind: Kind) -> Result<Option<CaptureInfo>, String> {
    cancel(&app);
    let monitors = app.available_monitors().map_err(err)?;
    let mut frames = HashMap::new();
    for (i, m) in monitors.iter().enumerate() {
        let xm = xcap_monitor(m)?;
        frames.insert(
            format!("overlay-{i}"),
            Frame {
                image: xm.capture_image().map_err(err)?,
                width: f64::from(xm.width().map_err(err)?),
                height: f64::from(xm.height().map_err(err)?),
                windows: if kind == Kind::Window {
                    windows_on(&xm)
                } else {
                    vec![]
                },
            },
        );
    }
    let (done, picked) = oneshot::channel();
    *app.state::<Selection>().0.lock().unwrap() = Some(Session { frames, done });
    for (i, m) in monitors.iter().enumerate() {
        if let Err(e) = overlay_window(&app, &format!("overlay-{i}"), m, kind) {
            cancel(&app);
            return Err(e);
        }
    }
    let picked = picked.await.ok().flatten();
    close_overlays(&app);
    match picked {
        None => Ok(None),
        Some(Picked::Region(img)) => store(&app, &img, "Selection".into()).map(Some),
        Some(Picked::Window(id, title)) => {
            let window = xcap::Window::all()
                .map_err(err)?
                .into_iter()
                .find(|w| w.id().is_ok_and(|w| w == id))
                .ok_or("That window has closed.")?;
            store(&app, &window.capture_image().map_err(err)?, title).map(Some)
        }
    }
}

/// Ends any selection in progress as cancelled.
pub fn cancel(app: &AppHandle) {
    let session = app.state::<Selection>().0.lock().unwrap().take();
    if let Some(s) = session {
        let _ = s.done.send(None);
    }
    close_overlays(app);
}

#[tauri::command]
pub fn overlay_frame(
    window: WebviewWindow,
    state: State<'_, Selection>,
) -> Result<Response, String> {
    let session = state.0.lock().unwrap();
    let frame = session
        .as_ref()
        .and_then(|s| s.frames.get(window.label()))
        .ok_or("No selection in progress.")?;
    Ok(Response::new(encode_png(&frame.image)?))
}

#[tauri::command]
pub fn overlay_info(
    window: WebviewWindow,
    state: State<'_, Selection>,
) -> Result<OverlayInfo, String> {
    let session = state.0.lock().unwrap();
    let frame = session
        .as_ref()
        .and_then(|s| s.frames.get(window.label()))
        .ok_or("No selection in progress.")?;
    Ok(OverlayInfo {
        width: frame.width,
        height: frame.height,
        windows: frame.windows.clone(),
    })
}

/// Called by an overlay with a region (monitor units), a window id, or neither to cancel.
#[tauri::command]
pub fn finish_selection(
    window: WebviewWindow,
    state: State<'_, Selection>,
    rect: Option<Rect>,
    window_id: Option<u32>,
) -> Result<(), String> {
    let Some(session) = state.0.lock().unwrap().take() else {
        return Ok(());
    };
    let picked = session
        .frames
        .get(window.label())
        .and_then(|f| pick(f, rect, window_id));
    let _ = session.done.send(picked);
    Ok(())
}

/// A window id must be one this overlay offered; a region is cropped from the frozen frame.
fn pick(frame: &Frame, rect: Option<Rect>, window_id: Option<u32>) -> Option<Picked> {
    if let Some(id) = window_id {
        let w = frame.windows.iter().find(|w| w.id == id)?;
        return Some(Picked::Window(id, w.title.clone()));
    }
    let (x, y, w, h) = to_pixels(rect?, (frame.width, frame.height), frame.image.dimensions())?;
    Some(Picked::Region(
        imageops::crop_imm(&frame.image, x, y, w, h).to_image(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn frame() -> Frame {
        // A 2x display: 100×50 monitor units captured as 200×100 pixels.
        Frame {
            image: RgbaImage::new(200, 100),
            width: 100.0,
            height: 50.0,
            windows: vec![PickableWindow {
                id: 7,
                title: "Notes".into(),
                rect: Rect::default(),
            }],
        }
    }

    #[test]
    fn crops_a_region_in_capture_pixels() {
        let rect = Rect {
            x: 10.0,
            y: 5.0,
            w: 20.0,
            h: 10.0,
        };
        match pick(&frame(), Some(rect), None) {
            Some(Picked::Region(img)) => assert_eq!(img.dimensions(), (40, 20)),
            _ => panic!("expected a region"),
        }
    }

    #[test]
    fn picks_only_offered_windows() {
        match pick(&frame(), None, Some(7)) {
            Some(Picked::Window(7, title)) => assert_eq!(title, "Notes"),
            _ => panic!("expected window 7"),
        }
        assert!(pick(&frame(), None, Some(8)).is_none());
    }

    #[test]
    fn cancels_on_nothing_or_an_empty_region() {
        assert!(pick(&frame(), None, None).is_none());
        let empty = Rect {
            x: 10.0,
            y: 5.0,
            w: 0.0,
            h: 10.0,
        };
        assert!(pick(&frame(), Some(empty), None).is_none());
    }

    #[test]
    fn keeps_windows_overlapping_the_monitor() {
        let monitor = (-1440, 0, 1440, 900);
        let rect = visible_rect((-1400, 100, 600, 400), monitor).unwrap();
        assert_eq!(
            rect,
            Rect {
                x: 40.0,
                y: 100.0,
                w: 600.0,
                h: 400.0
            }
        );
        // Partly off-screen still counts.
        assert!(visible_rect((-1600, -50, 300, 300), monitor).is_some());
    }

    #[test]
    fn skips_windows_elsewhere_or_too_small() {
        let monitor = (0, 0, 1440, 900);
        assert!(visible_rect((1440, 0, 500, 500), monitor).is_none());
        assert!(visible_rect((-500, 0, 500, 500), monitor).is_none());
        assert!(visible_rect((100, 100, 39, 300), monitor).is_none());
    }
}
