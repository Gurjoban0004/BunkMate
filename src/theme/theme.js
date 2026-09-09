// Presence Design System — Multi-Palette Theme Engine
// Single source of truth for all visual constants.
// NEVER hardcode colors, spacing, or radii in components.
import { Platform, Easing } from 'react-native';

// ─────────────────────────────────────────────────────────────
// 1. PALETTE DEFINITIONS
// ─────────────────────────────────────────────────────────────

export const PALETTES = {
    // The default. Every token here comes from ui-lab/today-replica.html — the
    // signed-off Today design — so the rest of the app now reads as the same
    // piece of paper rather than as a blue app with one warm screen in it.
    // PAPER (§1b) holds the extra Today-only tokens that have no COLORS slot.
    paper: {
        id: 'paper',
        name: 'Paper',
        description: 'Warm paper, ink and soft tints',
        swatches: ['#f8f7f2', '#5f668b', '#e2f0ea'],
        light: {
            background:      '#f9fafb',
            cardBackground:  '#ffffff',
            inputBackground: '#f4f3f7',
            bgSkip:          '#fbe7de',
            bgAttend:        '#e2f0ea',
            primary:         '#5f668b',
            primaryLight:    '#e8e9f5',
            primaryDark:     '#454b6b',
            textOnPrimary:   '#ffffff',
            success:         '#4f8f74',
            successLight:    '#e4f1eb',
            successDark:     '#326a55',
            successText:     '#326a55',
            danger:          '#b5674e',
            dangerLight:     '#fbe7de',
            dangerDark:      '#914732',
            dangerText:      '#914732',
            warning:         '#c08f45',
            warningLight:    '#f9f0dc',
            warningDark:     '#8a652c',
            warningText:     '#7e5c28',
            textPrimary:     '#292737',
            textSecondary:   '#666373',
            textMuted:       '#85818d',
            border:          '#e5e3e9',
            borderSubtle:    'rgba(95, 102, 139, 0.14)',
            borderLight:     '#f2f1f4',
            shadow:          '#292737',
            overlay:         'rgba(41, 39, 55, 0.45)',
            subjectPalette: [
                '#7f8bb8', '#4f8f74', '#c08f45', '#b5674e', '#6f8f9c',
                '#8f7fa8', '#9c8f5f', '#5f8f8b', '#a87f8f', '#7f9c6f',
            ],
        },
        // Paper at night. The tints keep their hue and lose their brightness, so
        // sage still reads as sage; inventing a second set would give the dark
        // mode a different personality from the one that was signed off.
        dark: {
            background:      '#16151b',
            cardBackground:  '#1f1e26',
            inputBackground: '#27262f',
            bgSkip:          '#2f231e',
            bgAttend:        '#1b2a24',
            primary:         '#9aa2cc',
            primaryLight:    '#2a2a3d',
            primaryDark:     '#c2c7e6',
            textOnPrimary:   '#16151b',
            success:         '#7fc0a3',
            successLight:    '#1b2a24',
            successDark:     '#a6d8c1',
            successText:     '#7fc0a3',
            danger:          '#d9967d',
            dangerLight:     '#2f231e',
            dangerDark:      '#efb9a3',
            dangerText:      '#d9967d',
            warning:         '#dfb877',
            warningLight:    '#2d2718',
            warningDark:     '#f0d5a2',
            warningText:     '#dfb877',
            textPrimary:     '#eceaf1',
            textSecondary:   '#a8a4b3',
            textMuted:       '#8b8797',
            border:          '#33313d',
            borderSubtle:    'rgba(154, 162, 204, 0.14)',
            borderLight:     '#27262f',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.7)',
            subjectPalette: [
                '#9aa2cc', '#7fc0a3', '#dfb877', '#d9967d', '#8fb2c0',
                '#b4a3d0', '#c4b47f', '#7fb8b4', '#cba3b4', '#a3c48f',
            ],
        },
    },

    chalkpad: {
        id: 'chalkpad',
        name: 'Chalkpad Classic',
        description: 'Original blue & sweet pastels',
        swatches: ['#F0F7FF', '#5B9BF2', '#F472B6'],
        light: {
            // Softened off-white. The old #F0F7FF read as a blue wash behind
            // every screen; the tint now only whispers.
            background:      '#FAFBFD',
            cardBackground:  '#FFFFFF',
            inputBackground: '#F1F5F9',
            bgSkip:          '#FEF2F2',
            bgAttend:        '#F0FDF4',
            primary:         '#5B9BF2',
            primaryLight:    '#E8F1FF',
            primaryDark:     '#2D6FD4',
            textOnPrimary:   '#0F172A',
            success:         '#34D399',
            successLight:    '#ECFDF5',
            successDark:     '#059669',
            successText:     '#1F7D5B',
            danger:          '#F87171',
            dangerLight:     '#FEF2F2',
            dangerDark:      '#DC2626',
            dangerText:      '#B15151',
            warning:         '#FBBF24',
            warningLight:    '#FFFBEB',
            warningDark:     '#D97706',
            warningText:     '#8B6914',
            textPrimary:     '#0F172A',
            textSecondary:   '#495465',
            textMuted:       '#656F7E',
            border:          '#E2E8F0',
            borderSubtle:    'rgba(91, 155, 242, 0.15)',
            borderLight:     '#F8FAFC',
            shadow:          '#0F172A',
            overlay:         'rgba(15, 23, 42, 0.5)',
            subjectPalette: [
                '#F472B6', '#34D399', '#FBBF24', '#FB7185', '#2DD4BF',
                '#F97316', '#A3E635', '#38BDF8', '#FACC15', '#FB923C',
            ],
        },
        dark: {
            background:      '#0B1120',
            cardBackground:  '#141D2E',
            inputBackground: '#1E293B',
            bgSkip:          '#2D1F1F',
            bgAttend:        '#1A2E22',
            primary:         '#5B9BF2',
            primaryLight:    '#1E3A5F',
            primaryDark:     '#8EC4FF',
            textOnPrimary:   '#0B1120',
            success:         '#6EE7B7',
            successLight:    '#14332A',
            successDark:     '#A7F3D0',
            successText:     '#6EE7B7',
            danger:          '#FCA5A5',
            dangerLight:     '#2D1F1F',
            dangerDark:      '#FECACA',
            dangerText:      '#FCA5A5',
            warning:         '#FCD34D',
            warningLight:    '#2D2814',
            warningDark:     '#FDE68A',
            warningText:     '#FCD34D',
            textPrimary:     '#E2E8F0',
            textSecondary:   '#94A3B8',
            textMuted:       '#8592A4',
            border:          '#2D3A4F',
            borderSubtle:    'rgba(91, 155, 242, 0.12)',
            borderLight:     '#1E293B',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.75)',
            subjectPalette: [
                '#F9A8D4', '#6EE7B7', '#FCD34D', '#FDA4AF', '#5EEAD4',
                '#FDBA74', '#BEF264', '#7DD3FC', '#FDE047', '#FED7AA',
            ],
        },
    },

    nordic: {
        id: 'nordic',
        name: 'Nordic Slate',
        description: 'Warm minimal gray & coal',
        swatches: ['#FAF9F6', '#1C1917', '#609384'],
        light: {
            background:      '#FDFDFD',
            cardBackground:  '#FFFFFF',
            inputBackground: '#F4F3EF',
            bgSkip:          '#F7EBE8',
            bgAttend:        '#E2ECE9',
            primary:         '#1C1917',
            primaryLight:    '#F4F3EF',
            primaryDark:     '#0C0A09',
            textOnPrimary:   '#FFFFFF',
            success:         '#609384',
            successLight:    '#E2ECE9',
            successDark:     '#3D6B5E',
            successText:     '#496F64',
            danger:          '#C85B49',
            dangerLight:     '#F7EBE8',
            dangerDark:      '#A0483A',
            dangerText:      '#AB4E3F',
            warning:         '#B89647',
            warningLight:    '#FAF4E5',
            warningDark:     '#8F7436',
            warningText:     '#836A32',
            textPrimary:     '#1C1917',
            textSecondary:   '#57534E',
            textMuted:       '#716D6B',
            border:          '#E6E4E0',
            borderSubtle:    '#F5F4F0',
            borderLight:     '#F5F4F0',
            shadow:          '#1C1917',
            overlay:         'rgba(28, 25, 23, 0.5)',
            subjectPalette: [
                '#609384', '#4A72B4', '#C85B49', '#B89647', '#5F738E',
                '#8B6E4E', '#7A8B6E', '#6E7A8B', '#8B6E7A', '#6E8B7A',
            ],
        },
        dark: {
            background:      '#0C0A09',
            cardBackground:  '#1C1917',
            inputBackground: '#292524',
            bgSkip:          '#321B19',
            bgAttend:        '#172622',
            primary:         '#FAFAFA',
            primaryLight:    '#292524',
            primaryDark:     '#D6D3D1',
            textOnPrimary:   '#0C0A09',
            success:         '#82B3A4',
            successLight:    '#172622',
            successDark:     '#A4D4C5',
            successText:     '#82B3A4',
            danger:          '#E28271',
            dangerLight:     '#321B19',
            dangerDark:      '#F5A898',
            dangerText:      '#E28271',
            warning:         '#D8B76D',
            warningLight:    '#2D2718',
            warningDark:     '#EAD194',
            warningText:     '#D8B76D',
            textPrimary:     '#F5F5F4',
            textSecondary:   '#A8A29E',
            textMuted:       '#908E8A',
            border:          '#2E2A28',
            borderSubtle:    '#23201E',
            borderLight:     '#23201E',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.75)',
            subjectPalette: [
                '#82B3A4', '#729CDA', '#E28271', '#D8B76D', '#8A9DB4',
                '#C4A07A', '#A4B89A', '#9AA4B8', '#B89AA4', '#9AB8A4',
            ],
        },
    },

    midnight: {
        id: 'midnight',
        name: 'Midnight Synth',
        description: 'Pitch dark OLED & neon',
        swatches: ['#000000', '#A78BFA', '#2DD4BF'],
        oledOnly: true,
        light: {
            background:      '#000000',
            cardBackground:  '#0A0A0C',
            inputBackground: '#14141A',
            bgSkip:          '#32161A',
            bgAttend:        '#0D2B26',
            primary:         '#A78BFA',
            primaryLight:    '#231C35',
            primaryDark:     '#C4B5FD',
            textOnPrimary:   '#000000',
            success:         '#2DD4BF',
            successLight:    '#0D2B26',
            successDark:     '#5EEAD4',
            successText:     '#2DD4BF',
            danger:          '#FB7185',
            dangerLight:     '#32161A',
            dangerDark:      '#FDA4AF',
            dangerText:      '#FB7185',
            warning:         '#FBBF24',
            warningLight:    '#2C200C',
            warningDark:     '#FDE68A',
            warningText:     '#FBBF24',
            textPrimary:     '#FAFAFA',
            textSecondary:   '#A1A1AA',
            textMuted:       '#7F7F85',
            border:          '#1E1E26',
            borderSubtle:    '#111116',
            borderLight:     '#111116',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.85)',
            subjectPalette: [
                '#2DD4BF', '#60A5FA', '#FB7185', '#FBBF24', '#A78BFA',
                '#34D399', '#F472B6', '#38BDF8', '#FDE047', '#C084FC',
            ],
        },
        dark: {
            background:      '#000000',
            cardBackground:  '#0A0A0C',
            inputBackground: '#14141A',
            bgSkip:          '#32161A',
            bgAttend:        '#0D2B26',
            primary:         '#A78BFA',
            primaryLight:    '#231C35',
            primaryDark:     '#C4B5FD',
            textOnPrimary:   '#000000',
            success:         '#2DD4BF',
            successLight:    '#0D2B26',
            successDark:     '#5EEAD4',
            successText:     '#2DD4BF',
            danger:          '#FB7185',
            dangerLight:     '#32161A',
            dangerDark:      '#FDA4AF',
            dangerText:      '#FB7185',
            warning:         '#FBBF24',
            warningLight:    '#2C200C',
            warningDark:     '#FDE68A',
            warningText:     '#FBBF24',
            textPrimary:     '#FAFAFA',
            textSecondary:   '#A1A1AA',
            textMuted:       '#7F7F85',
            border:          '#1E1E26',
            borderSubtle:    '#111116',
            borderLight:     '#111116',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.85)',
            subjectPalette: [
                '#2DD4BF', '#60A5FA', '#FB7185', '#FBBF24', '#A78BFA',
                '#34D399', '#F472B6', '#38BDF8', '#FDE047', '#C084FC',
            ],
        },
    },

    forest: {
        id: 'forest',
        name: 'Forest Sage',
        description: 'Earthy matcha & organic tones',
        swatches: ['#F5F6F3', '#40513B', '#C85B49'],
        light: {
            background:      '#F5F6F3',
            cardBackground:  '#FFFFFF',
            inputBackground: '#E3E8DF',
            bgSkip:          '#FBF0ED',
            bgAttend:        '#EDF4EE',
            primary:         '#40513B',
            primaryLight:    '#ECEFEA',
            primaryDark:     '#2C3527',
            textOnPrimary:   '#FFFFFF',
            success:         '#609966',
            successLight:    '#EDF4EE',
            successDark:     '#3D6B42',
            successText:     '#466F4A',
            danger:          '#D8604C',
            dangerLight:     '#FBF0ED',
            dangerDark:      '#B0473A',
            dangerText:      '#A64A3B',
            warning:         '#DCA842',
            warningLight:    '#FBF7EC',
            warningDark:     '#A47E2F',
            warningText:     '#806126',
            textPrimary:     '#2C3527',
            textSecondary:   '#586450',
            textMuted:       '#5E6958',
            border:          '#D2D8CB',
            borderSubtle:    '#ECEFEA',
            borderLight:     '#ECEFEA',
            shadow:          '#2C3527',
            overlay:         'rgba(44, 53, 39, 0.5)',
            subjectPalette: [
                '#609966', '#6A9C89', '#D8604C', '#DCA842', '#5F738E',
                '#8B6E4E', '#7A8B6E', '#6E7A8B', '#8B6E7A', '#6E8B7A',
            ],
        },
        dark: {
            background:      '#141712',
            cardBackground:  '#1E231B',
            inputBackground: '#272E23',
            bgSkip:          '#321F1C',
            bgAttend:        '#1A2E20',
            primary:         '#EDF3EB',
            primaryLight:    '#272E23',
            primaryDark:     '#C5D4C1',
            textOnPrimary:   '#141712',
            success:         '#7FBD86',
            successLight:    '#1A2E20',
            successDark:     '#A6E3A1',
            successText:     '#7FBD86',
            danger:          '#ED8B7A',
            dangerLight:     '#321F1C',
            dangerDark:      '#F5B0A2',
            dangerText:      '#ED8B7A',
            warning:         '#ECD175',
            warningLight:    '#2F2A1C',
            warningDark:     '#F5E5A5',
            warningText:     '#ECD175',
            textPrimary:     '#EDF3EB',
            textSecondary:   '#90A086',
            textMuted:       '#8E9789',
            border:          '#333C2E',
            borderSubtle:    '#242A20',
            borderLight:     '#242A20',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.75)',
            subjectPalette: [
                '#7FBD86', '#94AF9F', '#ED8B7A', '#ECD175', '#8A9DB4',
                '#C4A07A', '#A4B89A', '#9AA4B8', '#B89AA4', '#9AB8A4',
            ],
        },
    },

    catppuccin: {
        id: 'catppuccin',
        name: 'Catppuccin Latte',
        description: 'Warm soothing pastel macchiato',
        swatches: ['#EFF1F5', '#7287FD', '#E64553'],
        light: {
            background:      '#EFF1F5',
            cardBackground:  '#FFFFFF',
            inputBackground: '#E6E9EF',
            bgSkip:          '#FBE6EA',
            bgAttend:        '#EBF5E9',
            primary:         '#7287FD',
            primaryLight:    '#E8EBFC',
            primaryDark:     '#5468D4',
            textOnPrimary:   '#1E1E2E',
            success:         '#40A02B',
            successLight:    '#EBF5E9',
            successDark:     '#2D7A1E',
            successText:     '#28641B',
            danger:          '#D20F39',
            dangerLight:     '#FBE6EA',
            dangerDark:      '#A60C2D',
            dangerText:      '#B00D30',
            warning:         '#DF8E1D',
            warningLight:    '#FDF3E5',
            warningDark:     '#B07016',
            warningText:     '#7B4E10',
            textPrimary:     '#4C4F69',
            textSecondary:   '#494C5B',
            textMuted:       '#656772',
            border:          '#BCC0CC',
            borderSubtle:    '#E6E9EF',
            borderLight:     '#E6E9EF',
            shadow:          '#4C4F69',
            overlay:         'rgba(76, 79, 105, 0.5)',
            subjectPalette: [
                '#40A02B', '#1E66F5', '#EA76CB', '#DF8E1D', '#7287FD',
                '#E64553', '#179299', '#8839EF', '#FE640B', '#DD7878',
            ],
        },
        dark: {
            background:      '#1E1E2E',
            cardBackground:  '#252538',
            inputBackground: '#313244',
            bgSkip:          '#3D2230',
            bgAttend:        '#20352A',
            primary:         '#CBA6F7',
            primaryLight:    '#362D4A',
            primaryDark:     '#DFC3F9',
            textOnPrimary:   '#1E1E2E',
            success:         '#A6E3A1',
            successLight:    '#20352A',
            successDark:     '#C6F0C3',
            successText:     '#A6E3A1',
            danger:          '#F38BA8',
            dangerLight:     '#3D2230',
            dangerDark:      '#F7B3C5',
            dangerText:      '#F38BA8',
            warning:         '#F9E2AF',
            warningLight:    '#3E3B33',
            warningDark:     '#FBF0D3',
            warningText:     '#F9E2AF',
            textPrimary:     '#CDD6F4',
            textSecondary:   '#A6ADC8',
            textMuted:       '#999CAB',
            border:          '#3E4057',
            borderSubtle:    '#2A2B3C',
            borderLight:     '#2A2B3C',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.75)',
            subjectPalette: [
                '#A6E3A1', '#89B4FA', '#F5C2E7', '#F9E2AF', '#CBA6F7',
                '#F38BA8', '#94E2D5', '#B4BEFE', '#FAB387', '#EBA0AC',
            ],
        },
    },

    // The app's DEFAULT. From docs/design_system.md — "Warm Paper & Editorial
    // Pastel". Coral is the primary accent there, not an alarm colour, so danger
    // takes the deeper coral (#c45b3c) the doc reserves for coral TEXT and the
    // two never collide.
    editorial: {
        id: 'editorial',
        name: 'Linen',
        description: 'Unbleached paper, coral and sage',
        swatches: ['#f8f6f2', '#e27d60', '#6b8e7f'],
        light: {
            background:      '#f8f6f2',
            cardBackground:  '#ffffff',
            inputBackground: '#f1ede6',
            bgSkip:          '#fdf3f0',
            bgAttend:        '#f0f5f2',
            primary:         '#e27d60',
            primaryLight:    '#fdf3f0',
            primaryDark:     '#c45b3c',
            textOnPrimary:   '#ffffff',
            success:         '#6b8e7f',
            successLight:    '#f0f5f2',
            successDark:     '#4c6b5d',
            successText:     '#4c6b5d',
            danger:          '#c45b3c',
            dangerLight:     '#fdf3f0',
            dangerDark:      '#a3452a',
            dangerText:      '#a3452a',
            warning:         '#c99355',
            warningLight:    '#fcf7f0',
            warningDark:     '#9c6c32',
            warningText:     '#9c6c32',
            textPrimary:     '#23201d',
            textSecondary:   '#5c5852',
            textMuted:       '#888279',
            border:          '#e7e2d9',
            borderSubtle:    'rgba(35, 32, 29, 0.08)',
            borderLight:     '#f1ede6',
            shadow:          '#23201d',
            overlay:         'rgba(35, 32, 29, 0.45)',
            // The doc's four accents first — they are the ones the charts and
            // badges are tuned for — then four muted extensions of the same set.
            subjectPalette: [
                '#7b8fb5', '#6b8e7f', '#7f7aa8', '#c99355',
                '#a8817a', '#5f8f8b', '#9c7fa8', '#8a9169',
            ],
        },
        // The same relationships after dark: unbleached paper becomes warm coal,
        // and the four pastels lift instead of tint.
        dark: {
            background:      '#1a1816',
            cardBackground:  '#232120',
            inputBackground: '#2c2926',
            bgSkip:          '#332622',
            bgAttend:        '#202925',
            primary:         '#e8927a',
            primaryLight:    '#332622',
            primaryDark:     '#f2b5a3',
            textOnPrimary:   '#1a1816',
            success:         '#8fb09f',
            successLight:    '#202925',
            successDark:     '#b3ccbe',
            successText:     '#8fb09f',
            danger:          '#e08163',
            dangerLight:     '#332622',
            dangerDark:      '#efa78e',
            dangerText:      '#e08163',
            warning:         '#d9a970',
            warningLight:    '#302921',
            warningDark:     '#ecc79a',
            warningText:     '#d9a970',
            textPrimary:     '#ece7e0',
            textSecondary:   '#b0a99f',
            textMuted:       '#8d867d',
            border:          '#37332f',
            borderSubtle:    'rgba(236, 231, 224, 0.10)',
            borderLight:     '#2c2926',
            shadow:          '#000000',
            overlay:         'rgba(0, 0, 0, 0.7)',
            subjectPalette: [
                '#96a8cc', '#8fb09f', '#9a95c2', '#d9a970',
                '#c29b93', '#7aabA6', '#b79ac2', '#a3ab80',
            ],
        },
    },
};

// Backwards-compatible exports for existing code
export const LIGHT_COLORS = PALETTES.nordic.light;
export const DARK_COLORS = PALETTES.nordic.dark;

// COLORS is the live token map. Always read from this — never from
// palette definitions directly in components.
// Call applyTheme() once on app boot (and on theme toggle) to populate it.
export const COLORS = { ...PALETTES.editorial.light };

export const applyTheme = (themeStr, paletteId) => {
    const palette = PALETTES[paletteId] || PALETTES.editorial;
    const mode = palette.oledOnly ? 'dark' : themeStr;
    const source = mode === 'dark' ? palette.dark : palette.light;
    Object.assign(COLORS, source);

    const isDark = mode === 'dark';

    // PAPER and the subject ramp follow the palette. Light Paper keeps the
    // signed-off replica values exactly; everything else is derived.
    Object.assign(PAPER, (paletteId === 'paper' && !isDark) ? PAPER_LOCKED : derivePaper(source, isDark));
    SUBJECT_TINTS.length = 0;
    SUBJECT_TINTS.push(...buildSubjectTints(source, isDark));

    if (Platform.OS === 'web') {
        SHADOWS.small.boxShadow  = isDark ? '0px 2px 4px rgba(0,0,0,0.3)'   : '0px 1px 2px rgba(15,23,42,0.05)';
        SHADOWS.medium.boxShadow = isDark ? '0px 4px 12px rgba(0,0,0,0.4)'  : '0px 4px 12px rgba(15,23,42,0.1)';
        SHADOWS.large.boxShadow  = isDark ? '0px 8px 24px rgba(0,0,0,0.5)'  : '0px 8px 24px rgba(15,23,42,0.12)';
    } else {
        const eShadow = isDark
            ? { elevation: 0, shadowOpacity: 0 }
            : null;

        SHADOWS.small  = { ...SHADOWS.small,  ...(eShadow ?? { elevation: 1, shadowOpacity: 0.05 }) };
        SHADOWS.medium = { ...SHADOWS.medium, ...(eShadow ?? { elevation: 3, shadowOpacity: 0.12 }) };
        SHADOWS.large  = { ...SHADOWS.large,  ...(eShadow ?? { elevation: 4, shadowOpacity: 0.15 }) };
    }
};

// ─────────────────────────────────────────────────────────────
// 1b. PAPER — the surface tokens Today and every paper header read
// ─────────────────────────────────────────────────────────────
// PAPER_LOCKED holds the exact tokens from ui-lab/today-replica.html, the
// signed-off design. They stay byte-for-byte what was approved.
//
// But PAPER used to be a frozen constant, which meant a student on a dark
// palette got a bright cream header stapled to a dark app — the "paper theme
// didn't arrive everywhere" bug. So PAPER is now a LIVE object like COLORS:
// `applyTheme` fills it with the locked values on light Paper, and derives an
// equivalent set from the active palette everywhere else. Components keep
// importing `PAPER` and never notice.

const PAPER_LOCKED = {
    ink:          '#292737',
    secondary:    '#666373',
    muted:        '#85818d',
    line:         '#e5e3e9',
    surface:      '#ffffff',
    background:   '#f9fafb',

    primary:      '#5f668b',
    primarySoft:  '#e8e9f5',

    warning:      '#a27337',
    warningSoft:  '#f9f0dc',
    warningLine:  '#dfc589',
    warningInk:   '#7e5c28',
    warningInkSoft: '#806b48',
    warningInkDeep: '#8a652c',

    successSoft:  '#e4f1eb',
    successLine:  '#7fb49b',

    // Bento tints. Upcoming classes cycle sage → apricot → lavender; a class
    // the college has already marked is stone.
    sage:         '#e2f0ea',
    sageInk:      '#326a55',
    apricot:      '#fbe7de',
    apricotInk:   '#914732',
    lavender:     '#e8e7f6',
    lavenderInk:  '#5e5a8f',
    stone:        '#f0ebed',
    stoneInk:     '#7b6170',

    // The greeting's paper wash, drawn as SVG gradients (RN has no radial-gradient).
    paperBase:    '#f8f7f2',
    paperTopLeft: '#fdfcf8',
    paperBottomRight: '#f2f1ea',
    paperInk:     '#292b2b',
    paperSubInk:  '#696a68',
    // The three pools + the ring, as opaque colours plus their opacities —
    // react-native-svg wants them separate, and dark palettes need a lift off
    // the background rather than the light sheet's bright white.
    washHi:        '#ffffff', washHiOp:   0.98,
    washA:         '#dde4d9', washAOp:    0.56,
    washB:         '#e4e1f2', washBOp:    0.5,
    washRing:      'rgba(255,255,255,0.36)',

    nowCardBg:     '#fcfcff',
    nowCardBorder: '#d9d9ee',
    trackBg:       '#ecebf0',
    blockBg:       '#f1f0f2',
    nextBlockBg:   '#f7f3e8',
    nextBlockLine: '#d7b87a',
    lastBlockBg:   '#f0eef8',
    lastBlockLine: '#c7b9e8',
    countBorder:   '#d9d8e8',
    riskInk:       '#8e692c',
    pctRiskInk:    '#956c2b',
};

// ── Colour maths ─────────────────────────────────────────────────────
// Just enough to build a tint from an accent and a surface. Hand-authoring
// every tint for 6 palettes × 2 modes would be ~400 values nobody maintains.

const hexToRgb = (hex) => {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return Number.isFinite(n) && full.length === 6
        ? { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
        : { r: 128, g: 128, b: 128 };
};

const toHex = ({ r, g, b }) =>
    '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** `t` of `b` over `a`. mix(white, coral, 0.12) is a 12% coral tint. */
export const mix = (a, b, t) => {
    const A = hexToRgb(a), B = hexToRgb(b);
    return toHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
};

/** Relative luminance, 0–1. Used to keep ink readable on its own tint. */
const luminance = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/**
 * A tint/ink pair for `accent` that sits on `surface`.
 * Light modes get a pale wash with a darkened accent for the ink; dark modes
 * get the accent lifted just off the surface with the accent itself as ink.
 */
export const tintPair = (accent, surface, isDark) => isDark
    ? { bg: mix(surface, accent, 0.18), ink: mix(accent, '#ffffff', 0.32) }
    : {
        bg: mix(surface, accent, 0.16),
        // A pale accent (sand, yellow) needs more darkening than a deep one.
        ink: mix(accent, '#000000', luminance(accent) > 0.55 ? 0.42 : 0.24),
    };

/** Every PAPER token, built from one palette's COLORS. */
function derivePaper(c, isDark) {
    const surface = c.cardBackground;
    const sage = tintPair(c.success, surface, isDark);
    const apricot = tintPair(c.danger, surface, isDark);
    const lavender = tintPair(c.primary, surface, isDark);
    const sand = tintPair(c.warning, surface, isDark);

    return {
        ink: c.textPrimary,
        secondary: c.textSecondary,
        muted: c.textMuted,
        line: c.border,
        surface,
        background: c.background,

        primary: c.primary,
        primarySoft: c.primaryLight,

        warning: c.warning,
        warningSoft: c.warningLight,
        warningLine: mix(c.warningLight, c.warning, 0.45),
        warningInk: c.warningText,
        warningInkSoft: c.warningText,
        warningInkDeep: c.warningDark,

        successSoft: c.successLight,
        successLine: mix(c.successLight, c.success, 0.55),

        sage: sage.bg, sageInk: sage.ink,
        apricot: apricot.bg, apricotInk: apricot.ink,
        lavender: lavender.bg, lavenderInk: lavender.ink,
        stone: isDark ? mix(surface, c.textMuted, 0.14) : mix(surface, c.textMuted, 0.12),
        stoneInk: isDark ? c.textSecondary : mix(c.textMuted, '#000000', 0.25),

        // The wash. In dark modes the sheet is a lift off the background, not a
        // bright rectangle — same drawing, inverted relationship.
        paperBase: isDark ? mix(c.background, '#ffffff', 0.05) : mix(c.background, c.warning, 0.05),
        paperTopLeft: isDark ? mix(c.background, '#ffffff', 0.09) : mix(c.cardBackground, c.warning, 0.02),
        paperBottomRight: isDark ? c.background : mix(c.background, c.textMuted, 0.06),
        paperInk: c.textPrimary,
        paperSubInk: c.textSecondary,
        washHi:   isDark ? mix(c.background, '#ffffff', 0.10) : mix(c.cardBackground, '#ffffff', 1),
        washHiOp: isDark ? 0.9 : 0.98,
        washA:    isDark ? mix(c.background, c.success, 0.16) : mix('#ffffff', c.success, 0.18),
        washAOp:  isDark ? 0.8 : 0.56,
        washB:    isDark ? mix(c.background, c.primary, 0.18) : mix('#ffffff', c.primary, 0.16),
        washBOp:  isDark ? 0.8 : 0.5,
        washRing: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.36)',

        nowCardBg: isDark ? mix(surface, c.primary, 0.07) : mix(surface, c.primary, 0.03),
        nowCardBorder: mix(surface, c.primary, isDark ? 0.3 : 0.2),
        trackBg: c.inputBackground,
        blockBg: c.inputBackground,
        nextBlockBg: sand.bg,
        nextBlockLine: mix(sand.bg, c.warning, 0.5),
        lastBlockBg: lavender.bg,
        lastBlockLine: mix(lavender.bg, c.primary, 0.4),
        countBorder: c.border,
        riskInk: c.warningText,
        pctRiskInk: c.warningText,
    };
}

// Live token map, same contract as COLORS. Populated by applyTheme(); seeded
// from the DEFAULT palette so the frame before that call is not a different
// theme. PAPER_LOCKED is only reinstated when the student picks Paper itself.
export const PAPER = derivePaper(PALETTES.editorial.light, false);

// ─────────────────────────────────────────────────────────────
// 1c. SUBJECT IDENTITY
// ─────────────────────────────────────────────────────────────
// A subject's colour is its identity: the same hue carries it across the Today
// bento, the schedule bar, the subject list and the insights charts, so a
// student learns "the lavender one is DBMS" instead of re-reading five labels.
//
// The accents come from the active palette's own subjectPalette, so the identity
// re-tints with the theme but the ORDER never changes — a subject keeps its slot.
// Seeded from the default palette for the same reason PAPER is: subjectTint()
// is called on the first render, before applyTheme() has run.
export const SUBJECT_TINTS = buildSubjectTints(PALETTES.editorial.light, false);

function buildSubjectTints(c, isDark) {
    const accents = c.subjectPalette || [c.primary];
    return accents.map((accent) => ({ accent, ...tintPair(accent, c.cardBackground, isDark) }));
}

/**
 * The tint for one subject. Keyed on the subject's position in the roster, so
 * it is stable for the life of the term and identical on every screen.
 * Falls back to a hash of the id when the roster is not to hand.
 */
export const subjectTint = (subjectId, subjects) => {
    if (!SUBJECT_TINTS.length) return { accent: COLORS.primary, bg: COLORS.primaryLight, ink: COLORS.primary };
    let i = Array.isArray(subjects) ? subjects.findIndex((s) => s && s.id === subjectId) : -1;
    if (i < 0) {
        const key = String(subjectId || '');
        i = 0;
        for (let n = 0; n < key.length; n++) i = (i * 31 + key.charCodeAt(n)) >>> 0;
    }
    return SUBJECT_TINTS[i % SUBJECT_TINTS.length];
};

// ─────────────────────────────────────────────────────────────
// 2. SPACING
// ─────────────────────────────────────────────────────────────

export const SPACING = {
    xs:            4,
    sm:            8,
    md:            16,
    lg:            24,
    xl:            32,
    xxl:           48,
    screenPadding: 20,
    cardPadding:   20,
    cardGap:       16,
};

// ─────────────────────────────────────────────────────────────
// 3. TYPOGRAPHY
// Single source of truth — use TYPOGRAPHY everywhere.
// ─────────────────────────────────────────────────────────────

// One family: Times New Roman. Chosen by the user over the Tinos/Inter pair —
// real Times, not a metric clone, and no sans for the mechanics.
//
// Sizes are the larger redesign scale (they stay); weights live on the tokens
// again because Times has a real bold and the browser/OS picks it from the
// weight, not from a separate family name.
//
// ponytail: `android: 'serif'` resolves to Noto Serif, not Times — Android
// won't be pixel-identical to iOS/web. Bundle Tinos as an Android-only face if
// that ever matters.
// Exported: every serif in the app must come from here. Hardcoding
// 'Times New Roman' silently falls back to Roboto on Android — which is how
// the whole Today screen ended up sans-serif in the APK.
export const SERIF_FONT = Platform.select({
    ios: 'Times New Roman',
    android: 'serif',
    default: 'Times New Roman',
});

export const TYPOGRAPHY = {
    // Hero numbers and greetings
    displayLarge:  { fontFamily: SERIF_FONT, fontWeight: '700', fontSize: 30, lineHeight: 35, letterSpacing: -0.2 },
    displayMedium: { fontFamily: SERIF_FONT, fontWeight: '700', fontSize: 25, lineHeight: 30, letterSpacing: -0.2 },
    displaySmall:  { fontFamily: SERIF_FONT, fontWeight: '700', fontSize: 20, lineHeight: 25, letterSpacing: 0 },

    // Screen titles and empty-state headlines
    headingLarge:  { fontFamily: SERIF_FONT, fontWeight: '700', fontSize: 22, lineHeight: 28, letterSpacing: 0 },

    // Card titles and row headings
    headingMedium: { fontFamily: SERIF_FONT, fontWeight: '700', fontSize: 16, lineHeight: 22, letterSpacing: -0.2 },
    headingSmall:  { fontFamily: SERIF_FONT, fontWeight: '600', fontSize: 14, lineHeight: 19, letterSpacing: -0.1 },

    // Body copy
    bodyLarge:     { fontFamily: SERIF_FONT, fontWeight: '400', fontSize: 16, lineHeight: 24 },
    bodyMedium:    { fontFamily: SERIF_FONT, fontWeight: '400', fontSize: 14, lineHeight: 21 },
    bodySmall:     { fontFamily: SERIF_FONT, fontWeight: '400', fontSize: 12, lineHeight: 18 },

    // Labels, buttons, chips
    labelLarge:    { fontFamily: SERIF_FONT, fontWeight: '600', fontSize: 14, lineHeight: 18, letterSpacing: 0 },
    labelMedium:   { fontFamily: SERIF_FONT, fontWeight: '600', fontSize: 12, lineHeight: 16, letterSpacing: 0 },
    labelSmall:    { fontFamily: SERIF_FONT, fontWeight: '600', fontSize: 11, lineHeight: 14, letterSpacing: 0.1 },

    // Captions, hints
    captionLarge:  { fontFamily: SERIF_FONT, fontWeight: '400', fontSize: 12, lineHeight: 16 },
    captionMedium: { fontFamily: SERIF_FONT, fontWeight: '500', fontSize: 11, lineHeight: 14, letterSpacing: 0.1 },
    captionSmall:  { fontFamily: SERIF_FONT, fontWeight: '500', fontSize: 10, lineHeight: 13, letterSpacing: 0.2 },

    // Micro badges (SAFE / EDGE / LOW), uppercase
    micro:         { fontFamily: SERIF_FONT, fontWeight: '700', fontSize: 9, lineHeight: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
};

// Numerals that don't jitter. The attendance percentage is the hero number and
// it re-renders every time a class is marked; proportional figures make it
// shuffle sideways on each change. Spread onto any Text that shows a number.
export const TABULAR = Platform.OS === 'web'
    ? { fontVariantNumeric: 'tabular-nums' }
    : { fontVariant: ['tabular-nums'] };

// Convenience scale — matches the named steps above.
// Use FONT_SIZES.md, FONT_SIZES.lg etc. in StyleSheet definitions.
export const FONT_SIZES = {
    xs:   10,
    sm:   12,
    md:   14,
    lg:   16,
    xl:   20,
    xxl:  24,
    xxxl: 32,
};

// ─────────────────────────────────────────────────────────────
// 4. BORDER RADIUS
// ─────────────────────────────────────────────────────────────

export const RADIUS = {
    sm:     8,    // Chips, small badges
    md:     12,   // Inputs, inner cards
    lg:     16,   // Standard card corner
    xl:     20,   // Section cards, larger surfaces
    xxl:    24,   // Bottom sheets, modals
    full:   9999, // Pills, avatar circles
};

// Alias — many components import BORDER_RADIUS; keep both names in sync.
export const BORDER_RADIUS = RADIUS;

// ─────────────────────────────────────────────────────────────
// 5. SHADOWS
// ─────────────────────────────────────────────────────────────

export const SHADOWS = {
    small: Platform.OS === 'web'
        ? { boxShadow: '0px 1px 2px rgba(15,23,42,0.05)' }
        : { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },

    medium: Platform.OS === 'web'
        ? { boxShadow: '0px 4px 12px rgba(15,23,42,0.1)' }
        : { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 3 },

    large: Platform.OS === 'web'
        ? { boxShadow: '0px 8px 24px rgba(15,23,42,0.12)' }
        : { shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
};

// ─────────────────────────────────────────────────────────────
// 6. GLASS (frosted surfaces — web only, use sparingly)
// backdrop-filter has no effect on Android/iOS without Expo blur.
// Only use GLASS on cards that sit over a gradient or image bg.
// ─────────────────────────────────────────────────────────────

export const GLASS = {
    light: {
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderColor:     'rgba(255,255,255,0.9)',
        borderWidth: 1,
        ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
    },
    dark: {
        backgroundColor: 'rgba(20,29,46,0.72)',
        borderColor:     'rgba(91,155,242,0.15)',
        borderWidth: 1,
        ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
    },
    tinted: {
        backgroundColor: 'rgba(91,155,242,0.1)',
        borderColor:     'rgba(91,155,242,0.22)',
        borderWidth: 1,
    },
};

// ─────────────────────────────────────────────────────────────
// 7. MOTION
// ─────────────────────────────────────────────────────────────

export const MOTION = {
    pressOpacity: 0.92,
    spring:       { tension: 120, friction: 8 },
    duration:     { fast: 150, normal: 250, slow: 400 },
    easing: {
        enter:  Easing.out(Easing.cubic),
        exit:   Easing.in(Easing.quad),
        press:  Easing.out(Easing.quad),
        snappy: Easing.bezier(0.16, 1, 0.3, 1),
    },
};
