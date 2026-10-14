import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Storage } from '../lib/storage';
import { fetchApi } from '../lib/api';
import { setupNotificationChannels, scheduleOfflineNotification } from '../lib/notifications';
import { BannerData, BannerType } from '../components/NotificationBanner';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  link?: string;
  createdAt?: string;
}

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  activeBanner: BannerData | null;
  showBanner: (params: {
    title: string;
    message: string;
    type?: BannerType;
    link?: string;
    duration?: number;
    onPress?: () => void;
  }) => void;
  dismissBanner: () => void;
  scheduleLocalNotification: (params: {
    title: string;
    body: string;
    data?: Record<string, any>;
    secondsFromNow?: number;
    channelId?: 'academic-alerts' | 'reminders' | 'general';
  }) => Promise<string | null>;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeBanner, setActiveBanner] = useState<BannerData | null>(null);

  // Initialize offline channels & restore cache
  useEffect(() => {
    let isMounted = true;

    // 1. Setup channels & permissions
    setupNotificationChannels();

    // 2. Load cached notifications from local storage immediately (instant offline support)
    Storage.getCachedNotifications().then((cached) => {
      if (isMounted && cached && cached.length > 0) {
        setNotifications(cached);
        const unread = cached.filter((n: NotificationItem) => !n.isRead).length;
        setUnreadCount(unread);
      }
    });

    Storage.getCachedUnreadCount().then((cachedCount) => {
      if (isMounted && cachedCount > 0) {
        setUnreadCount(cachedCount);
      }
    });

    // 3. Listen to system notification responses (when user taps an OS tray alert)
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data && data.link) {
        try {
          router.push(data.link as any);
        } catch {
          router.push('/notifications' as any);
        }
      } else {
        router.push('/notifications' as any);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  // Fetch latest notifications from backend and update local cache
  const refreshNotifications = useCallback(async () => {
    try {
      const token = await Storage.getToken();
      if (!token) return;

      const data = await fetchApi<NotificationItem[]>('/notifications');
      if (data && Array.isArray(data)) {
        setNotifications(data);
        const count = data.filter((n) => !n.isRead).length;
        setUnreadCount(count);

        // Cache locally for offline access
        await Storage.saveCachedNotifications(data);
        await Storage.saveCachedUnreadCount(count);
      }
    } catch (e) {
      // If network fails, offline cached notifications remain untouched
      console.log('[NotificationContext] Refresh failed, using cached state');
    }
  }, []);

  // Show in-app banner popup
  const showBanner = useCallback(
    ({
      title,
      message,
      type = 'info',
      link,
      duration = 4500,
      onPress,
    }: {
      title: string;
      message: string;
      type?: BannerType;
      link?: string;
      duration?: number;
      onPress?: () => void;
    }) => {
      const bannerItem: BannerData = {
        id: Date.now().toString(),
        title,
        message,
        type,
        link,
        duration,
        onPress: () => {
          if (onPress) {
            onPress();
          } else if (link) {
            try {
              router.push(link as any);
            } catch {
              router.push('/notifications' as any);
            }
          }
        },
      };

      setActiveBanner(bannerItem);
    },
    [router]
  );

  const dismissBanner = useCallback(() => {
    setActiveBanner(null);
  }, []);

  // Schedule a local/offline OS notification
  const handleScheduleLocal = useCallback(
    async ({
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
    }) => {
      return await scheduleOfflineNotification({
        title,
        body,
        data,
        secondsFromNow,
        channelId,
      });
    },
    []
  );

  // Mark single notification as read
  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
      const newUnread = updated.filter((n) => !n.isRead).length;
      setUnreadCount(newUnread);
      Storage.saveCachedNotifications(updated);
      Storage.saveCachedUnreadCount(newUnread);
      return updated;
    });

    try {
      await fetchApi(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (e) {
      // offline fallback - local update already performed
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, isRead: true }));
      setUnreadCount(0);
      Storage.saveCachedNotifications(updated);
      Storage.saveCachedUnreadCount(0);
      return updated;
    });

    try {
      await fetchApi('/notifications/mark-all-read', { method: 'POST' });
    } catch (e) {
      // offline fallback
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    Storage.saveCachedNotifications([]);
    Storage.saveCachedUnreadCount(0);

    try {
      await fetchApi('/notifications/clear-all', { method: 'DELETE' });
    } catch (e) {
      // offline fallback
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        activeBanner,
        showBanner,
        dismissBanner,
        scheduleLocalNotification: handleScheduleLocal,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        clearAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
