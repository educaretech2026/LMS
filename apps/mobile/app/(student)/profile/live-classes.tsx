import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import { Video, Calendar, Clock, Play, Radio, Users, ChevronRight } from 'lucide-react-native';

export default function StudentLiveClassesScreen() {
  const [classes, setClasses] = useState<any[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClasses = async () => {
    try {
      const data = await fetchApi<any[]>('/live-class');
      setClasses(data || []);
    } catch (e) {
      console.error('Failed to load live classes', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadClasses();
  };

  const handleJoin = (meetingUrl: string) => {
    if (meetingUrl) {
      Linking.openURL(meetingUrl).catch(() => {
        Alert.alert('Error', 'Could not open meeting link.');
      });
    } else {
      Alert.alert('Notice', 'No meeting link is currently active for this class.');
    }
  };

  const liveClasses = useMemo(() => classes.filter((c) => c.status === 'LIVE'), [classes]);
  const upcomingClasses = useMemo(() => classes.filter((c) => c.status !== 'LIVE' && c.status !== 'ENDED'), [classes]);

  const displayedList = useMemo(() => {
    if (filter === 'LIVE') return liveClasses;
    if (filter === 'UPCOMING') return upcomingClasses;
    return classes;
  }, [classes, filter, liveClasses, upcomingClasses]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>SESSIONS</Text>
            <Text style={styles.title}>Live Classes</Text>
          </View>
          {liveClasses.length > 0 && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveIndicatorText}>{liveClasses.length} LIVE NOW</Text>
            </View>
          )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, filter === 'ALL' && styles.tabButtonActive]}
            onPress={() => setFilter('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'ALL' && styles.tabTextActive]}>
              All ({classes.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, filter === 'LIVE' && styles.tabButtonActive]}
            onPress={() => setFilter('LIVE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'LIVE' && styles.tabTextActive]}>
              Live Now ({liveClasses.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, filter === 'UPCOMING' && styles.tabButtonActive]}
            onPress={() => setFilter('UPCOMING')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, filter === 'UPCOMING' && styles.tabTextActive]}>
              Upcoming ({upcomingClasses.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : displayedList.length === 0 ? (
          <View style={styles.emptyCard}>
            <Video size={32} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>
              {filter === 'LIVE' ? 'No sessions live right now' : 'No upcoming classes scheduled'}
            </Text>
          </View>
        ) : (
          displayedList.map((item) => {
            const isLive = item.status === 'LIVE';
            const isEnded = item.status === 'ENDED';
            const meetUrl = item.zoomLink || item.meetLink || '';
            const dt = item.scheduledAt ? new Date(item.scheduledAt) : null;

            return (
              <View key={item.id} style={[styles.card, isLive && styles.cardLive]}>
                <View
                  style={[
                    styles.cardAccent,
                    {
                      backgroundColor: isLive
                        ? Colors.brand.red
                        : isEnded
                        ? Colors.text.muted
                        : Colors.brand.blue,
                    },
                  ]}
                />
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <View style={styles.subjectTag}>
                      <Text style={styles.subjectTagText}>{item.subject || 'Lecture'}</Text>
                    </View>

                    {isLive ? (
                      <View style={styles.badgeLive}>
                        <Radio size={10} color="#FFFFFF" />
                        <Text style={styles.badgeLiveText}>LIVE</Text>
                      </View>
                    ) : isEnded ? (
                      <View style={styles.badgeEnded}>
                        <Text style={styles.badgeEndedText}>Ended</Text>
                      </View>
                    ) : (
                      <View style={styles.badgeScheduled}>
                        <Clock size={10} color={Colors.brand.blue} />
                        <Text style={styles.badgeScheduledText}>Scheduled</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.classTitle} numberOfLines={2}>
                    {item.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.facultyText}>
                      Faculty: {item.teacherName || 'Faculty'}
                    </Text>
                    {dt && (
                      <View style={styles.timeTag}>
                        <Calendar size={11} color={Colors.text.muted} />
                        <Text style={styles.timeText}>
                          {dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ·{' '}
                          {dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Action button */}
                  {isLive ? (
                    <TouchableOpacity
                      style={styles.joinLiveBtn}
                      onPress={() => handleJoin(meetUrl)}
                      activeOpacity={0.85}
                    >
                      <Play size={13} color="#FFFFFF" />
                      <Text style={styles.joinLiveBtnText}>Join Live Classroom</Text>
                    </TouchableOpacity>
                  ) : meetUrl ? (
                    <TouchableOpacity
                      style={styles.joinBtn}
                      onPress={() => handleJoin(meetUrl)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.joinBtnText}>Open Meeting Link</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.redLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brand.red,
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.brand.red,
    letterSpacing: 0.5,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.subtle,
    borderRadius: Radii.md,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  tabButtonActive: {
    backgroundColor: Colors.surface.card,
    ...Shadows.xs,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  tabTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 20,
    gap: 10,
    ...Shadows.xs,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 10,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  cardLive: {
    borderColor: `${Colors.brand.red}40`,
  },
  cardAccent: {
    height: 2,
  },
  cardInner: {
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectTag: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  subjectTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  badgeLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.red,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  badgeLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  badgeEnded: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  badgeEndedText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  badgeScheduled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  badgeScheduledText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  classTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  facultyText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  joinLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brand.red,
    paddingVertical: 10,
    borderRadius: Radii.md,
  },
  joinLiveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  joinBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blueLight,
    paddingVertical: 9,
    borderRadius: Radii.md,
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
});
