/**
 * Research participation (AI/ML class project — see attendance-insights/PLAN.md).
 *
 * Consent mints a random UUID and stores it on the device. That UUID is the only
 * thing that ever leaves with the attendance data — no name, no roll number, no
 * login code — so there is nothing to anonymise later. No UUID means no upload and
 * the app behaves exactly as it did before.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ID_KEY        = '@presence_research_id';
const CONSENTED_KEY = '@presence_research_consented_at';
const DECLINED_KEY  = '@presence_research_declined';

// undefined = not read from storage yet, null = not participating
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

/** The participant UUID, or null if the student has not consented. */
export async function getResearchId() {
    if (cachedId === undefined) {
        try {
            cachedId = (await AsyncStorage.getItem(ID_KEY)) || null;
        } catch {
            cachedId = null;
        }
    }
    return cachedId;
}

/** ISO timestamp of consent, or null. Sent alongside the data as the consent record. */
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

/** Whether the student has already answered the consent question either way. */
export async function hasAnsweredConsent() {
    if (await getResearchId()) return true;
    try {
        return (await AsyncStorage.getItem(DECLINED_KEY)) === '1';
    } catch {
        return false;
    }
}

/** Opt in. Returns the new participant UUID. */
export async function consentToResearch() {
    const id = uuidV4();
    const at = new Date().toISOString();
    await AsyncStorage.multiSet([[ID_KEY, id], [CONSENTED_KEY, at]]);
    await AsyncStorage.removeItem(DECLINED_KEY);
    cachedId = id;
    cachedConsentedAt = at;
    return id;
}

/** Decline without consenting. Remembered so the screen is not shown again. */
export async function declineResearch() {
    await AsyncStorage.setItem(DECLINED_KEY, '1');
    cachedId = null;
    cachedConsentedAt = null;
}

/** Forget the UUID locally. The server-side delete is the caller's job. */
export async function forgetResearchId() {
    await AsyncStorage.multiRemove([ID_KEY, CONSENTED_KEY]);
    await AsyncStorage.setItem(DECLINED_KEY, '1');
    cachedId = null;
    cachedConsentedAt = null;
}
