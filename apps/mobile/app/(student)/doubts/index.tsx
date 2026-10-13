import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import { MessagesSquare, Plus, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react-native';

export default function StudentDoubtsList() {
  const router = useRouter();
  const [tab, setTab] = useState<'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDoubts = async () => {
    try {
      const data = await fetchApi<any[]>('/doubts');
      setDoubts(data || []);
    } catch (e) {
      console.error('Failed to load doubts', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDoubts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDoubts();
  };

  const activeDoubts = doubts.filter((d) => d.status !== 'RESOLVED' && d.status !== 'CLOSED');
  const resolvedDoubts = doubts.filter((d) => d.status === 'RESOLVED' || d.status === 'CLOSED');

  const displayedList = tab === 'ACTIVE' ? activeDoubts : resolvedDoubts;

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'URGENT':
        return Colors.status.error;
      case 'HIGH':
        return Colors.status.warning;
      default:
        return Colors.brand.blue;
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Doubt Clearance</Text>
          <Text style={styles.subtitle}>Direct 1-on-1 academic assistance from faculty</Text>
        </View>
        <TouchableOpacity
          style={styles.askButton}
          onPress={() => router.push('/(student)/doubts/ask' as any)}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.askButtonText}>Ask</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'ACTIVE' && styles.tabButtonActive]}
          onPress={() => setTab('ACTIVE')}
        >
          <Text style={[styles.tabText, tab === 'ACTIVE' && styles.tabTextActive]}>
            Active ({activeDoubts.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'RESOLVED' && styles.tabButtonActive]}
          onPress={() => setTab('RESOLVED')}
        >
          <Text style={[styles.tabText, tab === 'RESOLVED' && styles.tabTextActive]}>
            Resolved ({resolvedDoubts.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : displayedList.length === 0 ? (
          <View style={styles.emptyCard}>
            <MessagesSquare size={36} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>
              {tab === 'ACTIVE' ? 'No active doubts' : 'No resolved questions yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'ACTIVE'
                ? 'Stuck on a concept or textbook problem? Tap "Ask" to get teacher guidance.'
                : 'Questions you resolve with your teacher will be archived here.'}
            </Text>
          </View>
        ) : (
          displayedList.map((doubt) => {
            const priorityColor = getPriorityColor(doubt.priority);
            const teacherName = doubt.teacher
              ? `${doubt.teacher.firstName || ''} ${doubt.teacher.lastName || ''}`.trim()
              : 'Assigned Teacher';

            return (
              <TouchableOpacity
                key={doubt.id}
                style={styles.card}
                onPress={() => router.push(`/(student)/doubts/${doubt.id}/chat` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>{doubt.subject?.name || 'General'}</Text>
                  </View>

                  <View style={[styles.priorityPill, { borderColor: priorityColor }]}>
                    <Text style={[styles.priorityPillText, { color: priorityColor }]}>
                      {doubt.priority || 'MEDIUM'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.doubtTitle}>{doubt.title}</Text>
                {doubt.description ? (
                  <Text style={styles.doubtDesc} numberOfLines={2}>
                    {doubt.description}
                  </Text>
                ) : null}

                <View style={styles.footerRow}>
                  <Text style={styles.teacherText}>Faculty: {teacherName}</Text>
                  <View style={styles.actionArrow}>
                    <Text style={styles.openText}>Open Chat</Text>
                    <ChevronRight size={14} color={Colors.brand.blue} />
                  </View>
                </View>
              </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: Colors.surface.card,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
    ...Shadows.sm,
  },
  askButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.card,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface.subtle,
  },
  tabButtonActive: {
    backgroundColor: Colors.brand.blueLight,
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
    padding: 20,
    paddingBottom: 40,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 11,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 12,
    ...Shadows.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBadge: {
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
  },
  priorityPill: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  doubtTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  doubtDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
  },
  teacherText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  actionArrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  openText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
});
