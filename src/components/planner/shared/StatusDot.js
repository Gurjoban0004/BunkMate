import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../../theme/theme';

/**
 * Colored status dot: danger (🔴), warning (🟡), safe (🟢)
 * Props: status ('danger'|'warning'|'safe'), size (number, default 10)
 */
export default function StatusDot({ status, size = 10 }) {
    const colorMap = {
        danger: COLORS.danger,
        warning: COLORS.warning,
        safe: COLORS.success,
    };

    return (
        <View
            style={[
                styles.dot,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: colorMap[status] || COLORS.textMuted,
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    dot: {},
});
