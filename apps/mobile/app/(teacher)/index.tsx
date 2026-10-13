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
import { useAuth } from '../../hooks/useAuth';
import { fetchApi } from '../../lib/api';
import { Colors, Shadows } from '../../lib/theme';
import {
  Bell,
  CalendarCheck,
  ClipboardList,
  MessagesSquare,
  Users,
  ChevronRight,
  Sparkles,
  BookOpen,
  GraduationCap,
  Video,
  AlertCircle,
  Plus,
} from 'lucide-react-native';

export default function TeacherHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [batches, setBatches] = useState<any[]>([]);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [batchesData, doubtsData, assignmentsData, examsData, liveData] = await Promise.all([
        fetchApi<any[]>('/setup/batches').catch(() => []),
        fetchApi<any[]>('/doubts').catch(() => []),
        fetchApi<any[]>('/assignments').catch(() => []),
        fetchApi<any[]>('/exams').catch(() => []),
        fetchApi<any[]>('/live-class').catch(() => []),
      ]);
      setBatches(batchesData || []);
      setDoubts(doubtsData || []);
      setAssignments(assignmentsData || []);
      setExams(examsData || []);
      setLiveClasses(liveData || []);
    } catch (e) {
      console.error('Failed to load teacher dashboard', e);
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

  const pendingDoubts = doubts.filter((d) => d.status === 'OPEN' || d.status === 'IN_PROGRESS');
  const urgentDoubts = pendingDoubts.filter((d) => d.priority === 'URGENT');

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Educare Faculty';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Faculty Elevated Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || 'FC'}</Text>
          </View>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>Faculty Console</Text>
              <Sparkles size={12} color={Colors.brand.blue} />
            </View>
            <Text style={styles.name}>{fullName}</Text>
            {user?.centreName ? (
              <Text style={styles.centreName}>{user.centreName}</Text>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <Bell size={20} color={Colors.text.primary} />
          {pendingDoubts.length > 0 && <View style={styles.notificationDot} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {/* Urgent Doubt Priority Alert */}
        {urgentDoubts.length > 0 && (
          <TouchableOpacity
            style={styles.urgentBanner}
            onPress={() => router.push('/(teacher)/doubts' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.urgentIconBox}>
              <AlertCircle size={20} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.urgentTitle}>{urgentDoubts.length} Urgent Doubts Pending</Text>
              <Text style={styles.urgentSub}>Students waiting for rapid academic clearance</Text>
            </View>
            <ChevronRight size={16} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Faculty Metric Stats Grid */}
        <View style={styles.statGrid}>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.brand.blue, borderLeftWidth: 3 }]}
            onPress={() => router.push('/(teacher)/doubts' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
              <MessagesSquare size={16} color={Colors.brand.blue} />
            </View>
            <Text style={styles.statNumber}>{pendingDoubts.length}</Text>
            <Text style={styles.statLabel}>Doubts In Queue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: '#7C3AED', borderLeftWidth: 3 }]}
            onPress={() => router.push('/(teacher)/more/exams' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#EDE9FE' }]}>
              <GraduationCap size={16} color="#7C3AED" />
            </View>
            <Text style={styles.statNumber}>{exams.length}</Text>
            <Text style={styles.statLabel}>Assessments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: '#D97706', borderLeftWidth: 3 }]}
            onPress={() => router.push('/(teacher)/assignments' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
              <ClipboardList size={16} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>{assignments.length}</Text>
            <Text style={styles.statLabel}>Homework Sets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: '#DC2626', borderLeftWidth: 3 }]}
            onPress={() => router.push('/(teacher)/more/live-classes' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#FEE2E2' }]}>
              <Video size={16} color="#DC2626" />
            </View>
            <Text style={styles.statNumber}>{liveClasses.length}</Text>
            <Text style={styles.statLabel}>Live Classes</Text>
          </TouchableOpacity>
        </View>

        {/* Faculty Command Matrix */}
        <Text style={styles.sectionTitle}>FACULTY TOOLS</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(teacher)/attendance' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <CalendarCheck size={22} color="#16A34A" />
            </View>
            <Text style={styles.gridTitle}>1-Tap Roll Call</Text>
            <Text style={styles.gridSub}>Mark attendance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(teacher)/more/exams' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <GraduationCap size={22} color="#7C3AED" />
            </View>
            <Text style={styles.gridTitle}>Exam Manager</Text>
            <Text style={styles.gridSub}>MCQs & scores</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(teacher)/assignments' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <ClipboardList size={22} color="#D97706" />
            </View>
            <Text style={styles.gridTitle}>Homework</Text>
            <Text style={styles.gridSub}>Grade student work</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(teacher)/doubts' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <MessagesSquare size={22} color={Colors.brand.blue} />
            </View>
            <Text style={styles.gridTitle}>Doubt Clearance</Text>
            <Text style={styles.gridSub}>Priority answering</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(teacher)/more/live-classes' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Video size={22} color="#DC2626" />
            </View>
            <Text style={styles.gridTitle}>Live Classes</Text>
            <Text style={styles.gridSub}>Stream & rooms</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(teacher)/more/estudy' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EEF2FF' }]}>
              <BookOpen size={22} color="#4F46E5" />
            </View>
            <Text style={styles.gridTitle}>E-Study Notes</Text>
            <Text style={styles.gridSub}>Upload handouts</Text>
          </TouchableOpacity>
        </View>

        {/* Assigned Batches Attendance Callout */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>MY ACADEMIC BATCHES</Text>
          <TouchableOpacity onPress={() => router.push('/(teacher)/attendance' as any)}>
            <Text style={styles.seeAllText}>Take Attendance</Text>
          </TouchableOpacity>
        </View>

        {batches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={32} color={Colors.text.muted} />
            <Text style={styles.emptyCardTitle}>No Batches Assigned</Text>
            <Text style={styles.emptyCardSub}>Contact center administration to map batches.</Text>
          </View>
        ) : (
          batches.slice(0, 3).map((b) => (
            <TouchableOpacity
              key={b.id}
              style={styles.batchCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/(teacher)/attendance/mark?batchId=${b.id}&batchName=${encodeURIComponent(b.name)}` as any)}
            >
              <View style={styles.batchIcon}>
                <Users size={18} color={Colors.brand.blue} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.batchName}>{b.name}</Text>
                <Text style={styles.batchMeta}>
                  {b.centre?.name || 'Assigned Center'} • {b.students?.length || b._count?.enrollments || 0} Students
                </Text>
              </View>

              <View style={styles.rollCallBtn}>
                <Text style={styles.rollCallBtnText}>Roll Call</Text>
                <ChevronRight size={13} color={Colors.brand.blue} />
              </View>
            </TouchableOpacity>
          ))
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
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.surface.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glowBlue,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greeting: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  centreName: {
    fontSize: 11,
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 16,
    ...Shadows.sm,
  },
  urgentIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
  },
  urgentSub: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 1,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  statIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  gridItem: {
    width: '31%',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  gridIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  gridSub: {
    fontSize: 10,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 2,
  },
  batchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 8,
    gap: 12,
    ...Shadows.sm,
  },
  batchIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  batchMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  rollCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rollCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  emptyCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  emptyCardSub: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
});
