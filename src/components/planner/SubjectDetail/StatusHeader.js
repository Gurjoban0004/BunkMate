import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../../theme/theme';
import PlannerProgressBar from '../shared/PlannerProgressBar';
import { determineStatus } from '../../../utils/planner/attendanceCalculations';

/**
 * Sleek, compact status header for subject detail page.
 * Displays overall attendance stats in a bento-style column layout.
 */
export default function StatusHeader({ subjectData }) {
    const styles = getStyles(subjectData.color);
    const { color, attended, total, percentage, target } = subjectData;
    const status = determineStatus(percentage, target);
    const statusColor = status === 'danger'
        ? COLORS.danger
        : status === 'warning'
            ? COLORS.warningDark
            : COLORS.success;

    return (
        <View style={styles.container}>
            <View style={styles.contentRow}>
                {/* Left Panel: Big percentage */}
                <View style={styles.leftPanel}>
                    <Text style={[styles.percentageText, { color: statusColor }]}>
                        {percentage.toFixed(1)}%
                    </Text>
                    <Text style={styles.subLabel}>Current Attendance</Text>
                </View>

                {/* Vertical Divider */}
                <View style={styles.divider} />

                {/* Right Panel: Stats details */}
                <View style={styles.rightPanel}>
                    <View style={styles.statLine}>
                        <Text style={styles.statLabel}>Attended</Text>
                        <Text style={styles.statValue}>{attended}</Text>
                    </View>
                    <View style={styles.statLine}>
                        <Text style={styles.statLabel}>Total Classes</Text>
                        <Text style={styles.statValue}>{total}</Text>
                    </View>
                    <View style={styles.statLine}>
                        <Text style={styles.statLabel}>Goal Goal</Text>
                        <Text style={[styles.statValue, { color: COLORS.textMuted }]}>{target}%</Text>
                    </View>
                </View>
            </View>

            {/* Bottom Progress Bar */}
            <View style={styles.progressBarWrapper}>
                <PlannerProgressBar percentage={percentage} target={target} height={6} />
            </View>
        </View>
    );
}

const getStyles = (accentColor) => StyleSheet.create({
    container: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...Platform.select({
            ios: {
                shadowColor: COLORS.shadow,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
            },
            android: {
                elevation: 2,
            },
            web: {
                boxShadow: '0px 2px 4px rgba(15,23,42,0.05)',
            }
        }),
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    leftPanel: {
        flex: 1.2,
    },
    percentageText: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -0.5,
        fontFamily: 'Outfit-ExtraBold',
    },
    subLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: 50,
        backgroundColor: COLORS.border,
        marginHorizontal: SPACING.sm,
    },
    rightPanel: {
        flex: 1,
        paddingLeft: SPACING.xs,
        gap: 2,
    },
    statLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    statValue: {
        fontSize: 12,
        color: COLORS.textPrimary,
        fontWeight: '700',
    },
    progressBarWrapper: {
        marginTop: SPACING.md,
        width: '100%',
    },
});
