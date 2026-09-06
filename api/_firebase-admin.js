/**
 * Shared Firebase Admin SDK initialization for Vercel serverless functions.
 *
 * Requires either:
 *   - FIREBASE_SERVICE_ACCOUNT env var (JSON string of the service account key)
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing to a JSON key file (local dev)
 *
 * ADMIN_ROLL_NUMBERS (comma-separated) is the only source of admin identity.
 * There is deliberately no baked-in default: an admin list that lives in the
 * source is both a disclosure and a thing nobody remembers to change.
 */

// Modular API only — firebase-admin v14 dropped the namespaced surface.
const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    initializeApp({
        credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
    });
}

const adminDb = getFirestore();

const ADMIN_ROLL_NUMBERS = String(process.env.ADMIN_ROLL_NUMBERS || '')
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);

function isAdminRoll(rollNumber) {
    if (!rollNumber) return false;
    return ADMIN_ROLL_NUMBERS.includes(String(rollNumber).trim());
}

module.exports = { adminDb, isAdminRoll };
