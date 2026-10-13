import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import { CalendarCheck, CheckCircle2, XCircle, Clock } from 'lucide-react-native';

export default function StudentAttendanceScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchApi<any[]>('/attendance/student');
        setRecords(data || []);
      } catch (e) {
        console.error('Failed to load attendance', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalClasses = records.length;
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Attendance KPI Card */}
      <View style={styles.kpiCard}>
        <View style={styles.kpiCircle}>
          <Text style={styles.kpiPct}>{percentage}%</Text>
        </View>
        <Text style={styles.kpiTitle}>Overall Attendance Rate</Text>
        <Text style={styles.kpiSubtitle}>
          {presentCount} of {totalClasses} classes attended
        </Text>
      </View>

      {/* History Log */}
      <Text style={styles.sectionTitle}>Attendance History</Text>

      {records.length === 0 ? (
        <View style={styles.emptyCard}>
          <CalendarCheck size={36} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No attendance records recorded</Text>
        </View>
      ) : (
        records.map((r, idx) => {
          const isPresent = r.status === 'PRESENT';
          const isLate = r.status === 'LATE';

          return (
            <View key={idx} style={styles.recordCard}>
              <View>
                <Text style={styles.recordDate}>
                  {new Date(r.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.recordBatch}>{r.batch?.name || 'Class Session'}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  isPresent
                    ? styles.statusPresent
                    : isLate
                    ? styles.statusLate
                    : styles.statusAbsent,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isPresent
                      ? { color: Colors.status.success }
                      : isLate
                      ? { color: Colors.status.warning }
                      : { color: Colors.status.error },
                  ]}
                >
                  {r.status}
                </Text>
              </View>
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
  kpiCard: {
    backgroundColor: Colors.brand.blue,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    ...Shadows.md,
  },
  kpiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  kpiPct: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  kpiTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  kpiSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
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
  emptyTitle: {
    fontSize: 13,
    color: Colors.text.muted,
    marginTop: 8,
  },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 8,
    ...Shadows.sm,
  },
  recordDate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  recordBatch: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPresent: {
    backgroundColor: Colors.status.successLight,
  },
  statusLate: {
    backgroundColor: Colors.status.warningLight,
  },
  statusAbsent: {
    backgroundColor: Colors.status.errorLight,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
