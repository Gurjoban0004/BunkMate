import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { getDayRecommendation } from '../../utils/planner.js';

const QuickAnswerCard = ({ dayStatus, compact = false, onPlannerPress }) => {
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
                            ⚡ Setup Day
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
            emoji: '✅',
            title: 'YES — Skip the whole day!',
            shortTitle: 'YES',
            subtitle: `All ${classes.length} classes are safe to miss`,
            bg: COLORS.successLight,
            border: COLORS.success,
            textColor: COLORS.successDark,
        },
        partial: {
            emoji: '⚠️',
            title: 'PARTIAL — Skip some classes',
            shortTitle: 'PARTIAL',
            subtitle: `${safeCount} safe to skip, ${riskyCount} must attend`,
            bg: COLORS.warningLight,
            border: COLORS.warning,
            textColor: COLORS.warningDark,
        },
        risky: {
            emoji: '🚨',
            title: 'NO — Attend today',
            shortTitle: '🚨 NO',
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

    // Compact mode — single line for Today screen
    if (compact && !expanded) {
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <TouchableOpacity
                    style={[styles.compactCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                    onPress={toggleExpand}
                    activeOpacity={0.7}
                >
                    <View style={styles.compactRow}>
                        <Text style={[styles.compactLabel, { color: cfg.textColor }]}>
                            ⚡ Can I skip today?
                        </Text>
                        <Text style={[styles.compactAnswer, { color: cfg.textColor }]}>
                            {cfg.shortTitle}
                        </Text>
                    </View>
                    <Text style={styles.tapHint}>Tap for details</Text>
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
                <Text style={styles.question}>⚡ Can I skip today?</Text>

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
                                <Text style={styles.classEmoji}>
                                    {cls.safe ? '✅' : cls.newPercentage >= 73 ? '⚠️' : '🚨'}
                                </Text>
                                <Text style={styles.className}>{cls.subjectName}</Text>
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
                            <Text style={styles.collapseText}>Collapse ↑</Text>
                        </TouchableOpacity>
                    )}
                    {onPlannerPress && (
                        <TouchableOpacity onPress={onPlannerPress}>
                            <Text style={[styles.plannerLink, { color: COLORS.primary }]}>
                                See Full Plan in Planner →
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    compactCard: {
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 1,
        ...SHADOWS.small,
    },
    compactRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    compactLabel: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    compactAnswer: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
    tapHint: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: 4,
    },
    card: {
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.lg,
        borderWidth: 1,
        ...SHADOWS.medium,
    },
    question: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    answerRow: {
        marginBottom: SPACING.xs,
    },
    answerTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
    },
    answerSubtitle: {
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
    classEmoji: {
        fontSize: 14,
        width: 24,
    },
    className: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    classTime: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginRight: SPACING.sm,
    },
    classImpact: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
    },
    recommendationBox: {
        marginTop: SPACING.md,
        padding: SPACING.sm,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: BORDER_RADIUS.sm,
    },
    recommendationLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    recommendationText: {
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
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    plannerLink: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
});

export default QuickAnswerCard;
