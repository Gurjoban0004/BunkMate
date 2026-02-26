import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Card from '../../components/common/Card';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/theme';
import { showAlert } from '../../utils/alert';

export default function ExistingAttendanceScreen({ navigation }) {
    const { state, dispatch } = useApp();

    const [subjectData, setSubjectData] = useState(
        state.subjects.map((sub) => ({
            id: sub.id, name: sub.name, total: '', attended: '',
        }))
    );

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
        dispatch({ type: 'SET_INITIAL_ATTENDANCE', payload: updates });
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
    buttonContainer: {
        marginTop: SPACING.md,
    },
});
