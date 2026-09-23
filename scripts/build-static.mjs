import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const files = [
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'guinho-logo.svg',
  'guinho-192.png',
  'guinho-512.png',
  'hello.bit',
  'movement.bit',
  'pong.bit',
  'nave.bit',
  'breakout.bit',
  'tetris.bit'
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of files) {
  await cp(path.join(root, file), path.join(dist, file));
}
console.log(`Static artifact generated in ${path.relative(root, dist)}/`);
