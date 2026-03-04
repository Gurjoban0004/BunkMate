import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../../../theme/theme';

/**
 * Section header with label and optional count.
 * Props: title (string), count (optional number)
 */
export default function SectionHeader({ title, count }) {
    return (
        <View style={styles.container}>
            <View style={styles.line} />
            <Text style={styles.title}>
                {title}
                {count != null && <Text style={styles.count}> ({count})</Text>}
            </Text>
            <View style={styles.line} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        marginVertical: SPACING.lg,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    title: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        letterSpacing: 1.2,
        marginHorizontal: SPACING.sm,
        textTransform: 'uppercase',
    },
    count: {
        fontWeight: '400',
    },
});
