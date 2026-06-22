// Presence Design System — Multi-Palette Theme Engine
// Single source of truth for all visual constants.
// NEVER hardcode colors, spacing, or radii in components.
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// 1. PALETTE DEFINITIONS
// ─────────────────────────────────────────────────────────────

export const PALETTES = {
    chalkpad: {
        id: 'chalkpad',
        name: 'Chalkpad Classic',
        description: 'Original blue & sweet pastels',
        swatches: ['#F0F7FF', '#5B9BF2', '#F472B6'],
        light: {
            background:      '#F0F7FF',
            cardBackground:  '#FFFFFF',
            inputBackground: '#F1F5F9',
            bgSkip:          '#FEF2F2',
            bgAttend:        '#F0FDF4',
            primary:         '#5B9BF2',
            primaryLight:    '#E8F1FF',
            primaryDark:     '#2D6FD4',
            textOnPrimary:   '#FFFFFF',
            success:         '#34D399',
            successLight:    '#ECFDF5',
            successDark:     '#059669',
            danger:          '#F87171',
            dangerLight:     '#FEF2F2',
            dangerDark:      '#DC2626',
            warning:         '#FBBF24',
            warningLight:    '#FFFBEB',
            warningDark:     '#D97706',
            textPrimary:     '#0F172A',
            textSecondary:   '#64748B',
            textMuted:       '#94A3B8',
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
            textOnPrimary:   '#FFFFFF',
            success:         '#6EE7B7',
            successLight:    '#14332A',
            successDark:     '#A7F3D0',
            danger:          '#FCA5A5',
            dangerLight:     '#2D1F1F',
            dangerDark:      '#FECACA',
            warning:         '#FCD34D',
            warningLight:    '#2D2814',
            warningDark:     '#FDE68A',
            textPrimary:     '#E2E8F0',
            textSecondary:   '#94A3B8',
            textMuted:       '#64748B',
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
            danger:          '#C85B49',
            dangerLight:     '#F7EBE8',
            dangerDark:      '#A0483A',
            warning:         '#B89647',
            warningLight:    '#FAF4E5',
            warningDark:     '#8F7436',
            textPrimary:     '#1C1917',
            textSecondary:   '#57534E',
            textMuted:       '#A8A29E',
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
            danger:          '#E28271',
            dangerLight:     '#321B19',
            dangerDark:      '#F5A898',
            warning:         '#D8B76D',
            warningLight:    '#2D2718',
            warningDark:     '#EAD194',
            textPrimary:     '#F5F5F4',
            textSecondary:   '#A8A29E',
            textMuted:       '#57534E',
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
            danger:          '#FB7185',
            dangerLight:     '#32161A',
            dangerDark:      '#FDA4AF',
            warning:         '#FBBF24',
            warningLight:    '#2C200C',
            warningDark:     '#FDE68A',
            textPrimary:     '#FAFAFA',
            textSecondary:   '#A1A1AA',
            textMuted:       '#52525B',
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
            danger:          '#FB7185',
            dangerLight:     '#32161A',
            dangerDark:      '#FDA4AF',
            warning:         '#FBBF24',
            warningLight:    '#2C200C',
            warningDark:     '#FDE68A',
            textPrimary:     '#FAFAFA',
            textSecondary:   '#A1A1AA',
            textMuted:       '#52525B',
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
            danger:          '#D8604C',
            dangerLight:     '#FBF0ED',
            dangerDark:      '#B0473A',
            warning:         '#DCA842',
            warningLight:    '#FBF7EC',
            warningDark:     '#A47E2F',
            textPrimary:     '#2C3527',
            textSecondary:   '#586450',
            textMuted:       '#8FA086',
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
            danger:          '#ED8B7A',
            dangerLight:     '#321F1C',
            dangerDark:      '#F5B0A2',
            warning:         '#ECD175',
            warningLight:    '#2F2A1C',
            warningDark:     '#F5E5A5',
            textPrimary:     '#EDF3EB',
            textSecondary:   '#90A086',
            textMuted:       '#586450',
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
            inputBackground: '#CCD0DA',
            bgSkip:          '#FBE6EA',
            bgAttend:        '#EBF5E9',
            primary:         '#7287FD',
            primaryLight:    '#E8EBFC',
            primaryDark:     '#5468D4',
            textOnPrimary:   '#FFFFFF',
            success:         '#40A02B',
            successLight:    '#EBF5E9',
            successDark:     '#2D7A1E',
            danger:          '#D20F39',
            dangerLight:     '#FBE6EA',
            dangerDark:      '#A60C2D',
            warning:         '#DF8E1D',
            warningLight:    '#FDF3E5',
            warningDark:     '#B07016',
            textPrimary:     '#4C4F69',
            textSecondary:   '#6C6F85',
            textMuted:       '#9CA0B0',
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
            danger:          '#F38BA8',
            dangerLight:     '#3D2230',
            dangerDark:      '#F7B3C5',
            warning:         '#F9E2AF',
            warningLight:    '#3E3B33',
            warningDark:     '#FBF0D3',
            textPrimary:     '#CDD6F4',
            textSecondary:   '#A6ADC8',
            textMuted:       '#6C7086',
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
};

// Backwards-compatible exports for existing code
export const LIGHT_COLORS = PALETTES.chalkpad.light;
export const DARK_COLORS = PALETTES.chalkpad.dark;

// COLORS is the live token map. Always read from this — never from
// palette definitions directly in components.
// Call applyTheme() once on app boot (and on theme toggle) to populate it.
export const COLORS = { ...PALETTES.chalkpad.light };

export const applyTheme = (themeStr, paletteId) => {
    const palette = PALETTES[paletteId] || PALETTES.chalkpad;
    const mode = palette.oledOnly ? 'dark' : themeStr;
    const source = mode === 'dark' ? palette.dark : palette.light;
    Object.assign(COLORS, source);

    const isDark = mode === 'dark';
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

export const TYPOGRAPHY = {
    // Hero numbers (attendance %, big stats) — Outfit 22-26px, 800
    displayLarge:  { fontFamily: 'Outfit-ExtraBold', fontSize: 26, fontWeight: '800', lineHeight: 29, letterSpacing: -0.5 },
    displayMedium: { fontFamily: 'Outfit-ExtraBold', fontSize: 22, fontWeight: '800', lineHeight: 24, letterSpacing: -0.5 },
    displaySmall:  { fontFamily: 'Outfit-Bold', fontSize: 18, fontWeight: '800', lineHeight: 20, letterSpacing: -0.3 },

    // Section and card headers — Outfit 16-20px, 800
    headingLarge:  { fontFamily: 'Outfit-ExtraBold', fontSize: 20, fontWeight: '800', lineHeight: 26, letterSpacing: -0.3 },
    headingMedium: { fontFamily: 'Outfit-Bold', fontSize: 16, fontWeight: '800', lineHeight: 22, letterSpacing: -0.3 },
    headingSmall:  { fontFamily: 'Outfit-Bold', fontSize: 14, fontWeight: '700', lineHeight: 18 },

    // Body copy — Inter 12-14px, 500
    bodyLarge:     { fontFamily: 'Inter-Medium', fontSize: 16, fontWeight: '500', lineHeight: 22 },
    bodyMedium:    { fontFamily: 'Inter-Medium', fontSize: 14, fontWeight: '500', lineHeight: 20 },
    bodySmall:     { fontFamily: 'Inter-Medium', fontSize: 12, fontWeight: '500', lineHeight: 17 },

    // Labels, buttons, chips — Inter 12-14px, 600-700
    labelLarge:    { fontFamily: 'Inter-Bold', fontSize: 14, fontWeight: '700', lineHeight: 18, letterSpacing: 0.1 },
    labelMedium:   { fontFamily: 'Inter-SemiBold', fontSize: 12, fontWeight: '700', lineHeight: 16, letterSpacing: 0.1 },
    labelSmall:    { fontFamily: 'Inter-SemiBold', fontSize: 11, fontWeight: '700', lineHeight: 14, letterSpacing: 0.2 },

    // Captions, hints
    captionLarge:  { fontFamily: 'Inter-Medium', fontSize: 12, fontWeight: '500', lineHeight: 16, letterSpacing: 0.1 },
    captionMedium: { fontFamily: 'Inter-Medium', fontSize: 11, fontWeight: '500', lineHeight: 14, letterSpacing: 0.2 },
    captionSmall:  { fontFamily: 'Inter-Medium', fontSize: 10, fontWeight: '500', lineHeight: 13, letterSpacing: 0.3 },

    // Micro badges — Inter 9-10px, 700, uppercase
    micro:         { fontFamily: 'Inter-Bold', fontSize: 9, fontWeight: '700', lineHeight: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
};

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
    pressOpacity: 0.72,
    spring:       { tension: 120, friction: 8 },
    duration:     { fast: 150, normal: 250, slow: 400 },
    easing:       { enter: 'ease-out', exit: 'ease-in', standard: 'ease-in-out' },
};
