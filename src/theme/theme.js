// Presence Design System — Light Pastel Theme
// All styling constants — NEVER hardcode colors/spacing in components
import { Platform } from 'react-native';

export const LIGHT_COLORS = {
    // ---------------------------------------------------------
    // 1. BACKGROUNDS (The Canvas)
    // ---------------------------------------------------------
    background: '#F7F8FA',       // Main screen background (warmer)
    cardBackground: '#FFFFFF',   // Card surfaces, tab bar, modals
    inputBackground: '#F0F2F4',  // Text inputs, mode toggle track (darker for contrast)
    bgSkip: '#FFF5F5',           // Simulator background for Skip mode
    bgAttend: '#F0FFF4',         // Simulator background for Fix mode (richer green)

    // ---------------------------------------------------------
    // 2. PRIMARY BRAND (The Identity)
    // ---------------------------------------------------------
    primary: '#8B80F9',          // Active tabs, toggle text, percentage values
    primaryLight: '#EEEDFF',     // Stepper buttons bg, active tab icon pill (lighter)
    primaryDark: '#6358D4',      // Stepper button text (richer)
    textOnPrimary: '#FFFFFF',    // Text on primary-colored surfaces

    // ---------------------------------------------------------
    // 3. SEMANTIC STATUS (The Communication)
    // ---------------------------------------------------------
    success: '#5AC46A',          // Softer pastel green
    successLight: '#E6F7E9',     // Fresher background
    successDark: '#2A6B35',      // Richer text

    danger: '#F25F5F',           // Softer coral red
    dangerLight: '#FFEEEE',      // Softer pink background
    dangerDark: '#C93A3A',       // Richer text

    warning: '#F5D03A',          // Softer gold
    warningLight: '#FFFAEB',     // Warmer cream background
    warningDark: '#D4940A',      // Richer gold text

    // ---------------------------------------------------------
    // 4. TEXT (The Hierarchy)
    // ---------------------------------------------------------
    textPrimary: '#1F2937',      // Richer black for headers
    textSecondary: '#6B7280',    // Better gray for hierarchy
    textMuted: '#9CA3AF',        // Captions, hints, inactive tab labels

    // ---------------------------------------------------------
    // 5. STRUCTURAL (Consolidated Grays)
    // ---------------------------------------------------------
    border: '#E5E7EB',           // Borders, dividers, AND empty progress tracks
    shadow: '#000000',           // Shadow colors
    overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlays

    // ---------------------------------------------------------
    // 6. SUBJECT COLORS (Refined Pastel)
    // ---------------------------------------------------------
    subjectPalette: [
        '#7CB9E8', // Sky blue
        '#F2A3B8', // Rose pink
        '#B8A9D9', // Lavender
        '#4DD4C4', // Teal
        '#C9A3D9', // Orchid
        '#4CC4D9', // Cyan
        '#E0B0E0', // Mauve
        '#8ED4C4', // Mint
    ],
};

export const DARK_COLORS = {
    // ---------------------------------------------------------
    // 1. BACKGROUNDS (The Canvas)
    // ---------------------------------------------------------
    background: '#0F0F14',       // Deep space - main screen
    cardBackground: '#1A1A24',   // Elevated surface - cards, modals
    inputBackground: '#252532',  // Recessed surface - inputs, toggles
    bgSkip: '#1F1418',           // Subtle danger tint - skip mode
    bgAttend: '#141F18',         // Subtle success tint - fix mode

    // ---------------------------------------------------------
    // 2. PRIMARY BRAND (The Identity)
    // ---------------------------------------------------------
    primary: '#A89CFF',          // Soft purple glow - active elements
    primaryLight: '#2A2650',     // Muted purple - button backgrounds
    primaryDark: '#C4BDFF',      // Light purple - hover/active states
    textOnPrimary: '#FFFFFF',    // White on primary buttons

    // ---------------------------------------------------------
    // 3. SEMANTIC STATUS (The Communication)
    // ---------------------------------------------------------
    success: '#6ECB7B',          // Soft green - present, safe
    successLight: '#1A2E20',     // Dark green tint - success backgrounds
    successDark: '#A8E5B3',      // Light green - success emphasis

    danger: '#F07575',           // Soft coral - absent, danger
    dangerLight: '#2D1A1A',      // Dark red tint - danger backgrounds
    dangerDark: '#FFBDBD',       // Light pink - danger emphasis

    warning: '#E8C547',          // Soft gold - warnings
    warningLight: '#2E2815',     // Dark amber tint - warning backgrounds
    warningDark: '#FFE799',      // Light cream - warning emphasis

    // ---------------------------------------------------------
    // 4. TEXT (The Hierarchy)
    // ---------------------------------------------------------
    textPrimary: '#EAECEF',      // Off-white - main content
    textSecondary: '#8E949B',    // Muted gray - secondary info
    textMuted: '#5C6268',        // Dark gray - captions, hints

    // ---------------------------------------------------------
    // 5. STRUCTURAL (The Framework)
    // ---------------------------------------------------------
    border: '#2A2B38',           // Subtle borders, dividers
    shadow: '#000000',           // Shadow base
    overlay: 'rgba(0, 0, 0, 0.75)', // Modal overlay

    // ---------------------------------------------------------
    // 6. SUBJECT COLORS (Pastel Glow)
    // ---------------------------------------------------------
    subjectPalette: [
        '#7EB8D0',   // Soft sky blue
        '#D48BA3',   // Soft rose pink
        '#A892C9',   // Soft lavender
        '#5FBFB5',   // Soft teal
        '#B08FC2',   // Soft orchid
        '#5BB0C4',   // Soft cyan
        '#C99BD0',   // Soft mauve
        '#8CC5B5',   // Soft mint
    ],
};

export const COLORS = { ...LIGHT_COLORS };

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    screenPadding: 20,
    cardPadding: 20,
    cardGap: 16,
};

export const TYPOGRAPHY = {
    // Display Typography - For hero sections and major emphasis
    displayLarge: {
        fontSize: 40,
        fontWeight: '800',
        lineHeight: 48,
        letterSpacing: -0.5,
    },
    displayMedium: {
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 40,
        letterSpacing: -0.25,
    },
    displaySmall: {
        fontSize: 28,
        fontWeight: '700',
        lineHeight: 36,
    },

    // Headings - For section titles and card headers
    headingLarge: {
        fontSize: 24,
        fontWeight: '600',
        lineHeight: 32,
        letterSpacing: 0,
    },
    headingMedium: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
        letterSpacing: 0,
    },
    headingSmall: {
        fontSize: 18,
        fontWeight: '600',
        lineHeight: 24,
        letterSpacing: 0,
    },

    // Body Text - For main content
    bodyLarge: {
        fontSize: 18,
        fontWeight: '400',
        lineHeight: 26,
        letterSpacing: 0,
    },
    bodyMedium: {
        fontSize: 16,
        fontWeight: '400',
        lineHeight: 24,
        letterSpacing: 0,
    },
    bodySmall: {
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
        letterSpacing: 0,
    },

    // UI Elements - For buttons, labels, and controls
    labelLarge: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 20,
        letterSpacing: 0.1,
    },
    labelMedium: {
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 18,
        letterSpacing: 0.1,
    },
    labelSmall: {
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
        letterSpacing: 0.2,
    },

    // Supporting Text - For captions and helper text
    captionLarge: {
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 18,
        letterSpacing: 0.1,
    },
    captionMedium: {
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 16,
        letterSpacing: 0.2,
    },
    captionSmall: {
        fontSize: 10,
        fontWeight: '400',
        lineHeight: 14,
        letterSpacing: 0.3,
    },

    // Legacy compatibility — old names preserved with 'label' suffix where needed
    headerLarge: { fontSize: 28, fontWeight: 'bold' },
    headerMedium: { fontSize: 22, fontWeight: '600' },
    headerSmall: { fontSize: 18, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: 'normal' },
    label: { fontSize: 14, fontWeight: '600' },
    caption: { fontSize: 12, fontWeight: 'normal' },
    button: { fontSize: 16, fontWeight: '600' },
};

// Semantic font size aliases used by new components
export const FONT_SIZES = {
    // Display sizes
    displaySmall: 28,
    displayMedium: 32,
    displayLarge: 40,

    // Heading sizes
    headingSmall: 18,
    headingMedium: 20,
    headingLarge: 24,

    // Body sizes
    bodySmall: 14,
    bodyMedium: 16,
    bodyLarge: 18,

    // Label sizes
    labelSmall: 12,
    labelMedium: 14,
    labelLarge: 16,

    // Caption sizes
    captionSmall: 10,
    captionMedium: 12,
    captionLarge: 14,

    // Legacy compatibility
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
};

// Standardized Border Radius
export const BORDER_RADIUS = {
    sm: 8,
    md: 12,
    lg: 20,
    xl: 24,
    full: 9999,
};

export const SHADOWS = {
    small: Platform.OS === 'web' ? {
        boxShadow: `0px 1px 2px ${COLORS.shadow}0D`, // 0.05 opacity
    } : {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    medium: Platform.OS === 'web' ? {
        boxShadow: `0px 4px 12px ${COLORS.shadow}1A`, // 0.1 opacity
    } : {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
    },
    large: Platform.OS === 'web' ? {
        boxShadow: `0px 4px 8px ${COLORS.shadow}1A`, // 0.1 opacity
    } : {
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
};

export const applyTheme = (themeStr) => {
    const source = themeStr === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    for (const key in source) {
        COLORS[key] = source[key];
    }

    // Shadows need to be stronger in dark mode
    if (themeStr === 'dark') {
        if (Platform.OS === 'web') {
            SHADOWS.small.boxShadow = `0px 2px 4px rgba(0, 0, 0, 0.3)`;
            SHADOWS.medium.boxShadow = `0px 4px 12px rgba(0, 0, 0, 0.4)`;
            SHADOWS.large.boxShadow = `0px 8px 24px rgba(0, 0, 0, 0.5)`;
        } else {
            // On Android, elevation adds a white Material scrim over dark surfaces.
            // Zero it out in dark mode and rely on border for depth instead.
            SHADOWS.small.elevation = 0;
            SHADOWS.small.shadowOpacity = 0;
            SHADOWS.medium.elevation = 0;
            SHADOWS.medium.shadowOpacity = 0;
            SHADOWS.large.elevation = 0;
            SHADOWS.large.shadowOpacity = 0;
        }
    } else {
        // Reset to light mode values
        if (Platform.OS === 'web') {
            SHADOWS.small.boxShadow = `0px 1px 2px ${COLORS.shadow}0D`;
            SHADOWS.medium.boxShadow = `0px 4px 12px ${COLORS.shadow}1A`;
            SHADOWS.large.boxShadow = `0px 4px 8px ${COLORS.shadow}1A`;
        } else {
            SHADOWS.small.elevation = 1;
            SHADOWS.small.shadowOpacity = 0.05;
            SHADOWS.medium.elevation = 3;
            SHADOWS.medium.shadowOpacity = 0.12;
            SHADOWS.large.elevation = 4;
            SHADOWS.large.shadowOpacity = 0.1;
        }
    }
};

