import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Initialize Android notification channels and request system permissions
 */
export async function setupNotificationChannels(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    // Android Channels configuration
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('academic-alerts', {
        name: 'Academic Alerts & Exams',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
        sound: 'default',
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders & Attendance',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
        sound: 'default',
        enableVibrate: true,
      });

      await Notifications.setNotificationChannelAsync('general', {
        name: 'General Announcements',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Check / Request Permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('[Notifications] Setup error:', error);
    return false;
  }
}

/**
 * Schedule a local notification (works completely offline, even if app is closed)
 */
export async function scheduleOfflineNotification({
  title,
  body,
  data = {},
  secondsFromNow = 1,
  channelId = 'academic-alerts',
}: {
  title: string;
  body: string;
  data?: Record<string, any>;
  secondsFromNow?: number;
  channelId?: 'academic-alerts' | 'reminders' | 'general';
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: secondsFromNow > 0 ? {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(secondsFromNow)),
        repeats: false,
      } : null,
    });
    return identifier;
  } catch (error) {
    console.warn('[Notifications] Failed to schedule notification:', error);
    return null;
  }
}

/**
 * Cancel a scheduled local notification by ID
 */
export async function cancelNotification(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.warn('[Notifications] Error cancelling notification:', error);
  }
}

/**
 * Clear all delivered notifications from the device system tray
 */
export async function clearAllDeliveredNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.warn('[Notifications] Error dismissing notifications:', error);
  }
}
