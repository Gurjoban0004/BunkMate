#!/usr/bin/env node
/**
 * Read-only: what the server-side activity ledger actually holds.
 *
 *   node scripts/peek-activity.js
 *
 * Answers "my friend signed in — why does the admin panel only show me?"
 * without guessing, by printing the three places the answer can be:
 *
 *   admin/activity/logins    every sign-in ATTEMPT, written by api/_activity.js
 *                            from inside the login endpoint. If a login reached
 *                            the server at all, it is here. Empty for a student
 *                            who signed in before that code was deployed, or
 *                            whose app never reached this deployment.
 *   admin/activity/students  the roster + liveness heartbeat.
 *   users/                   what the PHONE writes after a Firebase sign-in.
 *                            A student missing here but present above never
 *                            completed client sign-in — that is the failure the
 *                            ledger exists to see through, not a missing login.
 *
 * Credentials: same as scripts/clean-firestore.js — GOOGLE_APPLICATION_CREDENTIALS
 * pointing at a service-account JSON, or FIREBASE_SERVICE_ACCOUNT holding it.
 * Writes nothing.
 */

const fs = require('fs');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function initFirebase() {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (inline) return cert(JSON.parse(inline));
    if (path && fs.existsSync(path)) return cert(JSON.parse(fs.readFileSync(path, 'utf8')));
    if (path) { console.error('Credentials file not found at:', path); process.exit(1); }
    return applicationDefault();
}

initializeApp({ credential: initFirebase() });
const db = getFirestore();

const when = (t) => (t && t.toDate ? t.toDate().toISOString().replace('T', ' ').slice(0, 19) : '—');
const pad = (v, n) => String(v ?? '—').padEnd(n).slice(0, n);

(async () => {
    const logins = await db.collection('admin/activity/logins').limit(500).get();
    const events = logins.docs
        .map((d) => d.data())
        .sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0));

    console.log(`\n── sign-in attempts (admin/activity/logins) — ${events.length} ──`);
    if (!events.length) {
        console.log('  EMPTY. Every login that reached this project would be here, so either');
        console.log('  the sign-in hit a deployment without api/_activity.js, or it never');
        console.log('  reached the server at all.');
    }
    events.slice(0, 60).forEach((e) => console.log(
        `  ${when(e.at)}  ${pad(e.rollNumber, 12)} ${pad(e.outcome, 13)} ${pad(e.method, 9)} ` +
        `${pad(e.platform, 8)} ${pad(e.appVersion, 8)} ${e.isMock ? 'MOCK' : ''}`
    ));

    const roster = await db.collection('admin/activity/students').limit(500).get();
    console.log(`\n── roster (admin/activity/students) — ${roster.size} ──`);
    roster.docs.forEach((d) => {
        const v = d.data();
        console.log(
            `  ${pad(d.id, 12)} ${pad(v.studentName, 22)} logins:${pad(v.loginCount || 0, 4)} ` +
            `syncs:${pad(v.syncCount || 0, 6)} lastSeen:${when(v.lastSeenAt)} ${v.isMock ? 'MOCK' : ''}`
        );
    });

    const users = await db.collection('users').limit(500).get();
    console.log(`\n── users/ written by the phone — ${users.size} ──`);
    users.docs.forEach((d) => {
        const v = d.data();
        console.log(`  ${pad(d.id, 12)} ${pad(v.userName || v.studentName, 22)} lastActive:${when(v.lastActive)}`);
    });

    const inLedger = new Set(roster.docs.map((d) => d.id));
    const inUsers = new Set(users.docs.map((d) => d.id));
    const ledgerOnly = [...inLedger].filter((r) => !inUsers.has(r));
    if (ledgerOnly.length) {
        console.log(`\n  Signed in but never wrote from the phone: ${ledgerOnly.join(', ')}`);
        console.log('  (Firebase client sign-in or the security rules are failing for them.)');
    }
    console.log('');
    process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
