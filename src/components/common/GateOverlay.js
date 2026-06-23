import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

export function MaintenanceGate({ message }) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Under Maintenance</Text>
            <Text style={styles.message}>{message || 'We are performing scheduled upgrades. Please check back shortly.'}</Text>
        </View>
    );
}

export function UpdateGate({ minVersion, updateUrl }) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Update Required</Text>
            <Text style={styles.message}>
                We've introduced critical fixes to Presence. Please download version {minVersion} to continue.
            </Text>
            {updateUrl ? (
                <TouchableOpacity style={styles.updateBtn} onPress={() => Linking.openURL(updateUrl)} activeOpacity={0.8}>
                    <Text style={styles.updateBtnText}>Download Update</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

export function RevokedGate({ reason }) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Access Suspended</Text>
            <Text style={styles.message}>
                Your account has been suspended.
                {reason ? `\n\nReason: ${reason}` : ''}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    title: {
        ...TYPOGRAPHY.headingLarge,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
    message: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 320,
    },
    updateBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.md,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        marginTop: SPACING.xl,
    },
    updateBtnText: {
        ...TYPOGRAPHY.labelLarge,
        color: '#FFFFFF',
    },
});
