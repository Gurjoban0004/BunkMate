import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { loginWithCode } from '../../utils/firebaseHelpers';
import { loadAppState, clearAppState } from '../../storage/storage';
import { logger } from '../../utils/logger';
import { showAlert } from '../../utils/alert';

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
      // 1. Validate code with Firebase FIRST — before touching any local data
      const authenticatedUserId = await loginWithCode(code);

      // 2. Only clear stale local data AFTER successful authentication
      await clearAppState();

      // 3. Fetch the cloud state
      const savedState = await loadAppState();

      if (savedState && (savedState.setupComplete || (savedState.subjects && savedState.subjects.length > 0))) {
        // User has data. Let's merge the correct userId into it, then fully replace the local state.
        savedState.setupComplete = true;
        savedState.userId = authenticatedUserId;
        dispatch({ type: 'LOAD_STATE', payload: savedState });
      } else {
        // New account or no data. Safe to set empty state to the new ID.
        dispatch({ type: 'SET_USER_ID', payload: authenticatedUserId });
        navigation.navigate('Welcome');
      }
    } catch (err) {
      logger.error('Login error:', err);
      setError(err.message || 'Invalid login code. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCreateAccount = () => {
    navigation.navigate('Welcome');
  };

  const isButtonDisabled = code.length !== 12 || isVerifying;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Enter your login code to sync your attendance data.
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Login Code</Text>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={code}
            onChangeText={handleCodeChange}
            placeholder="PRES-XXXXXXX"
            placeholderTextColor={COLORS.textSecondary}
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

        <TouchableOpacity 
          onPress={handleCreateAccount} 
          style={styles.createAccountLink}
          disabled={isVerifying}
        >
          <Text style={styles.linkText}>
            Don't have a code? <Text style={styles.linkHighlight}>Create a new account</Text>
          </Text>
        </TouchableOpacity>
      </View>
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
  header: {
    marginBottom: SPACING.xxl,
  },
  title: {
    ...TYPOGRAPHY.headerLarge,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  inputContainer: {
    marginBottom: SPACING.xl,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.lg,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
    letterSpacing: 2,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.danger,
    marginTop: SPACING.sm,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.5,
  },
  loginButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textOnPrimary,
  },
  createAccountLink: {
    marginTop: SPACING.xl,
    alignItems: 'center',
  },
  linkText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  linkHighlight: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});
