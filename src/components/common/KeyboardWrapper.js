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
        // We still need a ScrollView for pages with lots of content.
        // Using overflow: 'visible' on contentContainerStyle preserves
        // hit-testing on child inputs (the Safari stacking-context fix).
        return (
            <ScrollView
                style={[styles.container, style]}
                contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                scrollEnabled={scrollEnabled}
            >
                {children}
            </ScrollView>
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
