use std::{collections::HashMap, sync::Mutex};

use serde::{Deserialize, Serialize};
use tauri::{
    ipc::Response, AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tokio::sync::oneshot;
use xcap::image::{imageops, RgbaImage};

use crate::capture::{encode_png, err, store, to_pixels, xcap_monitor, CaptureInfo, Rect};

// ponytail: macOS reports some system UI as windows; a name denylist keeps them out of the picker.
const SYSTEM_APPS: [&str; 8] = [
    "Window Server",
    "Dock",
    "Control Center",
    "SystemUIServer",
    "Notification Center",
    "Spotlight",
    "WindowManager",
    "UserNotificationCenter",
];

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct CursorPoint {
    pub x: f64,
    pub y: f64,
}

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
    #[serde(skip_serializing_if = "Option::is_none")]
    cursor: Option<CursorPoint>,
}

struct Frame {
    image: RgbaImage,
    width: f64,
    height: f64,
    windows: Vec<PickableWindow>,
    cursor: Option<CursorPoint>,
}

enum Picked {
    Region(RgbaImage),
    Window(u32, String, Option<RgbaImage>),
}

#[derive(Default)]
pub struct Selection(Mutex<Option<Session>>);

struct Session {
    frames: HashMap<String, Frame>,
    done: oneshot::Sender<Result<Option<Picked>, String>>,
}

#[derive(Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Region,
    Window,
}

#[derive(Clone, Debug)]
struct RawWindow {
    id: u32,
    pid: u32,
    app: String,
    title: Option<String>,
    layer: i32,
    alpha: f64,
    on_screen: bool,
    bounds: (i32, i32, u32, u32),
}

#[cfg(target_os = "macos")]
fn prepare_overlay(win: &WebviewWindow) {
    use objc2::{msg_send, runtime::AnyObject};
    unsafe {
        if let Ok(ns) = win.ns_window() {
            let ns = ns.cast::<AnyObject>();
            // Above the menu bar and Dock (NSScreenSaverWindowLevel).
            let _: () = msg_send![ns, setLevel: 1000isize];
            let _: () = msg_send![ns, setAcceptsMouseMovedEvents: true];
        }
    }
    activate_app();
}

#[cfg(target_os = "macos")]
fn activate_app() {
    use objc2::{class, msg_send, runtime::AnyObject};
    unsafe {
        let ns_app: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        let _: () = msg_send![ns_app, activateIgnoringOtherApps: true];
    }
}

#[cfg(target_os = "macos")]
fn raw_windows() -> Vec<RawWindow> {
    #[repr(C)]
    #[derive(Default)]
    struct CgRect {
        x: f64,
        y: f64,
        w: f64,
        h: f64,
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGWindowListCopyWindowInfo(
            option: u32,
            relative_to_window: u32,
        ) -> *const std::ffi::c_void;
        fn CGRectMakeWithDictionaryRepresentation(
            dict: *const std::ffi::c_void,
            rect: *mut CgRect,
        ) -> bool;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *const std::ffi::c_void);
    }

    unsafe fn dict_val(
        dict: *const objc2::runtime::AnyObject,
        key: &std::ffi::CStr,
    ) -> *mut objc2::runtime::AnyObject {
        use objc2::{class, msg_send, runtime::AnyObject};
        let k: *mut AnyObject = msg_send![class!(NSString), stringWithUTF8String: key.as_ptr()];
        msg_send![dict, objectForKey: k]
    }

    unsafe fn dict_str(
        dict: *const objc2::runtime::AnyObject,
        key: &std::ffi::CStr,
    ) -> Option<String> {
        use objc2::{class, msg_send};
        use std::ffi::{c_char, CStr};
        let val = dict_val(dict, key);
        if val.is_null() {
            return None;
        }
        let is_str: bool = msg_send![val, isKindOfClass: class!(NSString)];
        if !is_str {
            return None;
        }
        let ptr: *const c_char = msg_send![val, UTF8String];
        (!ptr.is_null()).then(|| CStr::from_ptr(ptr).to_string_lossy().into_owned())
    }
    use objc2::{msg_send, rc::autoreleasepool, runtime::AnyObject};
    // kCGWindowListOptionOnScreenOnly (1 << 0) | kCGWindowListExcludeDesktopElements (1 << 4)
    const OPTIONS: u32 = (1 << 0) | (1 << 4);
    autoreleasepool(|_| unsafe {
        let arr = CGWindowListCopyWindowInfo(OPTIONS, 0);
        if arr.is_null() {
            return vec![];
        }
        let arr_obj = arr.cast::<AnyObject>();
        let count: usize = msg_send![arr_obj, count];
        let mut out = Vec::with_capacity(count);
        for i in 0..count {
            let dict: *mut AnyObject = msg_send![arr_obj, objectAtIndex: i];
            if dict.is_null() {
                continue;
            }
            let id_obj = dict_val(dict, c"kCGWindowNumber");
            let pid_obj = dict_val(dict, c"kCGWindowOwnerPID");
            let bounds_obj = dict_val(dict, c"kCGWindowBounds");
            if id_obj.is_null() || pid_obj.is_null() || bounds_obj.is_null() {
                continue;
            }
            let mut rect = CgRect::default();
            if !CGRectMakeWithDictionaryRepresentation(bounds_obj.cast(), &mut rect) {
                continue;
            }
            if rect.w <= 0.0 || rect.h <= 0.0 {
                continue;
            }
            let layer_obj = dict_val(dict, c"kCGWindowLayer");
            let alpha_obj = dict_val(dict, c"kCGWindowAlpha");
            let onscreen_obj = dict_val(dict, c"kCGWindowIsOnscreen");
            out.push(RawWindow {
                id: msg_send![id_obj, unsignedIntValue],
                pid: msg_send![pid_obj, unsignedIntValue],
                app: dict_str(dict, c"kCGWindowOwnerName").unwrap_or_default(),
                title: dict_str(dict, c"kCGWindowName"),
                layer: if layer_obj.is_null() {
                    0
                } else {
                    msg_send![layer_obj, intValue]
                },
                alpha: if alpha_obj.is_null() {
                    1.0
                } else {
                    msg_send![alpha_obj, doubleValue]
                },
                on_screen: if onscreen_obj.is_null() {
                    true
                } else {
                    msg_send![onscreen_obj, boolValue]
                },
                bounds: (
                    rect.x.round() as i32,
                    rect.y.round() as i32,
                    rect.w.round() as u32,
                    rect.h.round() as u32,
                ),
            });
        }
        CFRelease(arr);
        out
    })
}

#[cfg(not(target_os = "macos"))]
fn raw_windows() -> Vec<RawWindow> {
    xcap::Window::all()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|w| {
            Some(RawWindow {
                id: w.id().ok()?,
                pid: w.pid().ok()?,
                app: w.app_name().unwrap_or_default(),
                title: w.title().ok(),
                layer: 0,
                alpha: 1.0,
                on_screen: !w.is_minimized().ok()?,
                bounds: (w.x().ok()?, w.y().ok()?, w.width().ok()?, w.height().ok()?),
            })
        })
        .collect()
}

/// Maps a cursor position in monitor pixels onto the overlay's units when inside the monitor.
fn cursor_point(
    cursor: Option<(f64, f64)>,
    (mx, my, mw, mh): (i32, i32, u32, u32),
    (fw, fh): (f64, f64),
) -> Option<CursorPoint> {
    let (cx, cy) = cursor?;
    let (rx, ry, rw, rh) = (
        cx - f64::from(mx),
        cy - f64::from(my),
        f64::from(mw),
        f64::from(mh),
    );
    (rw > 0.0 && rh > 0.0 && rx >= 0.0 && ry >= 0.0 && rx < rw && ry < rh).then(|| CursorPoint {
        x: rx * fw / rw,
        y: ry * fh / rh,
    })
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

fn filter_window(
    win: RawWindow,
    monitor: (i32, i32, u32, u32),
    own_pid: u32,
) -> Option<PickableWindow> {
    if win.pid == own_pid
        || !win.on_screen
        || win.layer != 0
        || win.alpha <= 0.0
        || win.alpha.is_nan()
        || win.app.is_empty()
        || SYSTEM_APPS.contains(&win.app.as_str())
    {
        return None;
    }
    let rect = visible_rect(win.bounds, monitor)?;
    let title = win.title.filter(|t| !t.is_empty()).unwrap_or(win.app);
    Some(PickableWindow {
        id: win.id,
        title,
        rect,
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
    raw_windows()
        .into_iter()
        .filter_map(|w| filter_window(w, (mx, my, mw, mh), own))
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
        let win = w.clone();
        app.run_on_main_thread(move || prepare_overlay(&win))
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
    if crate::capture::is_wayland() && kind == Kind::Window {
        return Err("Window picking requires X11. Use Select area with your desktop's screenshot picker instead.".into());
    }
    cancel(&app);
    #[cfg(target_os = "linux")]
    if crate::capture::is_wayland() {
        return crate::capture::portal_capture(&app, true).await;
    }
    let cursor = app.cursor_position().ok().map(|c| (c.x, c.y));
    let monitors = app.available_monitors().map_err(err)?;
    if monitors.is_empty() {
        return Err("No display found.".into());
    }
    let mut frames = HashMap::new();
    for (i, m) in monitors.iter().enumerate() {
        let xm = xcap_monitor(m)?;
        let width = f64::from(xm.width().map_err(err)?);
        let height = f64::from(xm.height().map_err(err)?);
        let (p, s) = (m.position(), m.size());
        frames.insert(
            format!("overlay-{i}"),
            Frame {
                image: xm.capture_image().map_err(err)?,
                width,
                height,
                windows: if kind == Kind::Window {
                    windows_on(&xm)
                } else {
                    vec![]
                },
                cursor: if kind == Kind::Window {
                    cursor_point(cursor, (p.x, p.y, s.width, s.height), (width, height))
                } else {
                    None
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
    let picked = picked.await.unwrap_or(Ok(None));
    close_overlays(&app);
    match picked? {
        None => Ok(None),
        Some(Picked::Region(img)) => store(&app, &img, "Selection".into()).map(Some),
        Some(Picked::Window(id, title, fallback)) => {
            let standalone = xcap::Window::all()
                .ok()
                .and_then(|windows| windows.into_iter().find(|w| w.id().is_ok_and(|w| w == id)))
                .and_then(|window| window.capture_image().ok());
            let image = resolve_window_image(standalone, fallback)?;
            store(&app, &image, title).map(Some)
        }
    }
}

/// Ends any selection in progress as cancelled.
pub fn cancel(app: &AppHandle) {
    let session = app.state::<Selection>().0.lock().unwrap().take();
    if let Some(s) = session {
        let _ = s.done.send(Ok(None));
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
    #[cfg(target_os = "macos")]
    let _ = window.app_handle().run_on_main_thread(activate_app);
    let session = state.0.lock().unwrap();
    let frame = session
        .as_ref()
        .and_then(|s| s.frames.get(window.label()))
        .ok_or("No selection in progress.")?;
    Ok(OverlayInfo {
        width: frame.width,
        height: frame.height,
        windows: frame.windows.clone(),
        cursor: frame.cursor,
    })
}

/// Called by an overlay with a region (monitor units), a window id, or neither to cancel.
#[tauri::command]
pub fn finish_selection(
    window: WebviewWindow,
    state: State<'_, Selection>,
    rect: Option<Rect>,
    window_id: Option<u32>,
    error: Option<String>,
) -> Result<(), String> {
    let Some(session) = state.0.lock().unwrap().take() else {
        return Ok(());
    };
    let picked = match error {
        Some(error) => Err(error),
        None => Ok(session
            .frames
            .get(window.label())
            .and_then(|f| pick(f, rect, window_id))),
    };
    let _ = session.done.send(picked);
    Ok(())
}

fn crop(frame: &Frame, rect: Rect) -> Option<RgbaImage> {
    let (x, y, w, h) = to_pixels(rect, (frame.width, frame.height), frame.image.dimensions())?;
    Some(imageops::crop_imm(&frame.image, x, y, w, h).to_image())
}

fn resolve_window_image(
    standalone: Option<RgbaImage>,
    fallback: Option<RgbaImage>,
) -> Result<RgbaImage, String> {
    standalone
        .or(fallback)
        .ok_or_else(|| "That window has closed.".into())
}

/// A window id must be one this overlay offered; a region is cropped from the frozen frame.
fn pick(frame: &Frame, rect: Option<Rect>, window_id: Option<u32>) -> Option<Picked> {
    if let Some(id) = window_id {
        let w = frame.windows.iter().find(|w| w.id == id)?;
        return Some(Picked::Window(id, w.title.clone(), crop(frame, w.rect)));
    }
    Some(Picked::Region(crop(frame, rect?)?))
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
                rect: Rect {
                    x: 10.0,
                    y: 5.0,
                    w: 30.0,
                    h: 20.0,
                },
            }],
            cursor: None,
        }
    }

    fn raw_window() -> RawWindow {
        RawWindow {
            id: 42,
            pid: 100,
            app: "Brave Browser".into(),
            title: None,
            layer: 0,
            alpha: 1.0,
            on_screen: true,
            bounds: (10, 20, 800, 600),
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
    fn picks_only_offered_windows_with_cropped_fallback() {
        match pick(&frame(), None, Some(7)) {
            Some(Picked::Window(7, title, Some(fallback))) => {
                assert_eq!(title, "Notes");
                assert_eq!(fallback.dimensions(), (60, 40));
            }
            _ => panic!("expected window 7 with cropped fallback"),
        }
        assert!(pick(&frame(), None, Some(8)).is_none());
    }

    #[test]
    fn resolves_window_image_using_fallback_when_standalone_missing() {
        let fallback = RgbaImage::new(60, 40);
        let standalone = RgbaImage::new(64, 44);
        assert_eq!(
            resolve_window_image(None, Some(fallback))
                .unwrap()
                .dimensions(),
            (60, 40)
        );
        assert_eq!(
            resolve_window_image(Some(standalone), Some(RgbaImage::new(60, 40)))
                .unwrap()
                .dimensions(),
            (64, 44)
        );
        assert!(resolve_window_image(None, None).is_err());
    }

    #[test]
    fn filters_windows_by_layer_alpha_onscreen_and_system_apps() {
        let monitor = (0, 0, 1920, 1080);
        let picked = filter_window(raw_window(), monitor, 999).unwrap();
        assert_eq!(picked.title, "Brave Browser");

        let mut titled = raw_window();
        titled.title = Some("Docs".into());
        assert_eq!(filter_window(titled, monitor, 999).unwrap().title, "Docs");

        let mut wrong_layer = raw_window();
        wrong_layer.layer = 20;
        assert!(filter_window(wrong_layer, monitor, 999).is_none());

        let mut hidden = raw_window();
        hidden.alpha = 0.0;
        assert!(filter_window(hidden, monitor, 999).is_none());

        let mut offscreen = raw_window();
        offscreen.on_screen = false;
        assert!(filter_window(offscreen, monitor, 999).is_none());

        assert!(filter_window(raw_window(), monitor, 100).is_none());

        let mut wm = raw_window();
        wm.app = "WindowManager".into();
        assert!(filter_window(wm, monitor, 999).is_none());
    }

    #[test]
    fn maps_cursor_onto_monitor_units_only_when_inside() {
        assert_eq!(
            cursor_point(Some((1000.0, 500.0)), (0, 0, 2000, 1000), (1000.0, 500.0)),
            Some(CursorPoint { x: 500.0, y: 250.0 })
        );
        assert_eq!(
            cursor_point(Some((-10.0, 500.0)), (0, 0, 2000, 1000), (1000.0, 500.0)),
            None
        );
        assert_eq!(
            cursor_point(None, (0, 0, 2000, 1000), (1000.0, 500.0)),
            None
        );
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
