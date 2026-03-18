import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useApp } from '../../context/AppContext';
import { COLORS, SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme/theme';
import { logger } from '../../utils/logger';

export default function LoginCodeSection() {
  const { userId } = useApp();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!userId) return;
    if (Platform.OS === 'web') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(userId).catch(() => {});
      }
    } else {
      Clipboard.setString(userId);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!userId) return;
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({ text: `My Presence login code: ${userId}\n\nUse this to login on another device.` });
      } else if (Platform.OS === 'web') {
        // Fallback: copy to clipboard on web if Web Share API not available
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(userId);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } else {
        await Share.share({
          message: `My Presence login code: ${userId}\n\nUse this to login on another device.`,
        });
      }
    } catch (error) {
      logger.error('Error sharing code:', error);
    }
  };

  if (!userId) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>SYNC & CLOUD</Text>
      
      <View style={styles.card}>
        <Text style={styles.description}>
          Use this code to log in and sync your data on other devices.
        </Text>

        <View style={styles.codeContainer}>
          <Text style={styles.code}>
            {userId}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.button, styles.copyButton]} 
            onPress={handleCopy}
          >
            <Text style={styles.buttonText}>
              {copied ? '✓ COPIED' : 'COPY CODE'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.shareButton]} 
            onPress={handleShare}
          >
            <Text style={styles.shareButtonText}>
              SHARE
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  description: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  codeContainer: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  code: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 4,
    color: COLORS.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  shareButton: {
    backgroundColor: COLORS.primary,
  },
  buttonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  shareButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
