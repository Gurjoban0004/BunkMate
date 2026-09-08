import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  registerUser,
  ensureAuthenticated,
  getCurrentSemesterId,
  initNetworkListener,
  checkOnlineStatus,
  onNetworkStatusChange
} from '../firebaseHelpers';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('firebase/firestore');
jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: null }
}));
// The identity comes from the college session now, so every auth path needs one.
jest.mock('../../storage/erpTokenStorage', () => ({
  getErpToken: jest.fn(async () => 'erp-session-token'),
}));
// firebase/auth ships untransformed ESM; mock with a factory. signInWithCustomToken
// sets currentUser to the token value — our fetch mock issues token === the roll
// the server would read out of the ERP token, so ensureAuthenticated's uid check passes.
jest.mock('firebase/auth', () => ({
  signInWithCustomToken: jest.fn(async (authObj, token) => {
    authObj.currentUser = { uid: token };
  }),
}));

const { auth } = require('../../config/firebase');
const { getErpToken } = require('../../storage/erpTokenStorage');

const ROLL = '23BCS1234';

// Stand in for /api/auth-token: it opens the ERP token server-side and answers
// with a custom token whose uid is the roll sealed inside it.
const mockAuthApi = () => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ token: ROLL }),
  }));
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('firebaseHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = null;
    mockAuthApi();
    getErpToken.mockResolvedValue('erp-session-token');
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  describe('registerUser', () => {
    test('adopts the roll number as the account id and signs in', async () => {
      AsyncStorage.setItem.mockResolvedValue();
      setDoc.mockResolvedValue();

      const userId = await registerUser(ROLL);

      expect(userId).toBe(ROLL);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('userId', ROLL);
      // The server is asked with the ERP session token — never a client-chosen id.
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth-token'),
        expect.objectContaining({ body: JSON.stringify({ token: 'erp-session-token' }) })
      );

      await flush();
      expect(setDoc).toHaveBeenCalled(); // stamps lastActive
    });

    test('trims the roll and refuses an empty one', async () => {
      expect(await registerUser('  ' + ROLL + ' ')).toBe(ROLL);
      expect(await registerUser('')).toBeNull();
      expect(await registerUser(null)).toBeNull();
    });

    test('a failed sign-in still leaves the id usable offline', async () => {
      AsyncStorage.setItem.mockResolvedValue();
      global.fetch = jest.fn(() => Promise.reject(new Error('Network down')));

      expect(await registerUser(ROLL)).toBe(ROLL);
      await flush();
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('ensureAuthenticated', () => {
    test('signs in with the stored roll and the ERP token', async () => {
      AsyncStorage.getItem.mockResolvedValue(ROLL);

      expect(await ensureAuthenticated()).toBe(true);
      expect(auth.currentUser.uid).toBe(ROLL);
    });

    test('no college session means no cloud session — and no throw', async () => {
      AsyncStorage.getItem.mockResolvedValue(ROLL);
      getErpToken.mockResolvedValue(null);

      expect(await ensureAuthenticated()).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('fails open when the server is down', async () => {
      AsyncStorage.getItem.mockResolvedValue(ROLL);
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      expect(await ensureAuthenticated()).toBe(false);
    });

    test('a session for a different roll is not accepted for this one', async () => {
      AsyncStorage.getItem.mockResolvedValue('99SOMEONE_ELSE');

      expect(await ensureAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentSemesterId', () => {
    // Feature: firebase-cloud-sync, Property 3: Semester Classification Correctness
    test('returns correct semester for any date', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 12 }), // month
          fc.integer({ min: 2020, max: 2030 }), // year
          (month, year) => {
            // Mock Date to return specific month/year
            const originalDate = global.Date;
            global.Date = class extends originalDate {
              constructor() {
                super();
                return new originalDate(year, month - 1, 15); // Use middle of month
              }
              static now() {
                return new originalDate(year, month - 1, 15).getTime();
              }
            };

            const semesterId = getCurrentSemesterId();

            // Verify format
            expect(semesterId).toMatch(/^(fall|spring|summer)-\d{4}$/);

            // Verify correct classification
            if (month >= 8 && month <= 12) {
              expect(semesterId).toBe(`fall-${year}`);
            } else if (month >= 1 && month <= 5) {
              expect(semesterId).toBe(`spring-${year}`);
            } else {
              expect(semesterId).toBe(`summer-${year}`);
            }

            // Restore original Date
            global.Date = originalDate;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('returns fall semester for August through December', () => {
      const testCases = [
        { month: 8, expected: 'fall' },
        { month: 9, expected: 'fall' },
        { month: 10, expected: 'fall' },
        { month: 11, expected: 'fall' },
        { month: 12, expected: 'fall' }
      ];

      testCases.forEach(({ month, expected }) => {
        const originalDate = global.Date;
        global.Date = class extends originalDate {
          constructor() {
            super();
            return new originalDate(2024, month - 1, 15);
          }
          getMonth() {
            return month - 1;
          }
          getFullYear() {
            return 2024;
          }
        };

        const semesterId = getCurrentSemesterId();
        expect(semesterId).toBe(`${expected}-2024`);

        global.Date = originalDate;
      });
    });

    test('returns spring semester for January through May', () => {
      const testCases = [
        { month: 1, expected: 'spring' },
        { month: 2, expected: 'spring' },
        { month: 3, expected: 'spring' },
        { month: 4, expected: 'spring' },
        { month: 5, expected: 'spring' }
      ];

      testCases.forEach(({ month, expected }) => {
        const originalDate = global.Date;
        global.Date = class extends originalDate {
          constructor() {
            super();
            return new originalDate(2024, month - 1, 15);
          }
          getMonth() {
            return month - 1;
          }
          getFullYear() {
            return 2024;
          }
        };

        const semesterId = getCurrentSemesterId();
        expect(semesterId).toBe(`${expected}-2024`);

        global.Date = originalDate;
      });
    });

    test('returns summer semester for June and July', () => {
      const testCases = [
        { month: 6, expected: 'summer' },
        { month: 7, expected: 'summer' }
      ];

      testCases.forEach(({ month, expected }) => {
        const originalDate = global.Date;
        global.Date = class extends originalDate {
          constructor() {
            super();
            return new originalDate(2024, month - 1, 15);
          }
          getMonth() {
            return month - 1;
          }
          getFullYear() {
            return 2024;
          }
        };

        const semesterId = getCurrentSemesterId();
        expect(semesterId).toBe(`${expected}-2024`);

        global.Date = originalDate;
      });
    });
  });

  describe('Network monitoring', () => {
    let mockWindow;
    const { Platform } = require('react-native');
    let originalOS;

    beforeEach(() => {
      // initNetworkListener only wires window events on web
      originalOS = Object.getOwnPropertyDescriptor(Platform, 'OS');
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });

      // Mock window and navigator
      mockWindow = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      global.window = mockWindow;
      global.navigator = { onLine: true };
    });

    afterEach(() => {
      Object.defineProperty(Platform, 'OS', originalOS);
      delete global.window;
      delete global.navigator;
    });

    test('initNetworkListener sets up event listeners', () => {
      initNetworkListener();

      expect(mockWindow.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    test('checkOnlineStatus returns current status', () => {
      const status = checkOnlineStatus();
      expect(typeof status).toBe('boolean');
    });

    test('onNetworkStatusChange registers callback', () => {
      const callback = jest.fn();
      const unsubscribe = onNetworkStatusChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    test('network status change notifies listeners', () => {
      const callback = jest.fn();
      
      initNetworkListener();
      onNetworkStatusChange(callback);

      // Simulate going offline
      const offlineHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )[1];
      offlineHandler();

      expect(callback).toHaveBeenCalledWith(false);

      // Simulate going online
      const onlineHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'online'
      )[1];
      onlineHandler();

      expect(callback).toHaveBeenCalledWith(true);
    });

    test('unsubscribe removes listener', () => {
      const callback = jest.fn();
      const unsubscribe = onNetworkStatusChange(callback);

      unsubscribe();

      // Simulate network change
      initNetworkListener();
      const offlineHandler = mockWindow.addEventListener.mock.calls.find(
        call => call[0] === 'offline'
      )?.[1];
      
      if (offlineHandler) {
        offlineHandler();
      }

      // Callback should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
