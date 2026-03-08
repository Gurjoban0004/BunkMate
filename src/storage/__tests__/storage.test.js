import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import {
    shouldUseCloudData,
    saveAppState,
    loadAppState,
    migrateToFirestore,
    deleteUserAccount
} from '../storage';
import { checkOnlineStatus, getCurrentSemesterId } from '../../utils/firebaseHelpers';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('firebase/firestore');
jest.mock('../../config/firebase', () => ({
    db: {}
}));
jest.mock('../../utils/firebaseHelpers');

describe('storage hybrid layer', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.log = jest.fn();
        console.warn = jest.fn();
        console.error = jest.fn();
        
        // Default mocks
        getCurrentSemesterId.mockReturnValue('fall-2024');
        checkOnlineStatus.mockReturnValue(true);
    });

    describe('shouldUseCloudData', () => {
        // Feature: firebase-cloud-sync, Property 11: Timestamp-Based Sync Priority
        test('returns true only when cloud timestamp is strictly greater than local', () => {
            fc.assert(
                fc.property(
                    fc.integer({ min: 1000, max: 2000 }), // local time
                    fc.integer({ min: 1000, max: 2000 }), // cloud time
                    (localTime, cloudTime) => {
                        const localState = { _lastModified: new Date(localTime).toISOString() };
                        const cloudState = { _lastModified: new Date(cloudTime).toISOString() };

                        const result = shouldUseCloudData(localState, cloudState);

                        if (cloudTime > localTime) {
                            expect(result).toBe(true);
                        } else {
                            expect(result).toBe(false);
                        }
                    }
                ),
                { numRuns: 100 }
            );
        });

        test('handles missing states or timestamps correctly', () => {
            expect(shouldUseCloudData(null, { _lastModified: '2024-01-01' })).toBe(true);
            expect(shouldUseCloudData({ _lastModified: '2024-01-01' }, null)).toBe(false);
            expect(shouldUseCloudData({}, { _lastModified: '2024-01-01' })).toBe(true);
            expect(shouldUseCloudData({ _lastModified: '2024-01-01' }, {})).toBe(false);
        });
    });

    describe('saveAppState', () => {
        test('saves to AsyncStorage first, then Firestore if online', async () => {
            const state = { subjects: [] };
            AsyncStorage.getItem.mockResolvedValue('PRES-123');
            setDoc.mockResolvedValue();

            await saveAppState(state);

            // Verify AsyncStorage save
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                '@bunkmate_state',
                expect.stringContaining('"_lastModified"')
            );

            // Verify Firestore save
            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    ...state,
                    _lastModified: expect.any(String),
                    _cloudTimestamp: expect.anything()
                }),
                { merge: true }
            );
        });

        test('does not attempt cloud save if offline', async () => {
            checkOnlineStatus.mockReturnValue(false);
            const state = { subjects: [] };

            await saveAppState(state);

            expect(AsyncStorage.setItem).toHaveBeenCalled();
            expect(setDoc).not.toHaveBeenCalled();
        });

        test('handles cloud save failure gracefully', async () => {
            AsyncStorage.getItem.mockResolvedValue('PRES-123');
            setDoc.mockRejectedValue(new Error('Firestore failure'));
            
            await saveAppState({ subjects: [] });

            // Should still have saved to local
            expect(AsyncStorage.setItem).toHaveBeenCalled();
            // Should have logged a warning but not thrown
            expect(console.warn).toHaveBeenCalledWith(
                expect.stringContaining('Cloud sync failed'),
                expect.anything()
            );
        });
    });

    describe('loadAppState', () => {
        test('returns local state if cloud is older or missing', async () => {
            const localState = { _lastModified: '2024-01-02T00:00:00.000Z', data: 'local' };
            const cloudState = { _lastModified: '2024-01-01T00:00:00.000Z', data: 'cloud' };

            AsyncStorage.getItem.mockImplementation(async (key) => {
                if (key === '@bunkmate_state') return JSON.stringify(localState);
                if (key === 'userId') return 'PRES-123';
                return null;
            });

            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => cloudState
            });

            const result = await loadAppState();

            expect(result).toEqual(localState);
            expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('@bunkmate_state', expect.any(String));
        });

        test('updates local state if cloud is newer', async () => {
            const localState = { _lastModified: '2024-01-01T00:00:00.000Z', data: 'local' };
            const cloudState = { _lastModified: '2024-01-02T00:00:00.000Z', data: 'cloud' };

            AsyncStorage.getItem.mockImplementation(async (key) => {
                if (key === '@bunkmate_state') return JSON.stringify(localState);
                if (key === 'userId') return 'PRES-123';
                return null;
            });

            getDoc.mockResolvedValue({
                exists: () => true,
                data: () => cloudState
            });

            const result = await loadAppState();

            expect(result).toEqual(cloudState);
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                '@bunkmate_state',
                JSON.stringify(cloudState)
            );
        });

        test('falls back to local state on cloud timeout', async () => {
            const localState = { data: 'local' };
            AsyncStorage.getItem.mockResolvedValue(JSON.stringify(localState));
            
            // Mock getDoc to never resolve (to trigger timeout)
            getDoc.mockReturnValue(new Promise(() => {}));

            // Use a shorter timeout for testing if possible, but the mock will work
            // Since we use Promise.race with a timeout
            
            const result = await loadAppState();
            expect(result).toEqual(localState);
        });
    });

    describe('migrateToFirestore', () => {
        test('uploads local state to cloud if not already migrated', async () => {
            const state = { data: 'to-migrate' };
            AsyncStorage.getItem.mockResolvedValue('PRES-123');
            getDoc.mockResolvedValue({ exists: () => false }); // Not in cloud yet
            setDoc.mockResolvedValue();

            await migrateToFirestore(state);

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    ...state,
                    _migrated: true
                })
            );
            expect(AsyncStorage.setItem).toHaveBeenCalledWith(
                '@bunkmate_state',
                expect.stringContaining('"_migrated":true')
            );
        });

        test('does nothing if already migrated', async () => {
            const state = { _migrated: true };
            await migrateToFirestore(state);
            expect(getDoc).not.toHaveBeenCalled();
        });
    });

    describe('deleteUserAccount', () => {
        test('marks cloud data as deleted and clears local storage', async () => {
            AsyncStorage.getItem.mockResolvedValue('PRES-123');
            setDoc.mockResolvedValue();

            await deleteUserAccount();

            expect(setDoc).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    _deleted: true,
                    _deletedAt: expect.anything()
                }),
                { merge: true }
            );
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@bunkmate_state');
            expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userId');
        });
    });
});
