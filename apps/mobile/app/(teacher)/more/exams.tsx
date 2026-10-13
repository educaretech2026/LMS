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
  Alert,
  Modal,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import {
  GraduationCap,
  Plus,
  Clock,
  Award,
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  Trash2,
  Eye,
  X,
  FileQuestion,
  Sparkles,
} from 'lucide-react-native';

export default function TeacherExamManager() {
  const [activeTab, setActiveTab] = useState<'LIST' | 'CREATE'>('LIST');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');

  // Results Modal State
  const [selectedExamForResults, setSelectedExamForResults] = useState<any | null>(null);
  const [resultsList, setResultsList] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Create Exam Form State
  const [examTitle, setExamTitle] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [totalMarks, setTotalMarks] = useState('100');
  const [passingPercentage, setPassingPercentage] = useState('40');
  const [creating, setCreating] = useState(false);

  // MCQ Questions Builder
  const [mcqQuestions, setMcqQuestions] = useState<
    Array<{ question: string; options: string[]; correctOption: number; marks: number }>
  >([]);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOptionIdx, setCorrectOptionIdx] = useState(0);

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

  const handleOpenResults = async (exam: any) => {
    setSelectedExamForResults(exam);
    setResultsLoading(true);
    try {
      const results = await fetchApi<any[]>(`/exams/${exam.id}/results`);
      setResultsList(results || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load exam results');
    } finally {
      setResultsLoading(false);
    }
  };

  const handleDeleteExam = (examId: string) => {
    Alert.alert('Delete Exam', 'Are you sure you want to permanently delete this exam?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetchApi(`/exams/${examId}`, { method: 'DELETE' });
            setExams((prev) => prev.filter((e) => e.id !== examId));
            Alert.alert('Success', 'Exam has been deleted.');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete exam');
          }
        },
      },
    ]);
  };

  const handleAddQuestion = () => {
    if (!newQuestionText.trim()) {
      Alert.alert('Validation Error', 'Please enter a question prompt.');
      return;
    }
    if (!optA.trim() || !optB.trim()) {
      Alert.alert('Validation Error', 'Please provide at least Option A and Option B.');
      return;
    }

    const options = [optA.trim(), optB.trim(), optC.trim(), optD.trim()].filter(Boolean);

    setMcqQuestions((prev) => [
      ...prev,
      {
        question: newQuestionText.trim(),
        options,
        correctOption: correctOptionIdx,
        marks: 1,
      },
    ]);

    setNewQuestionText('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setCorrectOptionIdx(0);
  };

  const handleCreateExam = async () => {
    if (!examTitle.trim()) {
      Alert.alert('Validation Error', 'Exam title is required.');
      return;
    }

    setCreating(true);
    try {
      const payload: any = {
        title: examTitle.trim(),
        subject: subjectName.trim() || 'General Assessment',
        durationMinutes: parseInt(durationMinutes, 10) || 60,
        totalMarks: parseFloat(totalMarks) || 100,
        passingPercentage: parseFloat(passingPercentage) || 40,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        mcqQuestions: mcqQuestions.map((q) => ({
          question: q.question,
          options: q.options,
          correctAnswer: q.options[q.correctOption] || q.options[0],
          marks: q.marks,
        })),
      };

      await fetchApi('/exams', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      Alert.alert('Success', 'Exam published successfully!');
      setExamTitle('');
      setSubjectName('');
      setMcqQuestions([]);
      setActiveTab('LIST');
      loadExams();
    } catch (err: any) {
      Alert.alert('Creation Failed', err.message || 'Failed to create exam');
    } finally {
      setCreating(false);
    }
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
      {/* Top Segmented Navigation */}
      <View style={styles.topTabBar}>
        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'LIST' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('LIST')}
        >
          <GraduationCap size={16} color={activeTab === 'LIST' ? Colors.brand.blue : Colors.text.muted} />
          <Text style={[styles.topTabText, activeTab === 'LIST' && styles.topTabTextActive]}>
            All Assessments ({exams.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topTabBtn, activeTab === 'CREATE' && styles.topTabBtnActive]}
          onPress={() => setActiveTab('CREATE')}
        >
          <Plus size={16} color={activeTab === 'CREATE' ? Colors.brand.blue : Colors.text.muted} />
          <Text style={[styles.topTabText, activeTab === 'CREATE' && styles.topTabTextActive]}>
            Create Assessment
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'LIST' ? (
        <>
          {/* Search & Filter Bar */}
          <View style={styles.searchBar}>
            <Search size={18} color={Colors.text.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search assessments..."
              placeholderTextColor={Colors.text.muted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {(['ALL', 'ACTIVE', 'UPCOMING', 'COMPLETED'] as const).map((tabKey) => (
              <TouchableOpacity
                key={tabKey}
                style={[styles.filterChip, filter === tabKey && styles.filterChipActive]}
                onPress={() => setFilter(tabKey)}
              >
                <Text style={[styles.filterChipText, filter === tabKey && styles.filterChipTextActive]}>
                  {tabKey === 'ALL'
                    ? 'All'
                    : tabKey === 'ACTIVE'
                    ? 'Live'
                    : tabKey === 'UPCOMING'
                    ? 'Upcoming'
                    : 'Ended'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Exams List */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.brand.blue} />
                <Text style={styles.loadingText}>Loading exams...</Text>
              </View>
            ) : filteredExams.length === 0 ? (
              <View style={styles.emptyContainer}>
                <GraduationCap size={48} color={Colors.text.muted} />
                <Text style={styles.emptyTitle}>No Assessments Found</Text>
                <Text style={styles.emptySubtitle}>Tap 'Create Assessment' above to publish your first exam.</Text>
              </View>
            ) : (
              filteredExams.map((exam) => {
                const status = getExamStatus(exam);
                const questionCount = exam.mcqQuestions?.length || exam.questionCount || 0;
                const submissionsCount = exam.results?.length || exam._count?.results || 0;
                const subjectNameText = exam.subject?.name || exam.subject || 'Academics';

                return (
                  <View key={exam.id} style={styles.examCard}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.subjectTag}>{subjectNameText}</Text>
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
                        <Text style={styles.metricLabel}>
                          {exam.totalMarks || 100} pts ({exam.passingPercentage || 40}% pass)
                        </Text>
                      </View>
                      <View style={styles.metricItem}>
                        <FileQuestion size={13} color={Colors.text.muted} />
                        <Text style={styles.metricLabel}>{questionCount} MCQs</Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Users size={13} color={Colors.brand.blue} />
                        <Text style={[styles.metricLabel, { color: Colors.brand.blue, fontWeight: '700' }]}>
                          {submissionsCount} Attempts
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons Row */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.resultsButton}
                        onPress={() => handleOpenResults(exam)}
                        activeOpacity={0.8}
                      >
                        <Eye size={14} color={Colors.brand.blue} />
                        <Text style={styles.resultsButtonText}>Student Scorecard ({submissionsCount})</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => handleDeleteExam(exam.id)}
                        activeOpacity={0.8}
                      >
                        <Trash2 size={14} color={Colors.status.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      ) : (
        /* Create Exam Form */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formContainer}>
          <View style={styles.formSectionHeader}>
            <Sparkles size={18} color={Colors.brand.purple} />
            <Text style={styles.formSectionTitle}>Assessment Details</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Exam Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Physics Midterm Unit 3 Test"
              placeholderTextColor={Colors.text.muted}
              value={examTitle}
              onChangeText={setExamTitle}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Subject / Topic *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Physics / Thermodynamics"
              placeholderTextColor={Colors.text.muted}
              value={subjectName}
              onChangeText={setSubjectName}
            />
          </View>

          <View style={styles.rowInputs}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Duration (mins)</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={durationMinutes}
                onChangeText={setDurationMinutes}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Total Marks</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={totalMarks}
                onChangeText={setTotalMarks}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Pass %</Text>
              <TextInput
                style={styles.textInput}
                keyboardType="numeric"
                value={passingPercentage}
                onChangeText={setPassingPercentage}
              />
            </View>
          </View>

          {/* MCQ Question Builder */}
          <View style={styles.questionBuilderCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.builderTitle}>Add MCQ Questions ({mcqQuestions.length} added)</Text>
            </View>

            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder="Question Prompt..."
              placeholderTextColor={Colors.text.muted}
              value={newQuestionText}
              onChangeText={setNewQuestionText}
            />

            <View style={{ marginTop: 10, gap: 6 }}>
              {[
                { label: 'Option A', val: optA, set: setOptA, idx: 0 },
                { label: 'Option B', val: optB, set: setOptB, idx: 1 },
                { label: 'Option C', val: optC, set: setOptC, idx: 2 },
                { label: 'Option D', val: optD, set: setOptD, idx: 3 },
              ].map((item) => (
                <View key={item.idx} style={styles.optionInputRow}>
                  <TouchableOpacity
                    style={[
                      styles.correctOptionRadio,
                      correctOptionIdx === item.idx && styles.correctOptionRadioActive,
                    ]}
                    onPress={() => setCorrectOptionIdx(item.idx)}
                  >
                    <Text
                      style={[
                        styles.radioChar,
                        correctOptionIdx === item.idx && { color: '#FFFFFF', fontWeight: '800' },
                      ]}
                    >
                      {String.fromCharCode(65 + item.idx)}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.textInput, { flex: 1, paddingVertical: 8 }]}
                    placeholder={item.label}
                    placeholderTextColor={Colors.text.muted}
                    value={item.val}
                    onChangeText={item.set}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.addQuestionBtn} onPress={handleAddQuestion}>
              <Plus size={14} color={Colors.brand.blue} />
              <Text style={styles.addQuestionBtnText}>Add Question to Paper</Text>
            </TouchableOpacity>
          </View>

          {/* Added Questions Preview */}
          {mcqQuestions.map((q, idx) => (
            <View key={idx} style={styles.addedQuestionCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.addedQuestionIndex}>Q{idx + 1}: {q.question}</Text>
                <TouchableOpacity
                  onPress={() => setMcqQuestions((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <X size={14} color={Colors.status.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.addedQuestionCorrect}>
                Correct: {q.options[q.correctOption]}
              </Text>
            </View>
          ))}

          {/* Submit Exam Button */}
          <TouchableOpacity
            style={[styles.submitExamBtn, creating && styles.submitExamBtnDisabled]}
            onPress={handleCreateExam}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <CheckCircle2 size={18} color="#FFFFFF" />
                <Text style={styles.submitExamBtnText}>Publish Assessment</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Student Results Modal */}
      <Modal visible={!!selectedExamForResults} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedExamForResults?.title}</Text>
                <Text style={styles.modalSubtitle}>Student Submission Scorecard</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedExamForResults(null)} style={{ padding: 4 }}>
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {resultsLoading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={Colors.brand.blue} />
                <Text style={{ marginTop: 8, color: Colors.text.muted }}>Loading scores...</Text>
              </View>
            ) : resultsList.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Users size={40} color={Colors.text.muted} />
                <Text style={{ marginTop: 8, fontWeight: '700', color: Colors.text.primary }}>
                  No Submissions Yet
                </Text>
                <Text style={{ fontSize: 12, color: Colors.text.muted, textAlign: 'center', marginTop: 4 }}>
                  Students have not submitted this examination paper yet.
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8, padding: 12 }}>
                {resultsList.map((res) => {
                  const sName =
                    `${res.student?.user?.firstName || ''} ${res.student?.user?.lastName || ''}`.trim() ||
                    'Student';
                  const score = res.score ?? res.totalMarks ?? 0;
                  const maxMarks = selectedExamForResults?.totalMarks || 100;
                  const pct = Math.round((score / maxMarks) * 100);
                  const isPass = pct >= (selectedExamForResults?.passingPercentage || 40);

                  return (
                    <View key={res.id} style={styles.resultRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultStudentName}>{sName}</Text>
                        <Text style={styles.resultDate}>
                          {new Date(res.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.resultScoreText}>
                          {score} / {maxMarks} ({pct}%)
                        </Text>
                        <View
                          style={[
                            styles.passFailBadge,
                            { backgroundColor: isPass ? '#DCFCE7' : '#FEE2E2' },
                          ]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '800', color: isPass ? '#16A34A' : '#DC2626' }}>
                            {isPass ? 'PASSED' : 'FAILED'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    gap: 8,
  },
  topTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  topTabBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  topTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  topTabTextActive: {
    color: Colors.brand.blue,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  filterChipActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterChipTextActive: {
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
    marginBottom: 10,
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  resultsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    borderRadius: 8,
  },
  resultsButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  formContainer: {
    padding: 16,
    gap: 14,
  },
  formSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  textInput: {
    backgroundColor: Colors.surface.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  questionBuilderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 8,
  },
  builderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  optionInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  correctOptionRadio: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  correctOptionRadioActive: {
    backgroundColor: Colors.brand.blue,
  },
  radioChar: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  addQuestionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  addQuestionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  addedQuestionCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 4,
  },
  addedQuestionIndex: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  addedQuestionCorrect: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
  },
  submitExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blue,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 12,
    ...Shadows.glowBlue,
  },
  submitExamBtnDisabled: {
    opacity: 0.6,
  },
  submitExamBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  resultStudentName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  resultDate: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  resultScoreText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.brand.blue,
  },
  passFailBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
});
