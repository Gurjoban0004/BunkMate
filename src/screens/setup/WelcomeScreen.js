import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import Input from '../../components/common/Input';
import { useApp } from '../../context/AppContext';
import { PRESETS } from '../../data/presets';
import { showAlert } from '../../utils/alert';
import { getUserId } from '../../utils/firebaseHelpers';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

export default function WelcomeScreen({ navigation }) {
    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const { state, dispatch } = useApp();
    const inputRef = useRef(null);
    const styles = getStyles();

    // Focus input softly
    useEffect(() => {
        if (Platform.OS !== 'web') {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleContinue = async () => {
        if (!name.trim()) return;

        const trimmedCode = code.trim().toUpperCase();

        // If not yet authenticated (new user), generate a userId now
        if (!state.isAuthenticated || !state.userId) {
            try {
                const newUserId = await getUserId();
                dispatch({ type: 'SET_USER_ID', payload: newUserId });
                dispatch({ type: 'SET_AUTHENTICATED', payload: true });
            } catch (e) {
                // getUserId has its own fallback, so this is a safety net
            }
        }

        if (trimmedCode) {
            const preset = PRESETS[trimmedCode];
            if (preset) {
                dispatch({ type: 'SET_USER_NAME', payload: name.trim() });
                // Load preset data but don't mark setup as complete yet
                dispatch({ type: 'SET_TIME_SLOTS', payload: preset.timeSlots });
                dispatch({ type: 'SET_SUBJECTS', payload: preset.subjects });
                dispatch({ type: 'SET_TIMETABLE', payload: preset.timetable });
                // Navigate to AttendanceStats so they can enter their current attendance
                navigation.navigate('AttendanceStats');
            } else {
                showAlert('Invalid Code', 'The class code you entered is invalid. Please try again or leave blank.');
            }
        } else {
            dispatch({ type: 'SET_USER_NAME', payload: name.trim() });
            navigation.navigate('TimeSlots');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardWrapper>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        <Text style={styles.title}>Presence</Text>
                        <Text style={styles.subtitle}>Attendance, solved.</Text>

                        <View style={styles.spacer} />

                        <Text style={styles.greetingTitle}>Hi! What should we call you?</Text>
                        <Input
                            ref={inputRef}
                            placeholder="Your Name"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                            returnKeyType="next"
                            style={styles.input}
                        />

                        <View style={{ height: SPACING.lg }} />

                        <Input
                            placeholder="Class Code (Optional)"
                            value={code}
                            onChangeText={setCode}
                            autoCapitalize="characters"
                            returnKeyType="done"
                            onSubmitEditing={handleContinue}
                            style={styles.input}
                        />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[
                            styles.continueButton,
                            !name.trim() && styles.continueButtonDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.continueText}>GET STARTED →</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.loginLink}
                        onPress={() => navigation.navigate('Login')}
                    >
                        <Text style={styles.loginLinkText}>
                            Already have a login code? <Text style={styles.loginLinkBold}>Tap here</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardWrapper>
        </SafeAreaView>
    );
}

const getStyles = () => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xxl,
        paddingBottom: SPACING.xxl,
    },
    emoji: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    title: {
        ...TYPOGRAPHY.headerLarge,
        color: COLORS.textPrimary,
        textAlign: 'center',
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xxl,
    },
    spacer: {
        height: SPACING.xxl,
    },
    greetingTitle: {
        ...TYPOGRAPHY.headerSmall,
        color: COLORS.textPrimary,
        marginBottom: SPACING.lg,
        textAlign: 'center',
    },
    input: {
        width: '100%',
        backgroundColor: COLORS.cardBackground,
        borderRadius: BORDER_RADIUS.md,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        fontSize: FONT_SIZES.lg,
        color: COLORS.textPrimary,


        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.xl,
    },
    continueButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.md,
        alignItems: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: COLORS.border,
    },
    continueText: {
        color: COLORS.textOnPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: '700',
    },
    loginLink: {
        marginTop: SPACING.md,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
    },
    loginLinkText: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    loginLinkBold: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});
