import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../../../theme/theme';

/**
 * Section header with label and optional count.
 * Props: title (string), count (optional number)
 */
export default function SectionHeader({ title, count }) {
    const styles = getStyles();
    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                {title}
                {count != null && <Text style={styles.count}> ({count})</Text>}
            </Text>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    count: {
        fontWeight: '400',
    },
});
