use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Monitor};
use xcap::image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ExtendedColorType, ImageEncoder, RgbaImage,
};

/// A rectangle in monitor units: points on macOS, pixels elsewhere (what xcap reports).
#[derive(Clone, Copy, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

/// The last capture, held until the webview fetches its bytes with `take_capture`.
#[derive(Default)]
pub struct Captured(pub std::sync::Mutex<Option<Vec<u8>>>);

#[derive(Serialize)]
pub struct CaptureInfo {
    pub title: String,
}

pub fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Maps `rect` from a `mon_w`×`mon_h` monitor onto its `img_w`×`img_h` capture, clamped; `None` if empty.
pub fn to_pixels(
    rect: Rect,
    (mon_w, mon_h): (f64, f64),
    (img_w, img_h): (u32, u32),
) -> Option<(u32, u32, u32, u32)> {
    let (sx, sy) = (f64::from(img_w) / mon_w, f64::from(img_h) / mon_h);
    let px = |v: f64, s: f64, max: u32| (v * s).round().clamp(0.0, f64::from(max));
    let (x0, y0) = (px(rect.x, sx, img_w), px(rect.y, sy, img_h));
    let (x1, y1) = (
        px(rect.x + rect.w, sx, img_w),
        px(rect.y + rect.h, sy, img_h),
    );
    // NaN fails both comparisons, so malformed input is rejected too.
    (x1 > x0 && y1 > y0).then_some((x0 as u32, y0 as u32, (x1 - x0) as u32, (y1 - y0) as u32))
}

pub fn encode_png(img: &RgbaImage) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    // Fast compression: captures are re-encoded by the editor on save anyway.
    PngEncoder::new_with_quality(&mut out, CompressionType::Fast, FilterType::Adaptive)
        .write_image(
            img.as_raw(),
            img.width(),
            img.height(),
            ExtendedColorType::Rgba8,
        )
        .map_err(err)?;
    Ok(out)
}

/// The centre of a monitor (Tauri pixels) in xcap's units: points when `scale` isn't 1.
fn centre_point((x, y): (i32, i32), (w, h): (u32, u32), scale: f64) -> (i32, i32) {
    let cx = (f64::from(x) + f64::from(w) / 2.0) / scale;
    let cy = (f64::from(y) + f64::from(h) / 2.0) / scale;
    (cx as i32, cy as i32)
}

fn contains((px, py): (f64, f64), (x, y): (i32, i32), (w, h): (u32, u32)) -> bool {
    let (x, y) = (f64::from(x), f64::from(y));
    px >= x && py >= y && px < x + f64::from(w) && py < y + f64::from(h)
}

/// The xcap monitor matching a Tauri monitor. Tauri reports pixels; xcap uses points on macOS.
pub fn xcap_monitor(m: &Monitor) -> Result<xcap::Monitor, String> {
    let scale = if cfg!(target_os = "macos") {
        m.scale_factor()
    } else {
        1.0
    };
    let (p, s) = (m.position(), m.size());
    let (cx, cy) = centre_point((p.x, p.y), (s.width, s.height), scale);
    xcap::Monitor::from_point(cx, cy).map_err(err)
}

pub fn store(app: &AppHandle, img: &RgbaImage, title: String) -> Result<CaptureInfo, String> {
    *app.state::<Captured>().0.lock().unwrap() = Some(encode_png(img)?);
    Ok(CaptureInfo { title })
}

/// Captures the whole monitor under the mouse pointer.
#[tauri::command]
pub async fn capture_screen(app: AppHandle) -> Result<CaptureInfo, String> {
    let c = app.cursor_position().map_err(err)?;
    let monitors = app.available_monitors().map_err(err)?;
    let m = monitors
        .iter()
        .find(|m| {
            let (p, s) = (m.position(), m.size());
            contains((c.x, c.y), (p.x, p.y), (s.width, s.height))
        })
        .or(monitors.first())
        .ok_or("No display found.")?;
    let xm = xcap_monitor(m)?;
    let title = xm.friendly_name().unwrap_or_else(|_| "Screen".into());
    store(&app, &xm.capture_image().map_err(err)?, title)
}

#[tauri::command]
pub fn take_capture(state: tauri::State<'_, Captured>) -> Result<tauri::ipc::Response, String> {
    let png = state
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or("Nothing was captured.")?;
    Ok(tauri::ipc::Response::new(png))
}

#[cfg(test)]
mod tests {
    use super::*;

    const R: fn(f64, f64, f64, f64) -> Rect = |x, y, w, h| Rect { x, y, w, h };

    #[test]
    fn scales_monitor_units_to_capture_pixels() {
        // A 2x display: 1440×900 points captured as 2880×1800 pixels.
        let px = to_pixels(R(10.0, 20.0, 100.0, 50.0), (1440.0, 900.0), (2880, 1800));
        assert_eq!(px, Some((20, 40, 200, 100)));
    }

    #[test]
    fn clamps_to_the_capture() {
        let px = to_pixels(R(-50.0, 850.0, 200.0, 200.0), (1440.0, 900.0), (1440, 900));
        assert_eq!(px, Some((0, 850, 150, 50)));
    }

    #[test]
    fn rejects_empty_or_malformed_rects() {
        let size = ((100.0, 100.0), (100, 100));
        assert_eq!(to_pixels(R(10.0, 10.0, 0.0, 5.0), size.0, size.1), None);
        assert_eq!(to_pixels(R(200.0, 0.0, 10.0, 10.0), size.0, size.1), None);
        assert_eq!(
            to_pixels(R(f64::NAN, 0.0, 10.0, 10.0), size.0, size.1),
            None
        );
    }

    #[test]
    fn encodes_a_png() {
        let png = encode_png(&RgbaImage::new(3, 2)).unwrap();
        assert_eq!(&png[1..4], b"PNG");
    }

    #[test]
    fn finds_the_monitor_under_the_pointer() {
        // A secondary display left of the main one.
        let (pos, size) = ((-1920, 0), (1920, 1080));
        assert!(contains((-1.0, 500.0), pos, size));
        assert!(contains((-1920.0, 0.0), pos, size));
        assert!(!contains((0.0, 500.0), pos, size));
        assert!(!contains((-100.0, 1080.0), pos, size));
    }

    #[test]
    fn centre_point_converts_pixels_to_points() {
        assert_eq!(centre_point((0, 0), (2880, 1800), 2.0), (720, 450));
        assert_eq!(centre_point((-1920, 0), (1920, 1080), 1.0), (-960, 540));
    }
}
