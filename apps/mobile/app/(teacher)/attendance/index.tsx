import React, { useState, useEffect } from 'react';
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
import { CalendarCheck, Users, ChevronRight, BookOpen } from 'lucide-react-native';
import { AcademicHierarchyPicker, AcademicHierarchyValue } from '../../../components/AcademicHierarchyPicker';

export default function TeacherAttendanceList() {
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [hierarchy, setHierarchy] = useState<AcademicHierarchyValue>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [batchesData, subjectsData] = await Promise.all([
        fetchApi<any[]>('/setup/batches'),
        fetchApi<any[]>('/setup/subjects').catch(() => []),
      ]);
      setBatches(batchesData || []);
      setSubjects(subjectsData || []);
    } catch (e) {
      console.error('Failed to load attendance setup data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Filter batches by selected hierarchy
  const filteredBatches = batches.filter((b) => {
    if (hierarchy.centreId && b.centreId && b.centreId !== hierarchy.centreId) return false;
    if (hierarchy.boardId && b.boardId && b.boardId !== hierarchy.boardId) return false;
    if (hierarchy.standardId && b.standardId && b.standardId !== hierarchy.standardId) return false;
    return true;
  });

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>DAILY ROLL CALL</Text>
            <Text style={styles.title}>Attendance</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>{todayStr}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Academic Hierarchy Selector */}
        <AcademicHierarchyPicker
          label="Filter by Academic Level"
          showBatch={false}
          showSubject={false}
          value={hierarchy}
          onChange={setHierarchy}
        />

        {/* Subject Roll Call Selector */}
        <View style={styles.subjectSection}>
          <View style={styles.subjectSectionHeader}>
            <BookOpen size={13} color={Colors.brand.blue} />
            <Text style={styles.subjectSectionLabel}>SELECT SUBJECT OR GENERAL</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectChipsRow}>
            <TouchableOpacity
              style={[styles.subjectChip, !selectedSubjectId && styles.subjectChipActive]}
              onPress={() => setSelectedSubjectId(null)}
            >
              <Text style={[styles.subjectChipText, !selectedSubjectId && styles.subjectChipTextActive]}>
                General Roll Call
              </Text>
            </TouchableOpacity>
            {subjects.map((sub, sIdx) => {
              const isSel = selectedSubjectId === sub.id;
              return (
                <TouchableOpacity
                  key={sub.id || `sub-${sIdx}`}
                  style={[styles.subjectChip, isSel && styles.subjectChipActive]}
                  onPress={() => setSelectedSubjectId(sub.id)}
                >
                  <Text style={[styles.subjectChipText, isSel && styles.subjectChipTextActive]}>
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {selectedSubject ? `${selectedSubject.name.toUpperCase()} BATCHES` : 'ALL BATCHES'}
          </Text>
          <Text style={styles.sectionCount}>{filteredBatches.length} Available</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : filteredBatches.length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarCheck size={32} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No matching batches for this academic level</Text>
          </View>
        ) : (
          <View style={styles.cardContainer}>
            {filteredBatches.map((batch, idx) => (
              <TouchableOpacity
                key={batch.id || `batch-${idx}`}
                style={[
                  styles.cardRow,
                  idx < filteredBatches.length - 1 && styles.cardRowBorder,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/(teacher)/attendance/mark',
                    params: {
                      batchId: batch.id,
                      batchName: batch.name,
                      subjectId: selectedSubjectId || '',
                      subjectName: selectedSubject?.name || '',
                      boardName: typeof batch.board === 'object' ? batch.board?.name : batch.board || '',
                      standardName: typeof batch.standard === 'object' ? batch.standard?.name : batch.standard || '',
                    },
                  } as any)
                }
                activeOpacity={0.75}
              >
                <View style={styles.iconCircle}>
                  <Text style={styles.iconInitial}>
                    {(batch.name || 'B').charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.batchName} numberOfLines={1}>
                    {batch.name}
                  </Text>
                    <View style={styles.tagRow}>
                      {batch.board ? (
                        <Text style={styles.tag}>
                          {typeof batch.board === 'object' ? batch.board?.name : batch.board}
                        </Text>
                      ) : null}
                      {batch.classs ? (
                        <Text style={styles.tag}>
                          Class {typeof batch.classs === 'object' ? batch.classs?.name : batch.classs}
                        </Text>
                      ) : null}
                      <Text style={styles.studentCount}>
                      <Users size={10} color={Colors.text.muted} /> {batch.studentCount || 0}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionChip}>
                  <Text style={styles.takeText}>Roll Call</Text>
                  <ChevronRight size={12} color={Colors.brand.blue} />
                </View>
              </TouchableOpacity>
            ))}
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
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 14,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  dateBadge: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  dateBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
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
    marginTop: 20,
    gap: 10,
    ...Shadows.xs,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  cardContainer: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  cardRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    backgroundColor: Colors.brand.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconInitial: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.brand.blue,
  },
  batchName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tag: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.secondary,
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  studentCount: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.sm,
  },
  takeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  subjectSection: {
    marginBottom: 16,
  },
  subjectSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  subjectSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 0.5,
  },
  subjectChipsRow: {
    gap: 8,
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  subjectChipActive: {
    backgroundColor: 'rgba(1,98,177,0.1)',
    borderColor: Colors.brand.blue,
  },
  subjectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  subjectChipTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
});
