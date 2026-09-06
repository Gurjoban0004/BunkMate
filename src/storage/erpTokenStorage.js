/**
 * ERP token storage.
 *
 * Two opaque sealed blobs — the session token and the persistent (credential)
 * token — plus the install's device id. On native they live in the OS keystore
 * (expo-secure-store: Android Keystore / iOS Keychain), not in AsyncStorage's
 * plaintext SQLite file. On web there is no keystore, so localStorage it is.
 *
 * Existing installs are migrated on first read: any value still in AsyncStorage
 * is moved into SecureStore and removed from AsyncStorage.
 *
 * The device id (audit C1) is a random UUID minted once per install. The server
 * seals it into the persistent token and presents it to the ERP as the
 * "trusted device", so the same install stays trusted and a new one meets an OTP.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const ERP_TOKEN_KEY        = '@presence_erp_token';
const ERP_STUDENT_NAME_KEY = '@presence_erp_student_name';
const ERP_PERSISTENT_KEY   = '@presence_erp_persistent_token';
const DEVICE_ID_KEY        = '@presence_device_id';

// SecureStore keys may only contain [A-Za-z0-9._-].
const secureKey = (key) => key.replace(/[^A-Za-z0-9._-]/g, '_');
const useSecure = Platform.OS !== 'web';

async function readSecret(key) {
    if (!useSecure) return AsyncStorage.getItem(key);
    try {
        const value = await SecureStore.getItemAsync(secureKey(key));
        if (value !== null) return value;
        // One-time migration from the pre-keystore layout.
        const legacy = await AsyncStorage.getItem(key);
        if (legacy !== null) {
            await SecureStore.setItemAsync(secureKey(key), legacy);
            await AsyncStorage.removeItem(key);
        }
        return legacy;
    } catch {
        // A broken keystore must not brick the app: fall back to what is readable.
        return AsyncStorage.getItem(key);
    }
}

async function writeSecret(key, value) {
    if (!useSecure) return AsyncStorage.setItem(key, value);
    try {
        await SecureStore.setItemAsync(secureKey(key), value);
        await AsyncStorage.removeItem(key).catch(() => {});
    } catch {
        await AsyncStorage.setItem(key, value);
    }
}

async function removeSecret(key) {
    await Promise.all([
        useSecure ? SecureStore.deleteItemAsync(secureKey(key)).catch(() => {}) : Promise.resolve(),
        AsyncStorage.removeItem(key).catch(() => {}),
    ]);
}

/** Save the session token, the student's name, and (if given) the persistent token. */
export async function saveErpToken(token, studentName = '', persistentToken = null) {
    try {
        await writeSecret(ERP_TOKEN_KEY, token);
        await AsyncStorage.setItem(ERP_STUDENT_NAME_KEY, studentName || '');
        if (persistentToken) await writeSecret(ERP_PERSISTENT_KEY, persistentToken);
    } catch (err) {
        console.error('Failed to save ERP token:', err);
        throw err;
    }
}

/** The session token, or null if never set. Validity is decided by the server. */
export async function getErpToken() {
    try {
        return await readSecret(ERP_TOKEN_KEY);
    } catch (err) {
        console.error('Failed to get ERP token:', err);
        return null;
    }
}

export async function getErpPersistentToken() {
    try {
        return await readSecret(ERP_PERSISTENT_KEY);
    } catch {
        return null;
    }
}

/** Update the session token after a refresh; the persistent token too if one came back. */
export async function updateErpToken(token, persistentToken = null) {
    try {
        await writeSecret(ERP_TOKEN_KEY, token);
        if (persistentToken) await writeSecret(ERP_PERSISTENT_KEY, persistentToken);
    } catch (err) {
        console.error('Failed to update ERP token:', err);
    }
}

export async function getErpStudentName() {
    try {
        return (await AsyncStorage.getItem(ERP_STUDENT_NAME_KEY)) || '';
    } catch {
        return '';
    }
}

/** Clear everything the ERP session owns. The device id survives on purpose. */
export async function clearErpToken() {
    try {
        await removeSecret(ERP_TOKEN_KEY);
        await removeSecret(ERP_PERSISTENT_KEY);
        await AsyncStorage.removeItem(ERP_STUDENT_NAME_KEY);
    } catch (err) {
        console.error('Failed to clear ERP token:', err);
    }
}

export async function isErpConnected() {
    return (await getErpToken()) !== null;
}

/**
 * This install's device id. Minted with a CSPRNG on first use and kept across
 * disconnect/reconnect so the ERP keeps trusting the same phone. Never derived
 * from anything a stranger could compute.
 */
export async function getDeviceId() {
    try {
        const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;
        const id = Crypto.randomUUID().toUpperCase();
        await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        return id;
    } catch {
        // Storage failure: the server mints one for this login. The ERP will simply
        // ask for an OTP again next time, which is the safe direction to fail.
        return null;
    }
}
