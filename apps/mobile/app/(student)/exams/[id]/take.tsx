import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchApi } from '../../../../lib/api';
import { Colors, Shadows } from '../../../../lib/theme';
import { Clock, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react-native';

export default function ExamTakeScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState<number>(3600);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function loadExam() {
      try {
        const data = await fetchApi<any>(`/exams/${id}`);
        setExam(data);
        const qs = data.mcqQuestions || [];
        setQuestions(qs);
        const durationSecs = (data.duration || 60) * 60;
        setTimeLeft(durationSecs);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load exam', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    }
    loadExam();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (loading || !exam) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, exam]);

  const handleSelectOption = (questionId: string, optionText: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionText,
    }));
  };

  const handleAutoSubmit = () => {
    Alert.alert('Time Up!', 'Your exam time has expired. Your answers will now be submitted.', [
      { text: 'Submit', onPress: () => submitFinalAnswers() },
    ]);
  };

  const submitFinalAnswers = async () => {
    if (submitting) return;
    setSubmitting(true);

    try {
      await fetchApi(`/exams/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers,
          score: 0,
        }),
      });

      router.replace(`/(student)/exams/${id}/result` as any);
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'Failed to submit exam answers.');
      setSubmitting(false);
    }
  };

  const confirmSubmit = () => {
    const answeredCount = Object.keys(answers).length;
    const totalCount = questions.length;
    const unansweredCount = totalCount - answeredCount;

    Alert.alert(
      'Submit Examination?',
      `You have answered ${answeredCount} of ${totalCount} questions (${unansweredCount} unanswered). Do you want to submit now?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes, Submit', style: 'default', onPress: () => submitFinalAnswers() },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
        <Text style={styles.loadingText}>Preparing your examination...</Text>
      </View>
    );
  }

  const currentQ = questions[currentIndex];
  if (!currentQ) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>No questions found for this exam.</Text>
      </View>
    );
  }

  // Parse options
  let optionsList: any[] = [];
  if (Array.isArray(currentQ.options)) {
    optionsList = currentQ.options;
  } else if (typeof currentQ.options === 'string') {
    try {
      optionsList = JSON.parse(currentQ.options);
    } catch {
      optionsList = [];
    }
  }

  const selectedAnswer = answers[currentQ.id];

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const isTimeCritical = timeLeft < 300; // less than 5 mins

  return (
    <View style={styles.container}>
      {/* Top Sticky Bar */}
      <View style={styles.topBar}>
        <View style={styles.titleColumn}>
          <Text style={styles.examTitleHeader} numberOfLines={1}>
            {exam?.title}
          </Text>
          <Text style={styles.qCountHeader}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>

        <View style={[styles.timerBadge, isTimeCritical && styles.timerCritical]}>
          <Clock size={14} color={isTimeCritical ? Colors.status.error : Colors.brand.blue} />
          <Text style={[styles.timerText, isTimeCritical && styles.timerTextCritical]}>
            {formatTimer(timeLeft)}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Marks Pills */}
        <View style={styles.marksRow}>
          <View style={styles.markBadgeGreen}>
            <Text style={styles.markBadgeTextGreen}>+{currentQ.marks || 4} Marks</Text>
          </View>
          {currentQ.negativeMarks ? (
            <View style={styles.markBadgeRed}>
              <Text style={styles.markBadgeTextRed}>-{currentQ.negativeMarks} Negative</Text>
            </View>
          ) : null}
        </View>

        {/* Question Statement */}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{currentQ.questionText}</Text>
          {currentQ.imageUrl ? (
            <Image
              source={{ uri: currentQ.imageUrl }}
              style={styles.questionImage}
              resizeMode="contain"
            />
          ) : null}
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {optionsList.map((opt, oIdx) => {
            const optText = typeof opt === 'string' ? opt : opt.text || '';
            const optImg = typeof opt === 'object' ? opt.imageUrl : null;
            const isSelected = selectedAnswer === optText;
            const letter = String.fromCharCode(65 + oIdx);

            return (
              <TouchableOpacity
                key={oIdx}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => handleSelectOption(currentQ.id, optText)}
                activeOpacity={0.8}
              >
                <View style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                  <Text style={[styles.optionLetterText, isSelected && styles.optionLetterTextSelected]}>
                    {letter}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {optText}
                  </Text>
                  {optImg ? (
                    <Image source={{ uri: optImg }} style={styles.optionImage} resizeMode="contain" />
                  ) : null}
                </View>

                {isSelected ? (
                  <CheckCircle2 size={18} color={Colors.brand.blue} style={{ marginLeft: 8 }} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
          onPress={() => setCurrentIndex((p) => Math.max(0, p - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={18} color={currentIndex === 0 ? Colors.text.muted : Colors.text.primary} />
          <Text style={[styles.navButtonText, currentIndex === 0 && styles.navButtonTextDisabled]}>
            Prev
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitHeaderButton} onPress={confirmSubmit}>
          <Text style={styles.submitHeaderButtonText}>
            {submitting ? 'Submitting...' : 'Submit'}
          </Text>
        </TouchableOpacity>

        {currentIndex < questions.length - 1 ? (
          <TouchableOpacity
            style={[styles.navButton, styles.nextButton]}
            onPress={() => setCurrentIndex((p) => Math.min(questions.length - 1, p + 1))}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <ChevronRight size={18} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, styles.finishButton]}
            onPress={confirmSubmit}
          >
            <Text style={styles.nextButtonText}>Finish</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  titleColumn: {
    flex: 1,
    marginRight: 12,
  },
  examTitleHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  qCountHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  timerCritical: {
    backgroundColor: Colors.status.errorLight,
  },
  timerText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  timerTextCritical: {
    color: Colors.status.error,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  marksRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  markBadgeGreen: {
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markBadgeTextGreen: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.status.success,
  },
  markBadgeRed: {
    backgroundColor: Colors.status.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markBadgeTextRed: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.status.error,
  },
  questionCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 16,
    ...Shadows.sm,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 22,
  },
  questionImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginTop: 12,
  },
  optionsContainer: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border.default,
  },
  optionCardSelected: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.brand.blueLight,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionLetterSelected: {
    backgroundColor: Colors.brand.blue,
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  optionLetterTextSelected: {
    color: '#FFFFFF',
  },
  optionText: {
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: Colors.brand.blueDark,
  },
  optionImage: {
    width: '100%',
    height: 100,
    marginTop: 8,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: Colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.surface.subtle,
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  navButtonTextDisabled: {
    color: Colors.text.muted,
  },
  nextButton: {
    backgroundColor: Colors.brand.blue,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  finishButton: {
    backgroundColor: Colors.status.success,
  },
  submitHeaderButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.brand.redLight,
  },
  submitHeaderButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.red,
  },
});
