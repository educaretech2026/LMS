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
  FileText,
  ClipboardList,
  MessagesSquare,
  Play,
  Calendar,
  Sparkles,
  ChevronRight,
  BookOpen,
  Award,
  Video,
  CreditCard,
  Radio,
  Flame,
} from 'lucide-react-native';

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [examsData, assignmentsData, doubtsData, liveData] = await Promise.all([
        fetchApi<any[]>('/exams').catch(() => []),
        fetchApi<any[]>('/assignments').catch(() => []),
        fetchApi<any[]>('/doubts').catch(() => []),
        fetchApi<any[]>('/live-class').catch(() => []),
      ]);
      setExams(examsData || []);
      setAssignments(assignmentsData || []);
      setDoubts(doubtsData || []);
      setLiveClasses(liveData || []);
    } catch (e) {
      console.error('Failed to load student dashboard', e);
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

  const pendingAssignments = assignments.filter(
    (a) => !a.submissions || a.submissions.length === 0
  );
  const activeDoubts = doubts.filter(
    (d) => d.status === 'OPEN' || d.status === 'IN_PROGRESS' || d.status === 'ANSWERED'
  );
  const upcomingExams = exams.filter(
    (e) => !e.results || e.results.length === 0
  );
  const activeLiveClass = liveClasses.find((c) => c.status === 'LIVE') || liveClasses[0];

  const fullName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : 'Student';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Elevated Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials || 'ST'}</Text>
          </View>
          <View>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>Welcome back</Text>
              <Sparkles size={13} color="#F59E0B" />
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
          <View style={styles.notificationDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {/* Live Class Spotlight Banner */}
        {activeLiveClass && (
          <TouchableOpacity
            style={[styles.liveSpotlightCard, activeLiveClass.status === 'LIVE' && styles.liveSpotlightCardActive]}
            activeOpacity={0.85}
            onPress={() => router.push('/(student)/profile/live-classes' as any)}
          >
            <View style={styles.liveBadgeRow}>
              <View style={styles.pulseIndicator}>
                <Radio size={12} color="#DC2626" />
                <Text style={styles.pulseText}>
                  {activeLiveClass.status === 'LIVE' ? 'LIVE NOW' : 'UPCOMING CLASS'}
                </Text>
              </View>
              <Text style={styles.liveDurationText}>{activeLiveClass.duration || 60} mins</Text>
            </View>
            <Text style={styles.liveTitle} numberOfLines={1}>
              {activeLiveClass.title}
            </Text>
            <View style={styles.liveFooter}>
              <Text style={styles.liveFaculty}>
                Faculty: {activeLiveClass.teacherName || 'Educare Faculty'}
              </Text>
              <View style={styles.joinAction}>
                <Text style={styles.joinActionText}>Enter Class</Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Dynamic Metric Stat Pills */}
        <View style={styles.statGrid}>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.brand.amber, borderLeftWidth: 3 }]}
            onPress={() => router.push('/(student)/assignments' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
              <ClipboardList size={18} color="#D97706" />
            </View>
            <Text style={styles.statNumber}>{pendingAssignments.length}</Text>
            <Text style={styles.statLabel}>Pending Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.brand.purple, borderLeftWidth: 3 }]}
            onPress={() => router.push('/(student)/exams' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#EDE9FE' }]}>
              <Award size={18} color="#7C3AED" />
            </View>
            <Text style={styles.statNumber}>{upcomingExams.length}</Text>
            <Text style={styles.statLabel}>Active Exams</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.brand.blue, borderLeftWidth: 3 }]}
            onPress={() => router.push('/(student)/doubts' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
              <MessagesSquare size={18} color={Colors.brand.blue} />
            </View>
            <Text style={styles.statNumber}>{activeDoubts.length}</Text>
            <Text style={styles.statLabel}>Open Doubts</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Launchpad Grid */}
        <Text style={styles.sectionTitle}>QUICK LAUNCHPAD</Text>
        <View style={styles.grid}>
          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(student)/exams' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EDE9FE' }]}>
              <FileText size={22} color="#7C3AED" />
            </View>
            <Text style={styles.gridTitle}>MCQ Exams</Text>
            <Text style={styles.gridSub}>Timed assessments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(student)/assignments' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#FEF3C7' }]}>
              <ClipboardList size={22} color="#D97706" />
            </View>
            <Text style={styles.gridTitle}>Homework</Text>
            <Text style={styles.gridSub}>Submit solutions</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(student)/doubts' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <MessagesSquare size={22} color={Colors.brand.blue} />
            </View>
            <Text style={styles.gridTitle}>Clear Doubts</Text>
            <Text style={styles.gridSub}>1-on-1 Faculty Q&A</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(student)/profile/live-classes' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Video size={22} color="#DC2626" />
            </View>
            <Text style={styles.gridTitle}>Live Classes</Text>
            <Text style={styles.gridSub}>Online lectures</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(student)/profile/estudy' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#EEF2FF' }]}>
              <BookOpen size={22} color="#4F46E5" />
            </View>
            <Text style={styles.gridTitle}>E-Study</Text>
            <Text style={styles.gridSub}>PDF Notes & Video</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridItem}
            onPress={() => router.push('/(student)/profile/id-card' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.gridIconCircle, { backgroundColor: '#DCFCE7' }]}>
              <CreditCard size={22} color="#16A34A" />
            </View>
            <Text style={styles.gridTitle}>QR ID Card</Text>
            <Text style={styles.gridSub}>Digital identity</Text>
          </TouchableOpacity>
        </View>

        {/* Priority Assessments Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>UPCOMING ASSESSMENTS</Text>
          <TouchableOpacity onPress={() => router.push('/(student)/exams' as any)}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {upcomingExams.length === 0 ? (
          <View style={styles.emptyCard}>
            <Award size={32} color={Colors.text.muted} />
            <Text style={styles.emptyCardTitle}>No Tests Scheduled</Text>
            <Text style={styles.emptyCardSub}>You're all caught up on examinations!</Text>
          </View>
        ) : (
          upcomingExams.slice(0, 2).map((exam) => (
            <TouchableOpacity
              key={exam.id}
              style={styles.examBanner}
              activeOpacity={0.8}
              onPress={() => router.push(`/(student)/exams/${exam.id}/take` as any)}
            >
              <View style={styles.examBannerLeft}>
                <Text style={styles.examSubjectTag}>{exam.subject?.name || exam.subject || 'Academics'}</Text>
                <Text style={styles.examBannerTitle} numberOfLines={1}>{exam.title}</Text>
                <Text style={styles.examBannerMeta}>
                  {exam.durationMinutes || 60} mins • {exam.totalMarks || 100} Marks
                </Text>
              </View>

              <View style={styles.takeTestBtn}>
                <Play size={13} color="#FFFFFF" />
                <Text style={styles.takeTestText}>Take Test</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Homework Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>PENDING HOMEWORK</Text>
          <TouchableOpacity onPress={() => router.push('/(student)/assignments' as any)}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {pendingAssignments.length === 0 ? (
          <View style={styles.emptyCard}>
            <ClipboardList size={32} color={Colors.text.muted} />
            <Text style={styles.emptyCardTitle}>All Homework Submitted</Text>
            <Text style={styles.emptyCardSub}>No pending assignments right now.</Text>
          </View>
        ) : (
          pendingAssignments.slice(0, 2).map((a) => (
            <TouchableOpacity
              key={a.id}
              style={styles.assignmentCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/(student)/assignments/${a.id}/submit` as any)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.assignmentSubject}>{a.batch?.name || 'Classwork'}</Text>
                <Text style={styles.assignmentTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.assignmentDue}>
                  Due: {a.dueDate ? new Date(a.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Soon'}
                </Text>
              </View>

              <View style={styles.submitPill}>
                <Text style={styles.submitPillText}>Submit</Text>
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
    backgroundColor: Colors.brand.blue,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  liveSpotlightCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    ...Shadows.md,
  },
  liveSpotlightCardActive: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  liveBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pulseIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pulseText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.5,
  },
  liveDurationText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  liveFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  liveFaculty: {
    fontSize: 12,
    color: '#CBD5E1',
  },
  joinAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  joinActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
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
  examBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 10,
    ...Shadows.sm,
  },
  examBannerLeft: {
    flex: 1,
    marginRight: 12,
  },
  examSubjectTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.brand.purple,
    textTransform: 'uppercase',
  },
  examBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 2,
  },
  examBannerMeta: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  takeTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...Shadows.glowBlue,
  },
  takeTestText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 8,
    ...Shadows.sm,
  },
  assignmentSubject: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D97706',
    textTransform: 'uppercase',
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  assignmentDue: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  submitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  submitPillText: {
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
