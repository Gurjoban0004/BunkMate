import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Animated } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../../theme/theme';
import { generateRecoveryPaths, generateRewards } from '../../../utils/planner/recoveryPlanner';

export default function RecoveryPaths({ subjectData }) {
    const styles = getStyles();
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
                    <Text style={styles.question}>Recovery Plan</Text>
                    <View style={styles.answerRow}>
                        <Text style={[styles.answerTitle, { color: COLORS.successDark }]}>
                            No recovery needed
                        </Text>
                    </View>
                    <Text style={[styles.answerSubtitle, { color: COLORS.successDark }]}>
                        This subject is above target. Keep the rhythm steady.
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
                <Text style={styles.question}>Recovery Plan</Text>

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
                                    <View style={[styles.pathMarker, idx === 0 && styles.pathMarkerPrimary]}>
                                        <Text style={[styles.pathMarkerText, idx === 0 && styles.pathMarkerTextPrimary]}>
                                            {idx + 1}
                                        </Text>
                                    </View>
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
                        {expanded ? 'Hide plan' : 'Show plan'}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const getStyles = () => StyleSheet.create({
    card: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.md,
        borderWidth: 1,
        ...SHADOWS.small,
        borderLeftWidth: 4,
    },
    question: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '700',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0,
        marginBottom: SPACING.sm,
    },
    answerRow: {
        flexDirection: 'row',
        alignItems: 'center', 
        marginBottom: 2,
    },
    answerTitle: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
    },
    answerSubtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    expandedContent: {
        marginTop: SPACING.lg,
        paddingTop: SPACING.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.05)',
    },
    pathRow: {
        marginBottom: SPACING.md,
    },
    firstPathRow: {
        marginBottom: SPACING.lg,
    },
    pathHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: SPACING.sm,
    },
    pathMarker: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    pathMarkerPrimary: {
        backgroundColor: COLORS.warning,
        borderColor: COLORS.warning,
    },
    pathMarkerText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '800',
        color: COLORS.textSecondary,
    },
    pathMarkerTextPrimary: {
        color: COLORS.textPrimary,
    },
    pathTarget: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    pathClasses: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textSecondary,
        fontWeight: '500', 
    },
    nextClassesLabel: {
        fontSize: 10,
        fontWeight: '600', 
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        marginBottom: 6,
        marginLeft: 4,
    },
    classesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    classChip: {
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    classChipText: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    moreText: {
        fontSize: 10,
        color: COLORS.textMuted,
        alignSelf: 'center',
    },
    pathFooterBox: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.borderSubtle,
    },
    skipAllowance: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: 2,
    },
    reward: {
        fontSize: 11,
        color: COLORS.textSecondary,
        lineHeight: 16,
    },
    actionsRow: {
        alignItems: 'flex-start',
        marginTop: SPACING.sm,
    },
    collapseText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '700',
    },
});
