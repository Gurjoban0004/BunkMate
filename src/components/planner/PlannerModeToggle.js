import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme/theme';

/**
 * Skip? / Fix mode toggle for the planner.
 * Props: activeMode ('skip'|'fix'), onModeChange (fn)
 */
export default function PlannerModeToggle({ activeMode, onModeChange }) {
    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={[styles.tab, activeMode === 'skip' && styles.activeTab]}
                onPress={() => onModeChange('skip')}
                activeOpacity={0.7}
            >
                <Text style={[styles.tabText, activeMode === 'skip' && styles.activeTabText]}>
                    Skip?
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.tab, activeMode === 'fix' && styles.activeTab]}
                onPress={() => onModeChange('fix')}
                activeOpacity={0.7}
            >
                <Text style={[styles.tabText, activeMode === 'fix' && styles.activeTabText]}>
                    Fix
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: COLORS.inputBackground,
        borderRadius: BORDER_RADIUS.full,
        padding: 4,
        marginHorizontal: SPACING.lg,
        marginBottom: SPACING.lg,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.full,
    },
    activeTab: {
        backgroundColor: COLORS.cardBackground,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    tabText: {
        fontSize: FONT_SIZES.sm,
        fontWeight: '600',
        color: COLORS.textMuted,
    },
    activeTabText: {
        color: COLORS.primary,
    },
});
