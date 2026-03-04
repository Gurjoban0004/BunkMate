import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';
import { showAlert } from '../../utils/alert';
import { getTodayKey, getNextDay } from '../../utils/dateHelpers';

export default function AttendanceStatsScreen({ navigation, route }) {
    const { state, dispatch } = useApp();
    const fromSettings = route?.params?.fromSettings || false;

    const [subjectData, setSubjectData] = useState(
        state.subjects.map((sub) => ({
            id: sub.id, name: sub.name, total: '', attended: '',
        }))
    );

    const [trackingOption, setTrackingOption] = useState(() => {
        const currentHour = new Date().getHours();
        const day = new Date().getDay();
        if (day === 0 || day === 6 || currentHour < 14) return 'yesterday';
        return 'today';
    });

    const todayDate = new Date();
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    const formatOptions = { weekday: 'long', month: 'long', day: 'numeric' };
    const todayLabel = todayDate.toLocaleDateString('en-US', formatOptions);
    const yesterdayLabel = yesterdayDate.toLocaleDateString('en-US', formatOptions);

    const updateSubject = (id, field, value) => {
        const numericValue = value.replace(/[^0-9]/g, '');
        setSubjectData((prev) =>
            prev.map((sub) => (sub.id === id ? { ...sub, [field]: numericValue } : sub))
        );
    };

    const getPercentage = (attended, total) => {
        const a = parseInt(attended) || 0;
        const t = parseInt(total) || 0;
        if (t === 0) return null;
        return Math.round((a / t) * 100);
    };

    const finishSetup = (updates, trackingDate, isTodayIncluded) => {
        const todayStr = getTodayKey();
        dispatch({ type: 'SET_INITIAL_ATTENDANCE', payload: updates });
        dispatch({
            type: 'SET_TRACKING_CONFIG',
            payload: {
                setupDate: todayStr,
                trackingStartDate: trackingDate,
                todayIncludedInSetup: isTodayIncluded,
            }
        });

        if (fromSettings) {
            // When accessed from Settings, just save and go back
            dispatch({ type: 'SET_INITIAL_ATTENDANCE', payload: updates });
            showAlert('Saved', 'Your past attendance has been updated.');
            navigation.goBack();
        } else {
            // During setup, proceed to the celebratory screen
            navigation.navigate('SetupComplete');
        }
    };

    const handleContinue = () => {
        for (const sub of subjectData) {
            const total = parseInt(sub.total) || 0;
            const attended = parseInt(sub.attended) || 0;
            if (attended > total) {
                showAlert('Invalid Input', `${sub.name}: Attended marks cannot exceed total marks.`);
                return;
            }
        }

        const updates = subjectData.map((sub) => ({
            id: sub.id,
            initialTotal: parseInt(sub.total) || 0,
            initialAttended: parseInt(sub.attended) || 0,
        }));

        const todayStr = getTodayKey();
        const trackingStartDate = trackingOption === 'yesterday' ? todayStr : getNextDay(todayStr);

        finishSetup(updates, trackingStartDate, trackingOption === 'today');
    };

    const handleSkip = () => {
        // Skip setup -> 0 attendance, start tracking from today
        const updates = state.subjects.map(sub => ({
            id: sub.id,
            initialTotal: 0,
            initialAttended: 0,
        }));

        const todayStr = getTodayKey();
        // Set trackingStart to today so any classes scheduled today appear in the backlog/Today screen
        finishSetup(updates, todayStr, false);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <KeyboardWrapper contentContainerStyle={styles.scrollContent}>

                <View style={styles.headerBox}>
                    <Text style={styles.header}>{fromSettings ? 'Log Past Attendance' : 'One last thing!'}</Text>
                    <Text style={styles.subtitle}>
                        {fromSettings
                            ? 'Update your attendance numbers for each subject.'
                            : 'Enter your attendance so far this semester.'
                        }
                    </Text>

                    {!fromSettings && (
                        <TouchableOpacity style={styles.skipButtonRow} onPress={handleSkip}>
                            <Text style={styles.skipText}>Starting fresh? </Text>
                            <Text style={styles.skipTextBold}>Skip this step →</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {subjectData.map((subject) => {
                    const pct = getPercentage(subject.attended, subject.total);
                    const isLow = pct !== null && pct < 75;
                    return (
                        <Card key={subject.id} style={styles.subjectCard}>
                            <Text style={styles.subjectName}>{subject.name}</Text>
                            <View style={styles.inputRow}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Total classes</Text>
                                    <Input
                                        placeholder="0"
                                        value={subject.total}
                                        onChangeText={(val) => updateSubject(subject.id, 'total', val)}
                                        keyboardType="number-pad"
                                    />
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Attended</Text>
                                    <Input
                                        placeholder="0"
                                        value={subject.attended}
                                        onChangeText={(val) => updateSubject(subject.id, 'attended', val)}
                                        keyboardType="number-pad"
                                    />
                                </View>
                            </View>
                            {pct !== null && (
                                <Text style={[styles.percentage, isLow && styles.percentageLow]}>
                                    Current: {pct}%
                                </Text>
                            )}
                        </Card>
                    );
                })}

                {!fromSettings && (
                    <>
                        <View style={styles.divider} />

                        <Text style={styles.sectionHeader}>When to Start Tracking?</Text>
                        <Text style={styles.sectionSubtitle}>
                            Your numbers above include attendance up to:
                        </Text>

                        <TouchableOpacity
                            style={[styles.optionCard, trackingOption === 'yesterday' && styles.optionCardSelected]}
                            onPress={() => setTrackingOption('yesterday')}
                        >
                            <View style={styles.optionRow}>
                                <View style={[styles.radio, trackingOption === 'yesterday' && styles.radioSelected]} />
                                <View style={styles.optionContent}>
                                    <Text style={styles.optionTitle}>Yesterday</Text>
                                    <Text style={styles.optionDate}>{yesterdayLabel}</Text>
                                </View>
                            </View>
                            <Text style={styles.optionHelp}>→ Today's classes will appear for you to mark</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.optionCard, trackingOption === 'today' && styles.optionCardSelected]}
                            onPress={() => setTrackingOption('today')}
                        >
                            <View style={styles.optionRow}>
                                <View style={[styles.radio, trackingOption === 'today' && styles.radioSelected]} />
                                <View style={styles.optionContent}>
                                    <Text style={styles.optionTitle}>Today</Text>
                                    <Text style={styles.optionDate}>{todayLabel}</Text>
                                </View>
                            </View>
                            <Text style={styles.optionHelp}>→ Tracking starts from tomorrow</Text>
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.buttonContainer}>
                    <Button title={fromSettings ? 'Save Attendance' : 'Finish Setup 🎉'} onPress={handleContinue} />
                </View>
            </KeyboardWrapper>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: SPACING.screenPadding,
        paddingBottom: SPACING.xxl,
    },
    headerBox: {
        marginBottom: SPACING.lg,
    },
    header: {
        ...TYPOGRAPHY.headerLarge,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    skipButtonRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.primaryLight,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
        borderLeftWidth: 4,
        borderLeftColor: COLORS.primary,
    },
    skipText: {
        ...TYPOGRAPHY.body,
        color: COLORS.primary,
    },
    skipTextBold: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.primary,
    },
    subjectCard: {
        marginBottom: SPACING.cardGap,
    },
    subjectName: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    inputRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        marginBottom: SPACING.xs,
    },
    percentage: {
        ...TYPOGRAPHY.body,
        color: COLORS.success,
        marginTop: SPACING.sm,
        fontWeight: '600',
    },
    percentageLow: {
        color: COLORS.danger,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.border,
        marginVertical: SPACING.lg,
    },
    sectionHeader: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    sectionSubtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    optionCard: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    optionCardSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primaryLight,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.border,
        marginRight: SPACING.md,
    },
    radioSelected: {
        borderColor: COLORS.primary,
        backgroundColor: COLORS.primary,
    },
    optionContent: {
        flex: 1,
    },
    optionTitle: {
        ...TYPOGRAPHY.body,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    optionDate: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
    },
    optionHelp: {
        ...TYPOGRAPHY.caption,
        color: COLORS.primary,
        marginLeft: 36, // Align with text, account for radio
    },
    buttonContainer: {
        marginTop: SPACING.xl,
    },
});
