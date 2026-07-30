import { addDoc, setDoc } from 'firebase/firestore';
import { logAttendanceSnapshot, logSync, trackEndpoint } from '../telemetry';

jest.mock('firebase/firestore');
jest.mock('../../config/firebase', () => ({ db: {} }));
jest.mock('../../utils/firebaseHelpers', () => ({
    ensureAuthenticated: jest.fn(async () => true),
}));

const { ensureAuthenticated } = require('../../utils/firebaseHelpers');

beforeEach(() => {
    jest.clearAllMocks();
    ensureAuthenticated.mockResolvedValue(true);
});

describe('trackEndpoint', () => {
    it('records a successful call and returns its value', async () => {
        const endpoints = [];
        const value = await trackEndpoint(endpoints, 'attendance', async () => 'data');

        expect(value).toBe('data');
        expect(endpoints).toHaveLength(1);
        expect(endpoints[0]).toMatchObject({ name: 'attendance', status: 'ok' });
        expect(typeof endpoints[0].durationMs).toBe('number');
    });

    it('records a failure AND re-throws so callers keep their error handling', async () => {
        const endpoints = [];
        await expect(
            trackEndpoint(endpoints, 'calendar', async () => { throw new Error('502 upstream'); })
        ).rejects.toThrow('502 upstream');

        expect(endpoints[0]).toMatchObject({
            name: 'calendar',
            status: 'fail',
            error: '502 upstream',
        });
    });
});

describe('logSync', () => {
    it('writes one telemetry doc with the endpoint results', async () => {
        await logSync('CODE123', {
            endpoints: [{ name: 'attendance', status: 'ok', durationMs: 12 }],
            parserErrors: [],
            rollNumber: '2410990296',
        });

        expect(addDoc).toHaveBeenCalledTimes(1);
        expect(addDoc.mock.calls[0][1]).toMatchObject({
            rollNumber: '2410990296',
            endpoints: [{ name: 'attendance', status: 'ok', durationMs: 12 }],
        });
    });

    it('skips the write when there is nothing to report', async () => {
        await logSync('CODE123', { endpoints: [] });
        expect(addDoc).not.toHaveBeenCalled();
    });

    it('skips the write when the user is not signed in (rules would reject it)', async () => {
        ensureAuthenticated.mockResolvedValue(false);
        await logSync('CODE123', { endpoints: [{ name: 'attendance', status: 'ok' }] });
        expect(addDoc).not.toHaveBeenCalled();
    });

    it('never throws when the write fails', async () => {
        addDoc.mockRejectedValue(new Error('permission-denied'));
        await expect(
            logSync('CODE123', { endpoints: [{ name: 'attendance', status: 'ok' }] })
        ).resolves.toBeUndefined();
    });
});

describe('logAttendanceSnapshot', () => {
    it('writes one aggregate-only snapshot per day', async () => {
        await logAttendanceSnapshot('CODE123', '2410990296', [{
            code: '24CSE0316', name: 'Artificial Intelligence and Machine Learning',
            attended: 20, delivered: 24, absent: 4, percentage: 83.3,
        }]);

        expect(setDoc).toHaveBeenCalledTimes(1);
        expect(setDoc.mock.calls[0][1]).toMatchObject({
            schemaVersion: 1,
            cohort: '24',
            source: 'erp',
            subjects: [expect.objectContaining({ courseCode: '24CSE0316', attended: 20, total: 24 })],
        });
    });
});
