const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const IST_OFFSET_MS = 330 * 60 * 1000;
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const SLOT_WINDOWS = {
    morning: { from: 7 * 60 + 30, to: 10 * 60 + 29, intro: 'Good morning ☀️' },
    midday: { from: 10 * 60 + 30, to: 11 * 60 + 30, intro: 'A quick heads-up' },
    afternoon: { from: 13 * 60, to: 14 * 60 + 30, intro: 'For this afternoon 🌤️' },
};

function parseTime(value) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function formatTime(value) {
    const minutes = parseTime(value);
    if (minutes == null) return '';
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function localDay(now) {
    const ist = new Date(now.getTime() + IST_OFFSET_MS);
    return {
        dayName: DAY_NAMES[ist.getUTCDay()],
        dateKey: `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`,
    };
}

function shortName(value) {
    const name = String(value || 'Your class').replace(/\s*\([^)]*\)\s*$/, '').trim();
    return name.length > 42 ? `${name.slice(0, 39).trim()}…` : name;
}

function classesForDay(profile, dayName) {
    const timeSlots = Array.isArray(profile?.timeSlots) ? profile.timeSlots : [];
    const subjects = Array.isArray(profile?.subjects) ? profile.subjects : [];
    const entries = Array.isArray(profile?.timetable?.[dayName]) ? profile.timetable[dayName] : [];
    const sorted = entries.map((entry) => {
        const slot = timeSlots.find((item) => item.id === entry.slotId);
        const subject = subjects.find((item) => item.id === entry.subjectId);
        const startTime = entry.customStart || slot?.start;
        const endTime = entry.customEnd || slot?.end;
        return { entry, subject, startTime, endTime, start: parseTime(startTime), end: parseTime(endTime) };
    }).filter((item) => item.subject && item.start != null).sort((a, b) => a.start - b.start);

    const classes = [];
    for (const item of sorted) {
        const previous = classes[classes.length - 1];
        if (previous && previous.subject.id === item.subject.id && item.start - previous.end <= 30) {
            previous.end = Math.max(previous.end, item.end ?? item.start);
            previous.units += 1;
        } else {
            classes.push({
                subject: item.subject,
                start: item.start,
                end: item.end ?? item.start,
                startTime: item.startTime,
                units: 1,
            });
        }
    }
    return classes;
}

function timestampMs(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function attendance(subject, profile) {
    const total = Math.max(0, Number(subject.initialTotal) || 0);
    const attended = Math.min(total, Math.max(0, Number(subject.initialAttended) || 0));
    const configured = Number(subject.target ?? profile?.settings?.dangerThreshold ?? 75);
    const target = configured > 0 && configured <= 100 ? configured : 75;
    return { attended, total, target, percentage: total ? (100 * attended) / total : null };
}

function pct(value) {
    return `${Math.round(value * 10) / 10}%`;
}

function bodyFor(cls, profile, slot, fresh) {
    const name = shortName(cls.subject.name);
    const time = formatTime(cls.startTime);
    const prefix = `${SLOT_WINDOWS[slot].intro} · ${name} starts at ${time}.`;
    const stats = attendance(cls.subject, profile);

    if (!fresh) return `${prefix} Open Presence for a quick refresh before deciding—your attendance data has not synced recently.`;
    if (!stats.total) return `${prefix} There is not enough attendance history yet for reliable guidance.`;

    const missPercentage = (100 * stats.attended) / (stats.total + cls.units);
    if (missPercentage >= stats.target) {
        return `${prefix} You have some flexibility today; missing it would leave you around ${pct(missPercentage)}, above your ${stats.target}% goal.`;
    }

    const attendPercentage = (100 * (stats.attended + cls.units)) / (stats.total + cls.units);
    if (stats.percentage < stats.target) {
        return `${prefix} You're at ${pct(stats.percentage)}. Attending would move you to about ${pct(attendPercentage)} toward your ${stats.target}% goal.`;
    }
    return `${prefix} You're at ${pct(stats.percentage)}. Attending is the safer choice to protect your ${stats.target}% goal.`;
}

function buildPersonalizedNotification(profile, slot, now = new Date(), profileUpdatedAt = null) {
    const window = SLOT_WINDOWS[slot];
    if (!window || !profile || profile?.timetableMeta?.timesAreInferred) return null;
    const { dayName, dateKey } = localDay(now);
    if ((profile.holidays || []).includes(dateKey)) return null;

    const cls = classesForDay(profile, dayName)
        .find((item) => item.start >= window.from && item.start <= window.to);
    if (!cls) return null;

    const syncedAt = timestampMs(profile.dataSyncedAt || profileUpdatedAt);
    const fresh = syncedAt > 0 && now.getTime() - syncedAt <= STALE_AFTER_MS;
    return {
        title: '',
        body: bodyFor(cls, profile, slot, fresh),
        url: '/app',
        tag: `presence-${slot}-${dateKey}`,
        key: `${dateKey}:${slot}`,
    };
}

module.exports = { buildPersonalizedNotification, classesForDay, localDay, parseTime };
