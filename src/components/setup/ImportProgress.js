import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing, Platform } from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, MOTION } from '../../theme/theme';
import LoadingDots from '../common/LoadingDots';

/**
 * ImportProgress — the last screen of setup, while the account is being built.
 *
 * A centred spinner tells the student nothing except "wait", and this wait is
 * long enough (three sequential network calls) that "wait" starts to look like
 * "stuck". Each row here maps to a real request, so the screen is honest about
 * what is happening and visibly moves the whole way through.
 */
export default function ImportProgress({ tasks, current, name }) {
    const styles = getStyles();
    const firstName = name ? name.trim().split(/\s+/)[0] : '';

    return (
        <View style={styles.container}>
            <Text style={styles.title}>
                {firstName ? `Setting up, ${firstName}` : 'Setting things up'}
            </Text>
            <Text style={styles.subtitle}>This takes a few seconds. Keep the app open.</Text>

            <View style={styles.list}>
                {tasks.map((task, i) => (
                    <TaskRow
                        key={task.id}
                        label={task.label}
                        state={i < current ? 'done' : i === current ? 'active' : 'pending'}
                        styles={styles}
                    />
                ))}
            </View>
        </View>
    );
}

function TaskRow({ label, state, styles }) {
    const done = state === 'done';
    const check = useRef(new Animated.Value(done ? 1 : 0)).current;

    useEffect(() => {
        const reduceMotion = Platform.OS === 'web'
            && typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

        if (reduceMotion) {
            check.setValue(done ? 1 : 0);
            return undefined;
        }
        const anim = Animated.timing(check, {
            toValue: done ? 1 : 0,
            duration: MOTION.duration.normal,
            easing: MOTION.easing.snappy,
            useNativeDriver: true,
        });
        anim.start();
        return () => anim.stop();
    }, [done, check]);

    return (
        <View style={styles.row} accessibilityLabel={`${label} — ${state}`}>
            <View style={styles.marker}>
                {state === 'active' ? (
                    <LoadingDots color={COLORS.primary} size={4} />
                ) : (
                    <View style={[styles.ring, done && styles.ringDone]}>
                        <Animated.Text style={[styles.check, { opacity: check }]}>✓</Animated.Text>
                    </View>
                )}
            </View>
            <Text
                style={[
                    styles.label,
                    state === 'active' && styles.labelActive,
                    state === 'pending' && styles.labelPending,
                ]}
            >
                {label}
            </Text>
        </View>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        paddingTop: SPACING.xxl,
        paddingHorizontal: SPACING.xs,
    },
    title: {
        ...TYPOGRAPHY.headingLarge,
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        ...TYPOGRAPHY.bodySmall,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SPACING.xs,
    },
    list: {
        marginTop: SPACING.xxl,
        gap: SPACING.lg,
        alignSelf: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    marker: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringDone: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    check: {
        ...TYPOGRAPHY.captionSmall,
        color: COLORS.textOnPrimary,
        lineHeight: 13,
    },
    label: {
        ...TYPOGRAPHY.bodyMedium,
        color: COLORS.textSecondary,
    },
    labelActive: {
        ...TYPOGRAPHY.headingSmall,
        color: COLORS.textPrimary,
    },
    labelPending: {
        color: COLORS.textMuted,
    },
});
