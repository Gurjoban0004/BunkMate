import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

const AddExtraClassButton = ({ onPress }) => {
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

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginTop: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderWidth: 2,
        borderColor: COLORS.border,
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
