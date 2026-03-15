import { Alert as RNAlert, Platform } from 'react-native';

// Global reference to the Web context alert method
let globalWebAlert = null;

export const setGlobalWebAlert = (alertMethod) => {
    globalWebAlert = alertMethod;
};

export const showAlert = (title, message, buttons, options) => {
    if (Platform.OS === 'web') {
        if (globalWebAlert) {
            globalWebAlert(title, message, buttons, options);
        } else {
            // Fallback just in case context isn't mounted yet (web only)
            const fallbackMessage = message ? `${title}\n\n${message}` : title;
            const confirmed = typeof window !== 'undefined' && window.confirm
                ? window.confirm(fallbackMessage)
                : false;

            if (buttons && buttons.length > 0) {
                // Approximate confirm/cancel behavior based on standard window.confirm
                const defaultOrOkButton = buttons.find(b => b.style !== 'cancel');
                const cancelButton = buttons.find(b => b.style === 'cancel');

                if (confirmed && defaultOrOkButton && defaultOrOkButton.onPress) {
                    defaultOrOkButton.onPress();
                } else if (!confirmed && cancelButton && cancelButton.onPress) {
                    cancelButton.onPress();
                }
            }
        }
    } else {
        // Use native Alert directly format Native platforms
        RNAlert.alert(title, message, buttons, options);
    }
};
