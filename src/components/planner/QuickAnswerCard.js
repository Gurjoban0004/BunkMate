import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, PAPER, SERIF_FONT } from '../../theme/theme';
import { getDayRecommendation } from '../../utils/planner.js';
import { shortSubjectName } from '../../utils/subjectName';

// Today reads on paper, so the compact card uses the PAPER tints rather than
// the palette engine's — see theme.js §1b.
const PAPER_TONE = {
    safe:    { bg: PAPER.successSoft, border: PAPER.successLine, ink: PAPER.sageInk,    subInk: PAPER.sageInk,        rule: 'rgba(50,106,85,0.2)' },
    partial: { bg: PAPER.warningSoft, border: PAPER.warningLine, ink: PAPER.warningInk, subInk: PAPER.warningInkSoft, rule: 'rgba(126,92,40,0.2)' },
    risky:   { bg: PAPER.apricot,     border: '#e0b3a3',         ink: PAPER.apricotInk, subInk: PAPER.apricotInk,     rule: 'rgba(145,71,50,0.2)' },
};

const QuickAnswerCard = ({ dayStatus, compact = false }) => {
    const [expanded, setExpanded] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    if (!dayStatus || dayStatus.status === 'noclass') {
        return null;
    }

    if (dayStatus.status === 'setup_day') {
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <View style={[styles.compactCard, { backgroundColor: COLORS.cardBackground, borderColor: COLORS.success }]}>
                    <View style={styles.compactRow}>
                        <Text style={[styles.compactLabel, { color: COLORS.textSecondary }]}>
                            Setup Day
                        </Text>
                        <Text style={[styles.compactAnswer, { color: COLORS.textSecondary }]}>
                            Already Counted
                        </Text>
                    </View>
                </View>
            </Animated.View>
        );
    }

    const { status, classes, safeCount, riskyCount } = dayStatus;

    const config = {
        safe: {
            title: 'Yes, skip the whole day',
            shortTitle: 'YES',
            subtitle: `All ${classes.length} classes are safe to miss`,
            bg: COLORS.successLight,
            border: COLORS.success,
            textColor: COLORS.successDark,
        },
        partial: {
            title: 'Partial — skip some classes',
            shortTitle: 'PARTIAL',
            subtitle: `${safeCount} safe to skip, ${riskyCount} must attend`,
            bg: COLORS.warningLight,
            border: COLORS.warning,
            textColor: COLORS.warningDark,
        },
        risky: {
            title: 'No — attend today',
            shortTitle: 'NO',
            subtitle: `${riskyCount} subjects are at risk`,
            bg: COLORS.dangerLight,
            border: COLORS.danger,
            textColor: COLORS.dangerDark,
        },
    };

    const cfg = config[status];
    const recommendation = getDayRecommendation(classes);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    // Compact mode — Today's one-line verdict, which opens in place rather than
    // swapping to the full planner card (ui-lab/today-replica.html .quick-answer).
    if (compact) {
        const tone = PAPER_TONE[status] || PAPER_TONE.partial;
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <TouchableOpacity
                    style={[styles.compactCard, { backgroundColor: tone.bg, borderColor: tone.border }]}
                    onPress={toggleExpand}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={`Can I skip today? ${cfg.shortTitle}`}
                >
                    <View style={styles.compactRow}>
                        <Text style={[styles.compactLabel, { color: tone.ink }]}>Can I skip today?</Text>
                        <Text style={[styles.compactAnswer, { color: tone.ink }]}>{cfg.shortTitle}</Text>
                    </View>
                    <Text style={[styles.tapHint, { color: tone.subInk }]}>
                        {expanded ? 'Tap to collapse' : 'Tap for details'}
                    </Text>

                    {expanded && (
                        <View style={[styles.compactDetails, { borderTopColor: tone.rule }]}>
                            <Text style={[styles.compactDetailsText, { color: tone.subInk }]}>{cfg.subtitle}</Text>
                            {classes.map((cls) => (
                                <Text
                                    key={cls.subjectId}
                                    style={[styles.compactDetailsText, { color: tone.subInk }]}
                                    numberOfLines={1}
                                >
                                    {shortSubjectName(cls.subjectName)} · {cls.safe ? 'safe to skip' : 'attend'} · {cls.currentPercentage.toFixed(0)}% → {cls.newPercentage.toFixed(0)}%
                                </Text>
                            ))}
                            {recommendation ? (
                                <Text style={[styles.compactDetailsText, { color: tone.subInk }]}>{recommendation}</Text>
                            ) : null}
                        </View>
                    )}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return (
        <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
                style={[styles.card, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                onPress={compact ? toggleExpand : undefined}
                activeOpacity={compact ? 0.7 : 1}
            >
                <Text style={styles.question}>Can I skip today?</Text>

                <View style={styles.answerRow}>
                    <Text style={[styles.answerTitle, { color: cfg.textColor }]}>
                        {cfg.title}
                    </Text>
                </View>

                <Text style={[styles.answerSubtitle, { color: cfg.textColor }]}>
                    {cfg.subtitle}
                </Text>

                {/* Per-class breakdown */}
                {(expanded || !compact) && (
                    <View style={styles.classBreakdown}>
                        {classes.map((cls) => (
                            <View key={cls.subjectId} style={styles.classRow}>
                                <Text style={styles.className} numberOfLines={1} accessibilityLabel={cls.subjectName}>
                                    {shortSubjectName(cls.subjectName)}
                                </Text>
                                <Text style={styles.classTime}>
                                    {cls.startTime}–{cls.endTime}
                                </Text>
                                <Text style={[
                                    styles.classImpact,
                                    { color: cls.safe ? COLORS.success : COLORS.danger },
                                ]}>
                                    {cls.currentPercentage.toFixed(0)}% → {cls.newPercentage.toFixed(0)}%
                                </Text>
                            </View>
                        ))}

                        {recommendation ? (
                            <View style={styles.recommendationBox}>
                                <Text style={styles.recommendationLabel}>Best strategy:</Text>
                                <Text style={styles.recommendationText}>{recommendation}</Text>
                            </View>
                        ) : null}
                    </View>
                )}

                {/* Actions row */}
                <View style={styles.actionsRow}>
                    {compact && expanded && (
                        <TouchableOpacity onPress={toggleExpand}>
                            <Text style={styles.collapseText}>Collapse</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    compactCard: {
        marginTop: 16,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
    },
    compactDetails: {
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        gap: 3,
    },
    compactDetailsText: {
        fontFamily: SERIF_FONT,
        fontSize: 11,
        lineHeight: 17,
    },
    compactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    compactLabel: { fontSize: 12, fontWeight: '700' },
    compactAnswer: { fontSize: 12, fontWeight: '700' },
    tapHint: { fontSize: 10, fontWeight: '500', marginTop: 4 },
    card: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        borderWidth: 1,
    },
    question: {
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    answerRow: {
        marginBottom: SPACING.xs,
    },
    answerTitle: {
        fontWeight: '700',
        fontSize: FONT_SIZES.lg,
    },
    answerSubtitle: {
        fontWeight: '400',
        fontSize: FONT_SIZES.sm,
        marginBottom: SPACING.md,
    },
    classBreakdown: {
        marginTop: SPACING.sm,
    },
    classRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs + 2,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    className: {
        flex: 1,
        fontWeight: '500',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textPrimary,
    },
    classTime: {
        fontWeight: '400',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginRight: SPACING.sm,
    },
    classImpact: {
        fontWeight: '600',
        fontSize: FONT_SIZES.xs,
    },
    recommendationBox: {
        marginTop: SPACING.md,
        padding: SPACING.sm,
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    recommendationLabel: {
        fontWeight: '600',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    recommendationText: {
        fontWeight: '400',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.md,
    },
    collapseText: {
        fontWeight: '500',
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
    },
});

export default QuickAnswerCard;
