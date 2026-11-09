# Changelog

All notable changes to Daguerre are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

New releases synchronize the desktop app and browser extension under one `vX.Y.Z` tag. Release CI turns the `## [Unreleased]` section below into `## [vX.Y.Z] - YYYY-MM-DD` and uses it verbatim as the GitHub Release body; without one, it generates Added, Fixed and Changed entries from commit messages. Version files are updated on remote main, not by local hooks. Earlier product-specific Desktop and Extension sections remain unchanged as historical records.

## [Unreleased]

### Added

- Both: added a native **Support** (Buy Me a Coffee) section with a monochrome coffee icon in the desktop sidebar (below **Product Tour**), the Chrome extension popup (below **Copy selected area**), and `README.md`.
- Desktop: added a validated `open_external` Tauri command to open external `https://` links in the system's default browser.
- Extension: `pnpm build` and `scripts/package-extension.mjs` now generate a signed CRX3 archive (`daguerre.crx`) alongside `dist/` and `daguerre.zip`, and GitHub Releases attach `daguerre-extension-vX.Y.Z.crx`.
- Extension: added the Chrome Web Store badge and direct store installation links in `README.md` and the interactive showcase (`store/index.html`).

### Fixed

- Extension: Windows packaging in `scripts/package-extension.mjs` uses `tar` when creating `daguerre.zip`.
- Both: release verification tests handle CRLF line endings when reading `src-tauri/Cargo.lock`.

### Changed

- Both: consolidated change detection and extension packaging into the CI `test` job, removed duplicate pre-tag release checks in `release.yml`, and updated `pnpm package` to alias `pnpm build`.
- Desktop: skipped `desktop-check` during release/manual runs so `desktop-build` starts immediately in parallel with `test` instead of compiling Rust twice across all three OS runners.
- Both: added author, homepage, and repository metadata to `package.json`, renamed `AGENT.md` to `AGENTS.md` with the post-task verification checklist, and removed obsolete `store/listing.md` and `to-do.md`.

## [v1.0.2] - 2026-11-06

### Added

### Fixed

- Ensure drive is called once after onboarding tour completion.

### Changed

## [v1.0.1] - 2026-11-06

### Added

- Desktop: an interactive 14-step product tour opens on first launch. It walks through all four capture modes, the editor tools, Copy Text, export options and themes, using a temporary sample that never touches your History, clipboard or settings.
- Desktop: replay the tour anytime from **Product Tour**, directly below Settings.
- Desktop: Windows and Linux get dedicated **Light**, **Dark** and **System** themes, which also apply to editor windows.
- Editor: every annotation tool shows its name below its icon, so you can find Pixelate, Steps, Text, Arrow and the shapes without hovering.
- Editor: collapse or expand the annotation toolbar to give the screenshot more room.
- Every GitHub release now includes the browser extension as a ready-to-load `dist` folder next to the desktop installers.

### Fixed

- Desktop: Liquid Glass is applied only on macOS. On Windows and Linux, an earlier glass setting switches to the Dark theme instead of a transparent window.
- Desktop: a saved glass strength no longer flashes before the app confirms it is running on macOS.
- Documentation links point to the correct repository.

### Changed

- The desktop app and browser extension now share one version number and are released together.
- Desktop: **Copy selected area** is shown as its own action below the three capture modes.
- Desktop: **Settings → Appearance** groups the theme choice and, on macOS, the Liquid Glass slider.
- History asks before **Clear all** in its own dialog instead of the browser's.
- The extension remembers the export quality in the page's local storage; a previously chosen quality resets once to 80%.

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
