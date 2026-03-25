import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES, SHADOWS } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { loginWithCode } from '../../utils/firebaseHelpers';
import { loadAppState, clearAppState } from '../../storage/storage';
import { logger } from '../../utils/logger';

// CR-09: lightweight online check using fetch with a short timeout
async function isOnline() {
    try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 3000);
        await fetch('https://www.google.com/generate_204', { method: 'HEAD', signal: ctrl.signal });
        return true;
    } catch {
        return false;
    }
}

export default function LoginScreen({ navigation }) {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const { dispatch } = useApp();

  const handleCodeChange = (text) => {
    setError(null);
    
    // Auto-capitalize and filter to only allow valid characters
    let formatted = text.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    
    // Limit to 12 characters
    if (formatted.length <= 12) {
      setCode(formatted);
    }
  };

  const handleLogin = async () => {
    if (code.length !== 12) return;

    setIsVerifying(true);
    setError(null);

    try {
      // 1. Validate code with Firebase FIRST — this also sets userId in AsyncStorage
      const authenticatedUserId = await loginWithCode(code);

      // 2. Clear stale local state blob (BUG-01 fix: userId is already updated by loginWithCode)
      await clearAppState();

      // 3. Fetch the cloud state for this user (loadAppState reads userId from AsyncStorage)
      let savedState = await loadAppState();

      // BUG-01 fix: If cloud fetch returned null (offline/timeout), retry once
      if (!savedState) {
        await new Promise(r => setTimeout(r, 1500));
        savedState = await loadAppState();
      }

      // CR-09 fix: if still no data after retry, check if we're genuinely offline
      // rather than silently routing to new-account flow and losing the user's data
      if (!savedState) {
        const online = await isOnline();
        if (!online) {
          setError('You appear to be offline. Connect to the internet to restore your data.');
          setIsVerifying(false);
          return;
        }
      }

      if (savedState && (savedState.setupComplete || (savedState.subjects && savedState.subjects.length > 0))) {
        // User has existing data — restore it and mark as authenticated
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            ...savedState,
            userId: authenticatedUserId,
            isAuthenticated: true,
            setupComplete: true,
          },
        });
      } else {
        // New account or no data — set userId, mark authenticated, then go to setup
        dispatch({ type: 'SET_USER_ID', payload: authenticatedUserId });
        dispatch({ type: 'SET_AUTHENTICATED', payload: true });
        navigation.navigate('Welcome');
      }
    } catch (err) {
      logger.error('Login error:', err);
      setError(err.message || 'Invalid login code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const isButtonDisabled = code.length !== 12 || isVerifying;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          {/* Back button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.headerEmoji}>🔑</Text>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Enter your login code to sync your attendance data.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>LOGIN CODE</Text>
              <TextInput
                style={[styles.input, error && styles.inputError]}
                value={code}
                onChangeText={handleCodeChange}
                placeholder="PRES-XXXXXXX"
                placeholderTextColor={COLORS.textMuted}
                autoCorrect={false}
                autoCapitalize="characters"
                maxLength={12}
                editable={!isVerifying}
              />
              {error && (
                <Text style={styles.errorText}>
                  {error}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isButtonDisabled && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isButtonDisabled}
          >
            {isVerifying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    padding: SPACING.xl,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    position: 'absolute',
    top: SPACING.xxl + SPACING.lg,
    left: SPACING.xl,
    zIndex: 10,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.md,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  headerEmoji: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
    marginBottom: SPACING.xl,
  },
  inputContainer: {},
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.md,
    fontSize: FONT_SIZES.lg,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: 'transparent',
    letterSpacing: 2,
    textAlign: 'center',
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.inputBackground,
    ...SHADOWS.small,
  },
  loginButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textOnPrimary,
  },
});

