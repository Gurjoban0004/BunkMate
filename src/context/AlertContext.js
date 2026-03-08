import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../theme/theme';

const AlertContext = createContext(null);

export const useAlert = () => {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within an AlertProvider');
    }
    return context;
};

export const AlertProvider = ({ children }) => {
    const [alertConfig, setAlertConfig] = useState(null);
    const styles = getStyles();

    const showAlert = (title, message, buttons, options) => {
        setAlertConfig({ title, message, buttons, options });
    };

    const hideAlert = () => {
        setAlertConfig(null);
    };

    return (
        <AlertContext.Provider value={{ showAlert, hideAlert }}>
            {children}
            {alertConfig && (
                <Modal
                    transparent={true}
                    visible={!!alertConfig}
                    animationType="fade"
                    onRequestClose={() => {
                        if (alertConfig.options?.cancelable) {
                            hideAlert();
                        }
                    }}
                >
                    <View style={styles.overlay}>
                        <View style={styles.alertBox}>
                            {alertConfig.title && (
                                <Text style={styles.title}>{alertConfig.title}</Text>
                            )}
                            {alertConfig.message && (
                                <Text style={styles.message}>{alertConfig.message}</Text>
                            )}
                            <View style={styles.buttonContainer}>
                                {alertConfig.buttons && alertConfig.buttons.length > 0 ? (
                                    alertConfig.buttons.map((btn, index) => {
                                        const isDestructive = btn.style === 'destructive';
                                        const isCancel = btn.style === 'cancel';

                                        return (
                                            <TouchableOpacity
                                                key={index}
                                                style={[
                                                    styles.button,
                                                    index > 0 && styles.buttonBorderLeft,
                                                ]}
                                                onPress={() => {
                                                    hideAlert();
                                                    if (btn.onPress) btn.onPress();
                                                }}
                                            >
                                                <Text
                                                    style={[
                                                        styles.buttonText,
                                                        isDestructive && styles.destructiveText,
                                                        isCancel && styles.cancelText,
                                                    ]}
                                                >
                                                    {btn.text || 'OK'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })
                                ) : (
                                    <TouchableOpacity
                                        style={styles.button}
                                        onPress={hideAlert}
                                    >
                                        <Text style={styles.buttonText}>OK</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </AlertContext.Provider>
    );
};

const getStyles = () => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
    alertBox: {
        width: 300,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        ...SHADOWS.medium,
        overflow: 'hidden',
    },
    title: {
        ...TYPOGRAPHY.headerSmall,
        textAlign: 'center',
        marginTop: SPACING.lg,
        paddingHorizontal: SPACING.md,
    },
    message: {
        ...TYPOGRAPHY.body,
        textAlign: 'left',
        color: COLORS.textSecondary,
        marginTop: SPACING.sm,
        marginBottom: SPACING.lg,
        paddingHorizontal: SPACING.lg,
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    button: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonBorderLeft: {
        borderLeftWidth: 1,
        borderLeftColor: COLORS.border,
    },
    buttonText: {
        ...TYPOGRAPHY.body,
        fontWeight: '600',
        color: COLORS.primary,
    },
    destructiveText: {
        color: COLORS.danger,
    },
    cancelText: {
        fontWeight: '400',
        color: COLORS.textSecondary,
    },
});
