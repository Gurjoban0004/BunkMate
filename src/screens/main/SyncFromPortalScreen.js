import React, { useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput,
    TouchableOpacity, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getSubjectAttendance } from '../../utils/attendance';
import FloatingBackButton from '../../components/common/FloatingBackButton';
import { showAlert } from '../../utils/alert';

/**
 * Sync from Portal screen — allows students to enter their current
 * attendance totals from the college portal to re-sync the app.
 */
export default function SyncFromPortalScreen({ navigation }) {
    const { state, dispatch } = useApp();

    // Build editable subject data
    const subjectsWithStats = useMemo(() => {
        return state.subjects.map(sub => {
            const stats = getSubjectAttendance(sub.id, state);
            return {
                id: sub.id,
                name: sub.name,
                color: sub.color,
                currentAttended: stats?.attendedUnits || 0,
                currentTotal: stats?.totalUnits || 0,
                percentage: stats?.percentage || 0,
            };
        });
    }, [state]);

    // Local state for edited values
    const [editedValues, setEditedValues] = useState(() => {
        const vals = {};
        subjectsWithStats.forEach(sub => {
            vals[sub.id] = {
                attended: String(sub.currentAttended),
                total: String(sub.currentTotal),
            };
        });
        return vals;
    });

    const updateValue = (subjectId, field, value) => {
        // Only allow digits
        const clean = value.replace(/[^0-9]/g, '');
        setEditedValues(prev => ({
            ...prev,
            [subjectId]: { ...prev[subjectId], [field]: clean },
        }));
    };

    // Determine which subjects changed
    const changedSubjects = useMemo(() => {
        return subjectsWithStats.filter(sub => {
            const edited = editedValues[sub.id];
            if (!edited) return false;
            const newAttended = parseInt(edited.attended) || 0;
            const newTotal = parseInt(edited.total) || 0;
            return newAttended !== sub.currentAttended || newTotal !== sub.currentTotal;
        });
    }, [subjectsWithStats, editedValues]);

    const handleSync = () => {
        if (changedSubjects.length === 0) {
            showAlert('No Changes', 'All values match your current attendance.');
            return;
        }

        // Validate
        const hasErrors = changedSubjects.some(sub => {
            const edited = editedValues[sub.id];
            const attended = parseInt(edited.attended) || 0;
            const total = parseInt(edited.total) || 0;
            return attended > total;
        });

        if (hasErrors) {
            showAlert('Invalid Data', 'Attended classes can\'t be more than total classes.');
            return;
        }

        const updates = changedSubjects.map(sub => ({
            subjectId: sub.id,
            newAttended: parseInt(editedValues[sub.id].attended) || 0,
            newTotal: parseInt(editedValues[sub.id].total) || 0,
        }));

        dispatch({
            type: 'RESYNC_ATTENDANCE',
            payload: { updates },
        });

        showAlert(
            'Synced! ✅',
            `Updated ${updates.length} subject${updates.length > 1 ? 's' : ''}. Tracking continues from today.`
        );

        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <FloatingBackButton />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.header}>
                        <Text style={styles.headerEmoji}>🔄</Text>
                        <Text style={styles.headerTitle}>Sync from Portal</Text>
                        <Text style={styles.headerSub}>
                            Enter your current totals from the college portal below.
                            This will update your attendance and start fresh tracking from today.
                        </Text>
                    </View>

                    {/* Subject cards */}
                    {subjectsWithStats.map(sub => {
                        const edited = editedValues[sub.id];
                        const isChanged = changedSubjects.find(c => c.id === sub.id);
                        const newAttended = parseInt(edited?.attended) || 0;
                        const newTotal = parseInt(edited?.total) || 0;
                        const newPercentage = newTotal > 0 ? (newAttended / newTotal * 100) : 0;

                        return (
                            <View key={sub.id} style={[styles.subjectCard, isChanged && styles.subjectCardChanged]}>
                                <View style={styles.subjectHeader}>
                                    <View style={[styles.colorDot, { backgroundColor: sub.color }]} />
                                    <Text style={styles.subjectName}>{sub.name}</Text>
                                    <Text style={[styles.currentBadge, {
                                        color: sub.percentage >= 75 ? COLORS.successDark : COLORS.danger,
                                    }]}>
                                        {sub.percentage.toFixed(1)}%
                                    </Text>
                                </View>

                                <View style={styles.inputRow}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Attended</Text>
                                        <TextInput
                                            style={[styles.input, isChanged && styles.inputChanged]}
                                            value={edited?.attended || ''}
                                            onChangeText={(v) => updateValue(sub.id, 'attended', v)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={COLORS.textMuted}
                                        />
                                    </View>
                                    <Text style={styles.divider}>/</Text>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.inputLabel}>Total</Text>
                                        <TextInput
                                            style={[styles.input, isChanged && styles.inputChanged]}
                                            value={edited?.total || ''}
                                            onChangeText={(v) => updateValue(sub.id, 'total', v)}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={COLORS.textMuted}
                                        />
                                    </View>
                                    {isChanged && (
                                        <Text style={[styles.newPercentage, {
                                            color: newPercentage >= 75 ? COLORS.successDark : COLORS.danger,
                                        }]}>
                                            → {newPercentage.toFixed(1)}%
                                        </Text>
                                    )}
                                </View>
                            </View>
                        );
                    })}

                    <View style={{ height: 120 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Sticky sync button */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.syncButton, changedSubjects.length === 0 && styles.syncButtonDisabled]}
                    onPress={handleSync}
                    activeOpacity={0.8}
                    disabled={changedSubjects.length === 0}
                >
                    <Text style={styles.syncButtonText}>
                        {changedSubjects.length > 0
                            ? `Sync ${changedSubjects.length} Subject${changedSubjects.length > 1 ? 's' : ''}`
                            : 'No Changes'
                        }
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        paddingTop: 60,
        paddingHorizontal: SPACING.lg,
    },
    header: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    headerEmoji: {
        fontSize: 40,
        marginBottom: SPACING.sm,
    },
    headerTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
    },
    headerSub: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: SPACING.md,
    },
    subjectCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
        ...SHADOWS.small,
    },
    subjectCardChanged: {
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    subjectHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    colorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: SPACING.sm,
    },
    subjectName: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        flex: 1,
    },
    currentBadge: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: SPACING.sm,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    input: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textAlign: 'center',
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
    inputChanged: {
        backgroundColor: COLORS.primaryLight,
    },
    divider: {
        fontSize: FONT_SIZES.xl,
        color: COLORS.textMuted,
        fontWeight: '300',
        paddingBottom: 6,
    },
    newPercentage: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
        paddingBottom: 8,
        minWidth: 60,
        textAlign: 'right',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: SPACING.lg,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    syncButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md + 2,
        alignItems: 'center',
        ...SHADOWS.medium,
    },
    syncButtonDisabled: {
        backgroundColor: COLORS.inputBackground,
    },
    syncButtonText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
