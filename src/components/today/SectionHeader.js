import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '../../theme/theme';

const SectionHeader = ({ title, classCount, onHolidayPress, showHoliday = true }) => {
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

            {showHoliday && (
                <TouchableOpacity
                    style={styles.holidayButton}
                    onPress={onHolidayPress}
                >
                    <Text style={styles.holidayEmoji}>🏖️</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.sm,
        marginTop: SPACING.sm,
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
    holidayButton: {
        padding: SPACING.xs,
    },
    holidayEmoji: {
        fontSize: 24,
    },
});

export default SectionHeader;
