// Declaring the app's commands generates allow-<command> permissions, so each window gets only what it needs.
const COMMANDS: &[&str] = &[
    "capture_screen",
    "take_capture",
    "select",
    "overlay_frame",
    "overlay_info",
    "finish_selection",
    "set_shortcuts",
    "take_pending",
    "copy_png",
    "copy_text",
    "save_file",
    "print",
    "open_editor",
    "show_main",
    "hide_main",
    "platform",
    "screen_access",
    "set_tray_icon",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
