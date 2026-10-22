# Chrome Web Store submission

Copy these values into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). Build the upload with `pnpm package` (creates `daguerre.zip`), or download the `daguerre-<version>` artifact from the CI run or GitHub release.

## Store listing

**Name:** Daguerre — Screenshot Studio

**Summary** (from the manifest, 132 characters max): Capture visible area, full page, a selection or all tabs. Annotate, copy text (OCR), export to PNG, JPEG, PDF or print.

**Category:** Tools

**Description:**

> Daguerre captures, annotates and exports screenshots, and it keeps everything on your device.
>
> CAPTURE
> • Visible area, entire page (scrolls and stitches automatically), a selected area, or every tab in the window
> • Selections can grow past the screen: drag to the edge and the page scrolls with you
> • Keyboard shortcuts, right-click menu, and a 3, 5 or 10 second delay for menus and hover states
>
> EDIT
> • Crop, arrows, rectangles, ellipses, lines, pen, highlighter, text and numbered steps
> • Pixelate passwords, emails and other sensitive details before sharing
> • Undo and redo, zoom, and edits you can change later
>
> EXPORT
> • PNG at full quality, or compressed JPEG and WebP with a quality slider
> • PDF, including searchable PDFs with selectable text
> • Copy the image or the text in it to your clipboard, or print
>
> PRIVATE BY DESIGN
> • Screenshots are stored only in your browser, in a searchable history
> • Text recognition (English) runs on your device. Nothing is uploaded, and there is no tracking.

**Images:** upload these files.

| Field                      | File                                                 |
| -------------------------- | ---------------------------------------------------- |
| Icon (128×128)             | packaged in the zip (`icons/icon-128.png`)           |
| Small promo tile (440×280) | `store/promo-small-440x280.png`                      |
| Screenshots (1280×800)     | `store/screenshots/1-annotate.png` … `5-history.png` |

## Privacy practices tab

**Single purpose:** Capture screenshots of web pages, then annotate and export them on the user's device.

**Permission justifications:**

| Permission                        | Justification                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `activeTab`                       | Captures the tab the user chose from the toolbar button, shortcut or context menu.                                                   |
| `scripting`                       | Runs a script in that tab to scroll it for full-page capture and to show the area-selection overlay.                                 |
| `storage`                         | Saves the user's settings (capture delay, export quality) and the in-progress capture status.                                        |
| `unlimitedStorage`                | Screenshot history is stored locally in IndexedDB, and full-page captures can be large.                                              |
| `contextMenus`                    | Adds capture commands to the right-click menu.                                                                                       |
| `clipboardWrite`                  | Copies images or text on request, including the dedicated Copy selected area button and shortcut.                                    |
| Optional host access `<all_urls>` | Requested at runtime only when the user picks "All tabs", because Chrome needs host access to capture tabs the user didn't click on. |

**Remote code:** No, I am not using remote code. All JavaScript and WebAssembly, including the OCR engine, is packaged in the extension.

**Data usage:** the extension handles **Website content** (the captured screenshot, plus page title and URL) and stores it locally only. Tick all three certifications: no selling to third parties, no use unrelated to the single purpose, and no use for creditworthiness or lending.

**Privacy policy URL:** `https://<owner>.github.io/<repo>/privacy.html`. CI publishes [store/privacy.html](privacy.html) there, along with the showcase site. Fill in the contact email first.

## Before you submit

- [ ] Developer account registered (one-time fee) with 2-step verification turned on
- [ ] Contact email added to `store/privacy.html`, and the policy live on GitHub Pages
- [ ] "Daguerre" checked against existing store listings and trademarks
- [ ] `pnpm package` run, and the zip loaded unpacked once in a clean Chrome profile to smoke-test
- [ ] Bump `version` in `package.json` and `public/manifest.json`, and add a matching `CHANGELOG.md` section, for every update you upload

## Third-party software

OCR uses [Tesseract.js](https://github.com/naptha/tesseract.js) and tesseract.js-core (Apache-2.0) with the English `tessdata` model (Apache-2.0). Their licenses ship in the package under `ocr/`.
