// Helper for safely merging state values for loading
export const mergeState = (initial, loaded) => {
    return {
        ...initial,
        ...loaded,
        settings: { ...initial.settings, ...(loaded?.settings || {}) },
        timetable: { ...initial.timetable, ...(loaded?.timetable || {}) },
    };
};
