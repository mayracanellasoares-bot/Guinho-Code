import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['index.html', 'manifest.webmanifest', 'sw.js', 'guinho-logo.svg'];
for (const file of files) {
  const info = await stat(path.join(root, file));
  if (!info.isFile() || info.size === 0) throw new Error(`Missing static asset: ${file}`);
}
const html = await readFile(path.join(root, 'index.html'), 'utf8');
for (const marker of ['/api/chat', '/api/health', 'serviceWorker']) {
  if (!html.includes(marker)) throw new Error(`Frontend marker missing: ${marker}`);
}
console.log('Static frontend verification passed.');
