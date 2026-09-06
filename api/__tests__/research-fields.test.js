process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'x'.repeat(32);
/**
 * The two extra fields the research dataset needs, and nothing else:
 *   - register  → a flat per-period `marks` array (which period was missed)
 *   - timetable → room / group / faculty kept on each slot
 * Both are additive; the existing `calendar` and slot shapes are unchanged.
 */
const fs = require('fs');
const path = require('path');
const { parseRegisterHTML } = require('../erp-calendar');
const { parseTimetableHTML } = require('../erp-timetable');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

describe('register → marks', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', '_sample-calendar-response.html'), 'utf8');
    const { calendar, marks } = parseRegisterHTML(html);

    it('emits one mark per register cell, not one per subject-day', () => {
        expect(marks.length).toBe(4);
        expect(marks).toContainEqual({ d: '2026-01-20', s: expect.any(String), p: 1, a: expect.any(Number) });
        expect(marks.filter(m => m.d === '2026-01-20').map(m => m.p).sort()).toEqual([1, 2]);
    });

    it('agrees with the calendar it is parsed alongside', () => {
        const attendedFromMarks = marks.filter(m => m.a === 1).length;
        const attendedFromCalendar = Object.values(calendar)
            .flatMap(day => Object.values(day))
            .reduce((n, e) => n + e.attendedUnits, 0);
        expect(attendedFromMarks).toBe(attendedFromCalendar);
    });
});

describe('timetable → room / group / faculty', () => {
    const { timetable, found } = parseTimetableHTML(fixture('tt-commonpage99-grid.html'));

    it('parses the live commonPage grid', () => {
        expect(found).toBe(true);
    });

    it('keeps room, group and faculty on every slot', () => {
        const slots = Object.values(timetable).flat();
        expect(slots.length).toBeGreaterThan(20);
        for (const slot of slots) {
            expect(slot.subjectCode).toMatch(/^\d{2}[A-Z]{2,}\d{4}$/);
            expect(slot.group).toMatch(/^\d{2}[A-Z]{2,}-\w+$/);
            expect(slot.room).toBeTruthy();
            expect(slot.faculty).toBeTruthy();
        }
    });

    it('reads one group for the whole grid — that is the section id', () => {
        const groups = new Set(Object.values(timetable).flat().map(s => s.group));
        expect(groups.size).toBe(1);
        expect([...groups][0]).toBe('24CSE-G04');
    });

    it('names the subject from the cell title, not just the code', () => {
        const slot = Object.values(timetable).flat().find(s => s.subjectCode === '24CSE0317');
        expect(slot.subjectName).toBe('Algorithm Design & Implementation');
        expect(slot.faculty).toBe('DIYA GARG');
        expect(slot.room).toBe('TG312');
    });
});
