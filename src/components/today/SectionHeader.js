import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { PAPER, SERIF_FONT } from '../../theme/theme';

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

const SERIF = { fontFamily: SERIF_FONT };

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 10,
        paddingBottom: 9,
        borderBottomWidth: 1,
        borderBottomColor: PAPER.line,
    },
    left: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    title: { ...SERIF, fontSize: 14, fontWeight: '700', letterSpacing: -0.14, color: PAPER.ink },
    badge: {
        minWidth: 18, paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 99, borderWidth: 1, borderColor: PAPER.countBorder,
        backgroundColor: PAPER.primarySoft, alignItems: 'center', justifyContent: 'center',
    },
    badgeText: { fontSize: 9, fontWeight: '700', color: PAPER.primary },
    action: {
        minHeight: 32, justifyContent: 'center', paddingHorizontal: 10,
        borderRadius: 9, borderWidth: 1, borderColor: PAPER.line, backgroundColor: PAPER.surface,
    },
    actionText: { ...SERIF, fontSize: 11, fontWeight: '700', color: PAPER.secondary },
});

export default SectionHeader;
