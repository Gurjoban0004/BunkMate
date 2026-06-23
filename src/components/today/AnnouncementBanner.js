import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../../theme/theme';
import { getActiveAnnouncements } from '../../services/adminService';

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

    if (announcements.length === 0) return null;

    return (
        <>
            {announcements.map(ann => (
                <View key={ann.id} style={[styles.banner, { backgroundColor: TYPE_BG[ann.type] || TYPE_BG.info, borderLeftColor: TYPE_COLORS[ann.type] || TYPE_COLORS.info }]}>
                    <View style={styles.content}>
                        <Text style={[styles.title, { color: TYPE_COLORS[ann.type] || TYPE_COLORS.info }]}>{ann.title}</Text>
                        <Text style={styles.message}>{ann.message}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDismiss(ann.id)} style={styles.dismissBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text style={styles.dismissText}>x</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: BORDER_RADIUS.md,
        borderLeftWidth: 4,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    content: { flex: 1 },
    title: { ...TYPOGRAPHY.labelMedium, marginBottom: 2 },
    message: { ...TYPOGRAPHY.captionMedium, color: COLORS.textSecondary },
    dismissBtn: { padding: 4 },
    dismissText: { ...TYPOGRAPHY.labelMedium, color: COLORS.textMuted },
});
