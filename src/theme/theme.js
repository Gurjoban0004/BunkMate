// Presence Design System — Sky Blue Theme
// Single source of truth for all visual constants.
// NEVER hardcode colors, spacing, or radii in components.
import { Platform } from 'react-native';

// ─────────────────────────────────────────────────────────────
// 1. COLOR PALETTES
// ─────────────────────────────────────────────────────────────

export const LIGHT_COLORS = {
    // Backgrounds
    background:      '#F0F7FF',   // Main screen — soft blue tint
    cardBackground:  '#FFFFFF',   // Cards, modals, tab bar
    inputBackground: '#F1F5F9',   // Inputs, toggle tracks
    bgSkip:          '#FEF2F2',   // Simulator — skip mode tint
    bgAttend:        '#F0FDF4',   // Simulator — attend mode tint

    // Brand
    primary:         '#5B9BF2',   // Sky blue — buttons, active tabs, key accents
    primaryLight:    '#E8F1FF',   // Tint — pill backgrounds, subtle fills
    primaryDark:     '#2D6FD4',   // Pressed state, strong emphasis
    textOnPrimary:   '#FFFFFF',   // Text on primary-colored surfaces

    // Semantic
    success:         '#34D399',   // Emerald — present, on-track
    successLight:    '#ECFDF5',   // Mint background
    successDark:     '#059669',   // Deep green text

    danger:          '#F87171',   // Coral — absent, at-risk
    dangerLight:     '#FEF2F2',   // Pink background
    dangerDark:      '#DC2626',   // Deep red text

    warning:         '#FBBF24',   // Amber — borderline, caution
    warningLight:    '#FFFBEB',   // Cream background
    warningDark:     '#D97706',   // Deep amber text

    // Text hierarchy
    textPrimary:     '#0F172A',   // Near-black headers
    textSecondary:   '#64748B',   // Body, labels
    textMuted:       '#94A3B8',   // Captions, hints, inactive

    // Structure
    border:          '#E2E8F0',   // Dividers, card borders
    borderSubtle:    'rgba(91, 155, 242, 0.15)', // Blue-tinted card border
    shadow:          '#0F172A',
    overlay:         'rgba(15, 23, 42, 0.5)',

    // Subject dot palette (10 distinct hues)
    subjectPalette: [
        '#F472B6',  // Pink
        '#34D399',  // Emerald
        '#FBBF24',  // Amber
        '#FB7185',  // Rose
        '#2DD4BF',  // Teal
        '#F97316',  // Orange
        '#A3E635',  // Lime
        '#38BDF8',  // Cyan
        '#FACC15',  // Yellow
        '#FB923C',  // Peach
    ],
};

export const DARK_COLORS = {
    // Backgrounds
    background:      '#0B1120',   // Deep navy
    cardBackground:  '#141D2E',   // Elevated navy
    inputBackground: '#1E293B',   // Recessed slate
    bgSkip:          '#2D1F1F',   // Danger tint
    bgAttend:        '#1A2E22',   // Success tint

    // Brand (same hue, same hex — sky blue holds on dark)
    primary:         '#5B9BF2',
    primaryLight:    '#1E3A5F',   // Dark blue fill
    primaryDark:     '#8EC4FF',   // Lighter for emphasis on dark
    textOnPrimary:   '#FFFFFF',

    // Semantic (softer, slightly lighter for dark mode legibility)
    success:         '#6EE7B7',
    successLight:    '#14332A',
    successDark:     '#A7F3D0',

    danger:          '#FCA5A5',
    dangerLight:     '#2D1F1F',
    dangerDark:      '#FECACA',

    warning:         '#FCD34D',
    warningLight:    '#2D2814',
    warningDark:     '#FDE68A',

    // Text hierarchy
    textPrimary:     '#E2E8F0',
    textSecondary:   '#94A3B8',
    textMuted:       '#64748B',

    // Structure
    border:          '#2D3A4F',
    borderSubtle:    'rgba(91, 155, 242, 0.12)',
    shadow:          '#000000',
    overlay:         'rgba(0, 0, 0, 0.75)',

    subjectPalette: [
        '#F9A8D4',  // Light Pink
        '#6EE7B7',  // Light Emerald
        '#FCD34D',  // Light Amber
        '#FDA4AF',  // Light Rose
        '#5EEAD4',  // Light Teal
        '#FDBA74',  // Light Orange
        '#BEF264',  // Light Lime
        '#7DD3FC',  // Light Cyan
        '#FDE047',  // Light Yellow
        '#FED7AA',  // Light Peach
    ],
};

// COLORS is the live token map. Always read from this — never from
// LIGHT_COLORS / DARK_COLORS directly in components.
// Call applyTheme() once on app boot (and on theme toggle) to populate it.
export const COLORS = { ...LIGHT_COLORS };

export const applyTheme = (themeStr) => {
    const source = themeStr === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    Object.assign(COLORS, source);

    const isDark = themeStr === 'dark';
    if (Platform.OS === 'web') {
        SHADOWS.small.boxShadow  = isDark ? '0px 2px 4px rgba(0,0,0,0.3)'   : '0px 1px 2px rgba(15,23,42,0.05)';
        SHADOWS.medium.boxShadow = isDark ? '0px 4px 12px rgba(0,0,0,0.4)'  : '0px 4px 12px rgba(15,23,42,0.1)';
        SHADOWS.large.boxShadow  = isDark ? '0px 8px 24px rgba(0,0,0,0.5)'  : '0px 8px 24px rgba(15,23,42,0.12)';
    } else {
        // On Android, elevation adds a white Material scrim over dark surfaces.
        // Zero it out in dark mode and use border for depth instead.
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
    // Hero numbers (attendance %, big stats)
    displayLarge:  { fontSize: 40, fontWeight: '800', lineHeight: 48, letterSpacing: -0.5 },
    displayMedium: { fontSize: 32, fontWeight: '700', lineHeight: 40, letterSpacing: -0.25 },
    displaySmall:  { fontSize: 28, fontWeight: '700', lineHeight: 36 },

    // Section and card headers
    headingLarge:  { fontSize: 24, fontWeight: '600', lineHeight: 32 },
    headingMedium: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
    headingSmall:  { fontSize: 18, fontWeight: '600', lineHeight: 24 },

    // Body copy
    bodyLarge:     { fontSize: 18, fontWeight: '400', lineHeight: 26 },
    bodyMedium:    { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    bodySmall:     { fontSize: 14, fontWeight: '400', lineHeight: 20 },

    // Labels, buttons, chips
    labelLarge:    { fontSize: 16, fontWeight: '600', lineHeight: 20, letterSpacing: 0.1 },
    labelMedium:   { fontSize: 14, fontWeight: '600', lineHeight: 18, letterSpacing: 0.1 },
    labelSmall:    { fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.2 },

    // Captions, hints
    captionLarge:  { fontSize: 14, fontWeight: '400', lineHeight: 18, letterSpacing: 0.1 },
    captionMedium: { fontSize: 12, fontWeight: '400', lineHeight: 16, letterSpacing: 0.2 },
    captionSmall:  { fontSize: 10, fontWeight: '400', lineHeight: 14, letterSpacing: 0.3 },
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
