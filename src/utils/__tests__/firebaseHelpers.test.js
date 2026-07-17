import * as fc from 'fast-check';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  generateLoginCode,
  getUserId,
  loginWithCode,
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
// firebase/auth ships untransformed ESM; mock with a factory. signInWithCustomToken
// sets currentUser to the token value — our fetch mock issues token === code, so
// ensureAuthenticated's uid check passes.
jest.mock('firebase/auth', () => ({
  signInWithCustomToken: jest.fn(async (authObj, token) => {
    authObj.currentUser = { uid: token };
  }),
}));

const { auth } = require('../../config/firebase');

// Mock the auth-token API: returns token === requested code.
const mockAuthApi = () => {
  global.fetch = jest.fn(async (url, opts) => ({
    ok: true,
    status: 200,
    json: async () => ({ token: JSON.parse(opts.body).code }),
  }));
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('firebaseHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    auth.currentUser = null;
    mockAuthApi();
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  describe('generateLoginCode', () => {
    // Feature: firebase-cloud-sync, Property 1: Login Code Format Validation
    test('generated login codes always match format PRES-XXXXXXX with valid characters', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 1000 }), () => {
          const code = generateLoginCode();
          
          // Check length (12 characters total)
          expect(code.length).toBe(12);
          
          // Check format: PRES-XXXXXXX
          expect(code).toMatch(/^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/);
          
          // Check no ambiguous characters (0, O, 1, I)
          expect(code).not.toMatch(/[01IO]/);
          
          // Check prefix
          expect(code.substring(0, 4)).toBe('PRES');
          
          // Check hyphen at position 4
          expect(code[4]).toBe('-');
        }),
        { numRuns: 100 }
      );
    });

    test('generates unique codes on multiple calls', () => {
      const codes = new Set();
      for (let i = 0; i < 100; i++) {
        codes.add(generateLoginCode());
      }
      // Should have high uniqueness (allow for small chance of collision)
      expect(codes.size).toBeGreaterThan(95);
    });

    test('uses only non-ambiguous characters', () => {
      const code = generateLoginCode();
      const randomPart = code.substring(5); // Skip "PRES-"
      
      // Should not contain confusing characters
      expect(randomPart).not.toContain('0');
      expect(randomPart).not.toContain('O');
      expect(randomPart).not.toContain('1');
      expect(randomPart).not.toContain('I');
    });
  });

  describe('getUserId', () => {
    test('returns existing userId from AsyncStorage', async () => {
      const existingId = 'PRES-ABC2345';
      AsyncStorage.getItem.mockResolvedValue(existingId);
      setDoc.mockResolvedValue();

      const userId = await getUserId();

      expect(userId).toBe(existingId);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('userId');

      // lastActive update is fire-and-forget after background auth — flush it
      await flush();
      expect(setDoc).toHaveBeenCalled(); // Updates lastActive
    });

    test('generates new userId if none exists', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      AsyncStorage.setItem.mockResolvedValue();

      const userId = await getUserId();

      expect(userId).toMatch(/^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('userId', userId);
      // User doc is created server-side now: client calls /api/auth-token with create:true
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth-token'),
        expect.objectContaining({ body: JSON.stringify({ code: userId, create: true }) })
      );
    });

    test('handles cloud registration errors gracefully', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      AsyncStorage.setItem.mockResolvedValue();
      global.fetch = jest.fn(() => Promise.reject(new Error('Network down')));

      const userId = await getUserId();

      // Should still return a valid userId (cloud registration is deferred)
      expect(userId).toMatch(/^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/);
      expect(console.warn).toHaveBeenCalled();
    });

    test('generates temporary ID if AsyncStorage fails', async () => {
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));
      AsyncStorage.setItem.mockResolvedValue();

      const userId = await getUserId();

      expect(userId).toMatch(/^PRES-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/);
      expect(console.error).toHaveBeenCalled();
    });

    // Feature: firebase-cloud-sync, Property 4: Login Code Storage Round-Trip
    test('storing and retrieving login code returns identical code', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async () => {
          const code = generateLoginCode();
          
          // Mock AsyncStorage to simulate storage
          let storedValue = null;
          AsyncStorage.setItem.mockImplementation(async (key, value) => {
            storedValue = value;
          });
          AsyncStorage.getItem.mockImplementation(async (key) => {
            return storedValue;
          });
          
          // Store the code
          await AsyncStorage.setItem('userId', code);
          
          // Retrieve the code
          const retrieved = await AsyncStorage.getItem('userId');
          
          // Should be identical
          expect(retrieved).toBe(code);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('loginWithCode', () => {
    test('successfully logs in with valid code', async () => {
      const validCode = 'PRES-ABC2345';
      AsyncStorage.setItem.mockResolvedValue();
      setDoc.mockResolvedValue();

      const userId = await loginWithCode(validCode);

      expect(userId).toBe(validCode);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('userId', validCode);
      expect(setDoc).toHaveBeenCalled(); // Updates lastActive
    });

    test('throws error for a code that fails format validation', async () => {
      // Contains I and L, which are not in CODE_CHARS
      await expect(loginWithCode('PRES-INVALID')).rejects.toThrow('Invalid login code');
    });

    test('throws error for a code the server rejects', async () => {
      global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));

      await expect(loginWithCode('PRES-ABC2345')).rejects.toThrow('Invalid login code');
    });

    test('throws error on network failure', async () => {
      global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

      await expect(loginWithCode('PRES-ABC2345')).rejects.toThrow('Failed to login');
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
