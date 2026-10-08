import React, { useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useApp } from '../../context/AppContext';
import TabIcon from '../../navigation/TabIcon';
import { COLORS, TYPOGRAPHY, PALETTES } from '../../theme/theme';
import { triggerHaptic } from '../../utils/haptics';

const BAR_HEIGHT = 68;
const BAR_PADDING = 5;

/** Native counterpart of the supplied capsule; React Navigation owns tab state. */
export default function PresenceTabBar({ state, descriptors, navigation, insets }) {
    const { state: appState } = useApp();
    const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
    const [width, setWidth] = useState(0);
    const [keyboardOpen, setKeyboardOpen] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(true);
    const [reduceTransparency, setReduceTransparency] = useState(true);
    const slide = useRef(new Animated.Value(state.index)).current;
    const dark = appState.settings?.theme === 'dark' || !!PALETTES[appState.settings?.uiPalette]?.oledOnly;

    useEffect(() => {
        let live = true;
        AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (live) setReduceMotion(value); });
        AccessibilityInfo.isReduceTransparencyEnabled().then((value) => { if (live) setReduceTransparency(value); });
        const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
        const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true));
        const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false));
        return () => { live = false; motion.remove(); transparency.remove(); show.remove(); hide.remove(); };
    }, []);

    useEffect(() => {
        slide.stopAnimation();
        if (reduceMotion) slide.setValue(state.index);
        else Animated.spring(slide, { toValue: state.index, damping: 24, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
    }, [state.index, reduceMotion, slide]);

    const tabWidth = (width - BAR_PADDING * 2) / state.routes.length;
    if (keyboardOpen) return null;

    return <View onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)} style={[styles.layer, { backgroundColor: COLORS.background, paddingBottom: Math.max(insets.bottom, 10), paddingHorizontal: Math.max(insets.left, insets.right, 20) }]}>
        <View style={[styles.shadow, { shadowColor: COLORS.shadow }]}>
            <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.capsule, { backgroundColor: reduceTransparency ? COLORS.cardBackground : 'transparent' }]}>
                {!reduceTransparency && <BlurView pointerEvents="none" intensity={85} tint={dark ? 'systemMaterialDark' : 'systemMaterialLight'} style={StyleSheet.absoluteFill} />}
                {width > 0 && <Animated.View pointerEvents="none" style={[styles.pill, {
                    width: tabWidth - 4,
                    backgroundColor: COLORS.inputBackground,
                    transform: [{ translateX: Animated.multiply(slide, tabWidth) }],
                }]} />}
                {state.routes.map((route, index) => {
                    const focused = state.index === index;
                    const options = descriptors[route.key].options;
                    const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title || route.name);
                    return <Pressable
                        key={route.key}
                        accessibilityRole="tab"
                        accessibilityLabel={options.tabBarAccessibilityLabel || label}
                        accessibilityState={{ selected: focused }}
                        onPress={() => {
                            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                            if (!event.defaultPrevented && !focused) { triggerHaptic('light'); navigation.navigate(route.name, route.params); }
                        }}
                        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
                    >
                        <TabIcon label={route.name} focused={focused} color={focused ? COLORS.textPrimary : COLORS.textSecondary} />
                        <Text style={[styles.label, { color: focused ? COLORS.textPrimary : COLORS.textSecondary, fontWeight: focused ? '700' : '500' }]}>{label}</Text>
                    </Pressable>;
                })}
            </View>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    layer: { paddingTop: 12, alignItems: 'center', backgroundColor: 'transparent' },
    shadow: { width: '100%', maxWidth: 420, borderRadius: 36, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
    capsule: { minHeight: BAR_HEIGHT, borderRadius: 36, overflow: 'hidden', padding: BAR_PADDING, flexDirection: 'row', alignItems: 'stretch' },
    pill: { position: 'absolute', left: 7, top: 5, bottom: 5, borderRadius: 28 },
    item: { flex: 1, minHeight: 58, minWidth: 44, justifyContent: 'center', alignItems: 'center', gap: 3, paddingVertical: 6 },
    label: { ...TYPOGRAPHY.captionMedium, fontSize: 13, lineHeight: 16, textAlign: 'center' },
});
