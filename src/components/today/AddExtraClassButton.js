import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, SHADOWS } from '../../theme/theme';

const AddExtraClassButton = ({ onPress }) => {
    const styles = getStyles();
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={styles.icon}>+</Text>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-end',
        backgroundColor: COLORS.primary,
        marginRight: SPACING.screenPadding,
        marginTop: SPACING.md,
        width: 44,
        height: 44,
        borderRadius: 22,
        ...SHADOWS.small,
    },
    icon: {
        fontSize: 24,
        lineHeight: 28,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
    },
});

export default AddExtraClassButton;
