# Changelog

All notable changes to Daguerre are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

The Chrome extension and the desktop app are versioned and released separately: extension sections are headed `## [Extension x.y.z]` (version in `public/manifest.json`, tag `ext-vx.y.z`), desktop sections `## [Desktop x.y.z]` (version in `src-tauri/Cargo.toml`, tag `desktop-vx.y.z`). Each release publishes its own section as the release notes. A change to shared code (the editor, History, export) goes in both.

## [Desktop 0.0.4] - 2026-11-04

### Added

- Settings → Updates: check GitHub for a new version, then download and install it.
- Optional automatic updates, checked at launch and once a day.

### Fixed

- Editor and main windows no longer open off screen with several displays (unplugged monitors, mixed Retina and standard displays).
- Wayland screenshot permission handling and recovery after stalled requests.
- Unsupported Wayland shortcuts and window capture controls.

### Changed

- Wayland captures use the desktop screenshot portal.
- Wayland Screen mode captures the whole desktop.

## [Extension Unreleased]

### Changed

- History asks before **Clear all** in its own dialog instead of the browser's.
- The extension remembers the export quality in the page's local storage; a previously chosen quality resets once to 80%.
- Releases are tagged `ext-v*` now, so desktop releases no longer bump the extension.

## [Extension 1.0.0] - 2026-10-22

### Added

- Capture the visible area, the entire page (scrolls, stitches, and hides repeated sticky headers), a selected area, or every tab in the window.
- Area selection that scrolls the page when you drag to the edge, so selections can be taller than the screen.
- Capture progress dialog with Cancel; keyboard shortcuts, right-click menu and a 3, 5 or 10 second delay.
- Editor with crop handles, arrows, shapes, pen, highlighter, text, numbered steps and pixelate. Edits stay re-editable and support undo and redo.
- Export to lossless PNG, compressed JPEG or WebP with live size estimates, multi-page PDF, searchable PDF, clipboard and print.
- On-device text recognition (English): Copy Text and searchable PDFs.
- Local-only history with search, filters, bulk delete and undo.
- Silver-and-black theme with light and dark modes.

### Security

- Minimal permissions: no `tabs` permission, and access to all sites is optional, requested only for All tabs. No remote code.
