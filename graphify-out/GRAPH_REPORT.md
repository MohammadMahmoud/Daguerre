# Graph Report - Daguerre (2026-11-28)

## Corpus Check

- 136 files · ~110,358 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 35 file(s) not represented in the graph (top: .toml 24, (none) 7, .plist 1)

## Summary

- 1303 nodes · 2752 edges · 107 communities (74 shown, 33 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 55 edges (avg confidence: 0.85)
- Token cost: 12,000 input · 3,500 output

## Graph Freshness

- Built from commit: `c1e26abe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- DocumentImport.ts
- Product Promo Assets
- Chrome Extension Manifest
- selection.rs
- Editor.tsx
- Tauri Application Configuration
- Clipboardext Module
- vitest
- Remotion Video Generation
- Setup.ts
- Linux Wayland Portal Capture
- Live Text OCR Engine
- Extension Background Capture
- Home.tsx
- Liquid Glass Desktop Theme
- Desktop Settings and Shortcuts
- Product Promo Assets
- unit/Editor.test.tsx
- putShots
- With Module
- Interactive Editor Canvas
- Tsconfig Module
- devDependencies
- Overlay Html Host Module
- Chrome Extension Manifest
- capture_arg
- Popup.tsx
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
- test/Chrome.ts
- dock_visible
- Bumpversion Module
- Dependabot Automation
- Chrome Extension Id Module
- tag
- Icons Module
- Args() Module
- verify
- Pending Module
- Name Module
- Permissions Module
- Steps Module
- Packageextension Module
- Live Text OCR Engine
- Releaseautomation.Test Module
- Automated Release Pipeline
- Editor
- Changed Module
- Interactive Editor Canvas
- Home Module
- Overlay Module
- Themecontrast.Test Module
- Test Module
- Encode Module
- @tauri-apps/cli@^2.12.4
- Live Text OCR Engine
- Request Module
- Lint-Staged Module
- Repository Module
- .Prettierrc Module
- Build Module
- Definition Of Done Module
- Home.test.tsx
- @testing-library/dom@^10.4.2
- @vitejs/plugin-react
- Export.ts
- platform/Chrome.ts
- Updater.ts
- Background.test.ts
- Capture.ts
- dragTo
- @tauri-apps/api
- vitest
- Daguerre Module
- lint-staged@^17.6.0

## God Nodes (most connected - your core abstractions)

1. `Editor()` - 67 edges
2. `vitest` - 41 edges
3. `react` - 36 edges
4. `Home()` - 35 edges
5. `scripts` - 27 edges
6. `History()` - 25 edges
7. `remotion` - 25 edges
8. `THEME` - 21 edges
9. `with` - 21 edges
10. `addShot()` - 20 edges

## Surprising Connections (you probably didn't know these)

- `Live Text OCR & Searchable PDF` --implements--> `OcrService` [INFERRED]
  README.md → src/lib/OcrService.ts
- `Capture Engine` --implements--> `CapturePage()` [INFERRED]
  README.md → src/desktop/CapturePage.tsx
- `Desktop Capture Screenshot` --references--> `CapturePage()` [INFERRED]
  store/desktop/1-capture.png → src/desktop/CapturePage.tsx
- `Annotation Suite` --implements--> `bounds()` [INFERRED]
  README.md → src/editor/Draw.ts
- `Annotation Screenshot` --references--> `bounds()` [INFERRED]
  store/screenshots/1-annotate.png → src/editor/Draw.ts

## Import Cycles

- None detected.

## Hyperedges (group relationships)

- **Capture and Edit Workflow** — readme_capture_engine, readme_annotation_suite, readme_live_text_ocr [INFERRED 0.95]

## Communities (107 total, 33 thin omitted)

### Community 0 - "DocumentImport.ts"

Cohesion: 0.11
Nodes (24): pdfjs-dist@^6.5.438, pdfjs-dist, decodeViaImageElement(), DOCUMENT_ACCEPT, documentTitle(), drawToPng(), extensionOf(), formatImportSummary() (+16 more)

### Community 1 - "Product Promo Assets"

Cohesion: 0.10
Nodes (44): react, remotion, AUDIO_MARKERS, AudioTrigger, ChromeWebStoreBadge(), DaguerreAppIcon(), DaguerreLogoSvg(), GitHubBadge() (+36 more)

### Community 2 - "Chrome Extension Manifest"

Cohesion: 0.06
Nodes (42): action, default_icon, default_popup, default_title, background, service_worker, type, description (+34 more)

### Community 3 - "selection.rs"

Cohesion: 0.05
Nodes (63): capture_screen(), Captured, CaptureInfo, centre_point(), centre_point_converts_pixels_to_points(), clamps_to_the_capture(), detects_wayland_without_requiring_xdg_session_type(), encode_png() (+55 more)

### Community 4 - "Editor.tsx"

Cohesion: 0.10
Nodes (31): Annotation Suite, COLORS, Drag, bounds(), constrain(), distToSegment(), drawShape(), font() (+23 more)

### Community 5 - "Tauri Application Configuration"

Cohesion: 0.06
Nodes (34): app, macOSPrivateApi, security, windows, build, beforeBuildCommand, beforeDevCommand, frontendDist (+26 more)

### Community 6 - "Clipboardext Module"

Cohesion: 0.06
Nodes (16): ACTIONS, allows_only_clean_https_external_urls(), CGPreflightScreenCaptureAccess(), CGRequestScreenCaptureAccess(), external_url(), open_external(), PAGES, parse_theme_blend() (+8 more)

### Community 7 - "vitest"

Cohesion: 0.21
Nodes (7): addShot(), clearShots(), defaultBitmap, imageBlob(), open(), platform, seed()

### Community 8 - "Remotion Video Generation"

Cohesion: 0.07
Nodes (27): scripts, assets:capture, assets:generate, build, changelog:update, coverage, coverage:badge, desktop:build (+19 more)

### Community 9 - "Setup.ts"

Cohesion: 0.17
Nodes (4): @testing-library/react, FakePointerEvent, sizes, mockShortcuts

### Community 10 - "Linux Wayland Portal Capture"

Cohesion: 0.12
Nodes (9): accepts_only_local_screenshot_files(), cancellation_does_not_require_a_screenshot_uri(), portal_request_lifecycle(), preserves_permission_failure_instead_of_falling_back(), request(), screenshot(), screenshot_path(), screenshot_response() (+1 more)

### Community 11 - "Live Text OCR Engine"

Cohesion: 0.11
Nodes (20): Live Text OCR & Searchable PDF, tesseract.js, LiveTextLayer(), PdfImage, asset(), getWorker(), isSegment(), isWord() (+12 more)

### Community 12 - "Extension Background Capture"

Cohesion: 0.16
Nodes (25): Area, capture(), captureAllTabs(), captureFullPage(), captureSelection(), COMMANDS, copyCapture(), ensureOffscreen() (+17 more)

### Community 13 - "Home.tsx"

Cohesion: 0.13
Nodes (18): Home HTML Host, formatReleaseDate(), Home(), changeBlend(), loadThemeBlend(), openEditor(), openExternal(), Page (+10 more)

### Community 14 - "Liquid Glass Desktop Theme"

Cohesion: 0.14
Nodes (13): CAPTURE_HINT, CAPTURE_MODES, copyText(), downloadBlob(), guardClose(), leaveToHistory(), NO_URL_LABEL, printPage() (+5 more)

### Community 15 - "Desktop Settings and Shortcuts"

Cohesion: 0.19
Nodes (18): Appearance(), SettingsPage(), record(), TRAY_ICONS, TrayIcon, UpdateButton(), updateMessage(), ACTION_LABELS (+10 more)

### Community 16 - "Product Promo Assets"

Cohesion: 0.13
Nodes (7): puppeteer-core, rows, { total }, css, declared, files(), read()

### Community 17 - "unit/Editor.test.tsx"

Cohesion: 0.36
Nodes (5): button(), canvas(), drag(), savedEdits(), status()

### Community 18 - "putShots"

Cohesion: 0.38
Nodes (7): orderMultiPagePdfShots(), rename(), getShot(), openDb(), putShots(), run(), open()

### Community 19 - "With Module"

Cohesion: 0.10
Nodes (20): with, body_path, client-id, client-secret, extension-id, fail_on_unmatched_files, fetch-depth, file-path (+12 more)

### Community 20 - "Interactive Editor Canvas"

Cohesion: 0.10
Nodes (25): Capture Engine, driver.js, react-dom, CapturePage(), DELAYS, MODES, when(), createSample() (+17 more)

### Community 21 - "Tsconfig Module"

Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, allowJs, isolatedModules, jsx, lib, module, moduleResolution (+11 more)

### Community 22 - "devDependencies"

Cohesion: 0.08
Nodes (25): devDependencies, husky@^9.1.7, jsdom@^26.1.0, prettier@^3.9.10, puppeteer-core@^25.16.0, remotion@^4.0.542, @remotion/cli@^4.0.542, @testing-library/react@^16.3.3 (+17 more)

### Community 23 - "Overlay Html Host Module"

Cohesion: 0.19
Nodes (12): Overlay HTML Host, finish(), inside(), Overlay(), onUp(), OverlayInfo, PickableWindow, Point (+4 more)

### Community 24 - "Chrome Extension Manifest"

Cohesion: 0.20
Nodes (10): readVersions(), buildDesktop(), require, resolveAppleSigningIdentity(), resolveCargoEnv(), PRODUCTS, readVersion(), releaseNotes() (+2 more)

### Community 25 - "capture_arg"

Cohesion: 0.67
Nodes (3): args(), capture_arg(), reads_the_capture_argument()

### Community 26 - "Popup.tsx"

Cohesion: 0.11
Nodes (30): Popup HTML Host, Extension App Icon 128px, dayLabel(), hasDraggedFiles(), History(), clearAll(), copy(), remove() (+22 more)

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

Cohesion: 0.09
Nodes (21): author, description, fake-indexeddb@^6.2.6, @remotion/shapes@^4.0.542, @types/react@^19.3.0, vitest-canvas-mock@^1.2.0, engines, node (+13 more)

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
Nodes (12): dependencies, driver.js@^1.10.2, react@^19.3.1, react-dom@^19.3.1, @tauri-apps/api@^2.12.4, @tauri-apps/plugin-autostart@^2.7.0, tesseract.js@^7.0.0, @tesseract.js-data/deu@^1.0.0 (+4 more)

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

### Community 40 - "test/Chrome.ts"

Cohesion: 0.20
Nodes (8): ChromeMock, createChrome(), event(), installChrome(), Listener, PNG_DATA_URL, storageArea(), playCaptureSound

### Community 42 - "Bumpversion Module"

Cohesion: 0.44
Nodes (10): bumpVersion(), getPreviousTag(), git(), resolveNextVersion(), validateVersion(), hasRemote(), publishRelease(), getReleaseSection() (+2 more)

### Community 43 - "Dependabot Automation"

Cohesion: 0.20
Nodes (9): minor-and-patch, update-types, interval, updates, directory, groups, package-ecosystem, schedule (+1 more)

### Community 44 - "Chrome Extension Id Module"

Cohesion: 0.29
Nodes (7): CHROME_EXTENSION_ID, VERSION, publish, env, name, needs, runs-on

### Community 45 - "tag"

Cohesion: 0.22
Nodes (9): tag, on, push, workflow_dispatch, tags, description, required, type (+1 more)

### Community 46 - "Icons Module"

Cohesion: 0.22
Nodes (12): createSolidPng(), chunk(), crc32(), generateAssets(), chunk(), crc32(), CRC_TABLE, encodePng() (+4 more)

### Community 47 - "Args() Module"

Cohesion: 0.31
Nodes (7): binaries_changed(), BinaryId, detects_when_a_watched_binary_is_replaced_or_removed(), should_exit_on_binary_change(), skips_binary_exit_while_updating(), Updating, watched_binaries()

### Community 48 - "verify"

Cohesion: 0.29
Nodes (7): verify, sha, tag, version, name, outputs, runs-on

### Community 49 - "Pending Module"

Cohesion: 0.25
Nodes (7): Pending, registers_only_known_actions_with_keys(), set_shortcuts(), set_updating(), Shortcuts, take_pending(), wanted_shortcuts()

### Community 50 - "Name Module"

Cohesion: 0.29
Nodes (7): name, needs, secrets, uses, with, build, release_ref

### Community 51 - "Permissions Module"

Cohesion: 0.29
Nodes (7): permissions, permissions, contents, id-token, pages, permissions, permissions

### Community 52 - "Steps Module"

Cohesion: 0.28
Nodes (9): TAG, steps, env, id, if, name, run, uses (+1 more)

### Community 53 - "Packageextension Module"

Cohesion: 0.48
Nodes (5): buildCrxBuffer(), encodeField(), encodeVarint(), packageExtension(), verifyExtension()

### Community 54 - "Live Text OCR Engine"

Cohesion: 0.33
Nodes (3): ocrAssets(), require, stripCdn()

### Community 55 - "Releaseautomation.Test Module"

Cohesion: 0.43
Nodes (6): cleanGitEnv(), createRepository(), git(), root, runScript(), temporary

### Community 57 - "Automated Release Pipeline"

Cohesion: 0.33
Nodes (5): concurrency, cancel-in-progress, group, jobs, name

### Community 58 - "Editor"

Cohesion: 0.16
Nodes (21): Editor(), applyCrop(), commit(), commitText(), copy(), copyText(), download(), exportPdf() (+13 more)

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

Cohesion: 0.33
Nodes (6): test, desktop, if, name, outputs, runs-on

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

### Community 77 - "Home.test.tsx"

Cohesion: 0.25
Nodes (7): cmds(), lastShortcuts(), nav(), openSettings(), renderHome(), runCapture, shortcutsSent()

### Community 80 - "Export.ts"

Cohesion: 0.22
Nodes (13): Clipboard HTML Host, buildPdf(), canvasToPdf(), fileName(), formatBytes(), hostOf(), jpeg, WIN_ANSI (+5 more)

### Community 81 - "platform/Chrome.ts"

Cohesion: 0.29
Nodes (11): CAPTURE_HINT, CAPTURE_MODES, guardClose(), leaveToHistory(), NO_URL_LABEL, printPage(), SAVE_PNG_LABEL, SAVED_TOAST (+3 more)

### Community 82 - "Updater.ts"

Cohesion: 0.31
Nodes (7): @tauri-apps/plugin-process@^2.4.0, @tauri-apps/plugin-updater@^2.14.1, @tauri-apps/plugin-process, @tauri-apps/plugin-updater, Updater, UpdateState, useUpdater()

### Community 84 - "Capture.ts"

Cohesion: 0.24
Nodes (7): runCapture(), sleep(), copy(), loadAudioData(), playCaptureSound(), copyPng(), importCaptureSound()

### Community 85 - "dragTo"

Cohesion: 0.38
Nodes (7): clamp(), autoScroll(), cropCursorAt(), dragTo(), onDoubleClick(), onPointerMove(), toImage()

### Community 86 - "@tauri-apps/api"

Cohesion: 0.73
Nodes (4): @tauri-apps/api, applyEditorGlass(), loadBlend(), watchEditorGlass()

## Knowledge Gaps

- **26 isolated node(s):** `Region`, `Window`, `daguerre`, `Live Text OCR & Searchable PDF`, `Full Page Capture Screenshot` (+21 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 496 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `Architecture Map` connect `Interactive Editor Canvas` to `Interactive Editor Canvas`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Editor()` (e.g. with `print()` and `redo()`) actually correct?**
  _`Editor()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Region`, `Window`, `daguerre` to the rest of the system?**
  _26 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DocumentImport.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `DocumentImport.ts`, `Product Promo Assets`, `Editor.tsx`, `vitest`, `Setup.ts`, `Live Text OCR Engine`, `Home.tsx`, `Liquid Glass Desktop Theme`, `Desktop Settings and Shortcuts`, `Product Promo Assets`, `unit/Editor.test.tsx`, `Interactive Editor Canvas`, `devDependencies`, `Overlay Html Host Module`, `Chrome Extension Manifest`, `Popup.tsx`, `Package Module`, `test/Chrome.ts`, `Releaseautomation.Test Module`, `Themecontrast.Test Module`, `Home.test.tsx`, `Export.ts`, `platform/Chrome.ts`, `Updater.ts`, `Background.test.ts`, `Capture.ts`, `@tauri-apps/api`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `Home()` (e.g. with `loadThemeBlend()` and `loadShortcuts()`) actually correct?**
  _`Home()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Should `Product Promo Assets` be split into smaller, more focused modules?**
  _Cohesion score 0.10343814281516309 - nodes in this community are weakly interconnected._
