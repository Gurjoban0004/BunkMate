import { Platform, Vibration } from 'react-native';

let Haptics = null;
try {
    Haptics = require('expo-haptics');
} catch (e) {
    // expo-haptics not installed, will fall back to Vibration
}

export const triggerHaptic = (type = 'medium') => {
    if (Platform.OS === 'ios' && Haptics) {
        switch (type) {
            case 'light':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                break;
            case 'medium':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                break;
            case 'heavy':
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                break;
            case 'success':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;
            case 'error':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                break;
            case 'warning':
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                break;
            default:
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
    } else {
        Vibration.vibrate(type === 'light' ? 25 : type === 'heavy' ? 100 : 50);
    }
};
