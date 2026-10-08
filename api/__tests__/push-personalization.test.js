const { buildPersonalizedNotification } = require('../_push-personalization');

const THURSDAY_8_AM_IST = new Date('2026-09-24T02:30:00.000Z');

function profile(attended = 9, total = 10) {
    return {
        subjects: [{ id: 'math', name: 'Applied Mathematics', initialAttended: attended, initialTotal: total }],
        timeSlots: [
            { id: 'morning', start: '08:30', end: '09:30' },
            { id: 'midday', start: '11:00', end: '12:00' },
            { id: 'afternoon', start: '14:00', end: '15:00' },
        ],
        timetable: {
            Thursday: [
                { slotId: 'morning', subjectId: 'math' },
                { slotId: 'midday', subjectId: 'math' },
                { slotId: 'afternoon', subjectId: 'math' },
            ],
        },
        holidays: [],
        settings: { dangerThreshold: 75 },
        dataSyncedAt: '2026-09-24T01:00:00.000Z',
    };
}

test('gives calm, numeric flexibility guidance only when the class is safe to miss', () => {
    const note = buildPersonalizedNotification(profile(), 'morning', THURSDAY_8_AM_IST);
    expect(note.title).toBe('');
    expect(note.body).toContain('some flexibility');
    expect(note.body).toContain('above your 75% goal');
    expect(note.tag).toBe('presence-morning-2026-09-24');
});

test('recommends attending when missing the class would cross the goal', () => {
    const note = buildPersonalizedNotification(profile(3, 4), 'midday', THURSDAY_8_AM_IST);
    expect(note.body).toContain('safer choice');
    expect(note.body).not.toContain('some flexibility');
});

test('never guesses from stale data and sends nothing on holidays or inferred times', () => {
    const stale = profile();
    stale.dataSyncedAt = '2026-09-01T00:00:00.000Z';
    expect(buildPersonalizedNotification(stale, 'afternoon', THURSDAY_8_AM_IST).body).toContain('quick refresh');

    const holiday = profile();
    holiday.holidays = ['2026-09-24'];
    expect(buildPersonalizedNotification(holiday, 'morning', THURSDAY_8_AM_IST)).toBeNull();

    const inferred = profile();
    inferred.timetableMeta = { timesAreInferred: true };
    expect(buildPersonalizedNotification(inferred, 'morning', THURSDAY_8_AM_IST)).toBeNull();
});
