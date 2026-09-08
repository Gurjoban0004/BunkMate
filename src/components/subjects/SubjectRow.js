import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { formatPct } from '../../utils/attendance';
import { shortSubjectName } from '../../utils/subjectName';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, TABULAR, subjectTint } from '../../theme/theme';
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

const SubjectRow = ({ subject, status, threshold, subjects, onPress }) => {
    const styles = getStyles();
    const { scale, onPressIn, onPressOut } = usePressScale(0.97);
    const { name, percentage, attendedUnits, totalUnits, skipInfo } = subject;

    // The card wears the SUBJECT's colour, exactly as its Today bento tile does
    // (theme.js §1c) — so a student who has learned "the coral one is CN" reads
    // this list the same way they read their day.
    //
    // The status still has to be visible, and it is: the list is already grouped
    // under Needs Attention / Borderline / Safe, and the ring plus the verdict
    // line keep the danger/edge/safe ink. Colour says WHICH subject; the ring
    // and the words say HOW IT IS GOING. They were both saying the second thing.
    const tint = subjectTint(subject.id, subjects);

    const statusColor = status === 'danger' ? COLORS.danger
        : status === 'edge' ? COLORS.warning
            : COLORS.success;
    const verdictColor = status === 'danger' ? COLORS.dangerText
        : status === 'edge' ? COLORS.warningText
            : tint.ink;

    return (
        <TouchableOpacity onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={0.95}>
            <Animated.View style={[
                styles.container,
                { backgroundColor: tint.bg, transform: [{ scale }] },
            ]}>
                {/* The ring's track is the subject's accent at low weight, so the
                    ring reads as belonging to the card rather than sitting on it. */}
                <ProgressRing
                    percentage={percentage}
                    size={52}
                    strokeWidth={4}
                    color={statusColor}
                    trackColor={tint.accent}
                >
                    <Text style={{ ...TABULAR, fontSize: 12, fontWeight: '700', color: statusColor }}>{formatPct(percentage)}%</Text>
                </ProgressRing>

                <View style={styles.content}>
                    <View style={styles.topRow}>
                        <Text style={[styles.name, { color: tint.ink }]} numberOfLines={1}>{shortSubjectName(name)}</Text>
                        <Text style={[styles.countText, { color: tint.ink }]}>{attendedUnits} / {totalUnits}</Text>
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
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md - 4, padding: SPACING.md + 2,
        // The bento's radius and its bare edge — a tint that already separates
        // the card from the page does not also need a stroke around it.
        borderRadius: 18,
    },
    content: { flex: 1 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: SPACING.sm },
    name: { fontSize: FONT_SIZES.md, fontWeight: '700', flex: 1 },
    countText: { ...TABULAR, fontSize: FONT_SIZES.sm, fontWeight: '600', opacity: 0.75 },
    verdict: { fontSize: FONT_SIZES.sm, fontWeight: '600', marginTop: SPACING.xs + 2 },
});

export default SubjectRow;
