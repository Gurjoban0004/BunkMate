jest.mock('firebase/firestore');
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(), signInWithCustomToken: jest.fn() }));
jest.mock('../../config/firebase', () => ({ db: {}, auth: {} }));

import { appReducer } from '../AppContext';

// Guards the OTP-spam fix: skipping the re-auth prompt must snooze auto-sync,
// while a successful restore must clear both the prompt and any snooze.
describe('ERP re-auth snooze (OTP bombardment fix)', () => {
    const base = { erpSessionExpired: { authUserId: 'x' }, erpReauthSnoozeUntil: null };

    it('sets a future snooze window when the user skips (payload.snooze)', () => {
        const before = Date.now();
        const next = appReducer(base, { type: 'ERP_SESSION_RESTORED', payload: { snooze: true } });
        expect(next.erpSessionExpired).toBeNull();
        expect(next.erpReauthSnoozeUntil).toBeGreaterThan(before);
    });

    it('clears the snooze on a successful restore (no payload)', () => {
        const snoozed = { ...base, erpReauthSnoozeUntil: Date.now() + 999999 };
        const next = appReducer(snoozed, { type: 'ERP_SESSION_RESTORED' });
        expect(next.erpSessionExpired).toBeNull();
        expect(next.erpReauthSnoozeUntil).toBeNull();
    });
});
