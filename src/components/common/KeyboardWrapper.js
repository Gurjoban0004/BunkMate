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

export default function KeyboardWrapper({
    children,
    scrollEnabled = true,
    style,
    contentContainerStyle,
    dismissOnTap = true,
}) {
    if (Platform.OS === 'web') {
        // On web the browser handles the keyboard natively.
        // We use a plain View with no overflow manipulation —
        // overflowY:'auto' on a flex:1 div creates a new stacking
        // context in Safari/Chrome that breaks hit-testing on child inputs.
        // 
        // ⚡️ Fix: Added overflow: 'visible' to ensure child hit-targets 
        // are never clipped or swallowed by the container's bounds.
        return (
            <View style={[styles.container, style, { overflow: 'visible' }]}>
                <View style={[styles.scrollContent, contentContainerStyle, { overflow: 'visible' }]}>
                    {children}
                </View>
            </View>
        );
    }

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
            {Platform.OS === 'android' && <View style={styles.keyboardSpacer} />}
        </ScrollView>
    );

    if (dismissOnTap) {
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
