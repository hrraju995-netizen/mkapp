import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy dist/index.html and dist/assets into public/ so Hostinger's git build copies them to public_html
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  fs.copyFileSync(path.join(distDir, 'index.html'), path.join(publicDir, 'index.html'));
  console.log('✓ Copied dist/index.html -> public/index.html');
}

if (fs.existsSync(path.join(distDir, 'assets'))) {
  copyRecursive(path.join(distDir, 'assets'), path.join(publicDir, 'assets'));
  console.log('✓ Copied dist/assets -> public/assets');
}
