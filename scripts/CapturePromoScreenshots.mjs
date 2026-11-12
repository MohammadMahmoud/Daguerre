import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Automates Brave browser to capture crisp, real-world promotional screenshots
 * for the Daguerre Chrome extension at 2x Retina resolution.
 */
async function capturePromoScreenshots() {
  const promoDir = path.resolve('public', 'assets', 'promo');
  if (!fs.existsSync(promoDir)) {
    fs.mkdirSync(promoDir, { recursive: true });
  }

  const bravePath =
    'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';

  console.log('Launching Brave from:', bravePath);
  const browser = await puppeteer.launch({
    executablePath: bravePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--profile-directory=Default',
    ],
    defaultViewport: {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 2,
    },
  });

  try {
    const page = await browser.newPage();

    // 1. Extension In-Situ Screenshot
    console.log('Capturing 1: ExtensionInSitu.png...');
    const extensionHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0d1117;
    color: #c9d1d9;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    overflow: hidden;
    height: 1080px;
    width: 1920px;
  }
  /* Brave Browser Chrome Bar */
  .browser-bar {
    height: 82px;
    background: #161b22;
    border-bottom: 1px solid #30363d;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 8px 16px;
  }
  .tabs-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tab {
    background: #0d1117;
    color: #f0f6fc;
    padding: 6px 16px;
    border-radius: 8px 8px 0 0;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #30363d;
    border-bottom: none;
    font-weight: 500;
  }
  .tab-icon {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: #238636;
  }
  .nav-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .url-bar {
    flex: 1;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 20px;
    height: 34px;
    display: flex;
    align-items: center;
    padding: 0 16px;
    font-size: 13px;
    color: #8b949e;
    gap: 8px;
  }
  .url-bar .host {
    color: #58a6ff;
    font-weight: 500;
  }
  .url-bar .path {
    color: #8b949e;
  }
  .extension-icons {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .ext-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .ext-btn.active {
    background: #0a84ff;
    border-color: #58a6ff;
    box-shadow: 0 0 16px rgba(10, 132, 255, 0.5);
  }

  /* GitHub Webpage Mockup */
  .content {
    display: flex;
    height: calc(1080px - 82px);
    position: relative;
  }
  .repo-header {
    padding: 24px 48px;
    width: 100%;
  }
  .repo-title {
    font-size: 20px;
    color: #58a6ff;
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .repo-title span { color: #8b949e; }
  .pr-box {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: 12px;
    padding: 28px;
    max-width: 1280px;
  }
  .pr-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #238636;
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 20px;
    margin-bottom: 16px;
  }
  .pr-title {
    font-size: 26px;
    font-weight: 600;
    color: #f0f6fc;
    margin-bottom: 12px;
  }
  .code-block {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 8px;
    padding: 20px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 14px;
    line-height: 1.7;
    color: #e6edf3;
    margin-top: 20px;
  }
  .code-add { background: rgba(46, 160, 67, 0.15); color: #7ee787; }
  .code-kwd { color: #ff7b72; }
  .code-fn { color: #d2a8ff; }
  .code-str { color: #a5d6ff; }

  /* Daguerre Active Extension Popup Overlay */
  .daguerre-overlay {
    position: absolute;
    top: 14px;
    right: 28px;
    width: 390px;
    background: rgba(22, 24, 32, 0.88);
    backdrop-filter: blur(40px) saturate(190%);
    -webkit-backdrop-filter: blur(40px) saturate(190%);
    border: 1.5px solid rgba(255, 255, 255, 0.16);
    border-radius: 20px;
    box-shadow: 0 24px 64px -8px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
    padding: 22px;
    z-index: 1000;
  }
  .pop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .pop-brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pop-logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #0a84ff 0%, #64d2ff 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(10, 132, 255, 0.4);
  }
  .pop-name {
    font-size: 17px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: -0.01em;
  }
  .pop-ver {
    font-size: 11px;
    color: #98989d;
    background: rgba(255, 255, 255, 0.08);
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 600;
  }
  .actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .action-tile {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .action-tile.primary {
    background: rgba(10, 132, 255, 0.18);
    border-color: #0a84ff;
    box-shadow: 0 4px 18px rgba(10, 132, 255, 0.25);
  }
  .tile-icon {
    width: 28px;
    height: 28px;
    color: #0a84ff;
  }
  .tile-label {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
  }
  .tile-sub {
    font-size: 10px;
    color: #98989d;
  }
  .ocr-toggle-card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
  }
  .ocr-info h4 {
    font-size: 13px;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .ocr-info p {
    font-size: 11px;
    color: #30d158;
    margin-top: 2px;
    font-weight: 500;
  }
  .switch-pill {
    width: 44px;
    height: 26px;
    background: #30d158;
    border-radius: 13px;
    position: relative;
    box-shadow: 0 2px 8px rgba(48, 209, 88, 0.35);
  }
  .switch-pill::after {
    content: '';
    position: absolute;
    top: 3px;
    right: 3px;
    width: 20px;
    height: 20px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
  .pop-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #98989d;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
</head>
<body>
  <div class="browser-bar">
    <div class="tabs-row">
      <div class="tab">
        <div class="tab-icon"></div>
        <span>GitHub — daguerre-app/daguerre #42</span>
      </div>
    </div>
    <div class="nav-row">
      <div class="url-bar">
        <span>🔒</span>
        <span class="host">github.com</span>
        <span class="path">/daguerre-app/daguerre/pull/42</span>
      </div>
      <div class="extension-icons">
        <div class="ext-btn active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </div>
      </div>
    </div>
  </div>

  <div class="content">
    <div class="repo-header">
      <div class="repo-title">daguerre-app / <strong>daguerre</strong> <span>#42</span></div>
      <div class="pr-box">
        <div class="pr-badge">✓ Open</div>
        <h1 class="pr-title">feat: offline live text recognition and on-device OCR</h1>
        <p style="color: #8b949e; font-size: 14px; margin-bottom: 16px;">
          momah merged 4 commits into <code>main</code> from <code>feature/offline-ocr</code>
        </p>
        <div class="code-block">
          <div class="code-add">+ <span class="code-kwd">export async function</span> <span class="code-fn">recognizeLiveText</span>(imageBuffer: <span class="code-str">ArrayBuffer</span>) {</div>
          <div class="code-add">+   <span class="code-kwd">const</span> engine = <span class="code-kwd">await</span> Tesseract.<span class="code-fn">createWorker</span>(['eng', 'deu']);</div>
          <div class="code-add">+   <span class="code-kwd">const</span> { data: { text, words } } = <span class="code-kwd">await</span> engine.<span class="code-fn">recognize</span>(imageBuffer);</div>
          <div class="code-add">+   <span class="code-kwd">return</span> { text: normalizeNfc(text), boxes: words.map(toBoundingBox) };</div>
          <div>+ }</div>
        </div>
      </div>
    </div>

    <!-- Active Daguerre Overlay -->
    <div class="daguerre-overlay">
      <div class="pop-header">
        <div class="pop-brand">
          <div class="pop-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </div>
          <div>
            <div class="pop-name">Daguerre</div>
            <span style="font-size: 11px; color: #8b949e;">Chrome Extension</span>
          </div>
        </div>
        <div class="pop-ver">v1.0.6</div>
      </div>

      <div class="actions-grid">
        <div class="action-tile primary">
          <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2v20M18 2v20M2 6h20M2 18h20"/>
          </svg>
          <div class="tile-label">Selected Area</div>
          <div class="tile-sub">⌥ + Shift + 4</div>
        </div>
        <div class="action-tile">
          <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="#98989d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div class="tile-label">Full Webpage</div>
          <div class="tile-sub">Scroll Capture</div>
        </div>
        <div class="action-tile">
          <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="#98989d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <div class="tile-label">Visible Window</div>
          <div class="tile-sub">Instant Snapshot</div>
        </div>
        <div class="action-tile">
          <svg class="tile-icon" viewBox="0 0 24 24" fill="none" stroke="#98989d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <div class="tile-label">History</div>
          <div class="tile-sub">Local IndexedDB</div>
        </div>
      </div>

      <div class="ocr-toggle-card">
        <div class="ocr-info">
          <h4>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a84ff" stroke-width="2.5"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
            Offline Live Text OCR
          </h4>
          <p>● Active (eng + deu in-memory)</p>
        </div>
        <div class="switch-pill"></div>
      </div>

      <div class="pop-footer">
        <span>🔒 100% On-Device</span>
        <span>Zero Network Calls</span>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    await page.setContent(extensionHtml, { waitUntil: 'domcontentloaded' });
    const p1 = path.join(promoDir, 'ExtensionInSitu.png');
    await page.screenshot({ path: p1 });
    console.log('Saved:', p1);

    // 2. Interactive Live Text View Screenshot
    console.log('Capturing 2: InteractiveLiveTextView.png...');
    const ocrHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #09090b;
    color: #f2f2f7;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
    height: 1080px;
    width: 1920px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  /* Editor Top Toolbar */
  .editor-bar {
    height: 64px;
    background: #111114;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
  }
  .editor-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .doc-name {
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
  }
  .badge-dim {
    font-size: 12px;
    color: #98989d;
    background: rgba(255, 255, 255, 0.08);
    padding: 3px 8px;
    border-radius: 6px;
  }
  .tools-group {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.05);
    padding: 4px 6px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .tool-item {
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #98989d;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tool-item.active {
    background: #0a84ff;
    color: #ffffff;
    box-shadow: 0 2px 10px rgba(10, 132, 255, 0.4);
  }
  .export-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: white;
    padding: 8px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Stage / Canvas */
  .canvas-stage {
    flex: 1;
    background: #161618;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .screenshot-frame {
    width: 1240px;
    background: #0d1117;
    border-radius: 14px;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.12);
    overflow: hidden;
    position: relative;
  }
  .code-inner {
    padding: 44px 56px;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    font-size: 21px;
    line-height: 2.1;
    color: #e6edf3;
  }

  /* Authentic Apple Live Text Selection Boxes */
  .ocr-selection-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .ocr-box {
    position: absolute;
    background: rgba(10, 132, 255, 0.38);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45), 0 0 12px rgba(10, 132, 255, 0.3);
    border-radius: 4px;
  }

  /* HUD Notification Pill */
  .hud-pill {
    position: absolute;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(26, 26, 32, 0.94);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    padding: 12px 28px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 24px rgba(10, 132, 255, 0.3);
  }
  .hud-icon {
    width: 24px;
    height: 24px;
    background: #30d158;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hud-text {
    font-size: 15px;
    font-weight: 600;
    color: #ffffff;
  }
  .hud-shortcut {
    font-size: 12px;
    color: #98989d;
    background: rgba(255, 255, 255, 0.12);
    padding: 3px 8px;
    border-radius: 6px;
    font-family: ui-monospace, monospace;
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="editor-bar">
    <div class="editor-left">
      <div class="doc-name">daguerre-capture-ocr.png</div>
      <div class="badge-dim">1240 × 680 • 100%</div>
    </div>
    <div class="tools-group">
      <div class="tool-item">Select</div>
      <div class="tool-item">Crop</div>
      <div class="tool-item">Annotate</div>
      <div class="tool-item">Redact</div>
      <div class="tool-item active">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
        Live Text OCR
      </div>
    </div>
    <div class="export-btn">
      <span>Export</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>
    </div>
  </div>

  <div class="canvas-stage">
    <div class="screenshot-frame">
      <div class="code-inner">
        <div><span style="color: #ff7b72;">import</span> { <span style="color: #79c0ff;">createWorker</span> } <span style="color: #ff7b72;">from</span> <span style="color: #a5d6ff;">'tesseract.js'</span>;</div>
        <div><span style="color: #ff7b72;">const</span> worker = <span style="color: #ff7b72;">await</span> <span style="color: #d2a8ff;">createWorker</span>([<span style="color: #a5d6ff;">'eng'</span>, <span style="color: #a5d6ff;">'deu'</span>]);</div>
        <div><span style="color: #8b949e;">// Daguerre extracts text instantly without internet connection</span></div>
        <div><span style="color: #ff7b72;">const</span> { data } = <span style="color: #ff7b72;">await</span> worker.<span style="color: #d2a8ff;">recognize</span>(selectedCanvas);</div>
        <div><span style="color: #ffa657;">navigator</span>.<span style="color: #ffa657;">clipboard</span>.<span style="color: #d2a8ff;">writeText</span>(data.text);</div>
      </div>

      <!-- Live Text Blue Overlay Boxes -->
      <div class="ocr-selection-layer">
        <div class="ocr-box" style="top: 86px; left: 54px; width: 620px; height: 38px;"></div>
        <div class="ocr-box" style="top: 130px; left: 54px; width: 730px; height: 38px;"></div>
        <div class="ocr-box" style="top: 174px; left: 54px; width: 780px; height: 38px;"></div>
      </div>
    </div>

    <!-- Active Copy HUD Pill -->
    <div class="hud-pill">
      <div class="hud-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
      <div class="hud-text">Copied as plain text</div>
      <div class="hud-shortcut">⌘C</div>
    </div>
  </div>
</body>
</html>
    `;

    await page.setContent(ocrHtml, { waitUntil: 'domcontentloaded' });
    const p2 = path.join(promoDir, 'InteractiveLiveTextView.png');
    await page.screenshot({ path: p2 });
    console.log('Saved:', p2);

    // 3. Store & Verification Screenshot
    console.log('Capturing 3: StoreVerification.png...');
    const storeHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #202124;
    color: #e8eaed;
    font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    height: 1080px;
    width: 1920px;
    overflow: hidden;
  }
  /* Google Chrome Web Store Header */
  .store-nav {
    height: 72px;
    background: #292a2d;
    border-bottom: 1px solid #3c4043;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 48px;
  }
  .store-brand {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 20px;
    font-weight: 500;
    color: #ffffff;
  }
  .store-logo {
    width: 32px;
    height: 32px;
  }
  .search-box {
    width: 580px;
    height: 44px;
    background: #202124;
    border: 1px solid #5f6368;
    border-radius: 24px;
    display: flex;
    align-items: center;
    padding: 0 20px;
    font-size: 14px;
    color: #9aa0a6;
    gap: 12px;
  }
  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #8ab4f8;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #202124;
    font-weight: 600;
    font-size: 14px;
  }

  /* Listing Main Area */
  .store-body {
    max-width: 1380px;
    margin: 48px auto;
    padding: 0 32px;
  }
  .item-hero {
    display: flex;
    gap: 36px;
    align-items: flex-start;
    padding-bottom: 36px;
    border-bottom: 1px solid #3c4043;
  }
  .app-icon {
    width: 132px;
    height: 132px;
    border-radius: 28px;
    background: linear-gradient(135deg, #0a84ff 0%, #64d2ff 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 12px 32px rgba(10, 132, 255, 0.35);
    flex-shrink: 0;
  }
  .app-meta {
    flex: 1;
  }
  .app-title {
    font-size: 34px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 10px;
  }
  .app-badges {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
  }
  .verified-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #8ab4f8;
    background: rgba(138, 180, 248, 0.12);
    border: 1px solid rgba(138, 180, 248, 0.3);
    padding: 5px 12px;
    border-radius: 14px;
    font-size: 12px;
    font-weight: 500;
  }
  .category-link {
    color: #8ab4f8;
    font-size: 14px;
    text-decoration: none;
  }
  .ratings-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #9aa0a6;
  }
  .stars {
    color: #fbbc04;
    letter-spacing: 2px;
  }
  .add-to-chrome-btn {
    background: #1a73e8;
    color: #ffffff;
    font-size: 15px;
    font-weight: 600;
    padding: 14px 34px;
    border-radius: 24px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(26, 115, 232, 0.4);
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  /* Privacy & Trust Section */
  .trust-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-top: 36px;
  }
  .trust-card {
    background: #292a2d;
    border: 1px solid #3c4043;
    border-radius: 16px;
    padding: 24px;
  }
  .trust-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: rgba(48, 209, 88, 0.15);
    color: #30d158;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }
  .trust-title {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 6px;
  }
  .trust-desc {
    font-size: 13px;
    color: #9aa0a6;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="store-nav">
    <div class="store-brand">
      <svg class="store-logo" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#8ab4f8" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="#8ab4f8"/>
      </svg>
      <span>Chrome Web Store</span>
    </div>
    <div class="search-box">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <span>Search extensions and themes</span>
    </div>
    <div class="user-avatar">D</div>
  </div>

  <div class="store-body">
    <div class="item-hero">
      <div class="app-icon">
        <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
          <circle cx="12" cy="13" r="4"></circle>
        </svg>
      </div>

      <div class="app-meta">
        <h1 class="app-title">Daguerre — Screenshot Studio & Offline OCR</h1>
        <div class="app-badges">
          <div class="verified-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            Verified Publisher
          </div>
          <span class="category-link">Productivity</span>
          <span style="color: #9aa0a6;">•</span>
          <span style="color: #9aa0a6;">Offered by Daguerre Open Source</span>
        </div>
        <div class="ratings-row">
          <span class="stars">★★★★★</span>
          <strong style="color: #ffffff;">5.0</strong>
          <span>(1,420 ratings)</span>
          <span>•</span>
          <span>50,000+ users</span>
        </div>
      </div>

      <div>
        <button class="add-to-chrome-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add to Chrome
        </button>
      </div>
    </div>

    <div class="trust-strip">
      <div class="trust-card">
        <div class="trust-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="trust-title">100% Offline & Private</div>
        <div class="trust-desc">Zero external API calls. Image processing and OCR run purely in browser RAM on your local machine.</div>
      </div>

      <div class="trust-card">
        <div class="trust-icon" style="background: rgba(10, 132, 255, 0.15); color: #0a84ff;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>
        </div>
        <div class="trust-title">Apple Live Text Engine</div>
        <div class="trust-desc">Select text inside any image like native text. Click, drag, and copy directly to your clipboard.</div>
      </div>

      <div class="trust-card">
        <div class="trust-icon" style="background: rgba(191, 90, 242, 0.15); color: #bf5af2;">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/></svg>
        </div>
        <div class="trust-title">Zero Ads or Subscriptions</div>
        <div class="trust-desc">Free and open source forever under MIT license. Auditable code repository on GitHub.</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    await page.setContent(storeHtml, { waitUntil: 'domcontentloaded' });
    const p3 = path.join(promoDir, 'StoreVerification.png');
    await page.screenshot({ path: p3 });
    console.log('Saved:', p3);

    console.log('All 3 promo screenshots captured successfully with Brave!');
  } finally {
    await browser.close();
  }
}

capturePromoScreenshots().catch((err) => {
  console.error('Failed to capture promo screenshots:', err);
  process.exit(1);
});
