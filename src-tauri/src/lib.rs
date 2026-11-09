mod capture;
#[cfg(target_os = "linux")]
mod portal;
mod selection;

use std::{collections::HashMap, sync::Mutex};

use capture::{err, Rect};
use serde::Serialize;
use tauri::{
    ipc::{InvokeBody, Request},
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
    WindowEvent,
};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri_plugin_window_state::StateFlags;
use xcap::image::{self, ImageFormat};

const ACTIONS: [&str; 4] = ["selection", "screen", "window", "copy-selection"];
const PAGES: [&str; 3] = ["capture", "history", "settings"];
const TRAY_ICONS: [&str; 2] = ["app", "white"];

/// Global shortcut id -> action.
#[derive(Default)]
struct Shortcuts(Mutex<HashMap<u32, String>>);

/// An action requested on the command line before the home window was listening.
#[derive(Default)]
struct Pending(Mutex<Option<String>>);

/// `--capture <action>`, used by launchers and desktop keyboard settings (e.g. on Wayland).
fn capture_arg(args: &[String]) -> Option<&str> {
    let i = args.iter().position(|a| a == "--capture")?;
    args.get(i + 1)
        .map(String::as_str)
        .filter(|a| ACTIONS.contains(a))
}

/// One editor window per screenshot; ids are UUIDs, so anything else is rejected.
fn editor_label(id: &str) -> Option<String> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    valid.then(|| format!("editor-{id}"))
}

/// Known actions with a non-empty accelerator.
fn wanted_shortcuts(shortcuts: HashMap<String, String>) -> Vec<(String, String)> {
    shortcuts
        .into_iter()
        .filter(|(action, accelerator)| {
            ACTIONS.contains(&action.as_str()) && !accelerator.is_empty()
        })
        .collect()
}

/// The Dock icon shows while the main window or an editor is on screen.
#[cfg(any(target_os = "macos", test))]
fn dock_visible<'a>(windows: impl IntoIterator<Item = (&'a str, bool)>) -> bool {
    windows
        .into_iter()
        .any(|(label, visible)| visible && (label == "home" || label.starts_with("editor-")))
}

#[cfg(target_os = "macos")]
fn update_dock(app: &AppHandle) {
    let windows = app.webview_windows();
    let visible = dock_visible(
        windows
            .iter()
            .map(|(label, w)| (label.as_str(), w.is_visible().unwrap_or(false))),
    );
    let _ = app.set_activation_policy(if visible {
        tauri::ActivationPolicy::Regular
    } else {
        tauri::ActivationPolicy::Accessory
    });
}

#[cfg(not(target_os = "macos"))]
fn update_dock(_app: &AppHandle) {}

fn trigger(app: &AppHandle, action: &str) {
    let _ = app.emit_to("home", "command", action);
}

fn show_home(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("home") {
        let _ = w.unminimize();
        keep_on_screen(app, &w);
        let _ = w.show();
        let _ = w.set_focus();
    }
    update_dock(app);
}

/// A window's outer rectangle in desktop units (see `capture::unit_scale`).
fn window_area(w: &WebviewWindow) -> Option<Rect> {
    let (p, s) = (w.outer_position().ok()?, w.outer_size().ok()?);
    let k = capture::unit_scale(w.scale_factor().ok()?);
    Some(Rect {
        x: f64::from(p.x) / k,
        y: f64::from(p.y) / k,
        w: f64::from(s.width) / k,
        h: f64::from(s.height) / k,
    })
}

/// Pixel positions only line up across mixed-DPI displays on Windows and Linux; macOS needs points.
fn move_window(w: &WebviewWindow, (x, y): (f64, f64)) {
    let _ = if cfg!(target_os = "macos") {
        w.set_position(tauri::LogicalPosition::new(x, y))
    } else {
        w.set_position(tauri::PhysicalPosition::new(
            x.round() as i32,
            y.round() as i32,
        ))
    };
}

/// Where to move a window whose title bar is on no display: centred on `fallback` (top-left if too big).
fn rescue_position(win: Rect, displays: &[Rect], fallback: Rect) -> Option<(f64, f64)> {
    let title_bar = (win.x + win.w / 2.0, win.y + 16.0);
    if displays.iter().any(|d| d.contains(title_bar)) {
        return None;
    }
    Some((
        fallback.x + ((fallback.w - win.w) / 2.0).max(0.0),
        fallback.y + ((fallback.h - win.h) / 2.0).max(0.0),
    ))
}

/// Brings back windows left off screen, e.g. on an unplugged monitor or restored across mixed DPI.
fn keep_on_screen(app: &AppHandle, w: &WebviewWindow) {
    let (Some(win), Ok(monitors), Ok(fallback)) = (
        window_area(w),
        app.available_monitors(),
        capture::monitor_at_cursor(app),
    ) else {
        return;
    };
    let displays: Vec<Rect> = monitors.iter().map(capture::monitor_area).collect();
    if let Some(p) = rescue_position(win, &displays, capture::monitor_area(&fallback)) {
        move_window(w, p);
    }
}

/// Hides the main window (e.g. before a capture) and drops the Dock icon if nothing else is open.
#[tauri::command]
fn hide_main(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("home") {
        w.hide().map_err(err)?;
    }
    update_dock(&app);
    Ok(())
}

fn raw_body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        InvokeBody::Json(_) => Err("Expected binary data.".into()),
    }
}

/// Registers `action -> accelerator` (empty disables) and returns the ones that failed, with why.
#[tauri::command]
fn set_shortcuts(
    app: AppHandle,
    state: State<'_, Shortcuts>,
    shortcuts: HashMap<String, String>,
) -> HashMap<String, String> {
    if capture::is_wayland() {
        return HashMap::new();
    }
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let mut ids = state.0.lock().unwrap();
    ids.clear();
    let mut failed = HashMap::new();
    for (action, accelerator) in wanted_shortcuts(shortcuts) {
        let registered = accelerator
            .parse::<Shortcut>()
            .map_err(err)
            .and_then(|s| gs.register(s).map(|()| s.id()).map_err(err));
        match registered {
            Ok(id) => {
                ids.insert(id, action);
            }
            Err(e) => {
                failed.insert(action, e);
            }
        }
    }
    failed
}

#[tauri::command]
fn take_pending(state: State<'_, Pending>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[tauri::command]
async fn copy_png(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let img = image::load_from_memory_with_format(raw_body(&request)?, ImageFormat::Png)
        .map_err(err)?
        .into_rgba8();
    let (w, h) = img.dimensions();
    app.clipboard()
        .write_image(&tauri::image::Image::new_owned(img.into_raw(), w, h))
        .map_err(err)
}

#[tauri::command]
fn copy_text(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(err)
}

/// Writes only to the path the user picks; returns false if they cancel.
#[tauri::command]
async fn save_file(app: AppHandle, request: Request<'_>) -> Result<bool, String> {
    let bytes = raw_body(&request)?;
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("Daguerre");
    let Some(path) = app.dialog().file().set_file_name(name).blocking_save_file() else {
        return Ok(false);
    };
    std::fs::write(path.into_path().map_err(err)?, bytes).map_err(err)?;
    Ok(true)
}

#[tauri::command]
fn print(window: WebviewWindow) -> Result<(), String> {
    window.print().map_err(err)
}

/// Opens the screenshot in its own editor window, or focuses it if it's already open.
#[tauri::command]
async fn open_editor(app: AppHandle, id: String) -> Result<(), String> {
    let label = editor_label(&id).ok_or("Unknown screenshot.")?;
    let window = match app.get_webview_window(&label) {
        Some(w) => w,
        None => {
            let w = WebviewWindowBuilder::new(
                &app,
                &label,
                WebviewUrl::App(format!("editor.html?id={id}").into()),
            )
            .title("Daguerre Editor")
            .inner_size(1280.0, 820.0)
            .min_inner_size(820.0, 520.0)
            .build()
            .map_err(err)?;
            // Editors share one remembered position; cascade so a new one doesn't cover the last.
            let furthest = app
                .webview_windows()
                .into_iter()
                .filter(|(l, _)| l.starts_with("editor-") && *l != label)
                .filter_map(|(_, other)| window_area(&other))
                .max_by(|a, b| (a.x + a.y).total_cmp(&(b.x + b.y)));
            if let Some(r) = furthest {
                let k = w.scale_factor().unwrap_or(1.0);
                let step = 28.0 * k / capture::unit_scale(k);
                move_window(&w, (r.x + step, r.y + step));
            }
            w
        }
    };
    let _ = window.unminimize();
    keep_on_screen(&app, &window);
    window.show().map_err(err)?;
    window.set_focus().map_err(err)?;
    update_dock(&app);
    Ok(())
}

fn external_url(url: &str) -> Option<&str> {
    let bad = |c: char| c.is_whitespace() || c.is_control() || matches!(c, '"' | '\'' | '\\');
    let valid = url.starts_with("https://") && url.len() > 8 && !url.chars().any(bad);
    valid.then_some(url)
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    let target = external_url(&url).ok_or("Invalid external URL.")?;
    let mut cmd = if cfg!(target_os = "macos") {
        std::process::Command::new("/usr/bin/open")
    } else if cfg!(target_os = "windows") {
        let mut c = std::process::Command::new("rundll32");
        c.arg("url.dll,FileProtocolHandler");
        c
    } else {
        std::process::Command::new("xdg-open")
    };
    cmd.arg(target).spawn().map(|_| ()).map_err(err)
}

/// Brings the main window forward on a section: capture, history or settings.
#[tauri::command]
fn show_main(app: AppHandle, page: String) -> Result<(), String> {
    if !PAGES.contains(&page.as_str()) {
        return Err("Unknown page.".into());
    }
    show_home(&app);
    app.emit_to("home", "navigate", page).map_err(err)
}

#[derive(Serialize)]
struct Platform {
    os: &'static str,
    wayland: bool,
}

#[tauri::command]
fn platform() -> Platform {
    Platform {
        os: std::env::consts::OS,
        wayland: capture::is_wayland(),
    }
}

#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

/// macOS needs Screen Recording access; `request` clears any stale ad-hoc build entry and prompts.
#[tauri::command]
fn screen_access(app: AppHandle, request: bool) -> bool {
    #[cfg(target_os = "macos")]
    unsafe {
        if CGPreflightScreenCaptureAccess() {
            return true;
        }
        if request {
            // Ad-hoc builds change cdhash on every rebuild, leaving a stale TCC entry that looks
            // enabled in System Settings and blocks a new prompt until reset.
            let _ = std::process::Command::new("/usr/bin/tccutil")
                .args(["reset", "ScreenCapture", &app.config().identifier])
                .status();
            CGRequestScreenCaptureAccess()
        } else {
            false
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, request);
        true
    }
}

fn white_tray_icon() -> tauri::image::Image<'static> {
    let img = image::load_from_memory_with_format(
        include_bytes!("../icons/tray-white.png"),
        ImageFormat::Png,
    )
    .expect("valid tray-white.png")
    .into_rgba8();
    let (w, h) = img.dimensions();
    tauri::image::Image::new_owned(img.into_raw(), w, h)
}

#[tauri::command]
fn set_tray_icon(app: AppHandle, icon: String) -> Result<(), String> {
    if !TRAY_ICONS.contains(&icon.as_str()) {
        return Err("Unknown tray icon.".into());
    }
    let Some(tray) = app.tray_by_id("main") else {
        return Ok(());
    };
    let mono = icon == "white";
    let image = if mono {
        Some(white_tray_icon())
    } else {
        app.default_window_icon().cloned()
    };
    tray.set_icon(image).map_err(err)?;
    // A template image is tinted by macOS: black on a light menu bar, white on a dark one.
    tray.set_icon_as_template(mono).map_err(err)
}

#[cfg(target_os = "macos")]
#[repr(C)]
#[derive(Clone, Copy)]
struct NSRect {
    origin: [f64; 2],
    size: [f64; 2],
}

#[cfg(target_os = "macos")]
unsafe impl objc2::encode::Encode for NSRect {
    const ENCODING: objc2::encode::Encoding = {
        use objc2::encode::Encoding::{Double, Struct};
        Struct(
            "CGRect",
            &[
                Struct("CGPoint", &[Double, Double]),
                Struct("CGSize", &[Double, Double]),
            ],
        )
    };
}

/// Puts native Liquid Glass (macOS 26+) behind the page. Returns false where it doesn't exist.
#[tauri::command]
fn set_liquid_glass(window: WebviewWindow, on: bool) -> Result<bool, String> {
    apply_liquid_glass(&window, on).map_err(err)
}

fn apply_liquid_glass(window: &WebviewWindow, on: bool) -> tauri::Result<bool> {
    #[cfg(target_os = "macos")]
    {
        use objc2::{
            class, msg_send,
            rc::{Allocated, Retained},
            runtime::{AnyClass, AnyObject},
            sel,
        };
        let Some(class) = AnyClass::get(c"NSGlassEffectView") else {
            return Ok(false);
        };
        // A vibrancy view would sit on top of the glass and wash it out.
        window.set_effects(None::<tauri::utils::config::WindowEffectsConfig>)?;
        let win = window.clone();
        window.run_on_main_thread(move || unsafe {
            let Ok(ns) = win.ns_window() else { return };
            let ns = ns.cast::<AnyObject>();
            let content: *mut AnyObject = msg_send![ns, contentView];
            if content.is_null() {
                return;
            }
            let views: *mut AnyObject = msg_send![content, subviews];
            let count: usize = msg_send![views, count];
            let existing = (0..count)
                .map(|i| -> *mut AnyObject { msg_send![views, objectAtIndex: i] })
                .find(|&view| -> bool { msg_send![view, isKindOfClass: class] });
            // Dark glass whatever the system appearance: it blurs like the light one but
            // never turns the window white.
            let appearance: *mut AnyObject = if on {
                let name: *mut AnyObject = msg_send![
                    class!(NSString),
                    stringWithUTF8String: c"NSAppearanceNameDarkAqua".as_ptr()
                ];
                msg_send![class!(NSAppearance), appearanceNamed: name]
            } else {
                std::ptr::null_mut()
            };
            let _: () = msg_send![ns, setAppearance: appearance];
            if !on {
                if let Some(glass) = existing {
                    let _: () = msg_send![glass, removeFromSuperview];
                }
                return;
            }
            if existing.is_some() {
                return;
            }
            let bounds: NSRect = msg_send![content, bounds];
            let view: Allocated<AnyObject> = msg_send![class, alloc];
            let view: Retained<AnyObject> = msg_send![view, initWithFrame: bounds];
            // NSViewWidthSizable | NSViewHeightSizable
            let _: () = msg_send![&view, setAutoresizingMask: 18usize];
            let rounded: bool = msg_send![ns, respondsToSelector: sel!(_cornerRadius)];
            let radius: f64 = if rounded {
                msg_send![ns, _cornerRadius]
            } else {
                16.0
            };
            let _: () = msg_send![&view, setCornerRadius: radius];
            // NSWindowBelow every other subview, so the web view draws on top.
            let _: () = msg_send![
                content,
                addSubview: &*view,
                positioned: -1isize,
                relativeTo: std::ptr::null::<AnyObject>()
            ];
        })?;
        Ok(true)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (window, on);
        Ok(false)
    }
}

/// A saved Window design strength, 0-100; anything else (empty, garbage, old formats) is ignored.
fn parse_theme_blend(text: &str) -> Option<u8> {
    text.trim().parse::<u8>().ok().filter(|v| *v <= 100)
}

// WebKit flushes localStorage lazily, so a force quit can drop the last change; this file can't.
fn theme_blend_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    Some(app.path().app_config_dir().ok()?.join("theme-blend"))
}

#[tauri::command]
fn theme_blend(app: AppHandle) -> Option<u8> {
    parse_theme_blend(&std::fs::read_to_string(theme_blend_path(&app)?).ok()?)
}

#[tauri::command]
fn set_theme_blend(app: AppHandle, value: u8) -> Result<(), String> {
    use std::io::Write;
    if value > 100 {
        return Err("Window design must be between 0 and 100.".into());
    }
    let path = theme_blend_path(&app).ok_or("No settings folder.")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(err)?;
    }
    // Written aside and renamed, so a crash mid-write leaves the previous value intact.
    let temp = path.with_extension("tmp");
    let mut file = std::fs::File::create(&temp).map_err(err)?;
    file.write_all(value.to_string().as_bytes()).map_err(err)?;
    file.sync_all().map_err(err)?;
    std::fs::rename(&temp, &path).map_err(err)
}

fn tray(app: &AppHandle) -> tauri::Result<()> {
    let item = |id: &str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
    let window_capture = item("window", "Capture window")?;
    window_capture.set_enabled(!capture::is_wayland())?;
    let menu = Menu::with_items(
        app,
        &[
            &item("selection", "Capture selected area")?,
            &window_capture,
            &item("screen", "Capture screen")?,
            &item("copy-selection", "Copy selected area")?,
            &PredefinedMenuItem::separator(app)?,
            &item("open", "Open Daguerre")?,
            &item("history", "History")?,
            &item("settings", "Settings…")?,
            &PredefinedMenuItem::separator(app)?,
            &item("quit", "Quit Daguerre")?,
        ],
    )?;
    let tray = TrayIconBuilder::with_id("main")
        .tooltip("Daguerre")
        .icon(white_tray_icon())
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_home(app),
            page @ ("history" | "settings") => {
                let _ = show_main(app.clone(), page.into());
            }
            "quit" => app.exit(0),
            action => trigger(app, action),
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_home(tray.app_handle());
            }
        });
    tray.build(app)?;
    Ok(())
}

/// Identifies an executable on disk so a running menu-bar instance knows when it was replaced.
#[derive(Clone, Debug, PartialEq, Eq)]
struct BinaryId {
    #[cfg(unix)]
    id: (u64, u64),
    len: u64,
    modified: Option<std::time::SystemTime>,
}

impl BinaryId {
    fn of(path: impl AsRef<std::path::Path>) -> Option<Self> {
        let meta = std::fs::metadata(path).ok()?;
        Some(Self {
            #[cfg(unix)]
            id: {
                use std::os::unix::fs::MetadataExt;
                (meta.dev(), meta.ino())
            },
            len: meta.len(),
            modified: meta.modified().ok(),
        })
    }
}

fn watched_binaries() -> Vec<(std::path::PathBuf, Option<BinaryId>)> {
    let mut paths = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        paths.push(exe);
    }
    #[cfg(target_os = "macos")]
    {
        let installed =
            std::path::PathBuf::from("/Applications/Daguerre.app/Contents/MacOS/daguerre");
        if !paths.contains(&installed) {
            paths.push(installed);
        }
    }
    paths
        .into_iter()
        .map(|p| {
            let id = BinaryId::of(&p);
            (p, id)
        })
        .collect()
}

fn binaries_changed(watched: &[(std::path::PathBuf, Option<BinaryId>)]) -> bool {
    watched
        .iter()
        .any(|(path, initial)| BinaryId::of(path) != *initial)
}

pub fn run() {
    let self_id = std::env::current_exe().ok().and_then(BinaryId::of);
    let mut builder = tauri::Builder::default()
        // Must be first: a second launch forwards its arguments here and exits.
        .plugin(tauri_plugin_single_instance::init(
            move |app, args, _cwd| match capture_arg(&args) {
                Some(action) => trigger(app, action),
                None => {
                    // If the user launched a newer binary than the running one, hand off to it.
                    if let Some(launched) = args.first().filter(|p| {
                        self_id.is_some() && BinaryId::of(p).is_some_and(|id| Some(id) != self_id)
                    }) {
                        let rest = args[1..].to_vec();
                        let bin = launched.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(300));
                            let _ = std::process::Command::new(bin).args(rest).spawn();
                        });
                        app.exit(0);
                    } else {
                        show_home(app);
                    }
                }
            },
        ));
    if !capture::is_wayland() {
        builder = builder.plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state != ShortcutState::Pressed {
                        return;
                    }
                    let action = app
                        .state::<Shortcuts>()
                        .0
                        .lock()
                        .unwrap()
                        .get(&shortcut.id())
                        .cloned();
                    if let Some(action) = action {
                        trigger(app, &action);
                    }
                })
                .build(),
        );
    }
    builder
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            // Size and position only: visibility is decided at launch (`--hidden`).
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() - StateFlags::VISIBLE)
                .with_filter(|label| label == "home" || label.starts_with("editor-"))
                .map_label(|label| {
                    if label.starts_with("editor-") {
                        "editor"
                    } else {
                        label
                    }
                })
                .build(),
        )
        .manage(Shortcuts::default())
        .manage(Pending::default())
        .manage(capture::Captured::default())
        .manage(selection::Selection::default())
        .setup(|app| {
            // Tray utility until a window is shown; see `update_dock`.
            #[cfg(target_os = "macos")]
            {
                use tauri::window::{Effect, EffectState};

                app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                if let Some(window) = app.get_webview_window("home") {
                    window.set_theme(Some(tauri::Theme::Dark))?;
                    // Open with the saved glass, before the page loads; the page re-checks
                    // accessibility settings once it runs.
                    let blend = theme_blend(app.handle().clone()).unwrap_or(0);
                    if blend > 0 && !apply_liquid_glass(&window, true)? {
                        window.set_effects(
                            tauri::window::EffectsBuilder::new()
                                .effect(Effect::UnderWindowBackground)
                                .state(EffectState::Active)
                                .build(),
                        )?;
                    }
                }
            }
            tray(app.handle())?;
            // Close the older running instance when a new build is moved into /Applications.
            let watched = watched_binaries();
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                if binaries_changed(&watched) {
                    handle.exit(0);
                    break;
                }
            });
            let args: Vec<String> = std::env::args().collect();
            if let Some(action) = capture_arg(&args) {
                *app.state::<Pending>().0.lock().unwrap() = Some(action.into());
            } else if !args.iter().any(|a| a == "--hidden") {
                show_home(app.handle());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            let label = window.label();
            match event {
                // Home keeps running hidden: it handles shortcuts and tray commands.
                WindowEvent::CloseRequested { api, .. } if label == "home" => {
                    api.prevent_close();
                    let _ = window.hide();
                    update_dock(window.app_handle());
                }
                WindowEvent::Destroyed if label.starts_with("editor-") => {
                    update_dock(window.app_handle());
                }
                WindowEvent::Destroyed if label.starts_with("overlay-") => {
                    selection::cancel(window.app_handle());
                    update_dock(window.app_handle());
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            capture::capture_screen,
            capture::take_capture,
            selection::select,
            selection::overlay_frame,
            selection::overlay_info,
            selection::finish_selection,
            set_shortcuts,
            take_pending,
            copy_png,
            copy_text,
            save_file,
            print,
            open_editor,
            open_external,
            show_main,
            hide_main,
            platform,
            screen_access,
            set_tray_icon,
            set_liquid_glass,
            theme_blend,
            set_theme_blend,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Daguerre");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn rescues_windows_whose_title_bar_is_off_screen() {
        let r = |x, y, w, h| Rect { x, y, w, h };
        let laptop = r(0.0, 25.0, 1512.0, 857.0);
        let external = r(1512.0, -200.0, 2560.0, 1415.0);
        let displays = [laptop, external];
        // On either display, even when partly off it.
        let on_external = r(1800.0, 0.0, 1280.0, 820.0);
        assert_eq!(rescue_position(on_external, &displays, laptop), None);
        assert_eq!(
            rescue_position(r(-600.0, 100.0, 1280.0, 820.0), &displays, laptop),
            None
        );
        // Left on an unplugged display, or placed in the gap above the laptop.
        assert_eq!(
            rescue_position(on_external, &[laptop], laptop),
            Some((116.0, 43.5))
        );
        assert_eq!(
            rescue_position(r(100.0, -400.0, 1280.0, 820.0), &displays, laptop),
            Some((116.0, 43.5))
        );
        // Bigger than the display: its top-left corner.
        assert_eq!(
            rescue_position(r(5000.0, 0.0, 2560.0, 1600.0), &displays, laptop),
            Some((0.0, 25.0))
        );
    }

    #[test]
    fn reads_the_capture_argument() {
        assert_eq!(
            capture_arg(&args(&["daguerre", "--capture", "window"])),
            Some("window")
        );
        assert_eq!(capture_arg(&args(&["daguerre", "--capture", "nope"])), None);
        assert_eq!(capture_arg(&args(&["daguerre", "--capture"])), None);
        assert_eq!(capture_arg(&args(&["daguerre", "--hidden"])), None);
    }

    #[test]
    fn editor_windows_are_labelled_by_screenshot_id() {
        assert_eq!(
            editor_label("1b2c-3d4e").as_deref(),
            Some("editor-1b2c-3d4e")
        );
        assert_eq!(editor_label(""), None);
        assert_eq!(editor_label("x&y=../"), None);
        assert_eq!(editor_label("https://example.com"), None);
        assert_eq!(editor_label(&"a".repeat(65)), None);
    }

    #[test]
    fn registers_only_known_actions_with_keys() {
        let wanted = wanted_shortcuts(HashMap::from([
            ("selection".into(), "Alt+Shift+S".into()),
            ("window".into(), String::new()),
            ("format-disk".into(), "Alt+F".into()),
        ]));
        assert_eq!(wanted, vec![("selection".into(), "Alt+Shift+S".into())]);
    }

    #[test]
    fn dock_follows_visible_main_and_editor_windows() {
        assert!(!dock_visible([("home", false), ("overlay-0", true)]));
        assert!(dock_visible([("home", true)]));
        assert!(dock_visible([("home", false), ("editor-1", true)]));
        assert!(!dock_visible([("editor-1", false)]));
    }

    #[test]
    fn default_shortcuts_parse() {
        for accelerator in ["Alt+Shift+S", "Alt+Shift+V", "Alt+Shift+W", "Alt+Shift+C"] {
            assert!(accelerator.parse::<Shortcut>().is_ok(), "{accelerator}");
        }
    }

    #[test]
    fn reads_only_valid_saved_blends() {
        assert_eq!(parse_theme_blend("100\n"), Some(100));
        assert_eq!(parse_theme_blend("0"), Some(0));
        assert_eq!(parse_theme_blend("101"), None);
        assert_eq!(parse_theme_blend("-5"), None);
        assert_eq!(parse_theme_blend("NaN"), None);
        assert_eq!(parse_theme_blend(""), None);
    }

    #[test]
    fn white_tray_icon_is_white_on_transparent_background() {
        let icon = white_tray_icon();
        assert_eq!((icon.width(), icon.height()), (64, 64));
        let rgba = icon.rgba();
        // Top-left corner is transparent; the center dot is opaque white.
        assert_eq!(&rgba[..4], &[0, 0, 0, 0]);
        let center = ((32 * 64 + 32) * 4) as usize;
        assert_eq!(&rgba[center..center + 4], &[255, 255, 255, 255]);
    }

    #[test]
    fn detects_when_a_watched_binary_is_replaced_or_removed() {
        let path = std::env::temp_dir().join(format!("daguerre-bin-{}", std::process::id()));
        std::fs::write(&path, b"v1").unwrap();
        let watched = vec![(path.clone(), BinaryId::of(&path))];
        assert!(!binaries_changed(&watched));
        std::fs::write(&path, b"v2-longer").unwrap();
        assert!(binaries_changed(&watched));
        std::fs::remove_file(&path).unwrap();
        assert!(binaries_changed(&watched));
    }

    #[test]
    fn allows_only_clean_https_external_urls() {
        assert_eq!(
            external_url("https://buymeacoffee.com/projectra"),
            Some("https://buymeacoffee.com/projectra")
        );
        assert_eq!(external_url("https://"), None);
        assert_eq!(external_url("http://buymeacoffee.com/projectra"), None);
        assert_eq!(external_url("javascript:alert(1)"), None);
        assert_eq!(external_url("https://example.com/a b"), None);
        assert_eq!(external_url("https://example.com/\"quote\""), None);
    }
}
