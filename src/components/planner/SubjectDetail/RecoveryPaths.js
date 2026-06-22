import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, TYPOGRAPHY } from '../../../theme/theme';
import { generateRecoveryPaths, generateRewards } from '../../../utils/planner/recoveryPlanner';

export default function RecoveryPaths({ subjectData }) {
    const styles = getStyles();
    const [expanded, setExpanded] = useState(false);

    const recovery = useMemo(() => generateRecoveryPaths(subjectData), [subjectData]);

    if (!recovery || recovery.paths.length === 0) {
        return (
            <View style={[styles.strip, { borderLeftColor: COLORS.success }]}>
                <Text style={[styles.stripText, { color: COLORS.successDark }]}>On track</Text>
            </View>
        );
    }

    const firstPath = recovery.paths[0];
    const toggle = () => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setExpanded(!expanded); };

    return (
        <TouchableOpacity style={[styles.strip, { borderLeftColor: COLORS.warning }]} onPress={toggle} activeOpacity={0.7}>
            <View style={styles.stripRow}>
                <Text style={[styles.stripText, { color: COLORS.warningDark }]}>
                    Attend {firstPath.classesNeeded} more{firstPath.timeline ? ` (~${firstPath.timeline.days}d)` : ''} → {firstPath.targetPercentage}%
                </Text>
                <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
            </View>

            {expanded && (
                <View style={styles.expandedContent}>
                    {recovery.paths.map((path, idx) => (
                        <View key={idx} style={styles.pathRow}>
                            <View style={styles.pathHeader}>
                                <View style={[styles.pathMarker, idx === 0 && styles.pathMarkerPrimary]}>
                                    <Text style={[styles.pathMarkerText, idx === 0 && styles.pathMarkerTextPrimary]}>{idx + 1}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.pathTarget}>{path.targetPercentage}% — {path.classesNeeded} classes</Text>
                                    <View style={styles.classesPreview}>
                                        {path.specificClasses.slice(0, 4).map((cls, ci) => (
                                            <View key={ci} style={styles.classChip}>
                                                <Text style={styles.classChipText}>{cls.day.slice(0, 3)} {cls.dateFormatted.split(',')[0]}</Text>
                                            </View>
                                        ))}
                                        {path.specificClasses.length > 4 && <Text style={styles.moreText}>+{path.specificClasses.length - 4}</Text>}
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </TouchableOpacity>
    );
}

const getStyles = () => StyleSheet.create({
    strip: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 16,
        marginBottom: SPACING.md,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    stripRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    stripText: {
        ...TYPOGRAPHY.labelLarge,
        flex: 1,
    },
    chevron: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textMuted,
        marginLeft: SPACING.sm,
    },
    expandedContent: {
        marginTop: SPACING.md,
        paddingTop: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    pathRow: {
        marginBottom: SPACING.sm,
    },
    pathHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    pathMarker: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.inputBackground,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pathMarkerPrimary: {
        backgroundColor: COLORS.warning,
        borderColor: COLORS.warning,
    },
    pathMarkerText: {
        ...TYPOGRAPHY.captionSmall,
        fontWeight: '800',
        color: COLORS.textSecondary,
    },
    pathMarkerTextPrimary: {
        color: COLORS.textPrimary,
    },
    pathTarget: {
        ...TYPOGRAPHY.labelLarge,
        color: COLORS.textPrimary,
        marginBottom: 4,
    },
    classesPreview: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    classChip: {
        backgroundColor: COLORS.inputBackground,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    classChipText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textSecondary,
    },
    moreText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textMuted,
        alignSelf: 'center',
    },
});
