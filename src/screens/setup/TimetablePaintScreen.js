import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM']; // 7 slots: 9am-4pm

export default function TimetablePaintScreen({ navigation }) {
    const { state, dispatch } = useApp();
    const subjects = state.subjects || [];

    // Grid state: day -> array of 7 subject IDs or null
    const [grid, setGrid] = useState(() => {
        const initial = {};
        DAYS.forEach(day => {
            initial[day] = Array(7).fill(null);
        });
        return initial;
    });

    const [activeSubjectId, setActiveSubjectId] = useState(null);
    const [activeDay, setActiveDay] = useState('Monday');

    const handleSlotPress = (index) => {
        setGrid(prev => {
            const newDay = [...prev[activeDay]];
            const currentSlot = newDay[index];

            if (activeSubjectId === null) {
                // Erase
                newDay[index] = null;
            } else {
                if (currentSlot === activeSubjectId) {
                    // Erase if tapping the same active subject
                    newDay[index] = null;
                } else {
                    // Paint
                    newDay[index] = activeSubjectId;
                }
            }

            return { ...prev, [activeDay]: newDay };
        });
    };

    const handleCopyPrevious = () => {
        const currentIndex = DAYS.indexOf(activeDay);
        if (currentIndex > 0) {
            const prevDay = DAYS[currentIndex - 1];
            setGrid(prev => ({
                ...prev,
                [activeDay]: [...prev[prevDay]]
            }));
        }
    };

    const handleContinue = () => {
        // 1. Generate standard time slots
        const generatedTimeSlots = [];
        for (let i = 0; i < 7; i++) {
            generatedTimeSlots.push({
                id: `slot-${i}`,
                start: `${String(9 + i).padStart(2, '0')}:00`,
                end: `${String(10 + i).padStart(2, '0')}:00`,
            });
        }

        // 2. Generate timetable
        const finalTimetable = {};
        DAYS.forEach(day => {
            const slotsArray = grid[day];
            const daySchedule = [];

            for (let i = 0; i < 7; i++) {
                const subjectId = slotsArray[i];
                if (subjectId) {
                    daySchedule.push({
                        slotId: `slot-${i}`,
                        subjectId: subjectId
                    });
                }
            }
            finalTimetable[day] = daySchedule;
        });

        dispatch({ type: 'SET_TIME_SLOTS', payload: generatedTimeSlots });
        dispatch({ type: 'SET_TIMETABLE', payload: finalTimetable });
        navigation.navigate('AttendanceStats');
    };

    // Calculate slots for rendering, merging adjacent identical subjects visually
    const renderSlots = () => {
        const currentSlots = grid[activeDay];
        const elements = [];
        let i = 0;

        while (i < 7) {
            const subjectId = currentSlots[i];

            if (subjectId === null) {
                // Render empty slot
                elements.push(
                    <TouchableOpacity
                        key={`slot-${i}`}
                        style={styles.emptySlot}
                        onPress={() => handleSlotPress(i)}
                    >
                        <Text style={styles.timeLabel}>{HOURS[i]}</Text>
                        <View style={styles.emptySlotContent}>
                            <Text style={styles.emptySlotText}>Tap to add</Text>
                        </View>
                    </TouchableOpacity>
                );
                i++;
            } else {
                // Render filled slot(s)
                let span = 1;
                while (i + span < 7 && currentSlots[i + span] === subjectId) {
                    span++;
                }

                const subject = subjects.find(s => s.id === subjectId);
                const color = subject ? subject.color : COLORS.primary;
                const name = subject ? subject.name : 'Unknown';

                elements.push(
                    <View key={`slot-${i}`} style={[styles.filledSlotWrapper, { height: span * 70 }]}>
                        {/* Time labels container */}
                        <View style={styles.timeLabelsContainer}>
                            <Text style={styles.timeLabel}>{HOURS[i]}</Text>
                            {span > 1 && (
                                <Text style={[styles.timeLabel, styles.timeLabelEnd]}>
                                    {HOURS[i + span - 1]}
                                </Text>
                            )}
                        </View>

                        {/* The clickable block, spanning multiple slots conceptually */}
                        <TouchableOpacity
                            style={[styles.filledSlot, { backgroundColor: color + '30', borderLeftColor: color }]}
                            onPress={() => {
                                // Tapping a merged block will apply the brush to all spanned slots
                                for (let j = 0; j < span; j++) {
                                    handleSlotPress(i + j);
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.subjectText, { color: color }]}>{name}</Text>
                            {span > 1 && (
                                <Text style={[styles.durationText, { color: color }]}>{span} Hours</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                );

                i += span;
            }
        }

        return elements;
    };

    const currentDayIndex = DAYS.indexOf(activeDay);

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Paint your timetable</Text>
                <Text style={styles.subtitle}>Select a subject, then tap slots</Text>
            </View>

            {/* Day Tabs */}
            <View style={styles.tabsContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.tabsContent}
                >
                    {DAYS.map(day => (
                        <TouchableOpacity
                            key={day}
                            style={[
                                styles.tab,
                                activeDay === day && styles.tabActive
                            ]}
                            onPress={() => setActiveDay(day)}
                        >
                            <Text style={[
                                styles.tabText,
                                activeDay === day && styles.tabTextActive
                            ]}>
                                {day.substring(0, 3)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Grid Area */}
            <ScrollView
                style={styles.gridScroll}
                contentContainerStyle={styles.gridContent}
                showsVerticalScrollIndicator={false}
            >
                {currentDayIndex > 0 && (
                    <TouchableOpacity style={styles.copyButton} onPress={handleCopyPrevious}>
                        <Text style={styles.copyButtonText}>📋 Copy {DAYS[currentDayIndex - 1]}</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.slotsContainer}>
                    {renderSlots()}
                </View>
            </ScrollView>

            {/* Palette Area */}
            <View style={styles.paletteContainer}>
                <Text style={styles.paletteTitle}>Brush</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.paletteContent}
                >
                    <TouchableOpacity
                        style={[
                            styles.paletteItem,
                            activeSubjectId === null && styles.paletteItemActive
                        ]}
                        onPress={() => setActiveSubjectId(null)}
                    >
                        <View style={[styles.paletteColor, { backgroundColor: COLORS.border }]} />
                        <Text style={[styles.paletteText, activeSubjectId === null && styles.paletteTextActive]}>Eraser</Text>
                    </TouchableOpacity>

                    {subjects.map(subject => (
                        <TouchableOpacity
                            key={subject.id}
                            style={[
                                styles.paletteItem,
                                activeSubjectId === subject.id && styles.paletteItemActive
                            ]}
                            onPress={() => setActiveSubjectId(subject.id)}
                        >
                            <View style={[styles.paletteColor, { backgroundColor: subject.color }]} />
                            <Text style={[styles.paletteText, activeSubjectId === subject.id && styles.paletteTextActive]}>
                                {subject.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Footer */}
            <SafeAreaView edges={['bottom']} style={styles.footer}>
                <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
                    <Text style={styles.continueText}>NEXT →</Text>
                </TouchableOpacity>
            </SafeAreaView>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.lg,
        paddingBottom: SPACING.sm,
    },
    title: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    tabsContainer: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        backgroundColor: COLORS.background,
    },
    tabsContent: {
        paddingHorizontal: SPACING.md,
    },
    tab: {
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    tabActive: {
        borderBottomColor: COLORS.primary,
    },
    tabText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    tabTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    gridScroll: {
        flex: 1,
    },
    gridContent: {
        padding: SPACING.lg,
        paddingBottom: SPACING.xxl,
    },
    copyButton: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.inputBackground,
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    copyButtonText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
        fontWeight: '600',
    },
    slotsContainer: {
        flexDirection: 'column',
    },
    emptySlot: {
        height: 70,
        flexDirection: 'row',
        marginBottom: SPACING.sm,
    },
    timeLabel: {
        width: 60,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '600',
        paddingTop: SPACING.sm,
    },
    timeLabelEnd: {
        marginTop: 'auto',
        paddingBottom: SPACING.sm,
    },
    timeLabelsContainer: {
        width: 60,
        justifyContent: 'space-between',
    },
    emptySlotContent: {
        flex: 1,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptySlotText: {
        color: COLORS.textMuted,
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
    },
    filledSlotWrapper: {
        flexDirection: 'row',
        marginBottom: SPACING.sm,
    },
    filledSlot: {
        flex: 1,
        borderRadius: BORDER_RADIUS.md,
        borderLeftWidth: 4,
        padding: SPACING.md,
        justifyContent: 'center',
    },
    subjectText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    durationText: {
        fontSize: FONT_SIZES.sm,
        marginTop: 4,
        opacity: 0.8,
        fontWeight: '600',
    },
    paletteContainer: {
        backgroundColor: COLORS.cardBackground,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.sm,
    },
    paletteTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    paletteContent: {
        paddingHorizontal: SPACING.md,
    },
    paletteItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginHorizontal: SPACING.xs,
        backgroundColor: COLORS.background,
    },
    paletteItemActive: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    paletteColor: {
        width: 16,
        height: 16,
        borderRadius: 8,
        marginRight: SPACING.sm,
    },
    paletteText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textSecondary,
    },
    paletteTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    footer: {
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.xl,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    continueButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    continueText: {
        color: COLORS.textOnPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
});
