import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme/theme';
import { logger } from '../../utils/logger';

/**
 * ErrorBoundary — catches render-time errors and shows a recovery UI.
 *
 * Two variants:
 *   <ErrorBoundary>          — full-screen fallback (used at app root in App.js)
 *   <ErrorBoundary screen>   — compact fallback (used per tab-stack in TabNavigator)
 *
 * Props:
 *   children    — subtree to protect
 *   screen      — if true, renders a compact in-tab fallback instead of full-screen
 *   screenName  — optional label shown in the error message (e.g. "Today")
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        const label = this.props.screenName ? `[${this.props.screenName}] ` : '';
        logger.error(`${label}ErrorBoundary caught:`, error, errorInfo);
    }

    handleRestart = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        const { screen, screenName } = this.props;
        const styles = screen ? screenStyles : rootStyles;

        return (
            <View style={styles.container}>
                <Text style={styles.icon}>⚠️</Text>
                <Text style={styles.title}>
                    {screen
                        ? `${screenName || 'This screen'} ran into a problem`
                        : 'Oops! Something went wrong.'}
                </Text>
                <Text style={styles.subtitle}>
                    {this.state.error?.message || 'An unexpected error occurred.'}
                </Text>
                <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
                    <Text style={styles.buttonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    }
}

// ── Full-screen fallback (app root) ──────────────────────────────────
const rootStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    icon: {
        fontSize: 64,
        marginBottom: SPACING.md,
    },
    title: {
        fontSize: FONT_SIZES.xl,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: SPACING.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONT_SIZES.md,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.xl,
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        borderRadius: BORDER_RADIUS.md,
    },
    buttonText: {
        color: COLORS.textOnPrimary,
        fontSize: FONT_SIZES.md,
        fontWeight: 'bold',
    },
});

// ── Compact in-tab fallback ───────────────────────────────────────────
const screenStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    icon: {
        fontSize: 40,
        marginBottom: SPACING.sm,
    },
    title: {
        fontSize: FONT_SIZES.lg,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginBottom: SPACING.xs,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: FONT_SIZES.sm,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: SPACING.lg,
        lineHeight: 20,
    },
    button: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.sm + 2,
        paddingHorizontal: SPACING.lg,
        borderRadius: BORDER_RADIUS.md,
    },
    buttonText: {
        color: COLORS.textOnPrimary,
        fontSize: FONT_SIZES.sm,
        fontWeight: '700',
    },
});
