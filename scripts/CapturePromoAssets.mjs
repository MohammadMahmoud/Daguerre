import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Captures pixel-perfect promo screenshots with harmonized typography
 * across Capture Mode, Live Text OCR, and Searchable PDF Export popup.
 */
async function capturePromoAssets() {
  const promoDir = path.resolve('public', 'assets', 'promo');
  const remotionAssetsDir = path.resolve('src', 'remotion', 'Assets');

  if (!fs.existsSync(promoDir)) {
    fs.mkdirSync(promoDir, { recursive: true });
  }
  if (!fs.existsSync(remotionAssetsDir)) {
    fs.mkdirSync(remotionAssetsDir, { recursive: true });
  }

  const bravePath =
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
  console.log('Launching Brave for promo asset captures...');

  const browser = await puppeteer.launch({
    executablePath: bravePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--allow-file-access-from-files',
    ],
    defaultViewport: {
      width: 1440,
      height: 900,
      deviceScaleFactor: 2,
    },
  });

  try {
    const page = await browser.newPage();

    // Mock Tauri native environment
    await page.evaluateOnNewDocument(() => {
      window.__TAURI_INTERNALS__ = {
        invoke: async (cmd, _args) => {
          if (cmd === 'platform') return { os: 'windows', wayland: false };
          if (cmd === 'screen_access') return true;
          if (cmd === 'plugin:app|version') return '1.0.6';
          if (cmd === 'plugin:autostart|is_enabled') return false;
          if (cmd === 'take_pending') return null;
          if (cmd === 'set_tray_icon') return null;
          if (cmd === 'set_shortcuts') return {};
          if (cmd === 'plugin:event|listen') return 1;
          if (cmd === 'plugin:event|unlisten') return null;
          if (cmd === 'get_theme') return 'dark';
          return null;
        },
        transformCallback: () => 1,
        unregisterCallback: () => {},
        ipc: () => {},
      };
      window.__TAURI_EVENT_LISTENERS__ = {
        1: () => {},
        2: () => {},
      };
    });

    const homeUrl =
      'file:///' +
      path.resolve('dist-desktop', 'home.html').replace(/\\/g, '/');

    // 1. Capture Mode View with unified typography
    console.log('Capturing CaptureModeView.png...');
    await page.goto(homeUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 600));

    // Hide tour popover non-destructively for clean capture
    await page.evaluate(() => {
      const pop = document.querySelector('.driver-popover');
      if (pop) pop.style.visibility = 'hidden';
      const ov = document.querySelector('.driver-overlay');
      if (ov) ov.style.visibility = 'hidden';
    });

    const captureModePath = path.join(promoDir, 'CaptureModeView.png');
    await page.screenshot({ path: captureModePath });
    fs.copyFileSync(
      captureModePath,
      path.join(remotionAssetsDir, 'CaptureModeView.png'),
    );
    console.log('Saved CaptureModeView.png');

    // Restore popover visibility so tour logic functions
    await page.evaluate(() => {
      const pop = document.querySelector('.driver-popover');
      if (pop) pop.style.visibility = 'visible';
      const ov = document.querySelector('.driver-overlay');
      if (ov) ov.style.visibility = 'visible';
    });

    // 2. Advance through Product Tour to reach Editor View (5 clicks)
    console.log('Advancing Product Tour to Editor View...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const nextBtn = document.querySelector('.driver-popover-next-btn');
        if (nextBtn) nextBtn.click();
      });
      await new Promise((r) => setTimeout(r, 600));
    }
    await new Promise((r) => setTimeout(r, 800));

    // Hide tour popover temporarily and add Apple Live Text OCR overlay precisely over the text
    await page.evaluate(() => {
      const pop = document.querySelector('.driver-popover');
      if (pop) pop.style.visibility = 'hidden';
      const ov = document.querySelector('.driver-overlay');
      if (ov) ov.style.visibility = 'hidden';

      const stage = document.querySelector('.stage') || document.body;
      const overlay = document.createElement('div');
      overlay.id = 'promo-live-text-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 440px;
        left: 712px;
        width: 215px;
        height: 25px;
        background-color: rgba(10, 132, 255, 0.38);
        border: 1.5px solid rgba(10, 132, 255, 0.85);
        border-radius: 4px;
        box-shadow: 0 0 16px rgba(10, 132, 255, 0.5);
        pointer-events: none;
        z-index: 100;
      `;
      stage.appendChild(overlay);

      const pill = document.createElement('div');
      pill.id = 'promo-live-text-pill';
      pill.style.cssText = `
        position: absolute;
        top: 380px;
        left: 712px;
        background-color: #161720;
        border: 1.5px solid #0A84FF;
        border-radius: 9999px;
        padding: 7px 18px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6), 0 0 16px rgba(10, 132, 255, 0.35);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 101;
      `;
      pill.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Copied Text to Clipboard</span>
      `;
      stage.appendChild(pill);
    });

    const editorLiveTextPath = path.join(promoDir, 'EditorLiveTextView.png');
    await page.screenshot({ path: editorLiveTextPath });
    fs.copyFileSync(
      editorLiveTextPath,
      path.join(remotionAssetsDir, 'EditorLiveTextView.png'),
    );
    console.log('Saved EditorLiveTextView.png');

    // 3. Open Searchable PDF Export popup with harmonized styling
    console.log('Opening Export Menu directly in Editor...');
    await page.evaluate(() => {
      document.getElementById('promo-live-text-overlay')?.remove();
      document.getElementById('promo-live-text-pill')?.remove();

      // Find and click the Export dropdown button
      const buttons = Array.from(document.querySelectorAll('button'));
      const exportBtn = buttons.find(
        (b) => b.textContent && b.textContent.includes('Export'),
      );
      if (exportBtn) {
        exportBtn.click();
      }
    });

    await new Promise((r) => setTimeout(r, 600));

    // Highlight Searchable PDF item in the menu
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.menu-item'));
      const searchablePdfItem = items.find(
        (it) => it.textContent && it.textContent.includes('Searchable PDF'),
      );
      if (searchablePdfItem) {
        searchablePdfItem.style.background = 'rgba(10, 132, 255, 0.22)';
        searchablePdfItem.style.border = '1.5px solid #0A84FF';
        searchablePdfItem.style.boxShadow = '0 0 18px rgba(10, 132, 255, 0.4)';
      }
    });

    const exportPath = path.join(promoDir, 'SearchablePdfExportView.png');
    await page.screenshot({ path: exportPath });
    fs.copyFileSync(
      exportPath,
      path.join(remotionAssetsDir, 'SearchablePdfExportView.png'),
    );
    console.log('Saved SearchablePdfExportView.png');

    console.log('All 3 UI promotional states successfully captured!');
  } finally {
    await browser.close();
  }
}

capturePromoAssets().catch((err) => {
  console.error('Failed to capture promo assets:', err);
  process.exit(1);
});
