import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { COLORS } from '../../theme/theme';

export default function BrandLoader() {
    const pulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 0,
                    duration: 1000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [pulseAnim]);

    // Interpolate values for pulsing effect
    const scale = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.95, 1.05]
    });
    
    const opacity = pulseAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.6, 1]
    });

    return (
        <View style={styles.container}>
            <Animated.Image 
                source={require('../../../assets/icon.png')} 
                style={[
                    styles.logo, 
                    { 
                        opacity: opacity, 
                        transform: [{ scale: scale }] 
                    }
                ]} 
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    logo: {
        width: 120,
        height: 120,
        tintColor: COLORS.primary, // Applies primary color to the outline if the logo is monochrome/transparent
    }
});
