import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@bunkmate_state';
const STATE_VERSION = 1;

export async function saveAppState(state) {
    try {
        const stateToSave = {
            ...state,
            _version: STATE_VERSION,
            _lastModified: new Date().toISOString()
        };
        const jsonValue = JSON.stringify(stateToSave);
        await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
    } catch (e) {
        console.error('Failed to save state to AsyncStorage:', e);
        // We could implement a fallback here or alert the user 
        // if they are out of storage space
    }
}

export async function loadAppState() {
    try {
        const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (jsonValue === null) return null;

        const parsedState = JSON.parse(jsonValue);

        // Simple migration logic if state version differs
        if (parsedState._version !== STATE_VERSION) {
            // currently no migrations needed, just updating version
            parsedState._version = STATE_VERSION;
        }

        return parsedState;
    } catch (e) {
        console.error('Failed to load state from AsyncStorage:', e);
        return null; // Return null so the app falls back to initialState instead of crashing
    }
}

export async function clearAppState() {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Failed to clear state from AsyncStorage:', e);
    }
}
