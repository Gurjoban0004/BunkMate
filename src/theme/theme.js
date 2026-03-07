// Presence Design System — Light Pastel Theme
// All styling constants — NEVER hardcode colors/spacing in components
import { Platform } from 'react-native';

export const LIGHT_COLORS = {
    // ---------------------------------------------------------
    // 1. BACKGROUNDS (The Canvas)
    // ---------------------------------------------------------
    background: '#F5F7FA',       // Main screen background
    cardBackground: '#FFFFFF',   // Card surfaces, tab bar, modals
    inputBackground: '#F1F3F4',  // Text inputs, mode toggle track
    bgBunk: '#FFF5F5',           // Simulator background for Skip mode
    bgAttend: '#F5FFF7',         // Simulator background for Fix mode

    // ---------------------------------------------------------
    // 2. PRIMARY BRAND (The Identity)
    // ---------------------------------------------------------
    primary: '#8B80F9',          // Active tabs, toggle text, percentage values
    primaryLight: '#E8E6FF',     // Stepper buttons bg, active tab icon pill
    primaryDark: '#5A52D9',      // Stepper button text
    textOnPrimary: '#FFFFFF',    // Text on primary-colored surfaces

    // ---------------------------------------------------------
    // 3. SEMANTIC STATUS (The Communication)
    // ---------------------------------------------------------
    success: '#6BCB77',
    successLight: '#E8F5E9',
    successDark: '#2E7D32',

    danger: '#FF6B6B',
    dangerLight: '#FFEBEE',
    dangerDark: '#D32F2F',

    warning: '#FFD93D',
    warningLight: '#FFF8E1',
    warningDark: '#F57C00',

    // ---------------------------------------------------------
    // 4. TEXT (The Hierarchy)
    // ---------------------------------------------------------
    textPrimary: '#2D3436',      // Headers, subject names, main content
    textSecondary: '#636E72',    // Subtitles, secondary info, progress markers
    textMuted: '#9CA3AF',        // Captions, hints, inactive tab labels

    // ---------------------------------------------------------
    // 5. STRUCTURAL (Consolidated Grays)
    // ---------------------------------------------------------
    border: '#E5E7EB',           // Borders, dividers, AND empty progress tracks
    shadow: '#000000',           // Shadow colors
    overlay: 'rgba(0, 0, 0, 0.5)', // Modal overlays

    // ---------------------------------------------------------
    // 6. SUBJECT COLORS (Strictly Decorative)
    // ---------------------------------------------------------
    subjectPalette: [
        '#85C1E9', '#F48FB1', '#B39DDB', '#4ECDC4',
        '#BB8FCE', '#45B7D1', '#DDA0DD', '#98D8C8',
    ],
};

export const DARK_COLORS = {
    background: '#14141A',       // Deep muted dark tone
    cardBackground: '#1F1F2A',   // Slightly elevated dark tone
    inputBackground: '#2B2B38',  // Input surfaces
    bgBunk: '#2A1A1E',           // Simulator background for Skip mode
    bgAttend: '#1A2A1E',         // Simulator background for Fix mode

    primary: '#9B92F2',          // Lighter pastel primary
    primaryLight: '#393375',     // Stepper buttons bg dark
    primaryDark: '#B1AAFA',      // Stepper button text lighter
    textOnPrimary: '#FFFFFF',

    success: '#5ABD69',
    successLight: '#1C3E26',
    successDark: '#8CED9B',

    danger: '#ED5E5E',
    dangerLight: '#4F1D1D',
    dangerDark: '#FFAFAF',

    warning: '#F2CD33',
    warningLight: '#594A10',
    warningDark: '#FFE67B',

    textPrimary: '#F1F3F5',
    textSecondary: '#9AA0A6',
    textMuted: '#687076',

    border: '#2C2D3A',
    shadow: '#000000',
    overlay: 'rgba(0, 0, 0, 0.7)',

    subjectPalette: [
        '#568EA6', '#B05E7B', '#7A64A0', '#34938D',
        '#8B6899', '#2E8B9E', '#A46EAA', '#63A293',
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

    // Legacy compatibility - will be deprecated
    headerLarge: { fontSize: 28, fontWeight: 'bold' },
    headerMedium: { fontSize: 22, fontWeight: '600' },
    headerSmall: { fontSize: 18, fontWeight: '600' },
    body: { fontSize: 16, fontWeight: 'normal' },
    bodySmall: { fontSize: 14, fontWeight: 'normal' },
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

    // Update SHADOWS dependent on COLORS.shadow
    if (Platform.OS === 'web') {
        SHADOWS.small.boxShadow = `0px 1px 2px ${COLORS.shadow}0D`;
        SHADOWS.medium.boxShadow = `0px 4px 12px ${COLORS.shadow}1A`;
        SHADOWS.large.boxShadow = `0px 4px 8px ${COLORS.shadow}1A`;
    } else {
        SHADOWS.small.shadowColor = COLORS.shadow;
        SHADOWS.medium.shadowColor = COLORS.shadow;
        SHADOWS.large.shadowColor = COLORS.shadow;
    }
};

