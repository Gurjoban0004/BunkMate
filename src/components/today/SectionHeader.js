import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';

const SectionHeader = ({ title, classCount, onHolidayPress, showHoliday = true, onCancelClassPress, showCancelClass = true }) => {
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

            <View style={styles.rightActions}>
                {showCancelClass && onCancelClassPress && (
                    <TouchableOpacity
                        style={[styles.actionButton, { marginRight: SPACING.xs }]}
                        onPress={onCancelClassPress}
                    >
                        <Text style={styles.actionText}>Cancel Class</Text>
                    </TouchableOpacity>
                )}
                {showHoliday && onHolidayPress && (
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={onHolidayPress}
                    >
                        <Text style={styles.actionText}>Mark Holiday</Text>
                    </TouchableOpacity>
                )}
            </View>
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
    left: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    badge: {
        backgroundColor: COLORS.primary,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: SPACING.sm,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textOnPrimary,
    },
    rightActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 6,
        backgroundColor: COLORS.inputBackground,
        borderRadius: 12,
    },
    actionText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
});

export default SectionHeader;
