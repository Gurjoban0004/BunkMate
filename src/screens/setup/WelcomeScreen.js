import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/common/Button';
import { COLORS, SPACING, TYPOGRAPHY } from '../../theme/theme';

export default function WelcomeScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.content}>
                    <Text style={styles.emoji}>📚</Text>
                    <Text style={styles.title}>Welcome to BunkMate</Text>
                    <Text style={styles.subtitle}>
                        Track your attendance effortlessly.{'\n'}Set up in 2 minutes.
                    </Text>
                </View>

                <View style={styles.footer}>
                    <Button
                        title="Get Started"
                        onPress={() => navigation.navigate('Name')}
                    />
                </View>
            </ScrollView>
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
        textAlign: 'center',
    },
    subtitle: {
        ...TYPOGRAPHY.body,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    footer: {
        paddingBottom: SPACING.lg,
    },
});
