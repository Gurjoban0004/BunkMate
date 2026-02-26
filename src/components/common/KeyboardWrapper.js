import React from 'react';
import {
    ScrollView,
    StyleSheet,
    TouchableWithoutFeedback,
    Keyboard,
    View,
    Platform,
} from 'react-native';
import { COLORS } from '../../theme/theme';

/**
 * KeyboardWrapper — wraps screen content in a ScrollView that
 * automatically adjusts for the keyboard WITHOUT pushing the
 * top of the screen off-view.
 *
 * On iOS 15+, `automaticallyAdjustKeyboardInsets` handles everything.
 * On Android, extra bottom padding provides space.
 * Tap outside to dismiss the keyboard.
 */
export default function KeyboardWrapper({
    children,
    scrollEnabled = true,
    style,
    contentContainerStyle,
    dismissOnTap = true,
}) {
    const scrollView = (
        <ScrollView
            style={[styles.container, style]}
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            bounces={true}
            scrollEnabled={scrollEnabled}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
            {children}
            {/* Extra bottom spacer for keyboard on Android */}
            {Platform.OS === 'android' && <View style={styles.keyboardSpacer} />}
        </ScrollView>
    );

    if (dismissOnTap && Platform.OS !== 'web') {
        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.wrapper}>{scrollView}</View>
            </TouchableWithoutFeedback>
        );
    }

    return <View style={styles.wrapper}>{scrollView}</View>;
}

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    keyboardSpacer: {
        height: 300,
    },
});
