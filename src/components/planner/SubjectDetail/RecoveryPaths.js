import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { generateRecoveryPaths, generateRewards } from '../../../utils/planner/recoveryPlanner';

export default function RecoveryPaths({ subjectData }) {
    const [expanded, setExpanded] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, []);

    const recovery = useMemo(
        () => generateRecoveryPaths(subjectData),
        [subjectData]
    );

    if (!recovery || recovery.paths.length === 0) {
        // Safe card
        return (
            <Animated.View style={{ opacity: fadeAnim }}>
                <View style={[styles.card, { backgroundColor: COLORS.successLight, borderColor: COLORS.success }]}>
                    <Text style={styles.question}>⚡ Recovery Plan</Text>
                    <View style={styles.answerRow}>
                        <Text style={[styles.answerTitle, { color: COLORS.successDark }]}>
                            🎉 You're above all targets!
                        </Text>
                    </View>
                    <Text style={[styles.answerSubtitle, { color: COLORS.successDark }]}>
                        Keep it up — no recovery needed.
                    </Text>
                </View>
            </Animated.View>
        );
    }

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const firstPath = recovery.paths[0];

    return (
        <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity
                style={[styles.card, { backgroundColor: COLORS.warningLight, borderColor: COLORS.warning }]}
                onPress={toggleExpand}
                activeOpacity={0.8}
            >
                <Text style={styles.question}>⚡ Recovery Plan</Text>

                <View style={styles.answerRow}>
                    <Text style={[styles.answerTitle, { color: COLORS.warningDark }]}>
                        Target: {firstPath.targetPercentage}%
                    </Text>
                </View>

                <Text style={[styles.answerSubtitle, { color: COLORS.warningDark }]}>
                    Attend {firstPath.classesNeeded} more class{firstPath.classesNeeded !== 1 ? 'es' : ''} to reach this goal.
                </Text>

                {expanded && (
                    <View style={styles.expandedContent}>
                        {recovery.paths.map((path, idx) => (
                            <View key={idx} style={[styles.pathRow, idx === 0 && styles.firstPathRow]}>
                                <View style={styles.pathHeader}>
                                    <Text style={styles.pathTargetEmoji}>
                                        {idx === 0 ? '🎯' : '🌟'}
                                    </Text>
                                    <View>
                                        <Text style={styles.pathTarget}>Goal: {path.targetPercentage}%</Text>
                                        <Text style={styles.pathClasses}>
                                            Needs {path.classesNeeded} classes
                                            {path.timeline ? ` (~${path.timeline.days} days)` : ''}
                                        </Text>
                                    </View>
                                </View>

                                {path.specificClasses.length > 0 && (
                                    <Text style={styles.nextClassesLabel}>Next classes:</Text>
                                )}
                                <View style={styles.classesPreview}>
                                    {path.specificClasses.slice(0, 4).map((cls, ci) => (
                                        <View key={ci} style={styles.classChip}>
                                            <Text style={styles.classChipText}>
                                                {cls.day.slice(0, 3)} {cls.dateFormatted.split(',')[0]}
                                            </Text>
                                        </View>
                                    ))}
                                    {path.specificClasses.length > 4 && (
                                        <Text style={styles.moreText}>
                                            +{path.specificClasses.length - 4} more
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.pathFooterBox}>
                                    <Text style={styles.skipAllowance}>
                                        Result: can skip {path.skipAllowance.simplified} classes
                                    </Text>
                                    <Text style={styles.reward}>{generateRewards(path.targetPercentage)}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.actionsRow}>
                    <Text style={styles.collapseText}>
                        {expanded ? 'Collapse ↑' : 'Tap for details ↓'}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        marginBottom: SPACING.md,
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
        marginBottom: SPACING.xs,
    },
    expandedContent: {
        marginTop: SPACING.sm,
    },
    pathRow: {
        paddingVertical: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.06)',
    },
    firstPathRow: {
        borderTopWidth: 0,
        paddingTop: SPACING.sm,
    },
    pathHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    pathTargetEmoji: {
        fontSize: 24,
        marginRight: SPACING.sm,
    },
    pathTarget: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    pathClasses: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    nextClassesLabel: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textMuted,
        marginBottom: SPACING.xs,
    },
    classesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    classChip: {
        backgroundColor: COLORS.background,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    classChipText: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    moreText: {
        fontSize: 11,
        color: COLORS.textMuted,
        alignSelf: 'center',
    },
    pathFooterBox: {
        backgroundColor: 'rgba(255,255,255,0.4)',
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
    },
    skipAllowance: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    reward: {
        fontSize: 11,
        color: COLORS.warningDark,
        fontStyle: 'italic',
    },
    actionsRow: {
        alignItems: 'flex-start',
        marginTop: SPACING.sm,
    },
    collapseText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
});
