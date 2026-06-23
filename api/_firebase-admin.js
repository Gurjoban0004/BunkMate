/**
 * Shared Firebase Admin SDK initialization for Vercel serverless functions.
 *
 * Requires either:
 *   - FIREBASE_SERVICE_ACCOUNT env var (JSON string of the service account key)
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing to a JSON key file (local dev)
 *
 * Also reads ADMIN_ROLL_NUMBERS (comma-separated) for server-side admin validation.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount)),
        });
    } else {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
    }
}

const adminDb = admin.firestore();

const ADMIN_ROLL_NUMBERS = (process.env.ADMIN_ROLL_NUMBERS || '2410990296')
    .split(',')
    .map(r => r.trim())
    .filter(Boolean);

function isAdminRoll(rollNumber) {
    if (!rollNumber) return false;
    return ADMIN_ROLL_NUMBERS.includes(String(rollNumber).trim());
}

module.exports = { adminDb, isAdminRoll };
