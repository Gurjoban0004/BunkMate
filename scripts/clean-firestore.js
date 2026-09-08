#!/usr/bin/env node
/**
 * One-off cleanup: mock/test data and login-code leftovers.
 *
 *   node scripts/clean-firestore.js            # dry run — prints, deletes nothing
 *   node scripts/clean-firestore.js --apply    # actually deletes
 *
 * Credentials: GOOGLE_APPLICATION_CREDENTIALS pointing at a service-account
 * JSON, or FIREBASE_SERVICE_ACCOUNT holding the JSON itself (the same variable
 * the API uses). Nothing here runs without one.
 *
 * WHAT IT DELETES
 *   1. users/{id} where the id is not a roll number and the doc carries no real
 *      erpRollNumber — PRES-XXXXXXX leftovers and mock accounts — plus their
 *      semesters/ and push/ subcollections and their telemetry/{id} tree.
 *   2. admin/activity/{students,logins} entries flagged isMock.
 *   3. research items flagged isMock.
 *   4. admin/analyticsCache — derived, regenerates on the next panel load.
 *   5. rateLimits counters whose window has already expired.
 *
 * WHAT IT NEVER TOUCHES
 *   Any user whose id is a real roll number, admin/config, announcements,
 *   revokedUsers, auditLog, and any research item without an isMock flag.
 *
 * Deleting is per-document rather than by a recursive path wipe: this file is
 * pointed at live student data, and a wrong prefix in a recursive delete has no
 * undo. Read the dry run before passing --apply.
 */

const fs = require('fs');
const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const APPLY = process.argv.includes('--apply');
const REAL_ROLL = /^\d{6,}$/;

function initFirebase() {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    let credential;
    if (inline) {
        credential = cert(JSON.parse(inline));
    } else if (path && fs.existsSync(path)) {
        credential = cert(JSON.parse(fs.readFileSync(path, 'utf8')));
    } else if (path) {
        console.error('Credentials file not found at:', path);
        process.exit(1);
    } else {
        credential = applicationDefault();
    }
    initializeApp({ credential });
    return getFirestore();
}

const db = initFirebase();
const plan = [];   // { path, why }
const note = (ref, why) => plan.push({ path: ref.path, why, ref });

/** Every document under a collection ref, including nested subcollections. */
async function collectTree(colRef, why) {
    const snap = await colRef.get();
    for (const d of snap.docs) {
        for (const sub of await d.ref.listCollections()) await collectTree(sub, why);
        note(d.ref, why);
    }
}

async function planUsers() {
    const snap = await db.collection('users').get();
    for (const d of snap.docs) {
        const data = d.data() || {};
        const roll = String(data.erpRollNumber || '').trim();
        // A real student is safe whichever way their roll is recorded.
        if (REAL_ROLL.test(d.id) || REAL_ROLL.test(roll)) continue;

        const why = d.id.startsWith('PRES-') ? 'legacy login-code account' : 'mock / test account';
        for (const sub of await d.ref.listCollections()) await collectTree(sub, why);
        note(d.ref, why);

        // The telemetry tree is keyed by the same id.
        const tele = db.collection('telemetry').doc(d.id);
        for (const sub of await tele.listCollections()) await collectTree(sub, why + ' (telemetry)');
        if ((await tele.get()).exists) note(tele, why + ' (telemetry)');
    }
}

async function planMockFlagged() {
    const targets = [
        [db.collection('admin/activity/students'), 'mock student in the activity ledger'],
        [db.collection('admin/activity/logins'), 'mock sign-in event'],
        [db.collection('research').doc('students').collection('items'), 'mock research item'],
    ];
    for (const [col, why] of targets) {
        const snap = await col.where('isMock', '==', true).get().catch(() => null);
        if (snap) snap.docs.forEach((d) => note(d.ref, why));
    }
}

async function planDerived() {
    const cacheDoc = db.doc('admin/analyticsCache');
    for (const sub of await cacheDoc.listCollections()) await collectTree(sub, 'analytics cache (regenerates)');
    if ((await cacheDoc.get()).exists) note(cacheDoc, 'analytics cache (regenerates)');

    const now = Date.now();
    const snap = await db.collection('rateLimits').get();
    for (const d of snap.docs) {
        const data = d.data() || {};
        const expires = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : (data.resetAt || 0);
        if (expires && expires < now) note(d.ref, 'expired rate-limit counter');
    }
}

(async () => {
    await planUsers();
    await planMockFlagged();
    await planDerived();

    const byReason = plan.reduce((acc, p) => { (acc[p.why] ||= []).push(p.path); return acc; }, {});
    for (const [why, paths] of Object.entries(byReason)) {
        console.log(`\n${why} — ${paths.length}`);
        paths.slice(0, 25).forEach((p) => console.log('  ' + p));
        if (paths.length > 25) console.log(`  … and ${paths.length - 25} more`);
    }

    const kept = (await db.collection('users').get()).size - plan.filter((p) => /^users\/[^/]+$/.test(p.path)).length;
    console.log(`\n${plan.length} documents to delete. ${kept} student accounts kept.`);

    if (!APPLY) {
        console.log('\nDry run — nothing was deleted. Re-run with --apply once this list looks right.');
        return;
    }

    // Children were noted before their parents, so committing in order never
    // orphans a subcollection behind a deleted document.
    for (let i = 0; i < plan.length; i += 400) {
        const batch = db.batch();
        plan.slice(i, i + 400).forEach((p) => batch.delete(p.ref));
        await batch.commit();
        console.log(`deleted ${Math.min(i + 400, plan.length)}/${plan.length}`);
    }
    console.log('Done.');
})().catch((err) => { console.error(err); process.exit(1); });
