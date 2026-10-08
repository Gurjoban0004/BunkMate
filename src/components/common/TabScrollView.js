import React, { useContext } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

// Clearance belongs to the scroll content, so the screen continues behind the capsule.
export default function TabScrollView({ contentContainerStyle, ...props }) {
    const tabBarHeight = useContext(BottomTabBarHeightContext) || 0;
    const content = StyleSheet.flatten(contentContainerStyle) || {};
    const bottom = content.paddingBottom ?? content.paddingVertical ?? content.padding ?? 0;
    const paddingBottom = Platform.OS === 'web'
        ? `calc(var(--ios-tabbar-reserved, 0px) + ${bottom}px)`
        : bottom + (Platform.OS === 'ios' ? tabBarHeight : 0);
    return <ScrollView {...props} contentContainerStyle={[contentContainerStyle, { paddingBottom }]} />;
}
