import { markerPercent } from '../TodayScheduleBar';

// 4 even blocks: each occupies 25% of the track regardless of duration.
const CLASSES = [
    { startTime: '09:00', endTime: '11:00' },   // block 0 →  0–25%
    { startTime: '11:00', endTime: '12:00' },   // block 1 → 25–50%
    { startTime: '13:00', endTime: '14:00' },   // block 2 → 50–75%  (break before it)
    { startTime: '14:00', endTime: '16:00' },   // block 3 → 75–100%
];

const at = (h, m = 0) => new Date(2026, 7, 17, h, m);

describe('markerPercent', () => {
    it('is null before the day starts and after it ends', () => {
        expect(markerPercent(CLASSES, at(8, 59))).toBeNull();
        expect(markerPercent(CLASSES, at(16, 1))).toBeNull();
    });

    it('places the marker by block index, not by clock fraction', () => {
        expect(markerPercent(CLASSES, at(9))).toBe(0);
        expect(markerPercent(CLASSES, at(10))).toBe(12.5);      // halfway through block 0
        expect(markerPercent(CLASSES, at(11, 30))).toBe(37.5);  // halfway through block 1
        expect(markerPercent(CLASSES, at(15))).toBe(87.5);      // halfway through block 3
    });

    it('parks on the boundary during a break', () => {
        expect(markerPercent(CLASSES, at(12, 30))).toBe(50);
    });

    it('handles an empty day', () => {
        expect(markerPercent([], at(10))).toBeNull();
        expect(markerPercent(undefined, at(10))).toBeNull();
    });
});
