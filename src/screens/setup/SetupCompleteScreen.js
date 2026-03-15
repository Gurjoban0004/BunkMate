import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/theme';

export default function SetupCompleteScreen() {
    const styles = getStyles();
    const { dispatch } = useApp();

    const handleComplete = () => {
        dispatch({ type: 'COMPLETE_SETUP' });
        // Navigation will switch automatically when setupComplete becomes true
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.title}>You're All Set!</Text>
                    <Text style={styles.subtitle}>
                        Start tracking your attendance today.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Button title="Go to Today" onPress={handleComplete} />
                </View>
            </ScrollView>
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
        padding: SPACING.screenPadding,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emoji: {
        fontSize: 80,
        marginBottom: SPACING.lg,
    },
    title: {
        ...TYPOGRAPHY.headerLarge,
        color: COLORS.textPrimary,
        marginBottom: SPACING.md,
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
    },
    footer: {
        paddingBottom: SPACING.lg,
    },
});
