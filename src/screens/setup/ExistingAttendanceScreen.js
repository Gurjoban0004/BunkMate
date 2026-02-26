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

export default function ExistingAttendanceScreen({ navigation }) {
    const { state, dispatch } = useApp();

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

        dispatch({ type: 'SET_INITIAL_ATTENDANCE', payload: updates });
        dispatch({
            type: 'SET_TRACKING_CONFIG',
            payload: {
                setupDate: todayStr,
                trackingStartDate,
                todayIncludedInSetup: trackingOption === 'today',
            }
        });

        navigation.navigate('TeacherNames');
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardWrapper contentContainerStyle={styles.scrollContent}>
                <Text style={styles.header}>Current Attendance</Text>
                <Text style={styles.subtitle}>
                    Enter your attendance so far this semester
                </Text>

                {subjectData.map((subject) => {
                    const pct = getPercentage(subject.attended, subject.total);
                    const isLow = pct !== null && pct < 75;
                    return (
                        <Card key={subject.id} style={styles.subjectCard}>
                            <Text style={styles.subjectName}>{subject.name}</Text>
                            <View style={styles.inputRow}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Total marks</Text>
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

                <View style={styles.divider} />

                <Text style={styles.sectionHeader}>📅 When to Start Tracking?</Text>
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

                <View style={styles.tipBox}>
                    <Text style={styles.tipTitle}>💡 Tip</Text>
                    <Text style={styles.tipText}>
                        <Text style={{ fontWeight: '600' }}>Setting up in the morning?</Text> → Pick "Yesterday"{'\n'}
                        <Text style={{ fontWeight: '600' }}>Already attended today's classes?</Text> → Pick "Today"
                    </Text>
                </View>

                <View style={styles.buttonContainer}>
                    <Button title="Continue" onPress={handleContinue} />
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
    header: {
        ...TYPOGRAPHY.headerMedium,
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        marginBottom: SPACING.lg,
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
        borderColor: COLORS.textSecondary,
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
    tipBox: {
        backgroundColor: COLORS.inputBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginTop: SPACING.sm,
        marginBottom: SPACING.md,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.secondary,
    },
    tipTitle: {
        ...TYPOGRAPHY.body,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    tipText: {
        ...TYPOGRAPHY.caption,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    buttonContainer: {
        marginTop: SPACING.md,
    },
});
