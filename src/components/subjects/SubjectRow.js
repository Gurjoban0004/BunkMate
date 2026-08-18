import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import ProgressRing from '../common/ProgressRing';
import usePressScale from '../../hooks/usePressScale';

/**
 * The one sentence this row exists to say. Plain words, no chip: "Skip 3" next
 * to a "3" gauge was the same number twice and neither said what it meant.
 */
export const skipVerdict = (status, skipCount) => {
    if (skipCount === null || skipCount === undefined) return '';

    if (status === 'danger') {
        return skipCount === Infinity || skipCount > 9999
            ? "Can't recover this semester"
            : `Attend ${skipCount} to recover`;
    }
    if (skipCount === Infinity) return 'Can skip freely';
    if (skipCount === 0) return "Can't skip next class";
    return `Can skip ${skipCount} class${skipCount === 1 ? '' : 'es'}`;
};

const SubjectRow = ({ subject, status, threshold, onPress }) => {
    const styles = getStyles();
    const { scale, onPressIn, onPressOut } = usePressScale(0.97);
    const { name, percentage, attendedUnits, totalUnits, skipInfo } = subject;

    const statusColor = status === 'danger' ? COLORS.danger
        : status === 'edge' ? COLORS.warning
            : COLORS.success;
    const verdictColor = status === 'danger' ? COLORS.dangerText
        : status === 'edge' ? COLORS.warningText
            : COLORS.textSecondary;

    return (
        <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={0.95}>
            <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
                <ProgressRing percentage={percentage} size={52} strokeWidth={4} color={statusColor}>
                    <Text style={{ fontSize: FONT_SIZES.sm, fontWeight: '700', color: statusColor }}>{Math.round(percentage)}%</Text>
                </ProgressRing>

                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        <Text style={styles.marksText}>{attendedUnits} / {totalUnits}</Text>
                    </View>
                    <Text style={[styles.verdict, { color: verdictColor }]} numberOfLines={1}>
                        {skipInfo ? skipVerdict(status, skipInfo.count) : '…'}
                    </Text>
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md + 2,
        backgroundColor: COLORS.cardBackground, marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md - 4, padding: SPACING.md + 2,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1, borderColor: COLORS.border,
    },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.sm },
    name: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
    marksText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, fontWeight: '500' },
    verdict: { fontSize: FONT_SIZES.sm, fontWeight: '600', marginTop: SPACING.xs + 2 },
});

export default SubjectRow;
