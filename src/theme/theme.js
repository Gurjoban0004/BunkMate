// Presence Design System — Light Pastel Theme
// All styling constants — NEVER hardcode colors/spacing in components
import { Platform } from 'react-native';

export const COLORS = {
    // ---------------------------------------------------------
    // 1. BACKGROUNDS (The Canvas)
    // ---------------------------------------------------------
    background: '#F5F7FA',       // Main screen background
    cardBackground: '#FFFFFF',   // Card surfaces, tab bar, modals
    inputBackground: '#F1F3F4',  // Text inputs, mode toggle track

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
    // Success
    success: '#6BCB77',          // On-track dots, progress bar fills
    successLight: '#E8F5E9',     // Safe badge bg
    successDark: '#2E7D32',      // Softer text contrast for badges

    // Danger
    danger: '#FF6B6B',           // Needs-work dots, bar fills
    dangerLight: '#FFEBEE',      // Danger percentage badge bg
    dangerDark: '#D32F2F',       // Clean, readable dark ruby

    // Warning
    warning: '#FFD93D',          // Warning dots, progress bar fills
    warningLight: '#FFF8E1',     // Softer warning badge bg
    warningDark: '#F57C00',      // Balanced dark orange

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
    // No semantic reds, greens, or yellows to avoid confusion.
    // ---------------------------------------------------------
    subjectPalette: [
        '#85C1E9', // Light Blue
        '#F48FB1', // Soft Pink
        '#B39DDB', // Deep Lavender
        '#4ECDC4', // Teal
        '#BB8FCE', // Lavender
        '#45B7D1', // Sky Blue
        '#DDA0DD', // Plum
        '#98D8C8', // Mint
    ],
};

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
    xl: 20,
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

