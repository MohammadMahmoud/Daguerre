mod capture;
mod selection;

use std::{collections::HashMap, sync::Mutex};

use capture::err;
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
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    update_dock(app);
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
                .filter_map(|(_, other)| other.outer_position().ok())
                .max_by_key(|p| p.x + p.y);
            if let Some(p) = furthest {
                let step = (28.0 * w.scale_factor().unwrap_or(1.0)) as i32;
                let _ = w.set_position(tauri::PhysicalPosition::new(p.x + step, p.y + step));
            }
            w
        }
    };
    let _ = window.unminimize();
    window.show().map_err(err)?;
    window.set_focus().map_err(err)?;
    update_dock(&app);
    Ok(())
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
        wayland: std::env::var("XDG_SESSION_TYPE").is_ok_and(|s| s == "wayland"),
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
    let image = match icon.as_str() {
        "white" => Some(white_tray_icon()),
        _ => app.default_window_icon().cloned(),
    };
    tray.set_icon(image).map_err(err)
}

fn tray(app: &AppHandle) -> tauri::Result<()> {
    let item = |id: &str, text: &str| MenuItem::with_id(app, id, text, true, None::<&str>);
    let menu = Menu::with_items(
        app,
        &[
            &item("selection", "Capture selected area")?,
            &item("window", "Capture window")?,
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
    tauri::Builder::default()
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
        ))
        .plugin(
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
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
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
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);
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
            show_main,
            hide_main,
            platform,
            screen_access,
            set_tray_icon,
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
}
