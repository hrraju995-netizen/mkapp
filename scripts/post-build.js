import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');
const publicHtmlDir = path.join(rootDir, 'public_html');

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

// 1. Copy dist to public/
if (fs.existsSync(distDir)) {
  copyRecursive(distDir, publicDir);
  console.log('✓ Copied dist -> public');
}

// 2. Copy dist to public_html/ (Hostinger web root)
if (fs.existsSync(distDir)) {
  if (!fs.existsSync(publicHtmlDir)) fs.mkdirSync(publicHtmlDir, { recursive: true });
  copyRecursive(distDir, publicHtmlDir);
  console.log('✓ Copied dist -> public_html');
}

// Ensure .htaccess exists in public_html
const htaccessPath = path.join(publicHtmlDir, '.htaccess');
const htaccessContent = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
`;
fs.writeFileSync(htaccessPath, htaccessContent, 'utf8');
console.log('✓ Ensured .htaccess in public_html');

