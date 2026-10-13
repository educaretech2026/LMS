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
import { ClipboardList, Calendar, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react-native';

export default function StudentAssignmentsList() {
  const router = useRouter();
  const [tab, setTab] = useState<'PENDING' | 'SUBMITTED' | 'GRADED'>('PENDING');
  const [sortBy, setSortBy] = useState<'dueDate' | 'title'>('dueDate');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAssignments = async () => {
    try {
      const data = await fetchApi<any[]>('/assignments');
      setAssignments(data || []);
    } catch (e) {
      console.error('Failed to load assignments', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadAssignments();
  };

  const pendingList = useMemo(
    () => assignments.filter((a) => !a.submissions || a.submissions.length === 0),
    [assignments]
  );
  const submittedList = useMemo(
    () =>
      assignments.filter(
        (a) => a.submissions && a.submissions.length > 0 && a.submissions[0].status !== 'GRADED'
      ),
    [assignments]
  );
  const gradedList = useMemo(
    () =>
      assignments.filter(
        (a) => a.submissions && a.submissions.length > 0 && a.submissions[0].status === 'GRADED'
      ),
    [assignments]
  );

  const displayedList = useMemo(() => {
    const list =
      tab === 'PENDING'
        ? [...pendingList]
        : tab === 'SUBMITTED'
        ? [...submittedList]
        : [...gradedList];

    if (sortBy === 'title') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      list.sort((a, b) => {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return da - db;
      });
    }
    return list;
  }, [tab, pendingList, submittedList, gradedList, sortBy]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>COURSEWORK</Text>
            <Text style={styles.title}>Homework</Text>
          </View>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{assignments.length} Total</Text>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'PENDING' && styles.tabButtonActive]}
            onPress={() => setTab('PENDING')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'PENDING' && styles.tabTextActive]}>
              Pending ({pendingList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'SUBMITTED' && styles.tabButtonActive]}
            onPress={() => setTab('SUBMITTED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'SUBMITTED' && styles.tabTextActive]}>
              Submitted ({submittedList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'GRADED' && styles.tabButtonActive]}
            onPress={() => setTab('GRADED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'GRADED' && styles.tabTextActive]}>
              Graded ({gradedList.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sort hierarchy */}
        <View style={styles.sortBar}>
          <Text style={styles.sortLabel}>SORT</Text>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'dueDate' && styles.sortChipActive]}
            onPress={() => setSortBy('dueDate')}
          >
            <Text style={[styles.sortChipText, sortBy === 'dueDate' && styles.sortChipTextActive]}>Due Date</Text>
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
            <ClipboardList size={32} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>
              {tab === 'PENDING'
                ? 'No pending assignments'
                : tab === 'SUBMITTED'
                ? 'No submissions under review'
                : 'No graded tasks yet'}
            </Text>
          </View>
        ) : (
          displayedList.map((assignment) => {
            const isSubmitted = assignment.submissions && assignment.submissions.length > 0;
            const submission = isSubmitted ? assignment.submissions[0] : null;
            const isGraded = submission?.status === 'GRADED';
            const isOverdue =
              !isSubmitted && assignment.dueDate && new Date(assignment.dueDate) < new Date();

            return (
              <TouchableOpacity
                key={assignment.id}
                style={styles.card}
                onPress={() => router.push(`/(student)/assignments/${assignment.id}` as any)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.cardAccent,
                    {
                      backgroundColor: isGraded
                        ? Colors.brand.emerald
                        : isOverdue
                        ? Colors.brand.red
                        : Colors.brand.blue,
                    },
                  ]}
                />
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>
                        {assignment.batch?.name || assignment.subject || 'Classwork'}
                      </Text>
                    </View>

                    {isGraded ? (
                      <View style={styles.gradedBadge}>
                        <CheckCircle size={11} color={Colors.brand.emerald} />
                        <Text style={styles.gradedBadgeText}>Graded</Text>
                      </View>
                    ) : isOverdue ? (
                      <View style={styles.overdueBadge}>
                        <AlertCircle size={11} color={Colors.brand.red} />
                        <Text style={styles.overdueBadgeText}>Overdue</Text>
                      </View>
                    ) : isSubmitted ? (
                      <View style={styles.submittedBadge}>
                        <Text style={styles.submittedBadgeText}>Submitted</Text>
                      </View>
                    ) : (
                      <View style={styles.pendingBadge}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.assignmentTitle} numberOfLines={2}>
                    {assignment.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Calendar size={12} color={isOverdue ? Colors.brand.red : Colors.text.muted} />
                      <Text style={[styles.metaText, isOverdue && { color: Colors.brand.red, fontWeight: '700' }]}>
                        Due {formatDate(assignment.dueDate)}
                      </Text>
                    </View>

                    {isGraded && submission?.marks !== undefined && (
                      <View style={styles.metaItem}>
                        <Text style={styles.gradeScore}>
                          Score: {submission.marks}/{assignment.totalMarks || 100}
                        </Text>
                      </View>
                    )}

                    <ChevronRight size={14} color={Colors.text.muted} style={{ marginLeft: 'auto' }} />
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
    marginBottom: 10,
    overflow: 'hidden',
    ...Shadows.xs,
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
  pendingBadge: {
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  submittedBadge: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  submittedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  gradedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.emeraldLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  gradedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.emerald,
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.redLight,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  overdueBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.brand.red,
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  gradeScore: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.emerald,
  },
});
