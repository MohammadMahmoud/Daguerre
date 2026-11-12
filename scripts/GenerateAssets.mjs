#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

/**
 * Generates a valid, standards-compliant PNG buffer in pure Node.js.
 * Produces clean dark-surface placeholders (#14151B) matching Daguerre's design.
 */
function createSolidPng(width, height, r = 20, g = 21, b = 27) {
  const rowSize = 1 + width * 3;
  const raw = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
    }
  }
  const idatData = zlib.deflateSync(raw);

  function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 2; // RGB color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function generateAssets() {
  const isCapture = process.argv.includes('--capture');
  const remotionDir = path.resolve('src', 'remotion', 'Assets');
  const remotionPromoDir = path.resolve('src', 'remotion', 'Assets', 'Promo');
  const publicPromoDir = path.resolve('public', 'assets', 'promo');

  fs.mkdirSync(remotionPromoDir, { recursive: true });
  fs.mkdirSync(publicPromoDir, { recursive: true });

  // 1. Ensure DaguerreIcon.png exists from committed icon asset
  const iconTarget = path.join(remotionDir, 'DaguerreIcon.png');
  const iconSource = path.resolve('src-tauri', 'icons', 'icon.png');
  if (fs.existsSync(iconSource)) {
    fs.copyFileSync(iconSource, iconTarget);
  } else if (!fs.existsSync(iconTarget)) {
    fs.writeFileSync(iconTarget, createSolidPng(512, 512, 10, 132, 255));
  }

  // 2. If --capture is requested, run browser automation scripts
  if (isCapture) {
    console.log('Running genuine browser screenshot captures...');
    try {
      execFileSync(process.execPath, ['scripts/CaptureAppScreenshots.mjs'], {
        stdio: 'inherit',
      });
      execFileSync(process.execPath, ['scripts/CapturePromoAssets.mjs'], {
        stdio: 'inherit',
      });
      execFileSync(process.execPath, ['scripts/CapturePromoScreenshots.mjs'], {
        stdio: 'inherit',
      });
      console.log('All real promotional captures completed successfully.');
      return;
    } catch {
      console.warn(
        'Automated browser capture failed (e.g., Brave not available); falling back to placeholder generation.',
      );
    }
  }

  // 3. Ensure all Remotion sequence images exist
  const remotionAssets = [
    'CaptureModeView.png',
    'CaptureView.png',
    'EditorLiveTextView.png',
    'EditorView.png',
    'HistoryView.png',
    'SearchablePdfExportView.png',
    'SettingsView.png',
  ];

  const placeholderBuffer = createSolidPng(1440, 900);

  for (const name of remotionAssets) {
    const filePath = path.join(remotionDir, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, placeholderBuffer);
    }
  }

  // 4. Ensure Promo subdirectory assets exist
  const promoAssets = [
    'CaptureModeView.png',
    'EditorGoogleCapture.png',
    'EditorLiveTextView.png',
    'ExtensionInSitu.png',
    'ExtensionPopupBottom.png',
    'ExtensionPopupTop.png',
    'InteractiveLiveTextView.png',
    'SearchablePdfExportView.png',
    'StoreVerification.png',
  ];

  for (const name of promoAssets) {
    const remotionPromoPath = path.join(remotionPromoDir, name);
    if (!fs.existsSync(remotionPromoPath)) {
      fs.writeFileSync(remotionPromoPath, placeholderBuffer);
    }

    const publicPromoPath = path.join(publicPromoDir, name);
    if (!fs.existsSync(publicPromoPath)) {
      fs.writeFileSync(publicPromoPath, placeholderBuffer);
    }
  }

  console.log(
    'Promotional & Remotion assets verified/generated successfully in src/remotion/Assets/ and public/assets/promo/.',
  );
}

generateAssets().catch((err) => {
  console.error('Failed to generate assets:', err);
  process.exit(1);
});
