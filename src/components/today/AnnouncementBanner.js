import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';
import { getActiveAnnouncements } from '../../services/adminService';
import { useBannerSlot, BANNER_PRIORITY } from './BannerSlot';

const TYPE_COLORS = {
    info: COLORS.primary,
    warning: COLORS.warning,
    danger: COLORS.danger,
};

const TYPE_BG = {
    info: COLORS.primaryLight,
    warning: COLORS.warningLight,
    danger: COLORS.dangerLight,
};

export default function AnnouncementBanner() {
    const [announcements, setAnnouncements] = useState([]);
    const [dismissed, setDismissed] = useState({});

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        try {
            const stored = await AsyncStorage.getItem('dismissed_announcements');
            const dismissedMap = stored ? JSON.parse(stored) : {};
            setDismissed(dismissedMap);

            const active = await getActiveAnnouncements();
            setAnnouncements(active.filter(a => !dismissedMap[a.id]));
        } catch (e) { /* ignore */ }
    };

    const handleDismiss = async (id) => {
        const updated = { ...dismissed, [id]: true };
        setDismissed(updated);
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        await AsyncStorage.setItem('dismissed_announcements', JSON.stringify(updated));
    };

    const mayRender = useBannerSlot(BANNER_PRIORITY.announcement, announcements.length > 0);
    if (!mayRender) return null;

    // One at a time. Rendering the whole list stacked several full-width alert
    // cards above the day's classes; the rest surface as each is dismissed.
    const ann = announcements[0];
    const accent = TYPE_COLORS[ann.type] || TYPE_COLORS.info;

    return (
        <View style={[styles.banner, { backgroundColor: TYPE_BG[ann.type] || TYPE_BG.info, borderColor: accent }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: accent }]}>{ann.title}</Text>
                <Text style={styles.message}>{ann.message}</Text>
                {announcements.length > 1 && (
                    <Text style={styles.more}>{announcements.length - 1} more</Text>
                )}
            </View>
            <TouchableOpacity
                onPress={() => handleDismiss(ann.id)}
                style={styles.dismissBtn}
                accessibilityRole="button"
                accessibilityLabel={`Dismiss announcement: ${ann.title}`}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
                <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: BORDER_RADIUS.md,
        // Full border, not a 4px left stripe — the stripe reads as a decorative
        // accent rather than a boundary, and the tint already carries the type.
        borderWidth: 1,
        padding: SPACING.md,
        marginHorizontal: SPACING.screenPadding,
        marginBottom: SPACING.cardGap,
    },
    content: { flex: 1 },
    title: { ...TYPOGRAPHY.labelMedium, marginBottom: 2 },
    message: { ...TYPOGRAPHY.captionMedium, color: COLORS.textSecondary },
    more: { ...TYPOGRAPHY.captionSmall, color: COLORS.textMuted, marginTop: 6 },
    dismissBtn: { padding: 6, marginTop: -2 },
    dismissText: { ...TYPOGRAPHY.labelMedium, color: COLORS.textMuted },
});
