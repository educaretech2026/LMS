import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import { CalendarCheck } from 'lucide-react-native';

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
  const lateCount = records.filter((r) => r.status === 'LATE').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;
  const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.brand.blue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>RECORD</Text>
        <Text style={styles.title}>Attendance</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Metric KPI Card */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiTop}>
            <View>
              <Text style={styles.kpiValue}>{percentage}%</Text>
              <Text style={styles.kpiLabel}>Overall Presence</Text>
            </View>
            <View style={styles.kpiBadge}>
              <Text style={styles.kpiBadgeText}>
                {percentage >= 75 ? 'Satisfactory' : 'Needs Attention'}
              </Text>
            </View>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.brand.emerald }]}>{presentCount}</Text>
              <Text style={styles.metricLbl}>Present</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.brand.amber }]}>{lateCount}</Text>
              <Text style={styles.metricLbl}>Late</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricVal, { color: Colors.brand.red }]}>{absentCount}</Text>
              <Text style={styles.metricLbl}>Absent</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}>
              <Text style={styles.metricVal}>{totalClasses}</Text>
              <Text style={styles.metricLbl}>Total</Text>
            </View>
          </View>
        </View>

        {/* History Log */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>SESSION HISTORY</Text>
          <Text style={styles.sectionCount}>{records.length} Recorded</Text>
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarCheck size={32} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No attendance records found</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {records.map((r, idx) => {
              const isPresent = r.status === 'PRESENT';
              const isLate = r.status === 'LATE';

              return (
                <View
                  key={idx}
                  style={[
                    styles.recordRow,
                    idx < records.length - 1 && styles.recordRowBorder,
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordDate}>
                      {new Date(r.date).toLocaleDateString('en-IN', {
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
                          ? { color: Colors.brand.emerald }
                          : isLate
                          ? { color: Colors.brand.amber }
                          : { color: Colors.brand.red },
                      ]}
                    >
                      {r.status}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 14,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  kpiCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: 16,
    marginBottom: 20,
    ...Shadows.xs,
  },
  kpiTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  kpiValue: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.brand.blue,
    letterSpacing: -1,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  kpiBadge: {
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  kpiBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  metricGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.subtle,
    borderRadius: Radii.md,
    paddingVertical: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  metricLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border.default,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 10,
    ...Shadows.xs,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  listContainer: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  recordRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  recordDate: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  recordBatch: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusPresent: {
    backgroundColor: Colors.brand.emeraldLight,
  },
  statusLate: {
    backgroundColor: Colors.brand.amberLight,
  },
  statusAbsent: {
    backgroundColor: Colors.brand.redLight,
  },
});
