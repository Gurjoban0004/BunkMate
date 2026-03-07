import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const AddExtraClassButton = ({ onPress }) => {
    const styles = getStyles();
    return (
        <TouchableOpacity
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={styles.icon}>+</Text>
            <Text style={styles.text}>Add Extra Class</Text>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.screenPadding,
        marginTop: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        ...SHADOWS.small,
        borderStyle: 'dashed',
    },
    icon: {
        fontSize: 20,
        fontWeight: '600',
        color: COLORS.primary,
        marginRight: SPACING.sm,
    },
    text: {
        fontSize: FONT_SIZES.md,
        fontWeight: '500',
        color: COLORS.primary,
    },
});

export default AddExtraClassButton;
