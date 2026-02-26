import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const StatsCard = ({ subject, stats, classesPerWeek, remainingClasses }) => {
    const isAtRisk = stats.percentage < 75;
    const statusLabel = stats.percentage >= 85 ? 'Safe' :
        stats.percentage >= 75 ? 'On Track' : 'At Risk';
    const statusColor = stats.percentage >= 85 ? COLORS.success :
        stats.percentage >= 75 ? COLORS.warning : COLORS.danger;
    const statusBg = stats.percentage >= 85 ? COLORS.successLight :
        stats.percentage >= 75 ? COLORS.warningLight : COLORS.dangerLight;

    return (
        <View style={styles.container}>
            {/* Subject Name & Teacher */}
            <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                    <View style={[styles.colorDot, { backgroundColor: subject.color }]} />
                    <Text style={styles.subjectName}>{subject.name}</Text>
                </View>
                {subject.teacher ? (
                    <Text style={styles.teacherName}>{subject.teacher}</Text>
                ) : null}
            </View>

            {/* Big Percentage */}
            <Text style={[styles.bigPercentage, { color: isAtRisk ? COLORS.danger : COLORS.textPrimary }]}>
                {stats.percentage.toFixed(1)}%
            </Text>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            width: `${Math.min(stats.percentage, 100)}%`,
                            backgroundColor: isAtRisk ? COLORS.danger : COLORS.primary,
                        },
                    ]}
                />
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.attendedUnits}</Text>
                    <Text style={styles.statLabel}>Attended</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>{stats.totalUnits}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={styles.statValue}>~{remainingClasses}</Text>
                    <Text style={styles.statLabel}>Remaining</Text>
                </View>
            </View>

            {/* Tags */}
            <View style={styles.tagsRow}>
                {classesPerWeek > 0 && (
                    <View style={styles.tag}>
                        <Text style={styles.tagText}>📅 {classesPerWeek}/wk</Text>
                    </View>
                )}
                <View style={[styles.tag, { backgroundColor: statusBg }]}>
                    <Text style={[styles.tagText, { color: statusColor }]}>
                        {isAtRisk ? '⚠️' : '✅'} {statusLabel}
                    </Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.medium,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: SPACING.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    colorDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
        marginRight: SPACING.sm,
    },
    subjectName: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    teacherName: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
    },
    bigPercentage: {
        fontSize: 44,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: SPACING.sm,
    },
    progressBar: {
        width: '100%',
        height: 10,
        backgroundColor: COLORS.progressBackground,
        borderRadius: 5,
        overflow: 'hidden',
        marginBottom: SPACING.md,
    },
    progressFill: {
        height: '100%',
        borderRadius: 5,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    statLabel: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: COLORS.border,
    },
    tagsRow: {
        flexDirection: 'row',
        gap: SPACING.sm,
    },
    tag: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        paddingHorizontal: SPACING.sm + 2,
        paddingVertical: SPACING.xs + 2,
    },
    tagText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
});

export default StatsCard;
