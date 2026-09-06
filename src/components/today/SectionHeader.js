import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../theme/theme';

/**
 * Section header for the day's classes, with the one occasional action that
 * survives an attendance app that reads from the college: marking the day a
 * holiday so it is not expected in the planner.
 */
const SectionHeader = ({ title, classCount, onHolidayPress }) => {
    const styles = getStyles();
    return (
        <View style={styles.container}>
            <View style={styles.left}>
                <Text style={styles.title}>{title}</Text>
                {classCount !== undefined && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{classCount}</Text>
                    </View>
                )}
            </View>
            {onHolidayPress && (
                <TouchableOpacity
                    style={styles.action}
                    onPress={onHolidayPress}
                    accessibilityRole="button"
                    accessibilityLabel="Mark today as a holiday"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.actionText}>Holiday?</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.sm,
        marginTop: SPACING.md,
    },
    left: { flexDirection: 'row', alignItems: 'center' },
    title: { ...TYPOGRAPHY.labelSmall, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    badge: { backgroundColor: COLORS.primary, borderRadius: BORDER_RADIUS.full, paddingHorizontal: 7, paddingVertical: 2, marginLeft: SPACING.sm },
    badgeText: { ...TYPOGRAPHY.micro, color: COLORS.textOnPrimary },
    action: { minHeight: 36, justifyContent: 'center', paddingHorizontal: SPACING.sm },
    actionText: { ...TYPOGRAPHY.labelSmall, color: COLORS.textMuted },
});

export default SectionHeader;
