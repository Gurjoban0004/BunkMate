import React from 'react';
import { TextInput, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

export default function Input({
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    style,
    ...props
}) {
    if (Platform.OS === 'web') {
        return (
            <input
                type={keyboardType === 'numeric' ? 'number' : 'text'}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                placeholder={placeholder}
                {...props}
                style={{
                    backgroundColor: COLORS.inputBackground,
                    color: COLORS.textPrimary,
                    paddingLeft: SPACING.md,
                    paddingRight: SPACING.md,
                    paddingTop: SPACING.md,
                    paddingBottom: SPACING.md,
                    borderRadius: BORDER_RADIUS.sm,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: COLORS.border,
                    fontSize: 16, // typical body size 
                    fontFamily: 'System', // fallback
                    outline: 'none',
                    boxSizing: 'border-box',
                    width: '100%',
                    ...(StyleSheet.flatten(style) || {})
                }}
            />
        );
    }

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
