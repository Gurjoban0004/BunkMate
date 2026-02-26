import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';

// Helper to format 24h hour int to 12h string
const formatHour = (hour24) => {
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return `${hour12}:00 ${period}`;
};

// Simple Number Stepper for Hours
const HourStepper = ({ value, min, max, onChange, label }) => (
    <View style={styles.stepperContainer}>
        <Text style={styles.stepperLabel}>{label}</Text>
        <View style={styles.stepperControls}>
            <TouchableOpacity
                style={styles.stepButton}
                onPress={() => onChange(Math.max(min, value - 1))}
            >
                <Text style={styles.stepButtonText}>-</Text>
            </TouchableOpacity>

            <View style={styles.stepperValueContainer}>
                <Text style={styles.stepperValue}>{formatHour(value)}</Text>
            </View>

            <TouchableOpacity
                style={styles.stepButton}
                onPress={() => onChange(Math.min(max, value + 1))}
            >
                <Text style={styles.stepButtonText}>+</Text>
            </TouchableOpacity>
        </View>
    </View>
);

export default function TimeSlotsScreen({ navigation }) {
    const { dispatch } = useApp();

    const [startHour, setStartHour] = useState(9); // 9 AM
    const [endHour, setEndHour] = useState(16);    // 4 PM

    const [hasLunchPattern, setHasLunchPattern] = useState(true);
    const [lunchStart, setLunchStart] = useState(13); // 1 PM

    const handleContinue = () => {
        if (startHour >= endHour) {
            Alert.alert('Invalid Times', 'Classes must end after they start.');
            return;
        }

        if (hasLunchPattern && (lunchStart <= startHour || lunchStart >= endHour)) {
            Alert.alert('Invalid Lunch Break', 'Lunch break must be during class hours.');
            return;
        }

        const generatedSlots = [];
        let slotId = 1;

        for (let hour = startHour; hour < endHour; hour++) {
            // Skip the lunch hour if it exists
            if (hasLunchPattern && hour === lunchStart) {
                continue;
            }

            generatedSlots.push({
                id: slotId.toString(),
                start: `${String(hour).padStart(2, '0')}:00`,
                end: `${String(hour + 1).padStart(2, '0')}:00`,
            });
            slotId++;
        }

        if (generatedSlots.length === 0) {
            Alert.alert('Error', 'No class slots could be generated with these settings.');
            return;
        }

        dispatch({ type: 'SET_TIME_SLOTS', payload: generatedSlots });
        navigation.navigate('TimetableBuilder');
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <View style={styles.content}>
                <Text style={styles.header}>⏰ Your Class Timings</Text>
                <Text style={styles.subtitle}>
                    When do your classes start and end? We'll generate your slots automatically.
                </Text>

                <View style={styles.card}>
                    <HourStepper
                        label="First class starts at:"
                        value={startHour}
                        min={6}
                        max={18}
                        onChange={(val) => {
                            setStartHour(val);
                            if (val >= endHour) setEndHour(val + 1);
                        }}
                    />

                    <View style={styles.divider} />

                    <HourStepper
                        label="Last class ends at:"
                        value={endHour}
                        min={startHour + 1}
                        max={22}
                        onChange={setEndHour}
                    />
                </View>

                <View style={styles.card}>
                    <HourStepper
                        label="Lunch break starts at:"
                        value={lunchStart}
                        min={startHour + 1}
                        max={endHour - 1}
                        onChange={setLunchStart}
                    />
                    <Text style={styles.lunchSubtext}>
                        Lunch break lasts for 1 hour
                    </Text>

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
                        💡 Each generated slot will be 1 hour long. You can easily merge slots together for 2-hour classes in the next step!
                    </Text>
                </View>
            </View>

            <Button title="Continue to Timetable" onPress={handleContinue} />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
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
        borderWidth: 1,
        borderColor: COLORS.border,
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
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    stepButton: {
        padding: SPACING.md,
        width: 50,
        alignItems: 'center',
    },
    stepButtonText: {
        fontSize: 24,
        color: COLORS.primary,
        fontWeight: '600',
        lineHeight: 28,
    },
    stepperValueContainer: {
        flex: 1,
        alignItems: 'center',
    },
    stepperValue: {
        fontSize: FONT_SIZES.lg,
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
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 4,
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
    }
});
