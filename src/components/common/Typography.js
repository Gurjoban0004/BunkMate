import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { TYPOGRAPHY, COLORS } from '../../theme/theme';

/**
 * Helper to create a functional component for each typography variant
 */
const createTypography = (variantName) => {
    return ({ children, style, color, ...props }) => {
        const variantStyle = TYPOGRAPHY[variantName] || TYPOGRAPHY.bodyMedium;
        return (
            <Text
                style={[
                    variantStyle,
                    { color: color || COLORS.textPrimary },
                    style
                ]}
                {...props}
            >
                {children}
            </Text>
        );
    };
};

// Export individual components matching TodayScreen.js usage
export const DisplayMedium = createTypography('displayMedium');
export const HeadingMedium = createTypography('headingMedium');
export const HeadingSmall = createTypography('headingSmall');
export const BodyMedium = createTypography('bodyMedium');
export const BodySmall = createTypography('bodySmall');
export const CaptionMedium = createTypography('captionMedium');

// Add others from TYPOGRAPHY for completeness
export const DisplayLarge = createTypography('displayLarge');
export const DisplaySmall = createTypography('displaySmall');
export const HeadingLarge = createTypography('headingLarge');
export const BodyLarge = createTypography('bodyLarge');
export const LabelLarge = createTypography('labelLarge');
export const LabelMedium = createTypography('labelMedium');
export const LabelSmall = createTypography('labelSmall');
export const CaptionLarge = createTypography('captionLarge');
export const CaptionSmall = createTypography('captionSmall');

export default {
    DisplayLarge,
    DisplayMedium,
    DisplaySmall,
    HeadingLarge,
    HeadingMedium,
    HeadingSmall,
    BodyLarge,
    BodyMedium,
    BodySmall,
    LabelLarge,
    LabelMedium,
    LabelSmall,
    CaptionLarge,
    CaptionMedium,
    CaptionSmall,
};
