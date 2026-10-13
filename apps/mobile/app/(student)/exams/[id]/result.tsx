import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchApi } from '../../../../lib/api';
import { Colors, Shadows } from '../../../../lib/theme';
import { Trophy, CheckCircle, XCircle, ArrowLeft, Award, Percent } from 'lucide-react-native';

export default function ExamResultScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [exam, setExam] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResult() {
      try {
        const examData = await fetchApi<any>(`/exams/${id}`);
        setExam(examData);
        if (examData.results && examData.results.length > 0) {
          setResult(examData.results[0]);
        }
      } catch (e) {
        console.error('Failed to load exam result', e);
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
        <Text style={styles.loadingText}>Calculating your results...</Text>
      </View>
    );
  }

  const marks = result?.marksObtained || 0;
  const maxMarks = result?.maxMarks || (exam?.mcqQuestions?.length ? exam.mcqQuestions.length * 4 : 40);
  const pct = maxMarks > 0 ? Math.round((marks / maxMarks) * 100) : 0;
  const isPassed = pct >= 40;
  const grade = result?.grade || (pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 50 ? 'C' : 'F');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Score Hero Card */}
      <View style={[styles.heroCard, isPassed ? styles.heroPassed : styles.heroFailed]}>
        <View style={styles.trophyCircle}>
          <Trophy size={36} color={isPassed ? Colors.status.warning : Colors.brand.blue} />
        </View>

        <Text style={styles.scoreText}>
          {marks} / {maxMarks}
        </Text>
        <Text style={styles.scoreSubtitle}>Marks Obtained</Text>

        <View style={styles.pillRow}>
          <View style={styles.badgePill}>
            <Percent size={13} color="#FFFFFF" />
            <Text style={styles.badgePillText}>{pct}% Score</Text>
          </View>
          <View style={[styles.badgePill, { backgroundColor: isPassed ? Colors.status.success : Colors.status.error }]}>
            <Award size={13} color="#FFFFFF" />
            <Text style={styles.badgePillText}>Grade {grade}</Text>
          </View>
        </View>
      </View>

      {/* Exam Details Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionHeaderTitle}>Assessment Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Exam Title</Text>
          <Text style={styles.detailValue}>{exam?.title}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Subject</Text>
          <Text style={styles.detailValue}>{exam?.subject?.name || 'General'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <Text style={[styles.detailValue, { color: isPassed ? Colors.status.success : Colors.status.error }]}>
            {isPassed ? 'Passed' : 'Needs Improvement'}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={styles.doneButton}
        onPress={() => router.replace('/(student)/exams' as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.doneButtonText}>Back to Exams</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.brand.blue,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    ...Shadows.md,
  },
  heroPassed: {
    backgroundColor: Colors.brand.blue,
  },
  heroFailed: {
    backgroundColor: Colors.text.primary,
  },
  trophyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  scoreSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    fontWeight: '500',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 5,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 24,
    ...Shadows.sm,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  detailLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  doneButton: {
    backgroundColor: Colors.brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    ...Shadows.sm,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
