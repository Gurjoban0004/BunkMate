import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const EndGameButton = ({ onPress }) => {
    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.row}>
                <View style={styles.content}>
                    <Text style={styles.emoji}>😴</Text>
                    <View>
                        <Text style={styles.title}>End of Semester Mode</Text>
                        <Text style={styles.subtitle}>See minimum classes needed</Text>
                    </View>
                </View>
                <Text style={styles.arrow}>→</Text>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.lg,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.small,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 24,
        marginRight: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: FONT_SIZES.xs,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    arrow: {
        fontSize: FONT_SIZES.lg,
        color: COLORS.textMuted,
    },
});

export default EndGameButton;
