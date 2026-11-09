# Daguerre Architecture Guide

## Architecture Map

| Area                    | Ownership and entry points                                                                                                                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop App             | `home.html` mounts `src/desktop/Home.tsx`; CapturePage, SettingsPage, Shortcuts and Updater own capture controls, preferences, shortcuts and update checks. `overlay.html` hosts the selection overlay. Desktop frontend output is `dist-desktop/`.                                                                                                              |
| Tauri Backend           | `src-tauri/src/lib.rs` owns windows, tray, IPC commands and plugin setup. `capture.rs` captures screens/windows; `selection.rs` handles regions; Linux `portal.rs` owns Wayland screenshots. Capabilities in `src-tauri/capabilities/` restrict each window. Rust/Tauri produces native installers under `src-tauri/target/**/release/bundle/`.                  |
| Browser Extension       | `public/manifest.json` configures Chrome MV3 permissions and commands. `src/background.ts` handles capture triggers, progress and on-demand selection/scrolling injection. `src/popup.tsx` owns popup actions and recent shots; `src/Clipboard.ts` handles the focused clipboard frame. Production output is `dist/`. No persistent content script is installed. |
| Shared UI and Storage   | `src/editor.tsx`, `src/editor/draw.ts`, `src/history.tsx`, `src/ui.tsx`, `src/styles.css` and `src/lib/` provide editing, local IndexedDB storage, export and offline English OCR. Vite's `@platform` alias selects `src/platform/Chrome.ts` or `Desktop.ts`. Both targets work independently and keep separate histories.                                       |
| Theming                 | `src/desktop/Theme.ts`, Home and Settings apply OS-adaptive appearance. Liquid Glass is macOS-only; Windows/Linux offer Light, Dark and System. Solid theme settings also apply to editor windows. Native effects require Tauri; browser previews cannot verify macOS material rendering.                                                                        |
| Onboarding Tour         | `src/desktop/ProductTour.tsx` uses driver.js for 14 stages across all four capture workflows, an in-memory editor sample, tool toggling, export previews and live appearance previews. Product Tour sits below Settings in the sidebar. Exit restores view and appearance without persisting samples, clipboard operations or preferences.                       |
| Showcase                | `store/index.html` contains the interactive browser/desktop showcase; `store/desktop/` and `store/screenshots/` contain product screenshots. Keep showcase descriptions, images and README synchronized with actual product behavior.                                                                                                                            |
| CI and Release Pipeline | `.github/workflows/ci.yml` runs frontend/Rust checks, builds `dist/` and `daguerre.crx`, and publishes Pages; it is reusable with an immutable `release_ref`. `.github/workflows/release.yml` serializes preparation on remote main, calls reusable builds, then publishes installers, `daguerre-extension-dist-vX.Y.Z.zip` and `daguerre-extension-vX.Y.Z.crx`. |

## Release Ownership

- `CHANGELOG.md` is the single source of release history. Preserve historical sections. Do not introduce a second permanent release-notes document.
- `scripts/bump-version.mjs` reads a reachable unified `vX.Y.Z` tag, or root package metadata if none exists. It applies patch rollover at 9 or an explicit override and validates all manifests before transactional writes. It synchronizes workspace packages, Tauri config, Cargo manifest/lock and extension manifest.
- `scripts/update-changelog.mjs` converts a curated `## [Unreleased]` section, when it has entries, into the dated version section verbatim. Otherwise it turns commits since the previous unified tag (or the newest legacy tag before the first unified release) into Added/Fixed/Changed entries, always emitting all three headings. `.release-notes.md` is ignored, temporary output copied verbatim from that section by `scripts/release-notes.mjs`.
- `scripts/package-extension.mjs` verifies the compiled extension manifest, entry points and bundled OCR, and produces both `daguerre.zip` and a CRX3 `daguerre.crx` alongside `dist/`. Release CI publishes `daguerre-extension-dist-vX.Y.Z.zip` and `daguerre-extension-vX.Y.Z.crx`.
- `scripts/publish-release.mjs` only dispatches release.yml on remote main through GitHub CLI. It accepts `--version X.Y.Z` and `--dry-run`, never changes local files, and does not include unmerged feature-branch work.
- Existing Husky pre-commit/pre-push hooks run quality checks only. Do not add post-commit/post-merge changelog writes, automatic amendments or local version bumps. CI uses HUSKY=0 for its explicit bot release commit.
- The release workflow atomically pushes main and its annotated tag using the bot identity and `chore(release): vX.Y.Z [skip ci]`. Normal concurrent main pushes fail safely rather than being overwritten. Builds use the exact prepared SHA; GitHub Release publication waits for all required jobs and dist verification.

## Agent Change Rules

1. Read this guide before editing. Inspect Git status, unstaged/staged diffs and recent log; preserve unrelated staged and unstaged work.
2. Keep the architecture map synchronized whenever module ownership, entry points, behavior boundaries or pipeline structure changes. Add a dated ledger entry describing the affected area and reason.
3. Keep commit messages clear and user-oriented. Use descriptive `feat:`, `fix:` and `docs:`/`chore:` subjects so release CI can generate useful human-readable entries. Do not manually generate changelog/version churn on developer feature branches.
4. Run relevant tests, typecheck, lint and formatting checks, then review the final diff. Never commit, tag, dispatch a release or push without explicit authorization. Script tests must use temporary repositories, not this worktree.

## Architecture Ledger

- 2026-11-09 | Desktop App, Browser Extension, Shared UI | Added monochrome `coffee` icon and shared Buy Me a Coffee constants in `src/ui.tsx`, native Support sections in `src/desktop/Home.tsx` (using Tauri `open_external` command in `src-tauri/src/lib.rs`) and `src/popup.tsx`, and Support badges/section in `README.md`.
- 2026-11-08 | Pipeline, Browser Extension | Consolidated change detection, extension build and verification into the CI `test` job, skipped `desktop-check` on release/manual runs so `desktop-build` runs in parallel with `test`, removed redundant pre-tag release checks and `store/listing.md`, and added CRX3 (`daguerre.crx`) generation alongside `dist/`.
- 2026-11-06 | Pipeline | Replaced the initial local release-note/hook design with CI-only release preparation. Removed duplicate permanent notes and documentation-mutating hooks. Added deterministic rollover, a single-source changelog generator, a dispatch-only publisher and serialized remote-main releases using immutable build refs.
- 2026-11-06 | Showcase | Synchronized browser/desktop capture descriptions, persistent editor labels, OCR/clipboard/export workflows, onboarding stages and OS-adaptive appearance; aligned README and Web Store instructions with dist-in-release distribution. Regenerated Capture, Editor, History, Settings, Product Tour and popup screenshots in an isolated browser with mocked native APIs.
- 2026-11-06 | Desktop App, Shared UI | Existing driver.js onboarding sandbox previews four desktop workflows, labeled annotation tools and platform themes without persisting sample captures or changing preferences.
- 2026-11-04 | Desktop App | Desktop 0.0.4 added updater integration, off-screen window recovery and Wayland portal capture. Earlier released history remains in CHANGELOG.md.

## Definition of Done (Mandatory Post-Task Checklist)

Before declaring any build, bug fix, or code modification finished across the Desktop Application or Chrome Extension, you MUST complete all four steps below:

1. **Test Coverage & Verification**
   - Add or update unit/integration tests covering every new feature, bug fix, or modified behavior.
   - Run the full test suite and ensure 100% of existing and new tests pass.
   - Never delete or skip failing tests to make a build pass; fix the root cause.

2. **Post-Task Workspace Cleanup**
   - Remove all temporary files, debug logs (`console.log`, trace outputs), commented-out code, and unused imports/variables introduced during the task.
   - Stop any background dev servers or orphaned test processes started during verification.
   - Run `git status` and `git diff` to confirm only intended, production-ready files remain modified.

3. **Build, Run & Hook Verification (`pre-commit` / `pre-push`)**
   - Verify that both the Desktop Application and Chrome Extension compile and bundle with zero TypeScript, linter, or build errors.
   - Explicitly run the repository's `pre-commit` and `pre-push` checks (linting, type-checking, formatting, tests, and builds) and resolve all issues.
   - Leave the working tree in a clean, runnable, and immediately pushable state.

4. **Changelog Update (`CHANGELOG.md`)**
   - Log every user-facing or architectural change in `CHANGELOG.md` under `## [Unreleased]` (or the active version header).
   - Categorize entries strictly under `### Added`, `### Fixed`, or `### Changed`.
   - Write concise bullet points noting what changed and its scope (`Desktop`, `Extension`, or `Both`).
