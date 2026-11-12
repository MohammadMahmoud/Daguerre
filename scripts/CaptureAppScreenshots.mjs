import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Captures 100% genuine, live application screenshots directly from the compiled
 * Daguerre application frontend running in Brave browser.
 */
async function captureAppScreenshots() {
  const assetsDir = path.resolve('src', 'remotion', 'Assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const bravePath =
    'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
  console.log('Launching Brave for live Daguerre application screenshots...');

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
      height: 920,
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

    // 1. Capture View
    console.log('Capturing fresh CaptureView.png...');
    await page.goto(homeUrl, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(assetsDir, 'CaptureView.png'),
    });

    // 2. History View
    console.log('Capturing fresh HistoryView.png...');
    await page.evaluate(() => {
      const historyTab = Array.from(
        document.querySelectorAll('.sidebar-nav button, a'),
      ).find((el) => el.textContent && el.textContent.includes('History'));
      if (historyTab) historyTab.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(assetsDir, 'HistoryView.png'),
    });

    // 3. Settings View
    console.log('Capturing fresh SettingsView.png...');
    await page.evaluate(() => {
      const settingsTab = Array.from(
        document.querySelectorAll('.sidebar-nav button, a'),
      ).find((el) => el.textContent && el.textContent.includes('Settings'));
      if (settingsTab) settingsTab.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({
      path: path.join(assetsDir, 'SettingsView.png'),
    });

    // 4. Editor View with real sample from Product Tour
    console.log('Capturing fresh EditorView.png with sample...');
    await page.evaluate(() => {
      const tourTab = Array.from(
        document.querySelectorAll('.sidebar-nav button, a'),
      ).find((el) => el.textContent && el.textContent.includes('Product Tour'));
      if (tourTab) tourTab.click();
    });
    // Wait for driver.js popover and click Next 4 times to enter editor stage
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 600));
      await page.evaluate(() => {
        const nextBtn = document.querySelector('.driver-popover-next-btn');
        if (nextBtn) nextBtn.click();
      });
    }
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({
      path: path.join(assetsDir, 'EditorView.png'),
    });

    console.log(
      'All fresh screenshots captured directly from running app into src/remotion/Assets/!',
    );
  } finally {
    await browser.close();
  }
}

captureAppScreenshots().catch((err) => {
  console.error('Failed to capture application screenshots:', err);
  process.exit(1);
});
