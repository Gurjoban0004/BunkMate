/**
 * The running app's version, read from the build's own config so it can never
 * drift from app.json. The version gate (admin/config.minVersion) compares
 * against this; a literal here would be the thing everyone forgets to bump.
 */
import Constants from 'expo-constants';

export const APP_VERSION =
    Constants?.expoConfig?.version ||
    Constants?.manifest2?.extra?.expoClient?.version ||
    Constants?.manifest?.version ||
    '0.0.0';
