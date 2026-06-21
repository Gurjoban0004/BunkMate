import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, BORDER_RADIUS } from '../../theme/theme';

export default function ProfileAvatar({ name, size = 36, onPress }) {
    const initial = (name || '?')[0].toUpperCase();
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}
            style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    circle: { backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
    initial: { fontWeight: '700', color: COLORS.primaryDark },
});
