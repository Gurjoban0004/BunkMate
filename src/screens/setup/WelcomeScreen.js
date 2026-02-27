import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import Input from '../../components/common/Input';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';

export default function WelcomeScreen({ navigation }) {
    const [name, setName] = useState('');
    const { dispatch } = useApp();
    const inputRef = useRef(null);

    // Focus input softly
    useEffect(() => {
        if (Platform.OS !== 'web') {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleContinue = () => {
        if (name.trim()) {
            dispatch({ type: 'SET_USER_NAME', payload: name.trim() });
            navigation.navigate('SubjectList');
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
                        <Text style={styles.emoji}>📚</Text>
                        <Text style={styles.title}>BunkMate</Text>
                        <Text style={styles.subtitle}>Attendance, solved.</Text>

                        <View style={styles.spacer} />

                        <Text style={styles.greetingTitle}>Hi! What should we call you?</Text>
                        <Input
                            ref={inputRef}
                            placeholder="Your Name"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
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
                </View>
            </KeyboardWrapper>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
        borderWidth: 2,
        borderColor: COLORS.border,
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
});
