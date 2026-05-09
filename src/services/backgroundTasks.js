import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { logger } from '../utils/logger';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_ERP_SYNC';

// 1. Define the task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        logger.info('💓', 'Background ERP sync running...');
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

// 2. Register the task
export async function registerBackgroundSync() {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!isRegistered) {
            await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: 60 * 60 * 6, // 6 hours
                stopOnTerminate: false,
                startOnBoot: true,
            });
            logger.info('✅', 'Background sync registered');
        }
    } catch (err) {
        logger.warn('⚠️ Background sync registration failed:', err.message);
    }
}

// 3. Setup Notifications
export async function setupNotifications() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
    
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    return finalStatus === 'granted';
}
