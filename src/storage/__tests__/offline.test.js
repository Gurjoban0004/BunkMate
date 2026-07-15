import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDoc, setDoc } from 'firebase/firestore';
import { saveAppState, loadAppState } from '../storage';
import { checkOnlineStatus, getCurrentSemesterId, ensureAuthenticated } from '../../utils/firebaseHelpers';

jest.mock('@react-native-async-storage/async-storage');
jest.mock('firebase/firestore');
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(), signInWithCustomToken: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {}, auth: {} }));
jest.mock('../../utils/firebaseHelpers');

// Offline truth-check: with no network, the app must round-trip through local storage
// only — never touching Firestore — and hand back exactly what the user saved.
describe('offline round-trip', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        console.log = jest.fn(); console.warn = jest.fn(); console.error = jest.fn();
        getCurrentSemesterId.mockReturnValue('fall-2026');
        checkOnlineStatus.mockReturnValue(false);   // offline
        ensureAuthenticated.mockResolvedValue(false);
    });

    test('save writes locally and never hits the cloud when offline', async () => {
        const state = {
            userId: 'PRES-ABCDEFG',
            subjects: [{ id: 'math', initialAttended: 8, initialTotal: 10 }],
            attendanceRecords: { '2026-07-14': { math: { status: 'present', units: 1, source: 'manual' } } },
        };

        await saveAppState(state);

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('@bunkmate_state', expect.any(String));
        expect(setDoc).not.toHaveBeenCalled();

        // The persisted blob carries the user's data intact.
        const written = JSON.parse(AsyncStorage.setItem.mock.calls[0][1]);
        expect(written.subjects[0].initialAttended).toBe(8);
        expect(written.attendanceRecords['2026-07-14'].math.status).toBe('present');
    });

    test('load returns local data without a cloud read when offline', async () => {
        const saved = {
            userId: 'PRES-ABCDEFG',
            subjects: [{ id: 'math', initialAttended: 9, initialTotal: 12 }],
            _version: 1,
        };
        AsyncStorage.getItem.mockImplementation((key) =>
            Promise.resolve(key === 'userId' ? 'PRES-ABCDEFG' : JSON.stringify(saved))
        );

        const result = await loadAppState();

        expect(getDoc).not.toHaveBeenCalled();
        expect(result.subjects[0].initialAttended).toBe(9);
    });
});
