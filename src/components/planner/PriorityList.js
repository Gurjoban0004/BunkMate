import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const PriorityList = ({ priorityList, threshold, onRecoveryPress }) => {
    const [showSafe, setShowSafe] = useState(false);

    const critical = priorityList.filter((s) => s.priority === 'critical');
    const warning = priorityList.filter((s) => s.priority === 'warning');
    const safe = priorityList.filter((s) => s.priority === 'safe');

    const toggleSafe = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowSafe(!showSafe);
    };

    return (
        <View style={styles.container}>
            <Text style={styles.sectionTitle}>Priority Order</Text>

            {/* Critical subjects (below threshold) */}
            {critical.map((subject, index) => (
                <SubjectCard
                    key={subject.id}
                    subject={subject}
                    rank={index + 1}
                    variant="critical"
                    threshold={threshold}
                    onRecoveryPress={onRecoveryPress}
                />
            ))}

            {/* Warning subjects (near threshold) */}
            {warning.map((subject, index) => (
                <SubjectCard
                    key={subject.id}
                    subject={subject}
                    rank={critical.length + index + 1}
                    variant="warning"
                    threshold={threshold}
                />
            ))}

            {/* Safe subjects (collapsible) */}
            {safe.length > 0 && (
                <>
                    <TouchableOpacity style={styles.safeToggle} onPress={toggleSafe}>
                        <Text style={styles.safeToggleText}>
                            ── Safe Subjects ({safe.length}) {showSafe ? '▲' : '▼'} ──
                        </Text>
                    </TouchableOpacity>

                    {showSafe && safe.map((subject) => (
                        <View key={subject.id} style={styles.safeRow}>
                            <Text style={styles.safeEmoji}>✅</Text>
                            <Text style={styles.safeName}>{subject.name}</Text>
                            <Text style={styles.safePercent}>{subject.percentage.toFixed(0)}%</Text>
                            <Text style={styles.safeBuffer}>
                                Buffer: {subject.safeBunks}
                            </Text>
                        </View>
                    ))}
                </>
            )}
        </View>
    );
};

const SubjectCard = ({ subject, rank, variant, threshold, onRecoveryPress }) => {
    const borderColor = variant === 'critical' ? COLORS.danger : COLORS.warning;
    const bgTint = variant === 'critical' ? COLORS.dangerLight : COLORS.warningLight;
    const emoji = variant === 'critical' ? '🔴' : '🟡';

    const progressWidth = Math.min(subject.percentage, 100);

    return (
        <View style={[styles.card, { borderColor, backgroundColor: bgTint }]}>
            <View style={styles.cardHeader}>
                <Text style={styles.rank}>{emoji} {rank}. {subject.name}</Text>
            </View>

            <Text style={styles.currentLabel}>
                Currently: {subject.percentage.toFixed(1)}%
            </Text>

            {/* Progress bar */}
            <View style={styles.progressBar}>
                <View style={[
                    styles.progressFill,
                    { width: `${progressWidth}%`, backgroundColor: borderColor },
                ]} />
                {/* Threshold marker */}
                <View style={[styles.thresholdMarker, { left: `${threshold}%` }]} />
            </View>

            {variant === 'critical' ? (
                <View style={styles.cardDetails}>
                    <Text style={styles.detailText}>
                        Need: <Text style={styles.bold}>{subject.recoveryNeeded} more classes</Text>
                    </Text>
                    <Text style={styles.detailText}>
                        Timeline: ~{subject.weeksToRecover === Infinity ? '?' : subject.weeksToRecover} week{subject.weeksToRecover !== 1 ? 's' : ''}
                    </Text>
                    {onRecoveryPress && (
                        <TouchableOpacity
                            style={styles.recoveryButton}
                            onPress={() => onRecoveryPress(subject)}
                        >
                            <Text style={[styles.recoveryButtonText, { color: COLORS.primary }]}>
                                See Recovery Plan →
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : (
                <View style={styles.cardDetails}>
                    <Text style={styles.detailText}>
                        Buffer: {subject.safeBunks} bunk{subject.safeBunks !== 1 ? 's' : ''} available
                    </Text>
                    <Text style={styles.detailText}>Status: On the edge</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    sectionTitle: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.md,
    },
    card: {
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    cardHeader: {
        marginBottom: SPACING.xs,
    },
    rank: {
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    currentLabel: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    progressBar: {
        height: 8,
        backgroundColor: COLORS.border,
        borderRadius: 4,
        marginBottom: SPACING.sm,
        position: 'relative',
        overflow: 'visible',
    },
    progressFill: {
        height: '100%',
        borderRadius: 4,
    },
    thresholdMarker: {
        position: 'absolute',
        top: -3,
        width: 2,
        height: 14,
        backgroundColor: COLORS.textPrimary,
        borderRadius: 1,
    },
    cardDetails: {
        marginTop: SPACING.xs,
    },
    detailText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    bold: {
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    recoveryButton: {
        marginTop: SPACING.sm,
    },
    recoveryButtonText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
    },
    safeToggle: {
        paddingVertical: SPACING.md,
        alignItems: 'center',
    },
    safeToggleText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    safeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.xs + 2,
        paddingHorizontal: SPACING.sm,
        backgroundColor: COLORS.successLight,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.xs,
    },
    safeEmoji: {
        fontSize: 14,
        marginRight: SPACING.sm,
    },
    safeName: {
        flex: 1,
        fontSize: FONT_SIZES.sm,
        fontWeight: '500',
        color: COLORS.textPrimary,
    },
    safePercent: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.success,
        marginRight: SPACING.sm,
    },
    safeBuffer: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
    },
});

export default PriorityList;
