import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import { Video, Calendar, Clock, Play, Radio, Users } from 'lucide-react-native';

export default function StudentLiveClassesScreen() {
  const [classes, setClasses] = useState<any[]>([]);
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
    >
      <View style={styles.banner}>
        <View style={styles.bannerIconBox}>
          <Radio size={24} color="#DC2626" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Interactive Live Sessions</Text>
          <Text style={styles.bannerSub}>Join real-time video lectures and doubt discussions</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.blue} />
          <Text style={styles.loadingText}>Fetching scheduled classes...</Text>
        </View>
      ) : classes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Video size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No Live Classes Scheduled</Text>
          <Text style={styles.emptySubtitle}>You will be notified as soon as a faculty member schedules a lecture.</Text>
        </View>
      ) : (
        classes.map((item) => {
          const isLive = item.status === 'LIVE';
          const isEnded = item.status === 'ENDED';
          const meetUrl = item.zoomLink || item.meetLink || '';

          return (
            <View key={item.id} style={[styles.card, isLive && styles.cardLive]}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subjectTag}>{item.subject || 'Live Lecture'}</Text>
                  <Text style={styles.classTitle}>{item.title}</Text>
                  <Text style={styles.facultyText}>Faculty: {item.teacherName || 'Educare Faculty'}</Text>
                </View>

                <View
                  style={[
                    styles.badge,
                    isLive ? styles.badgeLive : isEnded ? styles.badgeEnded : styles.badgeScheduled,
                  ]}
                >
                  {isLive && <Radio size={10} color="#DC2626" />}
                  <Text
                    style={[
                      styles.badgeText,
                      isLive ? { color: '#DC2626' } : isEnded ? { color: Colors.text.muted } : { color: Colors.brand.blue },
                    ]}
                  >
                    {item.status || 'SCHEDULED'}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Calendar size={13} color={Colors.text.muted} />
                  <Text style={styles.infoText}>
                    {new Date(item.scheduledAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.infoItem}>
                  <Clock size={13} color={Colors.text.muted} />
                  <Text style={styles.infoText}>{item.duration || 60} mins</Text>
                </View>
              </View>

              {!isEnded && (
                <TouchableOpacity
                  style={[styles.joinBtn, isLive ? styles.joinBtnLive : styles.joinBtnDefault]}
                  onPress={() => handleJoin(meetUrl)}
                  activeOpacity={0.8}
                >
                  <Play size={15} color="#FFFFFF" />
                  <Text style={styles.joinBtnText}>{isLive ? 'Join Live Stream' : 'Join Classroom'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 12,
    marginBottom: 4,
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  bannerSub: {
    fontSize: 11,
    color: '#B91C1C',
    marginTop: 1,
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
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  cardLive: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 2,
  },
  facultyText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeLive: {
    backgroundColor: '#FEE2E2',
  },
  badgeScheduled: {
    backgroundColor: '#EFF6FF',
  },
  badgeEnded: {
    backgroundColor: '#F1F5F9',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 6,
    ...Shadows.sm,
  },
  joinBtnLive: {
    backgroundColor: '#DC2626',
  },
  joinBtnDefault: {
    backgroundColor: Colors.brand.blue,
  },
  joinBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
