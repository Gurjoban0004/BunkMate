/**
 * Research participation (AI/ML class project — see attendance-insights/PLAN.md).
 *
 * The device mints a random UUID on first sync. That UUID is the only thing that
 * ever leaves with the attendance data — no name, no roll number, no account id —
 * so there is nothing to anonymise later. What is filed is the same register the
 * college publishes to the class; nothing personal rides along.
 *
 * There is no consent screen: it read as "we are collecting your private data"
 * for a dataset that holds none of it. See docs/ONBOARDING-SPEED-2026-09-07.md.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ID_KEY        = '@presence_research_id';
const CONSENTED_KEY = '@presence_research_consented_at';
const UPLOADED_PREFIX = '@presence_research_uploaded_at:';

// undefined = not read from storage yet
let cachedId;
let cachedConsentedAt;

// ponytail: Math.random, not a CSPRNG — this is a participant label, not a secret,
// and 50 devices will not collide. Swap in expo-crypto's randomUUID if it ever is one.
function uuidV4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

/**
 * This install's participant UUID, minted on first call and kept from then on.
 * Returns null only if storage itself is unreadable — in which case nothing is
 * filed, which is the safe direction to fail.
 */
export async function getResearchId() {
    if (cachedId === undefined) {
        try {
            const stored = await AsyncStorage.getItem(ID_KEY);
            if (stored) {
                cachedId = stored;
            } else {
                cachedId = uuidV4();
                cachedConsentedAt = new Date().toISOString();
                await AsyncStorage.multiSet([[ID_KEY, cachedId], [CONSENTED_KEY, cachedConsentedAt]]);
            }
        } catch {
            cachedId = null;
        }
    }
    return cachedId;
}

/** ISO timestamp the UUID was minted. Filed with the data as the enrolment date. */
export async function getConsentedAt() {
    if (cachedConsentedAt === undefined) {
        try {
            cachedConsentedAt = (await AsyncStorage.getItem(CONSENTED_KEY)) || null;
        } catch {
            cachedConsentedAt = null;
        }
    }
    return cachedConsentedAt;
}

// A semester's register does not change twenty times an hour, but the app syncs
// every three minutes — and each tagged sync makes the server write ~1000 marks
// to Firestore *before* it can answer, on the request the student is waiting on.
// Six hours keeps the dataset current to within a lecture block, takes that write
// off ~99% of syncs, and keeps a class of 50 well inside the daily write quota.
const UPLOAD_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Kept per endpoint, because different endpoints file different halves of the
// row: the register writes `marks`, the timetable writes `slots`. One shared
// clock would let whichever request went first eat the window and leave the
// other half of the dataset permanently unwritten.
const cachedUploadedAt = new Map();

/**
 * Whether this request should carry the dataset. Every upload is a full
 * replacement, so a skipped or failed one costs nothing but freshness — the next
 * one catches up.
 */
export async function shouldUploadResearch(endpoint) {
    if (!cachedUploadedAt.has(endpoint)) {
        try {
            cachedUploadedAt.set(endpoint, Number(await AsyncStorage.getItem(UPLOADED_PREFIX + endpoint)) || 0);
        } catch {
            cachedUploadedAt.set(endpoint, 0);
        }
    }
    return Date.now() - cachedUploadedAt.get(endpoint) > UPLOAD_INTERVAL_MS;
}

/** Called once the tagged request has been sent. Never throws. */
export async function markResearchUploaded(endpoint) {
    const now = Date.now();
    cachedUploadedAt.set(endpoint, now);
    try {
        await AsyncStorage.setItem(UPLOADED_PREFIX + endpoint, String(now));
    } catch { /* a lost timestamp just means one extra upload */ }
}
