import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  build: {
    emptyOutDir: true
  },
  plugins: [
    {
      name: 'save-download-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/save-download') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
              try {
                const { filename, dataUrl } = JSON.parse(body);
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                const outDir = path.resolve(import.meta.dirname, 'downloads');
                if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
                const safeName = filename || 'TextShift_Edited.png';
                const filePath = path.join(outDir, safeName);
                fs.writeFileSync(filePath, base64Data, 'base64');
                // Also write to public
                fs.writeFileSync(path.resolve(import.meta.dirname, 'public', safeName), base64Data, 'base64');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, path: filePath, url: `/${safeName}` }));
              } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
              }
            });
            return;
          }
          next();
        });
      }
    }
  ]
});
