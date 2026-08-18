import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import { useBannerSlot, BANNER_PRIORITY } from './BannerSlot';

const BacklogBanner = ({ count, onPress }) => {
    const styles = getStyles();
    const mayRender = useBannerSlot(BANNER_PRIORITY.backlog, count > 0);
    if (!mayRender) return null;

    return (
        <TouchableOpacity style={styles.container} onPress={onPress}>
            <View style={styles.content}>
                <View style={styles.iconDot} />
                <View style={styles.textContainer}>
                    <Text style={styles.title}>
                        You have {count} unmarked {count === 1 ? 'class' : 'classes'}
                    </Text>
                    <Text style={styles.subtitle}>from the past few days</Text>
                </View>
            </View>
            <View style={styles.button}>
                <Text style={styles.buttonText}>Mark Now</Text>
            </View>
        </TouchableOpacity>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.warningLight,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        borderWidth: 1,
        borderColor: COLORS.warning,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.warning,
        marginRight: SPACING.sm,
    },
    textContainer: {
        flex: 1,
    },
    title: {
        fontWeight: '600',
        fontSize: FONT_SIZES.sm,
        color: COLORS.warningDark,
    },
    subtitle: {
        fontWeight: '400',
        fontSize: FONT_SIZES.xs,
        color: COLORS.warningText,
        marginTop: 2,
    },
    button: {
        backgroundColor: COLORS.warning,
        paddingVertical: 6,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.sm,
    },
    buttonText: {
        fontWeight: '600',
        fontSize: FONT_SIZES.xs,
        color: COLORS.textOnPrimary,
    },
});

export default BacklogBanner;
