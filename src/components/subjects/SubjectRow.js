import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme/theme';
import ProgressRing from '../common/ProgressRing';
import SkipGauge from '../common/SkipGauge';

const SubjectRow = ({ subject, status, threshold, onPress }) => {
    const styles = getStyles();
    const { name, color, percentage, attendedUnits, totalUnits, skipInfo, source } = subject;
    const getStatusColor = () => {
        switch (status) {
            case 'danger': return COLORS.danger;
            case 'edge': return COLORS.warning;
            case 'safe': return COLORS.success;
            default: return COLORS.primary;
        }
    };

    const statusColor = getStatusColor();

    const isErpSynced = source === 'erp';
    const isManual = source === 'manual';
    const showSourceBadge = isErpSynced || isManual;

    const skipCount = skipInfo?.count ?? 0;
    const isRecovery = status === 'danger';
    const displayCount = isRecovery ? skipCount : skipCount;
    const gaugeStatus = status === 'danger' ? 'danger' : status === 'edge' ? 'warning' : 'safe';

    return (
        <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
            <ProgressRing percentage={percentage} size={44} strokeWidth={4} color={statusColor}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: statusColor }}>{Math.round(percentage)}%</Text>
            </ProgressRing>

            <View style={styles.content}>
                <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.marksText}>{attendedUnits}/{totalUnits}</Text>
                </View>

                <View style={styles.bottomRow}>
                    {skipInfo && skipCount !== Infinity && (
                        <SkipGauge skipsAvailable={displayCount} maxSkips={10} status={gaugeStatus} compact />
                    )}
                    <View style={[styles.actionBadge, status === 'danger' && styles.actionBadgeDanger, status === 'edge' && styles.actionBadgeEdge, status === 'safe' && styles.actionBadgeSafe]}>
                        <Text style={styles.actionText}>
                            {!skipInfo ? '...' : isRecovery ? (skipCount === Infinity ? "Can't recover" : `Attend ${skipCount}`) : skipCount === 0 ? "Can't skip" : `Skip ${skipCount}`}
                        </Text>
                    </View>
                </View>

                {showSourceBadge && (
                    <Text style={styles.sourceText}>{isErpSynced ? 'Portal' : 'Manual'}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: COLORS.cardBackground, marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.sm, padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1, borderColor: COLORS.borderSubtle, ...SHADOWS.small,
    },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    name: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
    marksText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontWeight: '600' },
    bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, gap: SPACING.sm },
    actionBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: BORDER_RADIUS.full },
    actionBadgeDanger: { backgroundColor: COLORS.dangerLight },
    actionBadgeEdge: { backgroundColor: COLORS.warningLight },
    actionBadgeSafe: { backgroundColor: COLORS.successLight },
    actionText: { fontSize: 10, fontWeight: '700', color: COLORS.textPrimary },
    sourceText: { fontSize: 9, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
});

export default SubjectRow;
