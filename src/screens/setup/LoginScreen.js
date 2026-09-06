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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY, BORDER_RADIUS, FONT_SIZES, SHADOWS, MOTION } from '../../theme/theme';
import { useApp } from '../../context/AppContext';
import { loginWithCode } from '../../utils/firebaseHelpers';
import { buildApiUrl } from '../../services/apiConfig';
import { loadAppState, clearAppState } from '../../storage/storage';
import { logger } from '../../utils/logger';
import { friendlyError } from '../../utils/friendlyError';
import Notice from '../../components/common/Notice';
import LoadingDots from '../../components/common/LoadingDots';
import SetupIllustration from '../../components/setup/SetupIllustration';

// Lightweight reachability check against our own origin (the thing we actually
// need to reach), so it works under the CSP and sends nothing to a third party.
async function isOnline() {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 3000);
        await fetch(buildApiUrl('/manifest.json', Platform.OS), { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
        clearTimeout(timer);
        return true;
    } catch {
        return false;
    }
}

export default function LoginScreen({ navigation }) {
  const styles = getStyles();
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const { dispatch } = useApp();

  const handleCodeChange = (text) => {
    setError(null);

    // Prefix-tolerant: accept a pasted code with or without the "PRES-" prefix,
    // normalize to the 7-char core, and always render as PRES-XXXXXXX.
    let core = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (core.startsWith('PRES')) core = core.slice(4);
    core = core.slice(0, 7);
    setCode(core ? `PRES-${core}` : '');
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
          setError({
            title: 'No connection',
            message: 'Presence needs the internet to restore your data. Reconnect and try again — your code still works.',
          });
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
      setError(friendlyError(err, 'code'));
    } finally {
      setIsVerifying(false);
    }
  };

  const isButtonDisabled = code.length !== 12 || isVerifying;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.topBarBack}
              onPress={() => navigation.goBack()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={styles.topBarBackText}>←</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            <SetupIllustration name="restore" />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Enter your login code to sync.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>LOGIN CODE</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={handleCodeChange}
              placeholder="PRES-XXXXXXX"
              placeholderTextColor={COLORS.textMuted}
              autoCorrect={false}
              autoCapitalize="characters"
              maxLength={12}
              editable={!isVerifying}
              accessibilityLabel="Login code"
            />
          </View>

          <Text style={styles.hint}>Find it in Settings on your other device.</Text>

          {error ? (
            <Notice
              tone="caution"
              title={error.title}
              message={error.message}
              detail={error.detail}
              style={styles.notice}
            />
          ) : null}

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.loginButton, isButtonDisabled && !isVerifying && styles.loginButtonDisabled]}
          onPress={handleLogin}
          activeOpacity={MOTION.pressOpacity}
          disabled={isButtonDisabled}
          accessibilityRole="button"
          accessibilityLabel="Continue"
          accessibilityState={{ disabled: isButtonDisabled, busy: isVerifying }}
        >
          {isVerifying ? (
            <LoadingDots color={COLORS.textOnPrimary} />
          ) : (
            <Text style={[styles.loginButtonText, isButtonDisabled && styles.loginButtonTextDisabled]}>
              Continue
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const getStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    marginLeft: -SPACING.sm,
  },
  topBarBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarBackText: {
    fontSize: 24,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.headingLarge,
    fontSize: FONT_SIZES.xl,
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontWeight: '700',
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.lg,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: COLORS.textPrimary,
    letterSpacing: 2,
    textAlign: 'center',
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  hint: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  notice: {
    marginTop: SPACING.lg,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    minHeight: 52,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  loginButtonDisabled: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: COLORS.textOnPrimary,
  },
  loginButtonTextDisabled: {
    color: COLORS.textMuted,
  },
});
