#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  generateKeyPairSync,
} from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

function encodeVarint(value) {
  const bytes = [];
  while (value > 0x7f) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return Buffer.from(bytes);
}

function encodeField(fieldNumber, wireType, data) {
  return Buffer.concat([
    encodeVarint((fieldNumber << 3) | wireType),
    encodeVarint(data.length),
    data,
  ]);
}

export function buildCrxBuffer(
  zipBuffer,
  keyPem = process.env.CRX_PRIVATE_KEY,
) {
  const privateKey = keyPem
    ? createPrivateKey(keyPem)
    : generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const publicKeyDer = createPublicKey(privateKey).export({
    type: 'spki',
    format: 'der',
  });
  const crxId = createHash('sha256')
    .update(publicKeyDer)
    .digest()
    .subarray(0, 16);
  const signedData = encodeField(1, 2, crxId);
  const signedLen = Buffer.alloc(4);
  signedLen.writeUInt32LE(signedData.length, 0);

  const signer = createSign('RSA-SHA256');
  signer.update(Buffer.from('CRX3 SignedData\0', 'utf8'));
  signer.update(signedLen);
  signer.update(signedData);
  signer.update(zipBuffer);
  const signature = signer.sign(privateKey);

  const keyProof = Buffer.concat([
    encodeField(1, 2, publicKeyDer),
    encodeField(2, 2, signature),
  ]);
  const header = Buffer.concat([
    encodeField(2, 2, keyProof),
    encodeField(10000, 2, signedData),
  ]);
  const prefix = Buffer.alloc(12);
  prefix.write('Cr24', 0, 4, 'ascii');
  prefix.writeUInt32LE(3, 4);
  prefix.writeUInt32LE(header.length, 8);
  return Buffer.concat([prefix, header, zipBuffer]);
}

export function verifyExtension(directory = 'dist') {
  if (!existsSync(`${directory}/manifest.json`))
    throw new Error(`${directory}/manifest.json is missing; run pnpm build`);
  const manifest = JSON.parse(
    readFileSync(`${directory}/manifest.json`, 'utf8'),
  );
  if (
    manifest.manifest_version !== 3 ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version)
  )
    throw new Error('Invalid extension manifest version');
  for (const file of [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    'editor.html',
    'history.html',
    'clipboard.html',
    'ocr/worker.min.js',
    'ocr/eng.traineddata.gz',
  ]) {
    if (
      !file ||
      !resolve(directory, file).startsWith(resolve(directory) + sep) ||
      !existsSync(`${directory}/${file}`) ||
      !statSync(`${directory}/${file}`).size
    )
      throw new Error(
        `Extension manifest references missing or empty output: ${file}`,
      );
  }
  const source = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
  if (manifest.version !== source.version)
    throw new Error('Built extension manifest is stale');
  if (!readdirSync(`${directory}/assets`).length)
    throw new Error('Extension assets are empty');
  return manifest;
}

export function packageExtension(
  out = 'daguerre.zip',
  crxOut = 'daguerre.crx',
) {
  verifyExtension();
  const archive = resolve(out);
  const crxArchive = resolve(crxOut);
  rmSync(archive, { force: true });
  rmSync(crxArchive, { force: true });
  if (process.platform === 'win32') {
    execFileSync('tar', ['-a', '-c', '-f', archive, '--exclude', '.*', '*'], {
      cwd: 'dist',
      stdio: 'inherit',
    });
  } else {
    execFileSync('zip', ['-qrX', archive, '.', '-x', '.*'], {
      cwd: 'dist',
      stdio: 'inherit',
    });
  }
  writeFileSync(crxArchive, buildCrxBuffer(readFileSync(archive)));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.includes('--verify')) verifyExtension();
    else packageExtension(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(`extension package: ${error.message}`);
    process.exitCode = 1;
  }
}
