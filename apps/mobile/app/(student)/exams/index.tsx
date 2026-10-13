import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import { FileText, Clock, Award, ChevronRight, Play, ArrowUpDown } from 'lucide-react-native';

export default function StudentExamsList() {
  const router = useRouter();
  const [tab, setTab] = useState<'AVAILABLE' | 'COMPLETED'>('AVAILABLE');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const availableExams = useMemo(() => {
    return exams.filter((e) => !e.results || e.results.length === 0);
  }, [exams]);

  const completedExams = useMemo(() => {
    return exams.filter((e) => e.results && e.results.length > 0);
  }, [exams]);

  const displayedList = useMemo(() => {
    const list = tab === 'AVAILABLE' ? [...availableExams] : [...completedExams];
    if (sortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      list.sort((a, b) => new Date(b.startTime || b.createdAt || 0).getTime() - new Date(a.startTime || a.createdAt || 0).getTime());
    }
    return list;
  }, [tab, availableExams, completedExams, sortBy]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>EVALUATION</Text>
            <Text style={styles.title}>Exams & Tests</Text>
          </View>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{exams.length} Total</Text>
          </View>
        </View>

        {/* Tab Pills */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'AVAILABLE' && styles.tabButtonActive]}
            onPress={() => setTab('AVAILABLE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'AVAILABLE' && styles.tabTextActive]}>
              Available ({availableExams.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'COMPLETED' && styles.tabButtonActive]}
            onPress={() => setTab('COMPLETED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'COMPLETED' && styles.tabTextActive]}>
              Completed ({completedExams.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hierarchy & Sort Bar */}
        <View style={styles.sortBar}>
          <Text style={styles.sortLabel}>SORT</Text>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'date' && styles.sortChipActive]}
            onPress={() => setSortBy('date')}
          >
            <Text style={[styles.sortChipText, sortBy === 'date' && styles.sortChipTextActive]}>Recent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'title' && styles.sortChipActive]}
            onPress={() => setSortBy('title')}
          >
            <Text style={[styles.sortChipText, sortBy === 'title' && styles.sortChipTextActive]}>Title A-Z</Text>
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
            <FileText size={32} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>
              {tab === 'AVAILABLE' ? 'No pending exams' : 'No completed tests'}
            </Text>
          </View>
        ) : (
          displayedList.map((exam) => {
            const hasResult = exam.results && exam.results.length > 0;
            const result = hasResult ? exam.results[0] : null;

            return (
              <View key={exam.id} style={styles.card}>
                <View style={styles.cardAccent} />
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>{exam.subject?.name || exam.subject || 'Assessment'}</Text>
                    </View>
                    {hasResult && result ? (
                      <View style={styles.gradeBadge}>
                        <Text style={styles.gradeBadgeText}>Grade {result.grade || 'Passed'}</Text>
                      </View>
                    ) : (
                      <View style={styles.activePill}>
                        <Text style={styles.activePillText}>Ready</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.examTitle}>{exam.title}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <FileText size={12} color={Colors.text.muted} />
                      <Text style={styles.metaText}>
                        {exam.mcqQuestions?.length || exam.questions || 10} Qs
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Clock size={12} color={Colors.text.muted} />
                      <Text style={styles.metaText}>{exam.duration || 60}m</Text>
                    </View>
                    {hasResult && result ? (
                      <View style={styles.metaItem}>
                        <Award size={12} color={Colors.brand.emerald} />
                        <Text style={[styles.metaText, { color: Colors.brand.emerald, fontWeight: '700' }]}>
                          {result.marksObtained}/{result.maxMarks}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Card Action */}
                  {hasResult ? (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={() => router.push(`/(student)/exams/${exam.id}/result` as any)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.reviewButtonText}>View Scorecard</Text>
                      <ChevronRight size={14} color={Colors.brand.blue} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.startButton}
                      onPress={() => router.push(`/(student)/exams/${exam.id}/take` as any)}
                      activeOpacity={0.8}
                    >
                      <Play size={14} color="#FFFFFF" />
                      <Text style={styles.startButtonText}>Start Test</Text>
                    </TouchableOpacity>
                  )}
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
  badgeCount: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.subtle,
    borderRadius: Radii.md,
    padding: 3,
    marginBottom: 10,
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
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  sortLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
  sortChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.surface.card,
  },
  sortChipActive: {
    backgroundColor: Colors.brand.blueLight,
    borderColor: Colors.brand.blue,
  },
  sortChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  sortChipTextActive: {
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
    marginBottom: 12,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  cardAccent: {
    height: 2,
    backgroundColor: Colors.brand.blue,
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
  subjectBadge: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  gradeBadge: {
    backgroundColor: Colors.brand.emeraldLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.emerald,
  },
  activePill: {
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 10,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.muted,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blue,
    paddingVertical: 10,
    borderRadius: Radii.md,
    gap: 6,
    ...Shadows.glowBlue,
  },
  startButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blueLight,
    paddingVertical: 10,
    borderRadius: Radii.md,
    gap: 4,
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
});
