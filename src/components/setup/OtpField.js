import React, { useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Platform } from 'react-native';
import { COLORS, BORDER_RADIUS, TABULAR } from '../../theme/theme';

const LENGTH = 6;

/**
 * The verification code, as six boxes.
 *
 * It used to be one text field with `placeholder="• • • •"` and
 * `letterSpacing: 8`, which drew four grey blobs that were neither the right
 * count (the college sends six) nor aligned with the digits that replaced them.
 *
 * There is still exactly ONE TextInput underneath — an input per box breaks
 * paste, breaks the iOS/Android one-time-code autofill, and turns backspace
 * into focus management. The real field is stretched invisibly across the row
 * so the OS keeps its caret and its autofill affordance; the boxes are just
 * what gets painted.
 */
export default function OtpField({ value = '', onChange, editable = true, length = LENGTH }) {
    const styles = getStyles();
    const inputRef = useRef(null);
    const [focused, setFocused] = useState(false);

    const digits = String(value).slice(0, length).split('');
    // The box the next digit lands in — highlighted, so the caret has somewhere
    // to be even though the real one is invisible.
    const activeIndex = Math.min(digits.length, length - 1);

    return (
        <Pressable
            onPress={() => inputRef.current?.focus()}
            accessibilityRole="none"
            style={styles.wrap}
        >
            <View style={styles.row} pointerEvents="none">
                {Array.from({ length }).map((_, i) => {
                    const filled = i < digits.length;
                    const isActive = focused && i === activeIndex && digits.length < length;
                    return (
                        <View
                            key={i}
                            style={[styles.box, filled && styles.boxFilled, isActive && styles.boxActive]}
                        >
                            {filled
                                ? <Text style={styles.digit}>{digits[i]}</Text>
                                : <View style={[styles.rest, isActive && styles.restActive]} />}
                        </View>
                    );
                })}
            </View>

            <TextInput
                ref={inputRef}
                style={styles.hiddenInput}
                value={value}
                onChangeText={(t) => onChange(t.replace(/[^0-9]/g, '').slice(0, length))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                inputMode="numeric"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={length}
                autoFocus
                editable={editable}
                caretHidden
                accessibilityLabel="Verification code"
            />
        </Pressable>
    );
}

const getStyles = () => StyleSheet.create({
    wrap: { position: 'relative' },
    row: { flexDirection: 'row', gap: 8 },
    box: {
        flex: 1,
        aspectRatio: 0.82,
        maxHeight: 58,
        borderRadius: BORDER_RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.inputBackground,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.cardBackground },
    boxActive: { borderColor: COLORS.primary, borderWidth: 2, backgroundColor: COLORS.cardBackground },
    digit: { ...TABULAR, fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
    // An empty box shows a short rule at the baseline, not a bullet — a dot
    // reads as "already filled with something you cannot see".
    rest: { width: 12, height: 2, borderRadius: 1, backgroundColor: COLORS.border },
    restActive: { backgroundColor: COLORS.primary },

    // Stretched over the boxes and made invisible: the OS still treats it as the
    // focused field (caret position, paste, SMS/e-mail autofill), we just never
    // draw its text. opacity:0 rather than display:none — a hidden input cannot
    // hold focus.
    hiddenInput: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0,
        fontSize: 22,
        color: 'transparent',
        ...Platform.select({ web: { outlineStyle: 'none' } }),
    },
});
