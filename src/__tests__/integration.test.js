import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import {
    saveAppState,
    loadAppState,
    migrateToFirestore,
    deleteUserAccount
} from '../storage/storage';
import { loginWithCode, getUserId, checkOnlineStatus, getCurrentSemesterId } from '../utils/firebaseHelpers';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('firebase/firestore');
jest.mock('../config/firebase', () => ({
    db: {},
    auth: { currentUser: null }
}));
// firebase/auth ships untransformed ESM; mock with a factory. signInWithCustomToken
// sets currentUser to the token — the fetch mock below issues token === code, so
// ensureAuthenticated's uid check passes.
jest.mock('firebase/auth', () => ({
    signInWithCustomToken: jest.fn(async (authObj, token) => {
        authObj.currentUser = { uid: token };
    }),
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

describe('Firebase Integration Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();

        auth.currentUser = null;
        // Mock the auth-token API: returns token === requested code
        global.fetch = jest.fn(async (url, opts) => ({
            ok: true,
            status: 200,
            json: async () => ({ token: JSON.parse(opts.body).code }),
        }));
        doc.mockReturnValue({ id: 'mock-ref' });

        checkOnlineStatus.mockReturnValue(true);
        getCurrentSemesterId.mockReturnValue('fall-2024');
    });

    // Feature: firebase-cloud-sync, Property 2: Timestamp Field Presence
    test('new user flow: generate ID, save state, and sync to cloud', async () => {
        // 1. New user gets ID
        AsyncStorage.getItem.mockResolvedValue(null); // No ID yet
        AsyncStorage.setItem.mockResolvedValue();
        setDoc.mockResolvedValue();

        const userId = await getUserId();
        expect(userId).toMatch(/^PRES-/);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('userId', userId);
        // User doc is created server-side via /api/auth-token with create:true
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth-token'),
            expect.objectContaining({ body: JSON.stringify({ code: userId, create: true }) })
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

    test('cross-device login flow: login with code, load cloud state', async () => {
        const existingCode = 'PRES-ABC2345';
        const cloudState = { 
            _lastModified: '2024-01-02T00:00:00.000Z', 
            setupComplete: true, 
            subjects: [{ id: '1', name: 'Math' }] 
        };

        // 1. Login with code (validated server-side via /api/auth-token, not getDoc)
        const userId = await loginWithCode(existingCode);
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
        const userId = 'PRES-QRS7892';
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
