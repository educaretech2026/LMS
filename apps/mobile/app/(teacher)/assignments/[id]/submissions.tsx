import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { fetchApi } from '../../../../lib/api';
import { Colors, Shadows } from '../../../../lib/theme';
import { Users, Award, CheckCircle2, AlertCircle, FileText } from 'lucide-react-native';

export default function SubmissionsReviewScreen() {
  const { id } = useLocalSearchParams();

  const [assignment, setAssignment] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  const loadData = async () => {
    try {
      const data = await fetchApi<any>(`/assignments/${id}`);
      setAssignment(data);
      setSubmissions(data.submissions || []);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const handleSaveGrade = async (submissionId: string) => {
    if (!gradeInput.trim()) {
      Alert.alert('Incomplete', 'Please enter a numerical mark.');
      return;
    }

    setSavingGrade(true);
    try {
      await fetchApi(`/assignments/submissions/${submissionId}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({
          grade: Number(gradeInput),
          feedback: feedbackInput.trim() || undefined,
        }),
      });

      Alert.alert('Success', 'Submission graded successfully!');
      setGradingId(null);
      setGradeInput('');
      setFeedbackInput('');
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save grade');
    } finally {
      setSavingGrade(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Assignment Summary Banner */}
      <View style={styles.headerCard}>
        <Text style={styles.assignmentTitle}>{assignment?.title}</Text>
        <Text style={styles.metaText}>
          Batch: {assignment?.batch?.name || 'Class'} • {submissions.length} Submissions Received
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Student Submissions</Text>

      {submissions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Users size={32} color={Colors.text.muted} />
          <Text style={styles.emptyText}>No students have submitted this homework yet.</Text>
        </View>
      ) : (
        submissions.map((sub) => {
          const studentName = sub.student?.user
            ? `${sub.student.user.firstName || ''} ${sub.student.user.lastName || ''}`.trim()
            : 'Enrolled Student';
          const isGraded = sub.status === 'GRADED';
          const isGradingThis = gradingId === sub.id;

          return (
            <View key={sub.id} style={styles.subCard}>
              <View style={styles.subCardHeader}>
                <View>
                  <Text style={styles.studentName}>{studentName}</Text>
                  <Text style={styles.subDate}>
                    Turned in:{' '}
                    {new Date(sub.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {isGraded ? (
                  <View style={styles.gradePill}>
                    <Award size={13} color={Colors.status.success} />
                    <Text style={styles.gradePillText}>{sub.grade} Marks</Text>
                  </View>
                ) : (
                  <View style={styles.pendingPill}>
                    <Text style={styles.pendingPillText}>Needs Grading</Text>
                  </View>
                )}
              </View>

              {/* Student Notes */}
              {sub.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Student Note:</Text>
                  <Text style={styles.notesText}>{sub.notes}</Text>
                </View>
              ) : null}

              {/* Attachments */}
              {sub.attachments && Array.isArray(sub.attachments) && sub.attachments.length > 0 ? (
                <View style={styles.attachRow}>
                  {sub.attachments.map((att: string, aIdx: number) => (
                    <Image key={aIdx} source={{ uri: att }} style={styles.subImg} resizeMode="contain" />
                  ))}
                </View>
              ) : null}

              {/* Teacher Feedback if already graded */}
              {isGraded && sub.feedback ? (
                <Text style={styles.feedbackGiven}>Feedback: "{sub.feedback}"</Text>
              ) : null}

              {/* Inline Grading Form */}
              {isGradingThis ? (
                <View style={styles.gradingForm}>
                  <Text style={styles.gradeFieldLabel}>Enter Marks Awarded</Text>
                  <TextInput
                    style={styles.gradeInput}
                    placeholder="e.g. 18"
                    placeholderTextColor={Colors.text.muted}
                    keyboardType="numeric"
                    value={gradeInput}
                    onChangeText={setGradeInput}
                  />

                  <Text style={styles.gradeFieldLabel}>Teacher Feedback</Text>
                  <TextInput
                    style={styles.feedbackInput}
                    placeholder="Constructive review for student..."
                    placeholderTextColor={Colors.text.muted}
                    value={feedbackInput}
                    onChangeText={setFeedbackInput}
                  />

                  <View style={styles.gradeActions}>
                    <TouchableOpacity
                      style={styles.cancelGradeBtn}
                      onPress={() => setGradingId(null)}
                    >
                      <Text style={styles.cancelGradeText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.saveGradeBtn}
                      onPress={() => handleSaveGrade(sub.id)}
                      disabled={savingGrade}
                    >
                      {savingGrade ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.saveGradeText}>Confirm Grade</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.gradeActionBtn}
                  onPress={() => {
                    setGradingId(sub.id);
                    setGradeInput(sub.grade ? String(sub.grade) : '');
                    setFeedbackInput(sub.feedback || '');
                  }}
                  activeOpacity={0.8}
                >
                  <Award size={14} color={Colors.brand.blue} />
                  <Text style={styles.gradeActionBtnText}>
                    {isGraded ? 'Edit Grade' : 'Grade Submission'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
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
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 20,
    ...Shadows.sm,
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  metaText: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  emptyText: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 8,
  },
  subCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 12,
    ...Shadows.sm,
  },
  subCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subDate: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 2,
  },
  gradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  gradePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.status.success,
  },
  pendingPill: {
    backgroundColor: Colors.status.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.status.warning,
  },
  notesBox: {
    backgroundColor: Colors.surface.subtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text.primary,
    lineHeight: 16,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  subImg: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  feedbackGiven: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.text.secondary,
    marginBottom: 10,
  },
  gradeActionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.blueLight,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
    marginTop: 4,
  },
  gradeActionBtnText: {
    color: Colors.brand.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  gradingForm: {
    backgroundColor: Colors.surface.subtle,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  gradeFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  gradeInput: {
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
    fontSize: 13,
    color: Colors.text.primary,
    marginBottom: 10,
  },
  feedbackInput: {
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 8,
    height: 40,
    paddingHorizontal: 10,
    fontSize: 13,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  gradeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelGradeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.surface.card,
  },
  cancelGradeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  saveGradeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: Colors.brand.blue,
  },
  saveGradeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
