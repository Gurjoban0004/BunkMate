import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ScrollView,
    Alert,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS } from '../theme/theme';
import { DEV_MODE, SHOW_DEV_MENU } from './config';
import { MOCK_SCENARIOS } from './mockData';
import { showAlert } from '../utils/alert';

const SCENARIO_DESCRIPTIONS = {
    NORMAL: 'Mixed attendance, some good, some bad',
    ALL_DANGER: 'All subjects below 75%',
    ALL_SAFE: 'All subjects above 90%',
    FRESH_START: 'No attendance records',
    MANY_UNMARKED: 'Test backlog warning',
    LONG_STREAK: '20 day attendance streak',
    EMPTY_TODAY: 'No classes scheduled today',
};

export default function DevMenu({ onLoadScenario, onClearData }) {
    const [visible, setVisible] = useState(false);

    if (!DEV_MODE || !SHOW_DEV_MENU) return null;

    const handleLoadScenario = (scenarioName) => {
        showAlert(
            'Load Scenario',
            `Load "${scenarioName}" mock data? This will replace current data.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Load',
                    onPress: () => {
                        onLoadScenario(MOCK_SCENARIOS[scenarioName]);
                        setVisible(false);
                    },
                },
            ]
        );
    };

    const handleClearData = () => {
        showAlert(
            'Clear All Data',
            'This will reset the app to fresh state. Continue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: () => {
                        onClearData();
                        setVisible(false);
                    },
                },
            ]
        );
    };

    return (
        <>
            {/* Floating Button */}
            <TouchableOpacity
                style={styles.floatingButton}
                onPress={() => setVisible(true)}
                activeOpacity={0.8}
            >
                <Text style={styles.floatingButtonText}>🛠️</Text>
            </TouchableOpacity>

            {/* Dev Menu Modal */}
            <Modal
                visible={visible}
                animationType="slide"
                transparent
                onRequestClose={() => setVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🛠️ Dev Menu</Text>
                            <TouchableOpacity onPress={() => setVisible(false)}>
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {/* Load Scenarios */}
                            <Text style={styles.sectionTitle}>Load Test Scenario</Text>
                            <View style={styles.scenarioList}>
                                {Object.keys(MOCK_SCENARIOS).map((scenario) => (
                                    <TouchableOpacity
                                        key={scenario}
                                        style={styles.scenarioButton}
                                        onPress={() => handleLoadScenario(scenario)}
                                    >
                                        <Text style={styles.scenarioButtonText}>{scenario}</Text>
                                        <Text style={styles.scenarioDescription}>
                                            {SCENARIO_DESCRIPTIONS[scenario] || ''}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Danger Zone */}
                            <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
                                Danger Zone
                            </Text>
                            <TouchableOpacity
                                style={styles.dangerButton}
                                onPress={handleClearData}
                            >
                                <Text style={styles.dangerButtonText}>🗑️ Clear All Data</Text>
                            </TouchableOpacity>

                            {/* Info */}
                            <View style={styles.infoBox}>
                                <Text style={styles.infoText}>
                                    💡 This menu only appears in development mode.
                                    Set DEV_MODE = false in config.js for production.
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    floatingButton: {
        position: 'absolute',
        bottom: 100,
        right: 20,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.large,
        zIndex: 9999,
        elevation: 10,
    },
    floatingButtonText: {
        fontSize: 24,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: COLORS.background,
        borderTopLeftRadius: BORDER_RADIUS.lg,
        borderTopRightRadius: BORDER_RADIUS.lg,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.screenPadding,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    closeButton: {
        fontSize: 24,
        color: COLORS.textSecondary,
        padding: SPACING.sm,
    },
    modalBody: {
        padding: SPACING.screenPadding,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
        marginTop: SPACING.md,
    },
    scenarioList: {
        gap: SPACING.sm,
    },
    scenarioButton: {
        backgroundColor: COLORS.cardBackground,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    scenarioButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    scenarioDescription: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    dangerButton: {
        backgroundColor: COLORS.dangerBg,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.danger,
        alignItems: 'center',
    },
    dangerButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.danger,
    },
    infoBox: {
        backgroundColor: COLORS.primaryBg,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        marginTop: SPACING.lg,
        marginBottom: SPACING.xl,
    },
    infoText: {
        fontSize: 12,
        color: COLORS.primary,
        lineHeight: 18,
    },
});
