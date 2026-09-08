/**
 * The line at the top of Today.
 *
 * It used to be four fixed strings on a clock. Four strings seen twice a day
 * for a whole term stop being read at all, so the salutation now also knows
 * what day it is and how late it is — the two things a student actually feels
 * when they open an attendance app.
 *
 * Rules it keeps to:
 *   - No emoji. The paper design has none, and the field was already unused.
 *   - Never a joke about attendance. This screen is read by someone who might
 *     be about to find out they are below 75%.
 *   - Deterministic per (hour, weekday), not random: a greeting that changes on
 *     every re-render looks like a bug, and the same day should read the same
 *     way all the way through.
 */

const MORNING = [
    'Good morning',
    'Morning',
    'Up early',
];

const AFTERNOON = [
    'Good afternoon',
    'Afternoon',
    'Midday',
];

const EVENING = [
    'Good evening',
    'Evening',
    'Winding down',
];

const NIGHT = [
    'Still up',
    'Late one',
    'Burning the oil',
];

const SMALL_HOURS = ['Very late', 'Small hours', 'Past midnight'];

/** Same input, same output — see the note about re-renders above. */
const pick = (list, seed) => list[Math.abs(seed) % list.length];

export const getGreeting = (name, devDate = null) => {
    const now = devDate ? new Date(devDate) : new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // The seed advances once a day, so the wording is stable within a day and
    // different across the week.
    const seed = day + Math.floor(hour / 6);

    let greeting;
    if (hour >= 5 && hour < 12) {
        greeting = day === 0 || day === 6 ? 'Good morning' : pick(MORNING, seed);
    } else if (hour >= 12 && hour < 17) {
        greeting = pick(AFTERNOON, seed);
    } else if (hour >= 17 && hour < 22) {
        greeting = pick(EVENING, seed);
    } else if (hour >= 22) {
        greeting = pick(NIGHT, seed);
    } else {
        greeting = pick(SMALL_HOURS, seed);
    }

    // First name only, title-cased: the college sends "GURJOBAN SINGH".
    const firstName = (name || 'there').trim().split(/\s+/)[0];
    const titleName = firstName.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

    return {
        text: `${greeting}, ${titleName}`,
        // Kept for the old shape; nothing renders it and the design has no emoji.
        emoji: '',
    };
};
