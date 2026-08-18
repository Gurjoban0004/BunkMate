import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../theme/theme';

/**
 * Section header for the day's classes.
 *
 * Occasional actions (mark a holiday, cancel a class, add an extra) live behind
 * one overflow button rather than sitting permanently in the header as small
 * plain buttons. Two 22pt-tall targets crammed next to a title failed the 44pt
 * minimum and gave rare actions the same standing as the section itself.
 */
const SectionHeader = ({
    title,
    classCount,
    onHolidayPress,
    showHoliday = true,
    onCancelClassPress,
    showCancelClass = true,
    onAddExtraPress,
}) => {
    const styles = getStyles();
    const [menuOpen, setMenuOpen] = useState(false);

    const actions = [
        showHoliday && onHolidayPress && { key: 'holiday', label: 'Mark today as holiday', onPress: onHolidayPress },
        showCancelClass && onCancelClassPress && { key: 'cancel', label: 'Cancel a class', onPress: onCancelClassPress },
        onAddExtraPress && { key: 'extra', label: 'Add an extra class', onPress: onAddExtraPress },
    ].filter(Boolean);

    const run = (fn) => {
        setMenuOpen(false);
        fn();
    };

    return (
        <View style={styles.container}>
            <View style={styles.left}>
                <Text style={styles.title}>{title}</Text>
                {classCount !== undefined && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{classCount}</Text>
                    </View>
                )}
            </View>

            {actions.length > 0 && (
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => setMenuOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="More actions for today"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Text style={styles.menuGlyph}>•••</Text>
                </TouchableOpacity>
            )}

            <Modal
                visible={menuOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuOpen(false)}
            >
                <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <View style={styles.grabber} />
                        {actions.map((a, i) => (
                            <TouchableOpacity
                                key={a.key}
                                style={[styles.sheetItem, i === actions.length - 1 && styles.sheetItemLast]}
                                onPress={() => run(a.onPress)}
                                accessibilityRole="button"
                                accessibilityLabel={a.label}
                            >
                                <Text style={styles.sheetItemText}>{a.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={styles.sheetCancel}
                            onPress={() => setMenuOpen(false)}
                            accessibilityRole="button"
                            accessibilityLabel="Close menu"
                        >
                            <Text style={styles.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: SPACING.screenPadding,
        paddingVertical: SPACING.sm,
        marginTop: SPACING.md,
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        ...TYPOGRAPHY.labelSmall,
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    badge: {
        backgroundColor: COLORS.primary,
        borderRadius: BORDER_RADIUS.full,
        paddingHorizontal: 7,
        paddingVertical: 2,
        marginLeft: SPACING.sm,
    },
    badgeText: {
        ...TYPOGRAPHY.micro,
        color: COLORS.textOnPrimary,
    },
    menuButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: -SPACING.sm,
    },
    menuGlyph: {
        fontSize: 15,
        lineHeight: 18,
        color: COLORS.textSecondary,
        letterSpacing: 1,
    },
    backdrop: {
        flex: 1,
        backgroundColor: COLORS.overlay,
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: COLORS.cardBackground,
        borderTopLeftRadius: BORDER_RADIUS.xxl,
        borderTopRightRadius: BORDER_RADIUS.xxl,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.xl,
        ...SHADOWS.large,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.border,
        marginBottom: SPACING.sm,
    },
    sheetItem: {
        paddingVertical: 16,
        paddingHorizontal: SPACING.lg,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderLight,
    },
    sheetItemLast: {
        borderBottomWidth: 0,
    },
    sheetItemText: {
        ...TYPOGRAPHY.bodyLarge,
        color: COLORS.textPrimary,
    },
    sheetCancel: {
        marginTop: SPACING.sm,
        marginHorizontal: SPACING.lg,
        paddingVertical: 14,
        borderRadius: BORDER_RADIUS.md,
        backgroundColor: COLORS.inputBackground,
        alignItems: 'center',
    },
    sheetCancelText: {
        ...TYPOGRAPHY.labelLarge,
        color: COLORS.textSecondary,
    },
});

export default SectionHeader;
