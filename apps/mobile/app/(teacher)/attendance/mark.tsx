import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import { Check, CheckCheck, Save } from 'lucide-react-native';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export default function MarkAttendanceScreen() {
  const { batchId, batchName } = useLocalSearchParams();
  const router = useRouter();

  const [students, setStudents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadBatchStudents() {
      try {
        const data = await fetchApi<any[]>(`/students?batchId=${batchId}`);
        const list = data || [];
        setStudents(list);

        // Default all to PRESENT
        const initialMap: Record<string, AttendanceStatus> = {};
        list.forEach((s) => {
          const sid = s.studentProfile?.id || s.id;
          initialMap[sid] = 'PRESENT';
        });
        setStatuses(initialMap);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load student roster');
      } finally {
        setLoading(false);
      }
    }
    loadBatchStudents();
  }, [batchId]);

  const setStudentStatus = (studentId: string, status: AttendanceStatus) => {
    setStatuses((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const markAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      const sid = s.studentProfile?.id || s.id;
      updated[sid] = 'PRESENT';
    });
    setStatuses(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const records = Object.entries(statuses).map(([studentId, status]) => ({
        studentId,
        status,
      }));

      await fetchApi('/attendance/batch', {
        method: 'POST',
        body: JSON.stringify({
          batchId,
          date: new Date().toISOString(),
          records,
        }),
      });

      Alert.alert('Success', 'Attendance marked successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
        <Text style={styles.loadingText}>Loading batch roster...</Text>
      </View>
    );
  }

  const presentCount = Object.values(statuses).filter((s) => s === 'PRESENT').length;
  const absentCount = Object.values(statuses).filter((s) => s === 'ABSENT').length;

  return (
    <View style={styles.container}>
      {/* Roster Summary Header */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.batchTitle}>{batchName || 'Batch Roll Call'}</Text>
          <Text style={styles.countText}>
            {presentCount} Present • {absentCount} Absent • {students.length} Total
          </Text>
        </View>

        <TouchableOpacity style={styles.allPresentBtn} onPress={markAllPresent}>
          <CheckCheck size={16} color={Colors.status.success} />
          <Text style={styles.allPresentBtnText}>All Present</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {students.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No students enrolled in this batch.</Text>
          </View>
        ) : (
          students.map((student, idx) => {
            const sid = student.studentProfile?.id || student.id;
            const currentStatus = statuses[sid] || 'PRESENT';
            const sName =
              student.user?.firstName
                ? `${student.user.firstName} ${student.user.lastName || ''}`.trim()
                : student.name || `Student ${idx + 1}`;

            return (
              <View key={sid} style={styles.studentRow}>
                <View style={styles.nameBlock}>
                  <Text style={styles.rollNo}>#{idx + 1}</Text>
                  <Text style={styles.studentName} numberOfLines={1}>
                    {sName}
                  </Text>
                </View>

                {/* 1-Tap Toggle Group (P, A, L, E) */}
                <View style={styles.toggleGroup}>
                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      currentStatus === 'PRESENT' && styles.toggleBtnPresent,
                    ]}
                    onPress={() => setStudentStatus(sid, 'PRESENT')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        currentStatus === 'PRESENT' && styles.toggleTextActive,
                      ]}
                    >
                      P
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      currentStatus === 'ABSENT' && styles.toggleBtnAbsent,
                    ]}
                    onPress={() => setStudentStatus(sid, 'ABSENT')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        currentStatus === 'ABSENT' && styles.toggleTextActive,
                      ]}
                    >
                      A
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      currentStatus === 'LATE' && styles.toggleBtnLate,
                    ]}
                    onPress={() => setStudentStatus(sid, 'LATE')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        currentStatus === 'LATE' && styles.toggleTextActive,
                      ]}
                    >
                      L
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toggleBtn,
                      currentStatus === 'EXCUSED' && styles.toggleBtnExcused,
                    ]}
                    onPress={() => setStudentStatus(sid, 'EXCUSED')}
                  >
                    <Text
                      style={[
                        styles.toggleText,
                        currentStatus === 'EXCUSED' && styles.toggleTextActive,
                      ]}
                    >
                      E
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Submit Sticky Footer */}
      <View style={styles.footerBar}>
        <TouchableOpacity
          style={[styles.saveBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Save size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Submit Roll Call</Text>
            </>
          )}
        </TouchableOpacity>
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
  },
  loadingText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  batchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    marginTop: 2,
  },
  allPresentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  allPresentBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.status.success,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 8,
    ...Shadows.sm,
  },
  nameBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 10,
  },
  rollNo: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    minWidth: 24,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  toggleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnPresent: {
    backgroundColor: Colors.status.success,
  },
  toggleBtnAbsent: {
    backgroundColor: Colors.status.error,
  },
  toggleBtnLate: {
    backgroundColor: Colors.status.warning,
  },
  toggleBtnExcused: {
    backgroundColor: Colors.brand.blue,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text.muted,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: Colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  saveBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    ...Shadows.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
