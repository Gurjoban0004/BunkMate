import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { showAlert } from '../../utils/alert';
import { formatMinutesToTime, parseTimeToMinutes } from '../../utils/dateHelpers';

// Helper to format total minutes to 12h string for display
const formatMins = (totalMins) => {
    const hours24 = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
    return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
};

// Simple Number Stepper for Time (5 min increments)
const TimeStepper = ({ value, min, max, onChange, label }) => (
    <View style={styles.stepperContainer}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <View style={styles.stepperControls}>
            <TouchableOpacity
                style={styles.stepButton}
                onPress={() => onChange(Math.max(min, value - 5))}
            >
                <Text style={styles.stepButtonText}>-</Text>
            </TouchableOpacity>

            <View style={styles.stepperValueContainer}>
                <Text style={styles.stepperValue}>{formatMins(value)}</Text>
            </View>

            <TouchableOpacity
                style={styles.stepButton}
                onPress={() => onChange(Math.min(max, value + 5))}
            >
                <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
        </View>
    </View>
);

export default function TimeSlotsScreen({ navigation }) {
    const { dispatch } = useApp();

    const [startMins, setStartMins] = useState(540); // 9:00 AM
    const [endMins, setEndMins] = useState(960);     // 4:00 PM

    const [hasLunchPattern, setHasLunchPattern] = useState(true);
    const [lunchStartMins, setLunchStartMins] = useState(780); // 1:00 PM
    const [lunchEndMins, setLunchEndMins] = useState(840);     // 2:00 PM

    const handleContinue = () => {
        if (startMins >= endMins) {
            showAlert('Invalid Times', 'Classes must end after they start.');
            return;
        }

        if (hasLunchPattern && (lunchStartMins <= startMins || lunchEndMins >= endMins || lunchStartMins >= lunchEndMins)) {
            showAlert('Invalid Lunch Break', 'Lunch break must be valid and during class hours.');
            return;
        }

        const generatedSlots = [];
        let slotId = 1;
        let currentMins = startMins;
        let iterations = 0;

        const LStart = hasLunchPattern ? lunchStartMins : null;
        const LEnd = hasLunchPattern ? lunchEndMins : null;

        while (currentMins + 60 <= endMins && iterations < 20) {
            iterations++;

            if (LStart !== null && LEnd !== null) {
                const overlap = Math.max(0, Math.min(currentMins + 60, LEnd) - Math.max(currentMins, LStart));
                if (overlap >= 30) {
                    // Skip this block by jumping to end of lunch
                    currentMins = LEnd;
                    continue;
                }
            }

            generatedSlots.push({
                id: slotId.toString(),
                start: formatMinutesToTime(currentMins),
                end: formatMinutesToTime(currentMins + 60),
            });
            currentMins += 60;
            slotId++;
        }

        if (generatedSlots.length === 0) {
            showAlert('Error', 'Could not generate valid time slots. Adjust your timings.');
            return;
        }

        dispatch({
            type: 'SET_TIME_SLOTS',
            payload: generatedSlots,
        });
        navigation.navigate('SubjectList');
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.header}>Your Class Timings</Text>
                    <Text style={styles.subtitle}>
                        When do your classes start and end? We'll generate your slots automatically.
                    </Text>

                    <View style={styles.card}>
                        <TimeStepper
                            label="First class starts at:"
                            value={startMins}
                            min={360} // 6 AM
                            max={1080} // 6 PM
                            onChange={(val) => {
                                setStartMins(val);
                                if (val >= endMins) setEndMins(val + 60);
                            }}
                        />

                        <View style={styles.divider} />

                        <TimeStepper
                            label="Last class ends at:"
                            value={endMins}
                            min={startMins + 60}
                            max={1320} // 10 PM
                            onChange={setEndMins}
                        />
                    </View>

                    <View style={styles.card}>
                        <TimeStepper
                            label="Break starts at:"
                            value={lunchStartMins}
                            min={startMins + 30}
                            max={endMins - 60}
                            onChange={(val) => {
                                setLunchStartMins(val);
                                if (val >= lunchEndMins) setLunchEndMins(val + 30);
                            }}
                        />

                        <View style={styles.divider} />

                        <TimeStepper
                            label="Break ends at:"
                            value={lunchEndMins}
                            min={lunchStartMins + 15}
                            max={endMins - 30}
                            onChange={setLunchEndMins}
                        />

                        <TouchableOpacity
                            style={styles.checkboxRow}
                            onPress={() => setHasLunchPattern(!hasLunchPattern)}
                        >
                            <View style={[styles.checkbox, hasLunchPattern && styles.checkboxActive]}>
                                {hasLunchPattern && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={styles.checkboxLabel}>Avoid scheduling classes during lunch</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>
                            We use these timings to build your visual timetable canvas in the next step.
                        </Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Button title="Generate Slots" onPress={handleContinue} />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: SPACING.lg,
    },
    content: {
        flex: 1,
    },
    header: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xl,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.lg,


        ...SHADOWS.small,
    },
    stepperContainer: {
        flexDirection: 'column',
    },
    stepperLabel: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    stepperControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        overflow: 'hidden',
    },
    stepButton: {
        padding: SPACING.md,
        width: 60,
        alignItems: 'center',
        backgroundColor: COLORS.primaryLight,
    },
    stepButtonText: {
        fontSize: 24,
        color: COLORS.primary,
        fontWeight: 'bold',
        lineHeight: 28,
    },
    stepperValueContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: SPACING.sm,
    },
    stepperValue: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.lg,
    },
    lunchSubtext: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        textAlign: 'center',
        marginTop: SPACING.xs,
        marginBottom: SPACING.md,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: SPACING.sm,
        padding: SPACING.sm,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: COLORS.border,
        marginRight: SPACING.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    checkmark: {
        color: COLORS.textOnPrimary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    checkboxLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    infoBox: {
        backgroundColor: COLORS.primaryLight,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginTop: SPACING.sm,
    },
    infoText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.primary,
        lineHeight: 20,
    },
    footer: {
        paddingTop: SPACING.md,
    }
});
