import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';

const BACKGROUND_SYNC_TASK = 'BACKGROUND_ERP_SYNC';

// 1. Define the task
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
        console.log('Background ERP sync running...');
        // Here we would call the headless ERP sync function, e.g.:
        // const result = await erpCheckSession(token);
        // if (result.needsAuth) return BackgroundFetch.BackgroundFetchResult.Failed;

        // Simulate sending a notification if a class dropped below 75%
        // await Notifications.scheduleNotificationAsync({
        //     content: {
        //         title: "⚠️ Attendance Alert",
        //         body: "Your Physics attendance just dropped to 74%. Tap to plan your recovery.",
        //         sound: true,
        //     },
        //     trigger: null,
        // });

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

// 2. Register the task
export async function registerBackgroundSync() {
    try {
        // Only register if not already registered
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
        if (!isRegistered) {
            await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
                minimumInterval: 60 * 60 * 6, // 6 hours
                stopOnTerminate: false, // android only
                startOnBoot: true, // android only
            });
            console.log('Background sync registered');
        }
    } catch (err) {
        console.log('Background sync registration failed:', err);
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
