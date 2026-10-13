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
import { ClipboardList, Plus, Calendar, ChevronRight, AlertCircle } from 'lucide-react-native';

export default function TeacherAssignmentsList() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'dueDate' | 'title'>('dueDate');
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

  const sortedAssignments = useMemo(() => {
    const list = [...assignments];
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
  }, [assignments, sortBy]);

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
            <Text style={styles.headerEyebrow}>FACULTY</Text>
            <Text style={styles.title}>Homework</Text>
          </View>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/(teacher)/assignments/create' as any)}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#FFFFFF" />
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        {/* Sort Bar */}
        <View style={styles.sortBar}>
          <Text style={styles.sortLabel}>SORT</Text>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'dueDate' && styles.sortChipActive]}
            onPress={() => setSortBy('dueDate')}
          >
            <Text style={[styles.sortChipText, sortBy === 'dueDate' && styles.sortChipTextActive]}>
              Due Date
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'title' && styles.sortChipActive]}
            onPress={() => setSortBy('title')}
          >
            <Text style={[styles.sortChipText, sortBy === 'title' && styles.sortChipTextActive]}>
              Title A-Z
            </Text>
          </TouchableOpacity>
          <Text style={styles.countBadge}>{assignments.length} Total</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : sortedAssignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClipboardList size={32} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No homework assignments created</Text>
          </View>
        ) : (
          sortedAssignments.map((assignment) => {
            const isOverdue =
              assignment.dueDate && new Date(assignment.dueDate) < new Date();
            const subCount = assignment.submissions?.length || 0;

            return (
              <TouchableOpacity
                key={assignment.id}
                style={styles.card}
                onPress={() => router.push(`/(teacher)/assignments/${assignment.id}` as any)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.cardAccent,
                    { backgroundColor: isOverdue ? Colors.brand.red : Colors.brand.blue },
                  ]}
                />
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>
                        {assignment.batch?.name || assignment.subject || 'Classwork'}
                      </Text>
                    </View>

                    {isOverdue && (
                      <View style={styles.overdueBadge}>
                        <AlertCircle size={10} color={Colors.brand.red} />
                        <Text style={styles.overdueBadgeText}>Overdue</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.assignmentTitle} numberOfLines={2}>
                    {assignment.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Calendar size={11} color={Colors.text.muted} />
                      <Text style={styles.metaText}>Due {formatDate(assignment.dueDate)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Text style={styles.submissionsText}>{subCount} Submissions</Text>
                    </View>
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.md,
    ...Shadows.glowBlue,
  },
  createBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  countBadge: {
    marginLeft: 'auto',
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
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
  emptyText: {
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
    fontSize: 9,
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
  submissionsText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
});
