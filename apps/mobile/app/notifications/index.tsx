import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { fetchApi } from '../../lib/api';
import { Colors, Shadows } from '../../lib/theme';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  MessagesSquare,
  ClipboardList,
  GraduationCap,
  Info,
  CalendarCheck,
  ChevronRight,
  Sparkles,
  AlarmClock,
} from 'lucide-react-native';

export default function NotificationsScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const {
    notifications,
    unreadCount,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    clearAll,
    showBanner,
    scheduleLocalNotification,
  } = useNotifications();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'ALL' | 'DOUBTS' | 'ASSIGNMENTS' | 'OTHER'>('ALL');

  useEffect(() => {
    refreshNotifications();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to dismiss all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
          },
        },
      ]
    );
  };

  const handleTestBanner = () => {
    showBanner({
      title: 'Academic Alert: Physics Quiz',
      message: 'New Physics Weekly Quiz has been published for Batch A.',
      type: 'academic',
      link: role === 'TEACHER' ? '/(teacher)/assignments' : '/(student)/assignments',
    });
  };

  const handleTestOfflineNotification = async () => {
    await scheduleLocalNotification({
      title: '🔔 Class Reminder (Offline)',
      body: 'Mathematics live class starts in 10 minutes. Tap to open app.',
      secondsFromNow: 5,
      channelId: 'academic-alerts',
      data: { link: role === 'TEACHER' ? '/(teacher)' : '/(student)' },
    });
    Alert.alert(
      'Alert Scheduled (5s)!',
      'Lock your screen or minimize the app to see the Android system notification alert drop into your notification tray in 5 seconds.'
    );
  };

  const handleNotificationPress = async (item: any) => {
    if (!item.isRead) {
      await markAsRead(item.id);
    }

    // Deep link routing based on notification link or type
    const link: string = item.link || '';
    const type: string = (item.type || '').toUpperCase();
    const isTeacher = role === 'TEACHER';

    if (link.includes('doubt') || type.includes('DOUBT')) {
      if (isTeacher) {
        router.push('/(teacher)/doubts' as any);
      } else {
        router.push('/(student)/doubts' as any);
      }
    } else if (link.includes('assignment') || type.includes('ASSIGNMENT') || type.includes('HOMEWORK')) {
      if (isTeacher) {
        router.push('/(teacher)/assignments' as any);
      } else {
        router.push('/(student)/assignments' as any);
      }
    } else if (link.includes('exam') || type.includes('EXAM')) {
      if (isTeacher) {
        router.push('/(teacher)/more/exams' as any);
      } else {
        router.push('/(student)/exams' as any);
      }
    } else if (link.includes('attendance') || type.includes('ATTENDANCE')) {
      if (isTeacher) {
        router.push('/(teacher)/attendance' as any);
      } else {
        router.push('/(student)/profile/attendance' as any);
      }
    }
  };

  const getNotificationIcon = (type: string, link: string) => {
    const t = (type || '').toUpperCase();
    const l = (link || '').toLowerCase();

    if (t.includes('DOUBT') || l.includes('doubt')) {
      return { icon: <MessagesSquare size={18} color={Colors.brand.blue} />, bg: '#EFF6FF' };
    }
    if (t.includes('ASSIGNMENT') || l.includes('assignment') || t.includes('HOMEWORK')) {
      return { icon: <ClipboardList size={18} color="#D97706" />, bg: '#FEF3C7' };
    }
    if (t.includes('EXAM') || l.includes('exam')) {
      return { icon: <GraduationCap size={18} color="#7C3AED" />, bg: '#EDE9FE' };
    }
    if (t.includes('ATTENDANCE') || l.includes('attendance')) {
      return { icon: <CalendarCheck size={18} color="#16A34A" />, bg: '#DCFCE7' };
    }
    return { icon: <Info size={18} color={Colors.text.secondary} />, bg: '#F1F5F9' };
  };

  const filteredNotifications = notifications.filter((n) => {
    const t = (n.type || '').toUpperCase();
    const l = (n.link || '').toLowerCase();

    if (filterTab === 'DOUBTS') {
      return t.includes('DOUBT') || l.includes('doubt');
    }
    if (filterTab === 'ASSIGNMENTS') {
      return t.includes('ASSIGNMENT') || l.includes('assignment') || t.includes('HOMEWORK');
    }
    if (filterTab === 'OTHER') {
      return !t.includes('DOUBT') && !l.includes('doubt') && !t.includes('ASSIGNMENT') && !l.includes('assignment');
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Action Header */}
      <View style={styles.topActionsBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.headerCountText}>
            {unreadCount > 0 ? `${unreadCount} Unread` : 'All caught up'}
          </Text>
        </View>

        <View style={styles.headerButtonRow}>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleMarkAllRead}>
              <CheckCheck size={14} color={Colors.brand.blue} />
              <Text style={styles.headerActionText}>Mark Read</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleClearAll}>
              <Trash2 size={14} color={Colors.status.error} />
              <Text style={[styles.headerActionText, { color: Colors.status.error }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <TouchableOpacity
            style={[styles.tabChip, filterTab === 'ALL' && styles.tabChipActive]}
            onPress={() => setFilterTab('ALL')}
          >
            <Text style={[styles.tabChipText, filterTab === 'ALL' && styles.tabChipTextActive]}>
              All ({notifications.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, filterTab === 'DOUBTS' && styles.tabChipActive]}
            onPress={() => setFilterTab('DOUBTS')}
          >
            <Text style={[styles.tabChipText, filterTab === 'DOUBTS' && styles.tabChipTextActive]}>
              Doubts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, filterTab === 'ASSIGNMENTS' && styles.tabChipActive]}
            onPress={() => setFilterTab('ASSIGNMENTS')}
          >
            <Text style={[styles.tabChipText, filterTab === 'ASSIGNMENTS' && styles.tabChipTextActive]}>
              Homework
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabChip, filterTab === 'OTHER' && styles.tabChipActive]}
            onPress={() => setFilterTab('OTHER')}
          >
            <Text style={[styles.tabChipText, filterTab === 'OTHER' && styles.tabChipTextActive]}>
              System
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Notification List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Bell size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySubtitle}>
              You have no active alerts or reminders in this category.
            </Text>
          </View>
        ) : (
          filteredNotifications.map((item) => {
            const iconConfig = getNotificationIcon(item.type || '', item.link || '');
            const isUnread = !item.isRead;

            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}
                activeOpacity={0.7}
                onPress={() => handleNotificationPress(item)}
              >
                <View style={[styles.iconCircle, { backgroundColor: iconConfig.bg }]}>
                  {iconConfig.icon}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, isUnread && styles.cardTitleUnread]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                  </View>

                  <Text style={styles.cardMessage} numberOfLines={2}>
                    {item.message}
                  </Text>

                  <Text style={styles.timeText}>
                    {new Date(item.createdAt || Date.now()).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <ChevronRight size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            );
          })
        )}

        {/* Interactive Notification Testing Tools */}
        <View style={styles.testCard}>
          <View style={styles.testCardHeader}>
            <Sparkles size={16} color={Colors.brand.blue} />
            <Text style={styles.testCardTitle}>Notification Live Preview & Diagnostics</Text>
          </View>
          <Text style={styles.testCardSub}>
            Test offline background alerts and interactive popup banners directly on this device.
          </Text>
          <View style={styles.testBtnRow}>
            <TouchableOpacity style={styles.testBtn} onPress={handleTestBanner} activeOpacity={0.8}>
              <Sparkles size={14} color="#FFFFFF" />
              <Text style={styles.testBtnText}>In-App Popup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testBtn, styles.testBtnSecondary]}
              onPress={handleTestOfflineNotification}
              activeOpacity={0.8}
            >
              <AlarmClock size={14} color={Colors.brand.blue} />
              <Text style={[styles.testBtnText, { color: Colors.brand.blue }]}>Offline Alert (5s)</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  topActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerCountText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  headerButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  headerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  tabsRow: {
    backgroundColor: Colors.surface.card,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface.background,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tabChipActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  notificationCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 12,
    ...Shadows.sm,
  },
  notificationCardUnread: {
    borderColor: '#BFDBFE',
    backgroundColor: '#FAFCFF',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  cardTitleUnread: {
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand.blue,
    marginLeft: 6,
  },
  cardMessage: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  testCard: {
    marginTop: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  testCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  testCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  testCardSub: {
    fontSize: 12,
    color: Colors.text.muted,
    lineHeight: 16,
    marginBottom: 12,
  },
  testBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brand.blue,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  testBtnSecondary: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
