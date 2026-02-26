import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

export default function Input({
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    style,
    ...props
}) {
    return (
        <TextInput
            style={[styles.input, style]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textDisabled}
            keyboardType={keyboardType}
            {...props}
        />
    );
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: COLORS.inputBackground,
        color: COLORS.textPrimary,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...TYPOGRAPHY.body,
    },
});
