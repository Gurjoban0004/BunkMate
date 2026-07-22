/**
 * Sync telemetry — one doc per sync cycle at telemetry/{userId}/syncs/{autoId}.
 *
 * This is the ONLY writer for the data behind the Admin panel's Endpoint Health,
 * Parser Failures and Rate Limit cards (api/admin-analytics.js reads it via a
 * collectionGroup('syncs') query). Without it those three cards are always empty.
 *
 * Fire-and-forget: telemetry must never break or slow down a sync.
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ensureAuthenticated } from '../utils/firebaseHelpers';
import { logger } from '../utils/logger';

/**
 * @param {string} userId       login code — also the Firebase uid (rules require the match)
 * @param {Object} sync
 * @param {Array}  sync.endpoints    [{ name, status: 'ok'|'fail', durationMs, error? }]
 * @param {Array}  sync.parserErrors [{ endpoint, message }]
 * @param {string} sync.rollNumber   ERP roll number, for the admin failure list
 */
export async function logSync(userId, { endpoints = [], parserErrors = [], rollNumber = null }) {
    if (!userId || endpoints.length === 0) return;
    try {
        if (!(await ensureAuthenticated(userId))) return;
        // ponytail: unbounded growth. Add a TTL policy on telemetry/*/syncs in the
        // Firebase console if the collection ever gets expensive.
        await addDoc(collection(db, 'telemetry', userId, 'syncs'), {
            timestamp: serverTimestamp(),
            endpoints,
            parserErrors,
            rollNumber,
        });
    } catch (err) {
        logger.warn('⚠️ Telemetry write failed (non-critical):', err.message);
    }
}

/**
 * Times an endpoint call and appends the outcome to `endpoints`.
 * Re-throws so callers keep their existing error handling.
 */
export async function trackEndpoint(endpoints, name, fn) {
    const startedAt = Date.now();
    try {
        const result = await fn();
        endpoints.push({ name, status: 'ok', durationMs: Date.now() - startedAt });
        return result;
    } catch (err) {
        endpoints.push({
            name,
            status: 'fail',
            durationMs: Date.now() - startedAt,
            error: String(err?.message || err).slice(0, 200),
        });
        throw err;
    }
}
