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
import { ClipboardList, Calendar, Award, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react-native';

export default function StudentAssignmentsList() {
  const router = useRouter();
  const [tab, setTab] = useState<'PENDING' | 'SUBMITTED' | 'GRADED'>('PENDING');
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

  const pendingList = assignments.filter((a) => !a.submissions || a.submissions.length === 0);
  const submittedList = assignments.filter(
    (a) => a.submissions && a.submissions.length > 0 && a.submissions[0].status !== 'GRADED'
  );
  const gradedList = assignments.filter(
    (a) => a.submissions && a.submissions.length > 0 && a.submissions[0].status === 'GRADED'
  );

  const displayedList =
    tab === 'PENDING' ? pendingList : tab === 'SUBMITTED' ? submittedList : gradedList;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Homework & Assignments</Text>
        <Text style={styles.subtitle}>Batch homework tasks and teacher feedback</Text>

        {/* Tab Selector */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'PENDING' && styles.tabButtonActive]}
            onPress={() => setTab('PENDING')}
          >
            <Text style={[styles.tabText, tab === 'PENDING' && styles.tabTextActive]}>
              Pending ({pendingList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'SUBMITTED' && styles.tabButtonActive]}
            onPress={() => setTab('SUBMITTED')}
          >
            <Text style={[styles.tabText, tab === 'SUBMITTED' && styles.tabTextActive]}>
              Submitted ({submittedList.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'GRADED' && styles.tabButtonActive]}
            onPress={() => setTab('GRADED')}
          >
            <Text style={[styles.tabText, tab === 'GRADED' && styles.tabTextActive]}>
              Graded ({gradedList.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : displayedList.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClipboardList size={36} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No assignments in this view</Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'PENDING'
                ? "You've submitted all assigned homework!"
                : 'Assignments will appear here once turned in or graded.'}
            </Text>
          </View>
        ) : (
          displayedList.map((assignment) => {
            const hasSubmission = assignment.submissions && assignment.submissions.length > 0;
            const submission = hasSubmission ? assignment.submissions[0] : null;
            const isLate = assignment.dueDate ? new Date() > new Date(assignment.dueDate) : false;

            return (
              <TouchableOpacity
                key={assignment.id}
                style={styles.card}
                onPress={() => router.push(`/(student)/assignments/${assignment.id}/submit` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>{assignment.subject?.name || 'Subject'}</Text>
                  </View>

                  {submission?.status === 'GRADED' ? (
                    <View style={styles.gradedPill}>
                      <Award size={12} color={Colors.status.success} />
                      <Text style={styles.gradedPillText}>Graded: {submission.grade} marks</Text>
                    </View>
                  ) : submission ? (
                    <View style={styles.submittedPill}>
                      <CheckCircle size={12} color={Colors.brand.blue} />
                      <Text style={styles.submittedPillText}>Turned In</Text>
                    </View>
                  ) : isLate ? (
                    <View style={styles.latePill}>
                      <AlertCircle size={12} color={Colors.status.error} />
                      <Text style={styles.latePillText}>Overdue</Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                {assignment.description ? (
                  <Text style={styles.assignmentDesc} numberOfLines={2}>
                    {assignment.description}
                  </Text>
                ) : null}

                <View style={styles.footerRow}>
                  <View style={styles.dateMeta}>
                    <Calendar size={13} color={Colors.text.muted} />
                    <Text style={styles.dateMetaText}>Due: {formatDate(assignment.dueDate)}</Text>
                  </View>
                  <View style={styles.actionArrow}>
                    <Text style={styles.openText}>
                      {tab === 'PENDING' ? 'Submit' : 'View'}
                    </Text>
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
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.subtle,
    borderRadius: 10,
    padding: 3,
    marginTop: 14,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: Colors.surface.card,
    ...Shadows.sm,
  },
  tabText: {
    fontSize: 11,
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
  gradedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  gradedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.status.success,
  },
  submittedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  submittedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  latePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  latePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.status.error,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  assignmentDesc: {
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
  dateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateMetaText: {
    fontSize: 11,
    color: Colors.text.muted,
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
