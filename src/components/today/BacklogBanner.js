import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const BacklogBanner = ({ count, onPress }) => {
    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <View style={styles.content}>
                <Text style={styles.icon}>⚠️</Text>
                <View style={styles.textContainer}>
                    <Text style={styles.title}>
                        You have {count} unmarked {count === 1 ? 'class' : 'classes'}
                    </Text>
                    <Text style={styles.subtitle}>from the past few days</Text>
                </View>
            </View>
            <View style={styles.button}>
                <Text style={styles.buttonText}>Mark Now</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.warningLight,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        ...SHADOWS.small,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    icon: {
        fontSize: 24,
        marginRight: SPACING.sm,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.warningDark,
    },
    subtitle: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.warning,
        marginTop: 2,
    },
    button: {
        backgroundColor: COLORS.warning,
        paddingVertical: 6,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    buttonText: {
        fontSize: FONT_SIZES.xs,
        fontWeight: '600',
        color: COLORS.textOnPrimary,
    },
});

export default BacklogBanner;
