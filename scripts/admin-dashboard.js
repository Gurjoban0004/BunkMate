#!/usr/bin/env node
/**
 * The full admin dashboard, on your own machine.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npm run admin
 *   → http://127.0.0.1:4545
 *
 * Everything the in-app panel shows, plus the detail a phone screen has no
 * room for: a session timeline per student, full sign-in and sync history,
 * raw config, every announcement and the audit log.
 *
 * The numbers come from the very same functions api/admin-analytics.js serves
 * (its METRICS export), run here against Firestore with the Admin SDK — so the
 * dashboard and the panel cannot disagree. Read-only: it never writes, not
 * even the analytics cache.
 *
 * It listens on 127.0.0.1 only. Anyone who can reach it reads every student's
 * data, with no sign-in, so never bind it to another interface.
 *
 * Credentials: same as scripts/peek-activity.js — GOOGLE_APPLICATION_CREDENTIALS
 * pointing at a service-account JSON, or FIREBASE_SERVICE_ACCOUNT holding it.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON first:\n');
    console.error('  GOOGLE_APPLICATION_CREDENTIALS=~/Downloads/<project>-firebase-adminsdk-….json npm run admin\n');
    process.exit(1);
}

// admin-analytics loads the session module, which refuses to load without a
// secret. Nothing here opens a token, so a throwaway one is enough.
process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || require('crypto').randomBytes(32).toString('hex');

const analytics = require('../api/admin-analytics');
const { adminDb } = require('../api/_firebase-admin');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4545;
const PAGE = path.join(__dirname, 'admin-dashboard.html');

const millis = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : v ?? null);
/** Firestore doc → plain JSON, Timestamps as epoch ms. */
function plain(value) {
    if (value && typeof value.toMillis === 'function') return value.toMillis();
    if (Array.isArray(value)) return value.map(plain);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
    return value;
}
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...plain(d.data()) }));

// What the panel reads client-side or through api/admin.js, read directly here.
const RAW = {
    config: async () => {
        const snap = await adminDb.doc('admin/config').get();
        return snap.exists ? plain(snap.data()) : null;
    },
    announcements: async () => docs(await adminDb.collection('admin/announcements/items').limit(200).get())
        .sort((a, b) => (millis(b.createdAt) || 0) - (millis(a.createdAt) || 0)),
    revoked: async () => docs(await adminDb.collection('admin/revokedUsers/items').limit(500).get()),
    audit: async () => docs(await adminDb.collection('admin/auditLog/entries').orderBy('at', 'desc').limit(200).get()),
};

async function route(url) {
    const [, kind, name] = url.pathname.split('/').filter(Boolean);
    const query = Object.fromEntries(url.searchParams);
    if (kind === 'metric' && Object.prototype.hasOwnProperty.call(analytics.METRICS, name)) {
        const { params, error } = analytics.metricParams(name, query);
        if (error) return [400, { error }];
        return [200, await analytics.METRICS[name](params)];
    }
    if (kind === 'raw' && Object.prototype.hasOwnProperty.call(RAW, name)) return [200, await RAW[name]()];
    return [404, { error: 'Not found' }];
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    // Reject pages on other origins that try to read this through the browser
    // (DNS rebinding): only our own Host header is served.
    if (req.headers.host !== `${HOST}:${PORT}` && req.headers.host !== `localhost:${PORT}`) {
        res.writeHead(403).end('Forbidden');
        return;
    }
    if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        fs.createReadStream(PAGE).pipe(res);
        return;
    }
    if (!url.pathname.startsWith('/api/') || req.method !== 'GET') {
        res.writeHead(404).end('Not found');
        return;
    }
    const started = Date.now();
    try {
        const [status, body] = await route(url);
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(body));
        console.log(`${status} ${url.pathname}${url.search} ${Date.now() - started}ms`);
    } catch (err) {
        console.error(`500 ${url.pathname}:`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Presence admin dashboard → http://${HOST}:${PORT}`);
    console.log('Read-only. Every page load reads Firestore, so it counts against the daily quota.');
});
