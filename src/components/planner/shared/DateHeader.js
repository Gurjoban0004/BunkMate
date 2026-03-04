import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, SPACING } from '../../../theme/theme';

/**
 * Displays formatted date like "Tuesday, March 19"
 * Props: date (Date object, optional — defaults to today)
 */
export default function DateHeader({ date }) {
    const d = date || new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const formatted = `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}`;

    return (
        <Text style={styles.date}>{formatted}</Text>
    );
}

const styles = StyleSheet.create({
    date: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
});
