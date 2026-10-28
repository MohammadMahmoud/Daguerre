# Daguerre Publishing To-Do

Updated: October 22, 2026.

External account and deployment steps have not been verified. Check off any you have already completed.

## 1. Name and Contact

- [ ] Search the Chrome Web Store for **Daguerre** and check for conflicting names or trademarks.
- [ ] Confirm that the contact link in [store/privacy.html](store/privacy.html) leads to a working way to contact you. It currently points to `https://mmjs.com.de/`.
- [ ] Choose and verify the support email for your Chrome Web Store developer account.

## 2. GitHub Setup

- [ ] Create the GitHub repository and push the project to its `main` branch.
- [ ] Replace every `OWNER/REPO` placeholder in [README.md](README.md), including the URL-encoded coverage badge endpoint.
- [ ] Set `REPO_URL` in [store/index.html](store/index.html) to the repository URL.
- [ ] In GitHub **Settings > Pages**, set **Source** to **GitHub Actions**.
- [ ] Confirm the [CI workflow](.github/workflows/ci.yml) runs successfully on GitHub, including the frozen-lockfile install, tests, packaging, and Pages deployment.
- [ ] Confirm the downloadable build artifact contains the extension zip.
- [ ] Open the deployed showcase and privacy policy, including on a phone-sized screen.
- [ ] Confirm the coverage report and README badges load after Pages is deployed.
- [ ] Replace the placeholder privacy-policy URL in [store/listing.md](store/listing.md) with the deployed address.

Expected Pages addresses:

```text
https://<owner>.github.io/<repo>/
https://<owner>.github.io/<repo>/privacy.html
https://<owner>.github.io/<repo>/coverage/
```

## 3. Final Release Check

- [ ] Run `pnpm package` on the final source. It typechecks, builds, runs tests with coverage thresholds, and creates `daguerre.zip`.
- [ ] Load the final `dist/` folder unpacked in a clean Chrome profile using `chrome://extensions` and Developer mode.
- [ ] Check visible-area, full-page, selected-area, and all-tabs captures.
- [ ] Check scrolling selection, crop handles, annotations, and undo/redo.
- [ ] Check **Copy selected area**, including **Alt+Shift+C**: it should copy a PNG, save it in History, and open no editor tab.
- [ ] Check that ordinary capture actions still open the editor.
- [ ] Check PNG, JPEG, WebP, PDF, searchable PDF, Copy Text, and print.
- [ ] Check History, deletion, and the optional permission request for All tabs.
- [ ] Confirm the release version matches in [public/manifest.json](public/manifest.json) and the `## [Extension x.y.z]` section of [CHANGELOG.md](CHANGELOG.md) (`pnpm release-notes extension` checks it). They currently target `1.0.0`.
- [ ] After committing and pushing the final changes, push a matching tag such as `ext-v1.0.0` to create a GitHub release with its zip and changelog notes.

## 4. Chrome Web Store Submission

- [ ] Enable Google account **2-step verification**.
- [ ] Register through the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) and pay the one-time registration fee.
- [ ] Complete any publisher identity and contact verification requested by the dashboard.
- [ ] Create a new item and upload `daguerre.zip`, or the versioned extension zip from the GitHub release. Do not upload the outer GitHub artifact archive.
- [ ] Fill in the description, category, and language using [store/listing.md](store/listing.md).
- [ ] Upload the 128-pixel icon from [public/icons/icon-128.png](public/icons/icon-128.png).
- [ ] Upload [store/promo-small-440x280.png](store/promo-small-440x280.png) and the five images in [store/screenshots](store/screenshots).
- [ ] Enter the deployed showcase URL as the homepage and the direct privacy-policy URL in the designated privacy field.
- [ ] Complete the single-purpose statement and permission justifications from the listing guide.
- [ ] Complete privacy disclosures accurately: screenshots, page titles, and URLs are processed locally; there are no uploads, analytics, sales of data, or remotely executed code. Match the current dashboard questions and the privacy policy.
- [ ] Choose the distribution regions, visibility, and pricing.
- [ ] Submit for review and monitor the developer email for questions or requested changes.

## 5. After Approval

- [ ] Set `STORE_URL` in [store/index.html](store/index.html) to the actual listing URL. It currently links to the Web Store homepage.
- [ ] Push the change and confirm every **Add to Chrome** button reaches the listing.
- [ ] Install from the published listing and repeat a brief capture, copy, and export check.

## Future Updates

- [ ] Increase the version in the manifest; the Web Store requires a higher version for each new upload.
- [ ] Add a matching `## [Extension x.y.z]` section to the changelog.
- [ ] Commit, push, and tag it `ext-vx.y.z` to produce its GitHub release.
- [ ] Upload the new extension zip in the Web Store dashboard and submit it for review. The current CI creates releases but does not upload to the Web Store automatically.

## Already Prepared

- [x] MIT license and package metadata, with the license included in the extension zip.
- [x] Minimal capture permissions; all-sites access is optional for All tabs.
- [x] Offline OCR and searchable PDF export with bundled engine assets.
- [x] Local screenshot history and a dedicated selected-area clipboard action.
- [x] Unit tests under `test/unit/` with an enforced 80% coverage floor.
- [x] GitHub workflow for testing, packaging, release notes, downloadable artifacts, releases, and Pages.
- [x] Showcase, privacy page, store images, and listing copy.

Latest local verification: **115 passing tests**, **97.03% statement coverage**, and a successful package build. Run the final release check again after any further changes.
