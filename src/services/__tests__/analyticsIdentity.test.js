/**
 * The uid contract, end to end.
 *
 * Everything the admin panel shows from the CLIENT side — sync telemetry,
 * endpoint health, parser failures, the research snapshots — is written to
 * `telemetry/{userId}/…` and gated by the Firestore rule
 * `request.auth.uid == userId`. Four separate files have to agree that
 * "userId" means the roll number:
 *
 *   api/auth-token.js   mints the custom token with uid = roll number
 *   firebaseHelpers.js  stores that roll number as AsyncStorage 'userId'
 *   AppContext          keeps it as state.userId
 *   telemetry.js        writes to telemetry/{state.userId}/…
 *
 * If any one of them drifts, nothing throws. The writes are fire-and-forget and
 * the rule rejection is swallowed, so the panel just goes quiet — which is
 * exactly how a real student's activity went missing before the server-side
 * ledger was added. This test is the tripwire.
 */

import { addDoc, setDoc, collection, doc } from 'firebase/firestore';
import { logAttendanceSnapshot, logSync } from '../telemetry';

jest.mock('firebase/firestore');
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../utils/firebaseHelpers', () => ({ ensureAuthenticated: jest.fn(async () => true) }));

const { ensureAuthenticated } = require('../../utils/firebaseHelpers');

const ROLL = '2410990296';

beforeEach(() => {
    jest.clearAllMocks();
    ensureAuthenticated.mockResolvedValue(true);
});

describe('client analytics write under the caller\'s own uid', () => {
    it('logSync signs in as, and writes under, the same id it was given', async () => {
        await logSync(ROLL, { endpoints: [{ name: 'attendance', status: 'ok' }], rollNumber: ROLL });

        expect(ensureAuthenticated).toHaveBeenCalledWith(ROLL);
        // collection(db, 'telemetry', <uid>, 'syncs') — the uid segment is what
        // the security rule compares against request.auth.uid.
        expect(collection).toHaveBeenCalledWith({}, 'telemetry', ROLL, 'syncs');
        expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('logAttendanceSnapshot writes under the same id, one doc per day', async () => {
        await logAttendanceSnapshot(ROLL, ROLL, [{
            code: '24CSE0316', name: 'AIML', attended: 20, delivered: 24, absent: 4, percentage: 83.3,
        }]);

        expect(ensureAuthenticated).toHaveBeenCalledWith(ROLL);
        const dayKey = new Date().toISOString().slice(0, 10);
        expect(doc).toHaveBeenCalledWith({}, 'telemetry', ROLL, 'attendanceSnapshots', dayKey);
    });

    it('writes nothing at all when the Firebase sign-in has not happened', async () => {
        // The rule would reject these anyway; not attempting them is what keeps
        // a signed-out device from filling the logs with permission errors.
        ensureAuthenticated.mockResolvedValue(false);

        await logSync(ROLL, { endpoints: [{ name: 'attendance', status: 'ok' }] });
        await logAttendanceSnapshot(ROLL, ROLL, [{ code: 'X', attended: 1, delivered: 1, absent: 0, percentage: 100 }]);

        expect(addDoc).not.toHaveBeenCalled();
        expect(setDoc).not.toHaveBeenCalled();
    });
});
