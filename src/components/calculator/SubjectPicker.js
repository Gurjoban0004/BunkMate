import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';

const SubjectPicker = ({ subjects, selectedId, onSelect }) => {
    const styles = getStyles();
    const [showDropdown, setShowDropdown] = useState(false);
    const selectedSubject = subjects.find(s => s.id === selectedId);

    return (
        <View>
            <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowDropdown(true)}
            >
                <View style={styles.selectorContent}>
                    <View style={[styles.colorDot, { backgroundColor: selectedSubject?.color || COLORS.primary }]} />
                    <Text style={styles.selectorText}>
                        {selectedSubject?.name || 'Select Subject'}
                    </Text>
                </View>
                <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>

            <Modal
                visible={showDropdown}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDropdown(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowDropdown(false)}
                >
                    <View style={styles.dropdown}>
                        <Text style={styles.dropdownTitle}>Select Subject</Text>
                        <FlatList
                            data={subjects}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.dropdownItem,
                                        item.id === selectedId && styles.dropdownItemActive,
                                    ]}
                                    onPress={() => {
                                        onSelect(item.id);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                                    <Text style={[
                                        styles.dropdownItemText,
                                        item.id === selectedId && styles.dropdownItemTextActive,
                                    ]}>
                                        {item.name}
                                    </Text>
                                    {item.id === selectedId && (
                                        <Text style={styles.checkmark}>✓</Text>
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const getStyles = () => StyleSheet.create({
    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.cardBackground,
        marginHorizontal: SPACING.lg,
        marginVertical: SPACING.md,
        padding: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        ...SHADOWS.small,
    },
    selectorContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    colorDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginRight: SPACING.sm,
    },
    selectorText: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    chevron: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    dropdown: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        width: '100%',
        maxHeight: 400,
        ...SHADOWS.large,
    },
    dropdownTitle: {
        fontSize: FONT_SIZES.md,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
        textAlign: 'center',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.xs,
    },
    dropdownItemActive: {
        backgroundColor: COLORS.primaryLight,
    },
    dropdownItemText: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textPrimary,
        flex: 1,
    },
    dropdownItemTextActive: {
        fontWeight: '600',
        color: COLORS.primary,
    },
    checkmark: {
        fontSize: FONT_SIZES.md,
        color: COLORS.primary,
        fontWeight: '700',
    },
});

export default SubjectPicker;
