import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { getEndGameStats } from '../../utils/planner';

const WEEK_OPTIONS = [4, 6, 8, 10];

const EndGameScreen = () => {
    const styles = getStyles();
    const { state } = useApp();
    const [weeksLeft, setWeeksLeft] = useState(6);

    const stats = useMemo(() => {
        return getEndGameStats(state, 75, weeksLeft);
    }, [state, weeksLeft]);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.pageTitle}>😴 Minimum Effort Mode</Text>
                <Text style={styles.pageSubtitle}>
                    "What's the least I need to pass?"
                </Text>

                {/* Weeks Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Weeks until semester ends:</Text>
                    <View style={styles.weeksRow}>
                        {WEEK_OPTIONS.map((w) => (
                            <TouchableOpacity
                                key={w}
                                style={[
                                    styles.weekButton,
                                    weeksLeft === w && styles.weekButtonActive,
                                ]}
                                onPress={() => setWeeksLeft(w)}
                            >
                                <Text style={[
                                    styles.weekButtonText,
                                    weeksLeft === w && styles.weekButtonTextActive,
                                ]}>
                                    {w}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Summary Card */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Estimated weeks left</Text>
                            <Text style={styles.summaryValue}>{weeksLeft}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                            <Text style={styles.summaryLabel}>Estimated classes left</Text>
                            <Text style={styles.summaryValue}>~{stats.totalRemaining}</Text>
                        </View>
                    </View>
                </View>

                {/* Must Attend vs Can Skip */}
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>To pass all at 75%:</Text>
                    <View style={styles.resultRow}>
                        <View style={[styles.resultBox, { backgroundColor: COLORS.dangerLight }]}>
                            <Text style={styles.resultBoxLabel}>Must attend</Text>
                            <Text style={[styles.resultBoxNumber, { color: COLORS.danger }]}>
                                {stats.totalMustAttend}
                            </Text>
                            <Text style={styles.resultBoxUnit}>classes</Text>
                        </View>
                        <View style={[styles.resultBox, { backgroundColor: COLORS.successLight }]}>
                            <Text style={styles.resultBoxLabel}>Can skip</Text>
                            <Text style={[styles.resultBoxNumber, { color: COLORS.success }]}>
                                {stats.totalCanSkip}
                            </Text>
                            <Text style={styles.resultBoxUnit}>classes</Text>
                        </View>
                    </View>
                </View>

                {/* Per Subject Table */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Per Subject:</Text>
                    <View style={styles.tableCard}>
                        {/* Table Header */}
                        <View style={styles.tableHeader}>
                            <Text style={[styles.tableHeaderText, { flex: 2 }]}>Subject</Text>
                            <Text style={styles.tableHeaderText}>Must Attend</Text>
                            <Text style={styles.tableHeaderText}>Can Skip</Text>
                        </View>

                        {stats.results.map((subject) => {
                            const skipEmoji = subject.canSkip >= 10 ? ' 🎉' : subject.canSkip <= 2 ? ' ⚠️' : '';
                            return (
                                <View key={subject.id} style={styles.tableRow}>
                                    <View style={[styles.tableCell, { flex: 2 }]}>
                                        <View style={[styles.dot, { backgroundColor: subject.color }]} />
                                        <Text style={styles.tableName} numberOfLines={1}>
                                            {subject.name}
                                        </Text>
                                    </View>
                                    <Text style={styles.tableCell}>
                                        {subject.mustAttend}/{subject.remainingUnits}
                                    </Text>
                                    <Text style={[styles.tableCell, { fontWeight: '600' }]}>
                                        {subject.canSkip}{skipEmoji}
                                    </Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Warning */}
                <View style={styles.warningCard}>
                    <Text style={styles.warningTitle}>Warning</Text>
                    <Text style={styles.warningText}>
                        This is the ABSOLUTE minimum. No room for error or emergencies!
                    </Text>
                    <View style={styles.saferRow}>
                        <Text style={styles.saferText}>
                            Safer: Attend {Math.ceil(stats.totalMustAttend * 1.1)}, skip {stats.totalRemaining - Math.ceil(stats.totalMustAttend * 1.1)}
                        </Text>
                    </View>
                </View>

                {/* Info */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>ℹ️ How is this calculated?</Text>
                    <Text style={styles.infoText}>
                        Based on your current attendance and estimated remaining classes per subject from your timetable.{'\n\n'}Actual numbers may vary.
                    </Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: SPACING.lg,
    },
    pageTitle: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
        paddingHorizontal: SPACING.lg,
    },
    pageSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
        paddingHorizontal: SPACING.lg,
        marginTop: SPACING.xs,
        marginBottom: SPACING.lg,
    },
    section: {
        marginBottom: SPACING.md,
    },
    sectionLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.sm,
    },
    weeksRow: {
        flexDirection: 'row',
        paddingHorizontal: SPACING.lg,
        gap: SPACING.sm,
    },
    weekButton: {
        flex: 1,
        paddingVertical: SPACING.sm,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.inputBackground,
    },
    weekButtonActive: {
        backgroundColor: COLORS.primary,
    },
    weekButtonText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    weekButtonTextActive: {
        color: COLORS.textOnPrimary,
    },
    summaryCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,


    },
    summaryRow: {
        flexDirection: 'row',
    },
    summaryItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginBottom: 4,
    },
    summaryValue: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    resultCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginBottom: SPACING.md,


        ...SHADOWS.medium,
    },
    resultTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
    resultRow: {
        flexDirection: 'row',
        gap: SPACING.md,
    },
    resultBox: {
        flex: 1,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        alignItems: 'center',
    },
    resultBoxLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
    },
    resultBoxNumber: {
        fontSize: 36,
        fontWeight: '700',
        lineHeight: 42,
    },
    resultBoxUnit: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
    tableCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,


    },
    tableHeader: {
        flexDirection: 'row',
        paddingBottom: SPACING.sm,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        marginBottom: SPACING.xs,
    },
    tableHeaderText: {
        flex: 1,
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs + 2,
    },
    tableCell: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
        flexDirection: 'row',
        alignItems: 'center',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    tableName: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    warningCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.warningLight,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,


        marginBottom: SPACING.md,
    },
    warningTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.warningDark,
        marginBottom: 4,
    },
    warningText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.warningDark,
    },
    saferRow: {
        marginTop: SPACING.sm,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.warning,
    },
    saferText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    infoCard: {
        marginHorizontal: SPACING.lg,
        backgroundColor: COLORS.primaryLight,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
    },
    infoTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    infoText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
});

export default EndGameScreen;
