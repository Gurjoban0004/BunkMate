// Local CSP check: serves ./dist with the exact headers from vercel.json (which
// `vercel dev` does not apply) and proxies /api/* to a running `vercel dev` on :3000.
//   1. cd presence && npx expo export -p web
//   2. ALLOW_MOCK_LOGIN=1 npx vercel dev --listen 3000     (in another shell)
//   3. node scripts/csp-check-server.js  → open http://localhost:3001/app, watch the console
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = require("path").resolve(__dirname, "..");
const DIST = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const allHeaders = cfg.headers.find(h => h.source === '/(.*)').headers;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    for (const h of allHeaders) res.setHeader(h.key, h.value);

    if (url.pathname.startsWith('/api/')) {
        const proxy = http.request({ host: '127.0.0.1', port: 3000, path: req.url, method: req.method, headers: { ...req.headers, host: 'localhost:3000' } }, (up) => {
            res.writeHead(up.statusCode, up.headers);
            up.pipe(res);
        });
        proxy.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
        req.pipe(proxy);
        return;
    }

    let file = url.pathname === '/app' || url.pathname.startsWith('/app/') ? '/app.html' : url.pathname;
    if (file === '/') file = '/index.html';
    const abs = path.join(DIST, file);
    if (!abs.startsWith(DIST) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.setHeader('Content-Type', MIME[path.extname(abs)] || 'application/octet-stream');
    fs.createReadStream(abs).pipe(res);
}).listen(3001, () => console.log('csp-proxy on http://localhost:3001 (CSP enforced)'));
