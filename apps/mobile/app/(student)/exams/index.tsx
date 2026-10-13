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
import { FileText, Clock, Award, CheckCircle2, ChevronRight, Play } from 'lucide-react-native';

export default function StudentExamsList() {
  const router = useRouter();
  const [tab, setTab] = useState<'AVAILABLE' | 'COMPLETED'>('AVAILABLE');
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

  const availableExams = exams.filter((e) => !e.results || e.results.length === 0);
  const completedExams = exams.filter((e) => e.results && e.results.length > 0);

  const displayedList = tab === 'AVAILABLE' ? availableExams : completedExams;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Exams & Tests</Text>
        <Text style={styles.subtitle}>Scheduled MCQ and class assessments</Text>

        {/* Tab Pills */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'AVAILABLE' && styles.tabButtonActive]}
            onPress={() => setTab('AVAILABLE')}
          >
            <Text style={[styles.tabText, tab === 'AVAILABLE' && styles.tabTextActive]}>
              Available ({availableExams.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'COMPLETED' && styles.tabButtonActive]}
            onPress={() => setTab('COMPLETED')}
          >
            <Text style={[styles.tabText, tab === 'COMPLETED' && styles.tabTextActive]}>
              Completed ({completedExams.length})
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
            <FileText size={36} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>
              {tab === 'AVAILABLE' ? 'No pending exams' : 'No completed tests yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'AVAILABLE'
                ? 'Your scheduled tests will show up here.'
                : 'Tests you submit will appear here with your grades and breakdown.'}
            </Text>
          </View>
        ) : (
          displayedList.map((exam) => {
            const hasResult = exam.results && exam.results.length > 0;
            const result = hasResult ? exam.results[0] : null;

            return (
              <View key={exam.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.subjectBadge}>
                    <Text style={styles.subjectBadgeText}>{exam.subject?.name || 'General'}</Text>
                  </View>
                  {hasResult && result ? (
                    <View style={styles.gradeBadge}>
                      <Text style={styles.gradeBadgeText}>Grade {result.grade || 'A'}</Text>
                    </View>
                  ) : (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>Live</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.examTitle}>{exam.title}</Text>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <FileText size={13} color={Colors.text.muted} />
                    <Text style={styles.metaText}>
                      {exam.mcqQuestions?.length || exam.questions || 10} Questions
                    </Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={13} color={Colors.text.muted} />
                    <Text style={styles.metaText}>{exam.duration || 60} mins</Text>
                  </View>
                  {hasResult && result ? (
                    <View style={styles.metaItem}>
                      <Award size={13} color={Colors.status.success} />
                      <Text style={[styles.metaText, { color: Colors.status.success, fontWeight: '700' }]}>
                        {result.marksObtained} / {result.maxMarks}
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
                    <Text style={styles.reviewButtonText}>View Scorecard & Review</Text>
                    <ChevronRight size={15} color={Colors.brand.blue} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={() => router.push(`/(student)/exams/${exam.id}/take` as any)}
                    activeOpacity={0.8}
                  >
                    <Play size={15} color="#FFFFFF" />
                    <Text style={styles.startButtonText}>Start Test</Text>
                  </TouchableOpacity>
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
  activePill: {
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.status.success,
  },
  gradeBadge: {
    backgroundColor: Colors.status.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.status.warning,
  },
  examTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  startButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.subtle,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  reviewButtonText: {
    color: Colors.brand.blue,
    fontSize: 12,
    fontWeight: '700',
  },
});
