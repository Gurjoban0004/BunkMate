import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT_SIZES, BORDER_RADIUS } from '../../../theme/theme';

/**
 * Visual progress bar with percentage fill and optional threshold marker.
 * Props: percentage, target (optional, shows marker), height (default 8), color (optional)
 */
export default function PlannerProgressBar({ percentage, target, height = 10, color }) {
    const safePercent = Math.min(100, Math.max(0, percentage || 0));

    const barColor = color ||
        (safePercent < 75 ? COLORS.danger : safePercent < (target || 75) ? COLORS.warning : COLORS.success);

    return (
        <View style={styles.container}>
            <View style={[styles.track, { height }]}>
                <View
                    style={[
                        styles.fill,
                        {
                            width: `${safePercent}%`,
                            backgroundColor: barColor,
                            height,
                        },
                    ]}
                />
                {target && (
                    <View
                        style={[
                            styles.marker,
                            {
                                left: `${Math.min(target, 100)}%`,
                                height: height + 6,
                                top: -3,
                            },
                        ]}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    track: {
        backgroundColor: COLORS.border,
        borderRadius: BORDER_RADIUS.full,
        overflow: 'visible',
        position: 'relative',
    },
    fill: {
        borderRadius: BORDER_RADIUS.full,
    },
    marker: {
        position: 'absolute',
        width: 2,
        backgroundColor: COLORS.textSecondary,
        borderRadius: 1,
    },
});
