import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const TARGET_OPTIONS = [70, 75, 80, 85, 90];

const TargetSelector = ({ selected, onSelect }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.label}>Your target</Text>
            <View style={styles.optionsRow}>
                {TARGET_OPTIONS.map((target) => (
                    <TouchableOpacity
                        key={target}
                        style={[
                            styles.option,
                            selected === target && styles.optionActive,
                        ]}
                        onPress={() => onSelect(target)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.optionText,
                            selected === target && styles.optionTextActive,
                        ]}>
                            {target}%
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.md,
    },
    label: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginBottom: SPACING.sm,
    },
    optionsRow: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.md,
        padding: 3,
    },
    option: {
        flex: 1,
        paddingVertical: SPACING.sm + 2,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.sm,
    },
    optionActive: {
        backgroundColor: COLORS.primary,
    },
    optionText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    optionTextActive: {
        color: COLORS.textOnPrimary,
        fontWeight: '700',
    },
});

export default TargetSelector;
