import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../../theme/theme';

export default function ProjectionTransparencyModal({ visible, onClose, breakdown }) {
    if (!breakdown) return null;

    const styles = getStyles();
    const { erp, local, projected } = breakdown;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
                
                <View style={styles.modalContent}>
                    <View style={styles.dragHandle} />
                    
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>The Math Behind the Magic ✨</Text>
                        <Text style={styles.headerSubtitle}>
                            How your projected attendance is calculated while we wait for the university portal to update.
                        </Text>
                    </View>

                    {/* Step 1: Base ERP */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionNumber}>1</Text>
                            <Text style={styles.sectionTitle}>University Portal (ERP)</Text>
                        </View>
                        <View style={styles.dataRow}>
                            <Text style={styles.dataText}>Base data from last sync</Text>
                            <View style={styles.mathBlock}>
                                <Text style={styles.monospace}>[{String(erp.attended).padStart(2, ' ')} / {String(erp.total).padStart(2, ' ')}]</Text>
                                <Text style={[styles.monospace, styles.percentageText]}>{erp.percentage.toFixed(1)}%</Text>
                            </View>
                        </View>
                    </View>

                    {/* Separator / Math Operator */}
                    <View style={styles.operatorRow}>
                        <Text style={styles.operator}>+</Text>
                    </View>

                    {/* Step 2: Local Tracking */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionNumber}>2</Text>
                            <Text style={styles.sectionTitle}>Local Tracking</Text>
                        </View>
                        <View style={styles.localDataContainer}>
                            <Text style={styles.localDesc}>Classes since last sync (Autopilot + You):</Text>
                            
                            <View style={styles.localMathRow}>
                                <Text style={[styles.monospace, styles.localValue, { color: COLORS.success }]}>+{local.attended}</Text>
                                <Text style={styles.localLabel}>Attended</Text>
                            </View>
                            
                            <View style={styles.localMathRow}>
                                <Text style={[styles.monospace, styles.localValue, { color: COLORS.danger }]}>-{local.missed}</Text>
                                <Text style={styles.localLabel}>Missed</Text>
                            </View>

                            {local.cancelled > 0 && (
                                <View style={styles.localMathRow}>
                                    <Text style={[styles.monospace, styles.localValue, { color: COLORS.textMuted }]}> 0</Text>
                                    <Text style={styles.localLabel}>Cancelled ({local.cancelled})</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Separator / Math Operator */}
                    <View style={styles.operatorRow}>
                        <Text style={styles.operator}>=</Text>
                    </View>

                    {/* Step 3: Result */}
                    <View style={[styles.section, styles.resultSection]}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>True Attendance</Text>
                        </View>
                        <View style={styles.resultRow}>
                            <Text style={[styles.monospace, styles.resultMath]}>
                                [{String(projected.attended).padStart(2, ' ')} / {String(projected.total).padStart(2, ' ')}]
                            </Text>
                            <Text style={[styles.monospace, styles.resultPercentage, { color: COLORS.primaryDark }]}>
                                {projected.percentage.toFixed(1)}%
                            </Text>
                        </View>
                    </View>

                    {/* Footer button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Got it</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const getStyles = () => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.xl,
        borderTopRightRadius: BORDER_RADIUS.xl,
        padding: SPACING.lg,
        paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.lg,
        ...SHADOWS.large,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: COLORS.border,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: SPACING.lg,
    },
    header: {
        marginBottom: SPACING.xl,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.textPrimary,
        marginBottom: 6,
    },
    headerSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 20,
    },
    section: {
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.sm,
    },
    sectionNumber: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: COLORS.primaryLight,
        color: COLORS.primaryDark,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 20,
        marginRight: 8,
        overflow: 'hidden',
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.textPrimary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dataRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dataText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    mathBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    monospace: {
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    percentageText: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textPrimary,
        width: 55,
        textAlign: 'right',
    },
    operatorRow: {
        alignItems: 'center',
        marginVertical: 4,
    },
    operator: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.textMuted,
    },
    localDataContainer: {
        marginTop: 4,
    },
    localDesc: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginBottom: 8,
    },
    localMathRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    localValue: {
        fontSize: 14,
        fontWeight: '700',
        width: 30,
        textAlign: 'right',
        marginRight: 8,
    },
    localLabel: {
        fontSize: 13,
        color: COLORS.textPrimary,
        fontWeight: '500',
    },
    resultSection: {
        backgroundColor: COLORS.primaryLight,
        borderWidth: 1,
        borderColor: COLORS.primary,
        marginBottom: SPACING.xl,
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    resultMath: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.primaryDark,
        letterSpacing: 1,
    },
    resultPercentage: {
        fontSize: 28,
        fontWeight: '800',
    },
    closeButton: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: 14,
        alignItems: 'center',
    },
    closeButtonText: {
        color: COLORS.textOnPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
});
