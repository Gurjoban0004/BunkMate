/**
 * ERP Token Storage
 *
 * Stores two opaque encrypted blobs:
 *   token           — session token (userId/sessionId/roleId/apiKey), no expiry
 *   persistentToken — credential token (username/password), no expiry
 *
 * Sessions are refreshed on failure, not on a timer.
 * The client never sees plaintext contents of either token.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ERP_TOKEN_KEY        = '@presence_erp_token';
const ERP_STUDENT_NAME_KEY = '@presence_erp_student_name';
const ERP_PERSISTENT_KEY   = '@presence_erp_persistent_token';

/**
 * Save session token and optionally the persistent credential token.
 */
export async function saveErpToken(token, studentName = '', persistentToken = null) {
    try {
        const pairs = [
            [ERP_TOKEN_KEY,        token],
            [ERP_STUDENT_NAME_KEY, studentName],
        ];
        if (persistentToken) pairs.push([ERP_PERSISTENT_KEY, persistentToken]);
        await AsyncStorage.multiSet(pairs);
    } catch (err) {
        console.error('Failed to save ERP token:', err);
        throw err;
    }
}

/**
 * Get the session token. Returns null only if never set (not yet logged in).
 * No expiry check — validity is determined by ERP response.
 */
export async function getErpToken() {
    try {
        return await AsyncStorage.getItem(ERP_TOKEN_KEY);
    } catch (err) {
        console.error('Failed to get ERP token:', err);
        return null;
    }
}

/**
 * Get the persistent credential token.
 */
export async function getErpPersistentToken() {
    try {
        return await AsyncStorage.getItem(ERP_PERSISTENT_KEY);
    } catch {
        return null;
    }
}

/**
 * Update the session token after a successful re-login.
 * Also updates the persistent token if a refreshed one was returned.
 */
export async function updateErpToken(token, persistentToken = null) {
    try {
        const pairs = [[ERP_TOKEN_KEY, token]];
        if (persistentToken) pairs.push([ERP_PERSISTENT_KEY, persistentToken]);
        await AsyncStorage.multiSet(pairs);
    } catch (err) {
        console.error('Failed to update ERP token:', err);
    }
}

/**
 * Get stored student name from last ERP login.
 */
export async function getErpStudentName() {
    try {
        return (await AsyncStorage.getItem(ERP_STUDENT_NAME_KEY)) || '';
    } catch {
        return '';
    }
}

/**
 * Clear all ERP tokens (disconnect / logout).
 */
export async function clearErpToken() {
    try {
        await AsyncStorage.multiRemove([ERP_TOKEN_KEY, ERP_STUDENT_NAME_KEY, ERP_PERSISTENT_KEY]);
    } catch (err) {
        console.error('Failed to clear ERP token:', err);
    }
}

/**
 * Returns true if a session token exists (doesn't guarantee it's still valid with ERP).
 */
export async function isErpConnected() {
    return (await getErpToken()) !== null;
}
