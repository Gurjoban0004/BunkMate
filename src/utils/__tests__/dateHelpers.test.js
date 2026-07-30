import { formatTime } from '../dateHelpers';

test('formats 24-hour reminder times for display', () => {
    expect(formatTime('18:00')).toBe('6:00 PM');
    expect(formatTime('00:05')).toBe('12:05 AM');
    expect(formatTime('invalid')).toBe('');
});
