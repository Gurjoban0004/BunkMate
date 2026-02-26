import React from 'react';
import { TextInput, StyleSheet, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';

export default function Input({
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    style,
    // Strip out React Native-only props so they don't get spread onto
    // a DOM <input> element and cause React warnings or Safari quirks
    autoCapitalize,
    returnKeyType,
    onSubmitEditing,
    placeholderTextColor,
    ...props
}) {
    if (Platform.OS === 'web') {
        // Map RN keyboardType to HTML input type
        const inputType = keyboardType === 'numeric' || keyboardType === 'number-pad'
            ? 'number'
            : keyboardType === 'email-address'
            ? 'email'
            : keyboardType === 'phone-pad'
            ? 'tel'
            : 'text';

        // Flatten RN StyleSheet style object so we can spread it as inline CSS
        const flatStyle = StyleSheet.flatten(style) || {};

        return (
            <input
                type={inputType}
                value={value}
                onChange={(e) => onChangeText(e.target.value)}
                placeholder={placeholder}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && onSubmitEditing) onSubmitEditing();
                }}
                // autoCapitalize is valid on <input> for mobile browsers
                autoCapitalize={autoCapitalize || 'off'}
                style={{
                    backgroundColor: COLORS.inputBackground,
                    color: COLORS.textPrimary,
                    paddingLeft: SPACING.md,
                    paddingRight: SPACING.md,
                    paddingTop: SPACING.md,
                    paddingBottom: SPACING.md,
                    borderRadius: BORDER_RADIUS.sm,
                    border: `1px solid ${COLORS.border}`,
                    // Must be >= 16px to prevent iOS Safari viewport zoom on focus
                    fontSize: 16,
                    outline: 'none',
                    boxSizing: 'border-box',
                    width: '100%',
                    pointerEvents: 'auto',
                    cursor: 'text',
                    touchAction: 'manipulation',
                    WebkitTapHighlightColor: 'rgba(0,0,0,0.1)',
                    // Ensure z-index is high enough
                    position: 'relative',
                    zIndex: 10,
                    // Remove default appearance
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    ...flatStyle,
                }}
                {...props}
            />
        );
    }

    return (
        <TextInput
            style={[styles.input, style]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor || COLORS.textDisabled}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            returnKeyType={returnKeyType}
            onSubmitEditing={onSubmitEditing}
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
