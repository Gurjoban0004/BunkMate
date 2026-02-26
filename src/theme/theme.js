// BunkMate Design System — Light Pastel Theme
// All styling constants — NEVER hardcode colors/spacing in components

export const COLORS = {
    // === BACKGROUNDS ===
    background: '#F8F9FA',
    cardBackground: '#FFFFFF',
    inputBackground: '#F1F3F4',

    // === PRIMARY ACCENT ===
    primary: '#6C63FF',    // Soft purple (main action)
    primaryLight: '#E8E6FF', // Light purple tint
    primaryDark: '#5A52D9',   // Pressed state

    // === TEXT ON PRIMARY ===
    textOnPrimary: '#FFFFFF',

    // === STATUS ===
    success: '#4CAF50',
    successLight: '#E8F5E9',
    successDark: '#388E3C',

    danger: '#EF5350',
    dangerLight: '#FFEBEE',
    dangerDark: '#C62828',

    warning: '#FF9800',
    warningLight: '#FFF3E0',
    warningDark: '#E65100',

    // === INFO ===
    info: '#29B6F6',
    infoLight: '#E1F5FE',

    // === TEXT ===
    textPrimary: '#1A1A2E',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',

    // === BORDERS & DIVIDERS ===
    border: '#E5E7EB',
    divider: '#F0F0F0',

    // === PROGRESS BAR ===
    progressBackground: '#E5E7EB',

    // === SUBJECT COLORS ===
    subjectColors: [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
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
    cardPadding: 16,
    cardGap: 12,
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
    lg: 16,
    xl: 20,
    full: 9999,
};

export const SHADOWS = {
    small: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    medium: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    large: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
};

