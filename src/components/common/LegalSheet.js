import React from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';
import { LEGAL_DOCS } from '../../config/legal';

/**
 * The terms and the privacy notice, shown in full.
 *
 * Opened from the acceptance line at the end of onboarding and from Settings,
 * so the words a student agrees to stay readable after they have agreed —
 * a link that only exists before you tap Continue is not really an offer to
 * read anything.
 *
 * @param {'terms'|'privacy'|null} doc  which document to show; null closes it
 */
export default function LegalSheet({ doc, onClose }) {
    const styles = getStyles();
    const content = doc ? LEGAL_DOCS[doc] : null;

    return (
        <Modal
            visible={!!content}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="pageSheet"
        >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>{content?.title}</Text>
                        <Text style={styles.updated}>Last updated {content?.updated}</Text>
                    </View>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.close}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <Text style={styles.closeText}>Done</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
                    {(content?.sections || []).map((section) => (
                        <View key={section.heading} style={styles.section}>
                            <Text style={styles.heading}>{section.heading}</Text>
                            <Text style={styles.paragraph}>{section.body}</Text>
                        </View>
                    ))}
                    <View style={{ height: SPACING.xxl }} />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}

const getStyles = () => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: SPACING.screenPadding,
        paddingBottom: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    title: { ...TYPOGRAPHY.headingLarge, color: COLORS.textPrimary },
    updated: { ...TYPOGRAPHY.captionMedium, color: COLORS.textMuted, marginTop: 2 },
    close: {
        paddingHorizontal: SPACING.sm, paddingVertical: 6, marginLeft: SPACING.sm,
        borderRadius: BORDER_RADIUS.sm, backgroundColor: COLORS.inputBackground,
    },
    closeText: { ...TYPOGRAPHY.labelMedium, color: COLORS.primary },
    body: { paddingHorizontal: SPACING.screenPadding, paddingTop: SPACING.lg },
    section: { marginBottom: SPACING.lg },
    heading: { ...TYPOGRAPHY.headingMedium, color: COLORS.textPrimary, marginBottom: SPACING.xs },
    paragraph: { ...TYPOGRAPHY.bodyMedium, color: COLORS.textSecondary, lineHeight: 22 },
});
