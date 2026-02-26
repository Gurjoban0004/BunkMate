import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { COLORS, BORDER_RADIUS, FONT_SIZES, SPACING } from '../../theme/theme';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TimetableGrid = ({ state, onCellPress }) => {
    const timetable = state.timetable;
    const timeSlots = state.timeSlots || [];

    return (
        <View style={styles.gridContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={true} bounces={false}>
                <ScrollView bounces={false}>
                    {/* Header Row */}
                    <View style={styles.row}>
                        <View style={[styles.cell, styles.headerCell, styles.cornerCell]} />
                        {timeSlots.map(slot => (
                            <View key={slot.id} style={[styles.cell, styles.headerCell]}>
                                <Text style={styles.timeText}>{slot.start.substring(0, 5)}</Text>
                                <Text style={styles.timeText}>{slot.end.substring(0, 5)}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Day Rows */}
                    {DAYS.map(day => {
                        let skipNext = false;

                        return (
                            <View key={day} style={styles.row}>
                                <View style={[styles.cell, styles.dayCell]}>
                                    <Text style={styles.dayText}>{day.substring(0, 3)}</Text>
                                </View>

                                {timeSlots.map((slot, index) => {
                                    if (skipNext) {
                                        skipNext = false;
                                        return null;
                                    }

                                    const classInfo = timetable[day]?.find(c => c.slotId === slot.id);
                                    const subject = classInfo ? state.subjects.find(s => s.id === classInfo.subjectId) : null;

                                    // Check if next slot has the same subject (2-hour class visually merged)
                                    let isMerged = false;
                                    if (subject) {
                                        const nextSlot = timeSlots[index + 1];
                                        if (nextSlot) {
                                            const nextClass = timetable[day]?.find(c => c.slotId === nextSlot.id);
                                            if (nextClass && nextClass.subjectId === subject.id) {
                                                isMerged = true;
                                                skipNext = true;
                                            }
                                        }
                                    }

                                    if (subject) {
                                        return (
                                            <TouchableOpacity
                                                key={slot.id}
                                                style={[
                                                    styles.cell,
                                                    styles.filledCell,
                                                    { backgroundColor: subject.color + '30', borderLeftColor: subject.color },
                                                    isMerged && { width: 140 } // Double width
                                                ]}
                                                onPress={() => onCellPress && onCellPress(subject)}
                                                activeOpacity={0.7}
                                                disabled={!onCellPress}
                                            >
                                                <Text style={[styles.subjectText, { color: subject.color }]} numberOfLines={2}>
                                                    {subject.name}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    }

                                    return (
                                        <View key={slot.id} style={styles.cell}>
                                            <Text style={styles.emptyText}>-</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })}
                </ScrollView>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    gridContainer: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden',
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.md,
    },
    row: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    cell: {
        width: 70, // Fixed width
        height: 60,
        borderRightWidth: 1,
        borderRightColor: COLORS.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
    },
    cornerCell: {
        width: 50,
        backgroundColor: COLORS.inputBackground,
    },
    headerCell: {
        backgroundColor: COLORS.inputBackground,
        height: 40,
    },
    dayCell: {
        width: 50,
        backgroundColor: COLORS.inputBackground,
    },
    timeText: {
        fontSize: 10,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    dayText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: 'bold',
        color: COLORS.textSecondary,
    },
    filledCell: {
        borderLeftWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    subjectText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        textAlign: 'center',
    },
    emptyText: {
        color: COLORS.border,
        fontSize: 24,
    },
});

export default TimetableGrid;
