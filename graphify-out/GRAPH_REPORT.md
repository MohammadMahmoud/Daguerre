# Graph Report - Daguerre (2026-11-18)

## Corpus Check

- 130 files · ~103,775 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 34 file(s) not represented in the graph (top: .toml 23, (none) 7, .plist 1)

## Summary

- 1248 nodes · 2585 edges · 110 communities (71 shown, 39 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.85)
- Token cost: 12,000 input · 3,500 output

## Graph Freshness

- Built from commit: `dfb4aa9c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- selection.rs
- Product Promo Assets
- Chrome Extension Manifest
- capture.rs
- Canvas Annotation Engine
- Tauri Application Configuration
- Clipboardext Module
- Db.ts
- Remotion Video Generation
- History.tsx
- Linux Wayland Portal Capture
- Live Text OCR Engine
- Extension Background Capture
- Home.tsx
- Liquid Glass Desktop Theme
- Desktop Settings and Shortcuts
- Product Promo Assets
- Export.ts
- Screen Region Cropping
- With Module
- Interactive Editor Canvas
- Tsconfig Module
- devDependencies
- Overlay Html Host Module
- Chrome Extension Manifest
- Updater.ts
- Popup Html Host Module
- Name Module
- With Module
- Interactive Editor Canvas
- Package Module
- Interactive Editor Canvas
- CI Verification Workflow
- Apple Certificate Module
- Live Text OCR Engine
- Interactive Editor Canvas
- Eslint.Config.Js Module
- Steps Module
- Name Module
- Release Ref Module
- pick
- dock_visible
- Bumpversion Module
- Dependabot Automation
- Chrome Extension Id Module
- Target Version Module
- Icons Module
- Args() Module
- Husky Module
- Pending Module
- Name Module
- Permissions Module
- Steps Module
- Packageextension Module
- Live Text OCR Engine
- Releaseautomation.Test Module
- Automated Release Pipeline
- Generateassets Module
- Changed Module
- Interactive Editor Canvas
- Home Module
- Overlay Module
- Themecontrast.Test Module
- Test Module
- Encode Module
- Image Module
- Live Text OCR Engine
- Request Module
- Lint-Staged Module
- Repository Module
- .Prettierrc Module
- Build Module
- Definition Of Done Module
- select
- Lint-Staged@^17.6.0 Module
- Remotion Video Generation
- CapturePage.tsx
- filter_window
- take_capture
- @Types/Node@^26.6.5 Module
- jsdom@^26.1.0
- prettier@^3.9.10
- husky@^9.1.7
- @Vitejs/Plugin-React@^6.1.2 Module
- Daguerre Module
- @tauri-apps/cli@^2.12.4
- @testing-library/dom@^10.4.2
- @vitest/coverage-v8@^5.0.5
- typescript@^7.0.2

## God Nodes (most connected - your core abstractions)

1. `Editor()` - 63 edges
2. `vitest` - 38 edges
3. `react` - 36 edges
4. `Home()` - 30 edges
5. `scripts` - 27 edges
6. `remotion` - 25 edges
7. `History()` - 23 edges
8. `with` - 22 edges
9. `THEME` - 21 edges
10. `addShot()` - 18 edges

## Surprising Connections (you probably didn't know these)

- `Live Text OCR & Searchable PDF` --implements--> `OcrService` [INFERRED]
  README.md → src/lib/OcrService.ts
- `Annotation Suite` --implements--> `bounds()` [INFERRED]
  README.md → src/editor/Draw.ts
- `Annotation Screenshot` --references--> `bounds()` [INFERRED]
  store/screenshots/1-annotate.png → src/editor/Draw.ts
- `Capture Engine` --implements--> `CapturePage()` [INFERRED]
  README.md → src/desktop/CapturePage.tsx
- `Desktop Capture Screenshot` --references--> `CapturePage()` [INFERRED]
  store/desktop/1-capture.png → src/desktop/CapturePage.tsx

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Capture and Edit Workflow** — readme_capture_engine, readme_annotation_suite, readme_live_text_ocr [INFERRED 0.95]

## Communities (110 total, 39 thin omitted)

### Community 0 - "selection.rs"

Cohesion: 0.14
Nodes (16): activate_app(), cursor_point(), CursorPoint, finish_selection(), keeps_windows_overlapping_the_monitor(), maps_cursor_onto_monitor_units_only_when_inside(), overlay_frame(), overlay_info() (+8 more)

### Community 1 - "Product Promo Assets"

Cohesion: 0.10
Nodes (44): react, remotion, AUDIO_MARKERS, AudioTrigger, ChromeWebStoreBadge(), DaguerreAppIcon(), DaguerreLogoSvg(), GitHubBadge() (+36 more)

### Community 2 - "Chrome Extension Manifest"

Cohesion: 0.06
Nodes (42): action, default_icon, default_popup, default_title, background, service_worker, type, description (+34 more)

### Community 3 - "capture.rs"

Cohesion: 0.12
Nodes (20): capture_screen(), CaptureInfo, centre_point(), centre_point_converts_pixels_to_points(), clamps_to_the_capture(), detects_wayland_without_requiring_xdg_session_type(), encode_png(), encodes_a_png() (+12 more)

### Community 4 - "Canvas Annotation Engine"

Cohesion: 0.09
Nodes (29): Annotation Suite, COLORS, Drag, bounds(), constrain(), distToSegment(), drawShape(), font() (+21 more)

### Community 5 - "Tauri Application Configuration"

Cohesion: 0.06
Nodes (34): app, macOSPrivateApi, security, windows, build, beforeBuildCommand, beforeDevCommand, frontendDist (+26 more)

### Community 6 - "Clipboardext Module"

Cohesion: 0.07
Nodes (16): ACTIONS, allows_only_clean_https_external_urls(), args(), capture_arg(), CGPreflightScreenCaptureAccess(), CGRequestScreenCaptureAccess(), external_url(), open_external() (+8 more)

### Community 7 - "Db.ts"

Cohesion: 0.05
Nodes (43): Clipboard HTML Host, @testing-library/react, vitest, save(), remove(), addShot(), clearShots(), deleteShots() (+35 more)

### Community 8 - "Remotion Video Generation"

Cohesion: 0.07
Nodes (27): scripts, assets:capture, assets:generate, build, changelog:update, coverage, coverage:badge, desktop:build (+19 more)

### Community 9 - "History.tsx"

Cohesion: 0.20
Nodes (18): dayLabel(), FILTERS, History(), clearAll(), copy(), CaptureMode, CAPTURE_HINT, CAPTURE_MODES (+10 more)

### Community 10 - "Linux Wayland Portal Capture"

Cohesion: 0.12
Nodes (9): accepts_only_local_screenshot_files(), cancellation_does_not_require_a_screenshot_uri(), portal_request_lifecycle(), preserves_permission_failure_instead_of_falling_back(), request(), screenshot(), screenshot_path(), screenshot_response() (+1 more)

### Community 11 - "Live Text OCR Engine"

Cohesion: 0.11
Nodes (20): Live Text OCR & Searchable PDF, tesseract.js, LiveTextLayer(), PdfImage, asset(), getWorker(), isSegment(), isWord() (+12 more)

### Community 12 - "Extension Background Capture"

Cohesion: 0.18
Nodes (23): Area, capture(), captureAllTabs(), captureFullPage(), captureSelection(), COMMANDS, copyCapture(), grab() (+15 more)

### Community 13 - "Home.tsx"

Cohesion: 0.14
Nodes (13): Home HTML Host, Home(), changeBlend(), loadThemeBlend(), openExternal(), Page, PAGES, root (+5 more)

### Community 14 - "Liquid Glass Desktop Theme"

Cohesion: 0.13
Nodes (17): runCapture(), sleep(), copy(), Action, CAPTURE_HINT, CAPTURE_MODES, copyPng(), copyText() (+9 more)

### Community 15 - "Desktop Settings and Shortcuts"

Cohesion: 0.20
Nodes (16): SettingsPage(), record(), TRAY_ICONS, TrayIcon, UpdateButton(), updateMessage(), ACTION_LABELS, formatShortcut() (+8 more)

### Community 16 - "Product Promo Assets"

Cohesion: 0.11
Nodes (9): puppeteer-core@^25.16.0, puppeteer-core, rows, { total }, css, css, declared, files() (+1 more)

### Community 17 - "Export.ts"

Cohesion: 0.28
Nodes (11): buildPdf(), canvasToBlob(), canvasToPdf(), fileName(), formatBytes(), hostOf(), jpeg, WIN_ANSI (+3 more)

### Community 18 - "Screen Region Cropping"

Cohesion: 0.12
Nodes (26): clamp(), handleAt(), Editor(), applyCrop(), autoScroll(), commit(), commitText(), copy() (+18 more)

### Community 19 - "With Module"

Cohesion: 0.10
Nodes (21): with, body_path, cache, client-id, client-secret, extension-id, fail_on_unmatched_files, fetch-depth (+13 more)

### Community 20 - "Interactive Editor Canvas"

Cohesion: 0.15
Nodes (16): driver.js@^1.10.2, driver.js, createSample(), DEMO_SHAPES, EDITOR_STATES, getTarget(), Preview, ProductTour() (+8 more)

### Community 21 - "Tsconfig Module"

Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 22 - "devDependencies"

Cohesion: 0.11
Nodes (18): devDependencies, fake-indexeddb@^6.2.6, remotion@^4.0.542, @remotion/shapes@^4.0.542, @testing-library/react@^16.3.3, @types/chrome@^0.3.6, @types/react@^19.3.0, @types/react-dom@^19.3.0 (+10 more)

### Community 23 - "Overlay Html Host Module"

Cohesion: 0.15
Nodes (16): Overlay HTML Host, @tauri-apps/api, applyEditorGlass(), loadBlend(), watchEditorGlass(), finish(), inside(), Overlay() (+8 more)

### Community 24 - "Chrome Extension Manifest"

Cohesion: 0.22
Nodes (10): readVersions(), buildDesktop(), require, resolveAppleSigningIdentity(), resolveCargoEnv(), PRODUCTS, readVersion(), releaseNotes() (+2 more)

### Community 25 - "Updater.ts"

Cohesion: 0.43
Nodes (5): @tauri-apps/plugin-process, @tauri-apps/plugin-updater, Updater, UpdateState, useUpdater()

### Community 26 - "Popup Html Host Module"

Cohesion: 0.11
Nodes (22): react-dom@^19.3.1, Popup HTML Host, Extension App Icon 128px, react-dom, MenuItem(), Progress, ACTIONS, DELAYS (+14 more)

### Community 27 - "Name Module"

Cohesion: 0.15
Nodes (14): if, name, runs-on, strategy, strategy, args, name, os (+6 more)

### Community 28 - "With Module"

Cohesion: 0.14
Nodes (14): with, cache, cache-all-crates, components, fetch-depth, if-no-files-found, key, name (+6 more)

### Community 29 - "Interactive Editor Canvas"

Cohesion: 0.32
Nodes (12): is_wayland(), copy_text(), hide_main(), run(), set_theme_blend(), show_home(), show_main(), theme_blend() (+4 more)

### Community 30 - "Package Module"

Cohesion: 0.14
Nodes (13): author, description, engines, node, homepage, keywords, license, main (+5 more)

### Community 31 - "Interactive Editor Canvas"

Cohesion: 0.19
Nodes (14): Tauri App Icon, monitor_area(), unit_scale(), apply_liquid_glass(), editor_label(), editor_windows_are_labelled_by_screenshot_id(), keep_on_screen(), move_window() (+6 more)

### Community 32 - "CI Verification Workflow"

Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, if, name, needs, runs-on, jobs (+4 more)

### Community 33 - "Apple Certificate Module"

Cohesion: 0.15
Nodes (13): APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_ID, APPLE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_TEAM_ID, BASE_REF, BEFORE (+5 more)

### Community 34 - "Live Text OCR Engine"

Cohesion: 0.17
Nodes (12): dependencies, react@^19.3.1, @tauri-apps/api@^2.12.4, @tauri-apps/plugin-autostart@^2.7.0, @tauri-apps/plugin-process@^2.4.0, @tauri-apps/plugin-updater@^2.14.1, tesseract.js@^7.0.0, @tesseract.js-data/deu@^1.0.0 (+4 more)

### Community 35 - "Interactive Editor Canvas"

Cohesion: 0.15
Nodes (13): Architecture Map, Release Ownership, Release Changelog, Editor HTML Host, History HTML Host, Daguerre Overview, Compressed, root (+5 more)

### Community 36 - "Eslint.Config.Js Module"

Cohesion: 0.18
Nodes (10): eslint@^10.13.0, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, globals@^17.13.0, typescript-eslint@^8.72.1, eslint, @eslint/js, eslint-plugin-react-hooks (+2 more)

### Community 37 - "Steps Module"

Cohesion: 0.35
Nodes (11): steps, steps, steps, id, if, name, run, shell (+3 more)

### Community 38 - "Name Module"

Cohesion: 0.18
Nodes (11): name, url, pages, environment, if, name, needs, permissions (+3 more)

### Community 39 - "Release Ref Module"

Cohesion: 0.18
Nodes (11): release_ref, on, pull_request, push, workflow_call, workflow_dispatch, branches, default (+3 more)

### Community 40 - "pick"

Cohesion: 0.24
Nodes (11): cancels_on_nothing_or_an_empty_region(), crop(), crops_a_region_in_capture_pixels(), Frame, frame(), pick(), Picked, Region (+3 more)

### Community 42 - "Bumpversion Module"

Cohesion: 0.47
Nodes (7): bumpVersion(), getPreviousTag(), git(), validateVersion(), getReleaseSection(), summarize(), updateChangelog()

### Community 43 - "Dependabot Automation"

Cohesion: 0.20
Nodes (9): minor-and-patch, update-types, interval, updates, directory, groups, package-ecosystem, schedule (+1 more)

### Community 44 - "Chrome Extension Id Module"

Cohesion: 0.22
Nodes (9): CHROME_EXTENSION_ID, TARGET_VERSION, VERSION, publish, env, name, needs, runs-on (+1 more)

### Community 45 - "Target Version Module"

Cohesion: 0.22
Nodes (9): target_version, on, push, workflow_dispatch, branches, description, required, type (+1 more)

### Community 46 - "Icons Module"

Cohesion: 0.42
Nodes (8): chunk(), crc32(), CRC_TABLE, encodePng(), insideRoundedRect(), isInk(), render(), renderTray()

### Community 47 - "Args() Module"

Cohesion: 0.60
Nodes (4): binaries_changed(), BinaryId, detects_when_a_watched_binary_is_replaced_or_removed(), watched_binaries()

### Community 48 - "Husky Module"

Cohesion: 0.25
Nodes (8): HUSKY, prepare, sha, version, env, name, outputs, runs-on

### Community 49 - "Pending Module"

Cohesion: 0.29
Nodes (6): Pending, registers_only_known_actions_with_keys(), set_shortcuts(), Shortcuts, take_pending(), wanted_shortcuts()

### Community 50 - "Name Module"

Cohesion: 0.29
Nodes (7): name, needs, secrets, uses, with, build, release_ref

### Community 51 - "Permissions Module"

Cohesion: 0.29
Nodes (7): permissions, permissions, contents, id-token, pages, permissions, permissions

### Community 52 - "Steps Module"

Cohesion: 0.38
Nodes (7): steps, steps, id, if, name, run, uses

### Community 53 - "Packageextension Module"

Cohesion: 0.48
Nodes (5): buildCrxBuffer(), encodeField(), encodeVarint(), packageExtension(), verifyExtension()

### Community 54 - "Live Text OCR Engine"

Cohesion: 0.33
Nodes (3): ocrAssets(), require, stripCdn()

### Community 55 - "Releaseautomation.Test Module"

Cohesion: 0.33
Nodes (4): createRepository(), git(), root, temporary

### Community 57 - "Automated Release Pipeline"

Cohesion: 0.33
Nodes (5): concurrency, cancel-in-progress, group, jobs, name

### Community 58 - "Generateassets Module"

Cohesion: 0.47
Nodes (4): createSolidPng(), chunk(), crc32(), generateAssets()

### Community 59 - "Changed Module"

Cohesion: 0.40
Nodes (5): classify(), DESKTOP, EXTENSION, NEITHER, under()

### Community 61 - "Interactive Editor Canvas"

Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 62 - "Home Module"

Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 63 - "Overlay Module"

Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 64 - "Themecontrast.Test Module"

Cohesion: 0.40
Nodes (3): contrast(), css, luminance()

### Community 65 - "Test Module"

Cohesion: 0.40
Nodes (5): test, desktop, name, outputs, runs-on

### Community 68 - "Image Module"

Cohesion: 0.50
Nodes (3): set_tray_icon(), white_tray_icon(), white_tray_icon_is_white_on_transparent_background()

### Community 69 - "Live Text OCR Engine"

Cohesion: 0.50
Nodes (3): allowBuilds, esbuild, tesseract.js

### Community 70 - "Request Module"

Cohesion: 0.83
Nodes (3): copy_png(), raw_body(), save_file()

### Community 71 - "Lint-Staged Module"

Cohesion: 0.67
Nodes (3): lint-staged, *.{json,md,yml,yaml,html,css}, *.{ts,tsx,js,mjs,cjs}

### Community 72 - "Repository Module"

Cohesion: 0.67
Nodes (3): repository, type, url

### Community 77 - "select"

Cohesion: 0.43
Nodes (7): cancel(), close_overlays(), Kind, Region, Window, overlay_window(), select()

### Community 80 - "CapturePage.tsx"

Cohesion: 0.18
Nodes (12): Capture Engine, CapturePage(), DELAYS, MODES, when(), Shortcuts, Shot, IconName (+4 more)

### Community 81 - "filter_window"

Cohesion: 0.36
Nodes (7): filter_window(), filters_windows_by_layer_alpha_onscreen_and_system_apps(), PickableWindow, raw_window(), raw_windows(), RawWindow, windows_on()

## Knowledge Gaps

- **26 isolated node(s):** `Region`, `Window`, `daguerre`, `Clipboard HTML Host`, `Live Text OCR & Searchable PDF` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 491 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `Architecture Map` connect `Interactive Editor Canvas` to `Interactive Editor Canvas`?**
  _High betweenness centrality (0.208) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Editor()` (e.g. with `print()` and `redo()`) actually correct?**
  _`Editor()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Region`, `Window`, `daguerre` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `selection.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.13675213675213677 - nodes in this community are weakly interconnected._
- **Why does `Compressed` connect `Interactive Editor Canvas` to `Canvas Annotation Engine`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Home()` (e.g. with `loadThemeBlend()` and `loadShortcuts()`) actually correct?**
  _`Home()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Product Promo Assets` be split into smaller, more focused modules?**
  _Cohesion score 0.10343814281516309 - nodes in this community are weakly interconnected._
