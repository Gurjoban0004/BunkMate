import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import {
    saveAppState,
    loadAppState,
    migrateToFirestore,
    deleteUserAccount
} from '../storage/storage';
import { registerUser, checkOnlineStatus, getCurrentSemesterId } from '../utils/firebaseHelpers';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('firebase/firestore');
jest.mock('../config/firebase', () => ({
    db: {},
    auth: { currentUser: null }
}));
// firebase/auth ships untransformed ESM; mock with a factory. signInWithCustomToken
// sets currentUser to the token — the fetch mock below issues token === ROLL, the
// roll the server reads out of the ERP token, so ensureAuthenticated's uid check passes.
jest.mock('firebase/auth', () => ({
    signInWithCustomToken: jest.fn(async (authObj, token) => {
        authObj.currentUser = { uid: token };
    }),
}));
jest.mock('../storage/erpTokenStorage', () => ({
    getErpToken: jest.fn(async () => 'erp-session-token'),
}));
jest.mock('../utils/firebaseHelpers', () => {
    const original = jest.requireActual('../utils/firebaseHelpers');
    return {
        ...original,
        checkOnlineStatus: jest.fn(),
        getCurrentSemesterId: jest.fn(),
    };
});

const { auth } = require('../config/firebase');

const ROLL = '23BCS1234';

describe('Firebase Integration Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();

        auth.currentUser = null;
        // Stand in for /api/auth-token: the roll comes out of the ERP session token.
        global.fetch = jest.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ token: ROLL }),
        }));
        doc.mockReturnValue({ id: 'mock-ref' });

        checkOnlineStatus.mockReturnValue(true);
        getCurrentSemesterId.mockReturnValue('fall-2024');
    });

    // Feature: firebase-cloud-sync, Property 2: Timestamp Field Presence
    test('new user flow: adopt the roll as the id, save state, sync to cloud', async () => {
        // 1. Signing in to the college is what creates the account
        AsyncStorage.getItem.mockResolvedValue(null); // No ID yet
        AsyncStorage.setItem.mockResolvedValue();
        setDoc.mockResolvedValue();

        const userId = await registerUser(ROLL);
        expect(userId).toBe(ROLL);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('userId', userId);
        // The user doc is created server-side, from the sealed ERP session token
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth-token'),
            expect.objectContaining({ body: JSON.stringify({ token: 'erp-session-token' }) })
        );

        // 2. User saves state
        const state = { setupComplete: true, subjects: [], userId };
        AsyncStorage.getItem.mockResolvedValue(userId);
        
        await saveAppState(state);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@bunkmate_state', expect.any(String));
        expect(setDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                _lastModified: expect.any(String),
                _cloudTimestamp: expect.anything()
            }),
            { merge: true }
        );
    });

    test('second device: sign in to the college, get the same cloud state', async () => {
        const existingCode = ROLL;
        const cloudState = { 
            _lastModified: '2024-01-02T00:00:00.000Z', 
            setupComplete: true, 
            subjects: [{ id: '1', name: 'Math' }] 
        };

        // 1. The college sign-in is the whole login: same roll, same account
        const userId = await registerUser(existingCode);
        expect(userId).toBe(existingCode);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('userId', existingCode);

        // 2. Load state
        AsyncStorage.getItem.mockImplementation(async (key) => {
            if (key === 'userId') return existingCode;
            if (key === '@bunkmate_state') return null; // New device, no local state
            return null;
        });

        getDoc.mockResolvedValueOnce({
            exists: () => true,
            data: () => cloudState
        });

        const loadedState = await loadAppState();
        expect(loadedState).toEqual(cloudState);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@bunkmate_state', JSON.stringify(cloudState));
    });

    test('offline-to-online sync: save offline, sync when online', async () => {
        const userId = ROLL;
        const state = { subjects: [], userId };
        
        // 1. Save while offline
        checkOnlineStatus.mockReturnValue(false);
        AsyncStorage.getItem.mockResolvedValue(userId);
        
        await saveAppState(state);

        expect(AsyncStorage.setItem).toHaveBeenCalled();
        expect(setDoc).not.toHaveBeenCalled(); // No cloud sync while offline

        // 2. Go online and sync (simulated by calling saveAppState again when online)
        checkOnlineStatus.mockReturnValue(true);
        await saveAppState(state);

        expect(setDoc).toHaveBeenCalled(); // Cloud sync now triggered
    });
});
