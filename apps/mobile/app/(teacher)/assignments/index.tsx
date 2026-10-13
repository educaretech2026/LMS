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
import { ClipboardList, Plus, Calendar, Users, ChevronRight } from 'lucide-react-native';

export default function TeacherAssignmentsList() {
  const router = useRouter();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Homework & Tasks</Text>
          <Text style={styles.subtitle}>Batch assignments and student reviews</Text>
        </View>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/(teacher)/assignments/create' as any)}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : assignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClipboardList size={36} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No assignments created yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Create" to assign worksheets and homework tasks to your batches.
            </Text>
          </View>
        ) : (
          assignments.map((assignment) => {
            const submissionCount = assignment._count?.submissions || assignment.submissions?.length || 0;

            return (
              <TouchableOpacity
                key={assignment.id}
                style={styles.card}
                onPress={() =>
                  router.push(`/(teacher)/assignments/${assignment.id}/submissions` as any)
                }
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <View style={styles.batchBadge}>
                    <Text style={styles.batchBadgeText}>{assignment.batch?.name || 'Class Batch'}</Text>
                  </View>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>{assignment.subject?.name || 'Subject'}</Text>
                  </View>
                </View>

                <Text style={styles.assignmentTitle}>{assignment.title}</Text>
                {assignment.description ? (
                  <Text style={styles.assignmentDesc} numberOfLines={2}>
                    {assignment.description}
                  </Text>
                ) : null}

                <View style={styles.footerRow}>
                  <View style={styles.submissionBadge}>
                    <Users size={12} color={Colors.brand.blue} />
                    <Text style={styles.submissionText}>{submissionCount} Turned In</Text>
                  </View>

                  <View style={styles.arrowWrap}>
                    <Text style={styles.viewText}>Review</Text>
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
    ...Shadows.sm,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
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
    gap: 8,
    marginBottom: 8,
  },
  batchBadge: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  batchBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
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
  submissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  submissionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  arrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
});
