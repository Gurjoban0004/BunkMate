/**
 * Subject display names.
 *
 * Students (and teachers) say "ADI", not "Algorithm Design & Implementation".
 * Short names are left alone — "System Design" and "DBMS" are already what
 * anyone would say out loud — so only genuinely long names collapse to their
 * initials.
 */

// Only joiners are dropped, so Design & Implementation is DI, not D&I.
// Everything else counts: Art of Communication is AOC and Programming
// Abstractions Using Java is PAUJ — students say the whole thing.
const SKIP = new Set(['and', '&', '-', '–']);

// At or below this, the full name is short enough to just read. Callers with
// less room (the schedule strip's ~90px blocks) pass a smaller budget so the
// name abbreviates instead of ellipsing to "SYSTEM DE…".
const MAX_LEN = 18;

/** "Algorithm Design & Implementation" → "ADI"; "System Design" → unchanged. */
export const shortSubjectName = (name, maxLen = MAX_LEN) => {
    if (!name) return '';
    const full = name.trim();
    if (full.length <= maxLen) return full;

    const initials = [];

    for (const w of full.split(/\s+/)) {
        const bare = w.replace(/[^\w&–-]/g, '');
        if (!bare || SKIP.has(bare.toLowerCase())) continue;
        // Part/level markers are dropped: "Art of Communication - II" → "AOC".
        // ponytail: two parts of the same course in one semester would collide;
        // keep the numeral if that ever shows up.
        if (/^(?:[IVX]+|\d+)$/i.test(bare)) continue;
        initials.push(bare[0].toUpperCase());
    }

    // Nothing worth abbreviating to (one long word, e.g. "Thermodynamics").
    if (initials.length < 2) return full;
    return initials.join('');
};
