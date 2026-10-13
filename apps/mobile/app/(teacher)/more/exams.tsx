import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import {
  GraduationCap,
  Clock,
  Award,
  Users,
  Search,
  CheckCircle2,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';

export default function TeacherExamsTracker() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');

  const loadExams = async () => {
    try {
      const data = await fetchApi<any[]>('/exams');
      setExams(data || []);
    } catch (e) {
      console.error('Failed to load exams', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadExams();
  };

  const now = new Date();

  const getExamStatus = (exam: any) => {
    const start = exam.startTime ? new Date(exam.startTime) : null;
    const end = exam.endTime ? new Date(exam.endTime) : null;

    if (start && start > now) {
      return { key: 'UPCOMING', label: 'Upcoming', bg: '#EFF6FF', text: Colors.brand.blue };
    }
    if (end && end < now) {
      return { key: 'COMPLETED', label: 'Ended', bg: '#F1F5F9', text: Colors.text.muted };
    }
    return { key: 'ACTIVE', label: 'Live Now', bg: '#DCFCE7', text: '#16A34A' };
  };

  const filteredExams = exams.filter((exam) => {
    const status = getExamStatus(exam);
    if (filter !== 'ALL' && status.key !== filter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (exam.title || '').toLowerCase();
      const subject = (exam.subject?.name || exam.subject || '').toLowerCase();
      return title.includes(q) || subject.includes(q);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter exams by title or subject..."
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabRow}>
        {(['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map((tabKey) => (
          <TouchableOpacity
            key={tabKey}
            style={[styles.tabButton, filter === tabKey && styles.tabButtonActive]}
            onPress={() => setFilter(tabKey)}
          >
            <Text style={[styles.tabText, filter === tabKey && styles.tabTextActive]}>
              {tabKey === 'ALL' ? 'All' : tabKey === 'ACTIVE' ? 'Live' : tabKey === 'UPCOMING' ? 'Upcoming' : 'Ended'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Loading examination schedules...</Text>
          </View>
        ) : filteredExams.length === 0 ? (
          <View style={styles.emptyContainer}>
            <GraduationCap size={44} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No Exams Found</Text>
            <Text style={styles.emptySubtitle}>
              {search || filter !== 'ALL'
                ? 'Try adjusting your search keywords or filter tab.'
                : 'No examinations are scheduled right now.'}
            </Text>
          </View>
        ) : (
          filteredExams.map((exam) => {
            const status = getExamStatus(exam);
            const questionCount = exam.questions?.length || exam.questionCount || 0;
            const submissionsCount = exam.results?.length || exam._count?.results || 0;
            const subjectName = exam.subject?.name || exam.subject || 'General Assessment';

            return (
              <View key={exam.id} style={styles.examCard}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.subjectTag}>{subjectName}</Text>
                    <Text style={styles.examTitle}>{exam.title}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: status.text }]}>{status.label}</Text>
                  </View>
                </View>

                {exam.description ? (
                  <Text style={styles.examDesc} numberOfLines={2}>
                    {exam.description}
                  </Text>
                ) : null}

                <View style={styles.metricsGrid}>
                  <View style={styles.metricItem}>
                    <Clock size={13} color={Colors.text.muted} />
                    <Text style={styles.metricLabel}>{exam.durationMinutes || 60} mins</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Award size={13} color={Colors.text.muted} />
                    <Text style={styles.metricLabel}>{exam.totalMarks || 100} marks ({exam.passingPercentage || 40}% pass)</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Users size={13} color={Colors.brand.blue} />
                    <Text style={[styles.metricLabel, { color: Colors.brand.blue, fontWeight: '700' }]}>
                      {submissionsCount} student attempt{submissionsCount === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                {exam.startTime && (
                  <View style={styles.footerSchedule}>
                    <Calendar size={12} color={Colors.text.muted} />
                    <Text style={styles.scheduleText}>
                      Window: {new Date(exam.startTime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {exam.endTime ? ` - ${new Date(exam.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </Text>
                  </View>
                )}
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: Colors.text.primary,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tabButtonActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
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
  examCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectTag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  examTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  examDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  footerSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  scheduleText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
});
