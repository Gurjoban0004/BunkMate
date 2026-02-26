import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import KeyboardWrapper from '../../components/common/KeyboardWrapper';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';

const NameScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const { dispatch } = useApp();

    const handleContinue = () => {
        if (name.trim()) {
            dispatch({ type: 'SET_USER_NAME', payload: name.trim() });
            navigation.navigate('TimeSlots');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardWrapper>
                <View style={styles.content}>
                    <Text style={styles.emoji}>👋</Text>

                    <Text style={styles.title}>What should we call you?</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Your name"
                        placeholderTextColor={COLORS.textMuted}
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        returnKeyType="done"
                        onSubmitEditing={handleContinue}
                    />

                    <Text style={styles.subtitle}>
                        This helps personalize your experience
                    </Text>
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[
                            styles.continueButton,
                            !name.trim() && styles.continueButtonDisabled,
                        ]}
                        onPress={handleContinue}
                        disabled={!name.trim()}
                    >
                        <Text style={styles.continueText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardWrapper>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: SPACING.xl,
    },
    emoji: {
        fontSize: 64,
        marginBottom: SPACING.lg,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xl,
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
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        marginTop: SPACING.md,
        textAlign: 'center',
    },
    buttonContainer: {
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
        fontWeight: '600',
    },
});

export default NameScreen;
