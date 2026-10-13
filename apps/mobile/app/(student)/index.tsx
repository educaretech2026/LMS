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
} from 'lucide-react-native';

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [examsData, assignmentsData, doubtsData, noticesData] = await Promise.all([
        fetchApi<any[]>('/exams').catch(() => []),
        fetchApi<any[]>('/assignments').catch(() => []),
        fetchApi<any[]>('/doubts').catch(() => []),
        fetchApi<any[]>('/notices').catch(() => []),
      ]);
      setExams(examsData || []);
      setAssignments(assignmentsData || []);
      setDoubts(doubtsData || []);
      setNotices(noticesData || []);
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

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>
            {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Student'}
          </Text>
          {user?.centreName ? (
            <View style={styles.centreBadge}>
              <Text style={styles.centreBadgeText}>{user.centreName}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <Bell size={20} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {/* Quick KPI Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.brand.blue }]}
            onPress={() => router.push('/(student)/exams' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.brand.blueLight }]}>
              <FileText size={18} color={Colors.brand.blue} />
            </View>
            <Text style={styles.statNumber}>{upcomingExams.length}</Text>
            <Text style={styles.statLabel}>Exams Due</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.status.warning }]}
            onPress={() => router.push('/(student)/assignments' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.status.warningLight }]}>
              <ClipboardList size={18} color={Colors.status.warning} />
            </View>
            <Text style={styles.statNumber}>{pendingAssignments.length}</Text>
            <Text style={styles.statLabel}>Homework</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statCard, { borderLeftColor: Colors.status.indigo }]}
            onPress={() => router.push('/(student)/doubts' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.statIcon, { backgroundColor: Colors.status.indigoLight }]}>
              <MessagesSquare size={18} color={Colors.status.indigo} />
            </View>
            <Text style={styles.statNumber}>{activeDoubts.length}</Text>
            <Text style={styles.statLabel}>Active Doubts</Text>
          </TouchableOpacity>
        </View>

        {/* Action Shortcut Banner */}
        <View style={styles.banner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Need Help With Homework?</Text>
            <Text style={styles.bannerSubtitle}>
              Directly ask questions to your batch faculty with 1 click
            </Text>
            <TouchableOpacity
              style={styles.bannerButton}
              onPress={() => router.push('/(student)/doubts/ask' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.bannerButtonText}>Ask a Doubt</Text>
              <ChevronRight size={14} color={Colors.brand.blue} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          </View>
          <View style={styles.bannerIconCircle}>
            <Sparkles size={28} color="#FFFFFF" />
          </View>
        </View>

        {/* Section: Live / Upcoming Exams */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Tests</Text>
          <TouchableOpacity onPress={() => router.push('/(student)/exams' as any)}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        {upcomingExams.length === 0 ? (
          <View style={styles.emptyCard}>
            <BookOpen size={28} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No pending exams right now</Text>
          </View>
        ) : (
          upcomingExams.slice(0, 2).map((exam) => (
            <TouchableOpacity
              key={exam.id}
              style={styles.examCard}
              onPress={() => router.push(`/(student)/exams/${exam.id}/take` as any)}
              activeOpacity={0.7}
            >
              <View style={styles.examInfo}>
                <Text style={styles.examTitle}>{exam.title}</Text>
                <Text style={styles.examSubject}>
                  {exam.subject?.name || 'General'} • {exam.duration || 60} mins
                </Text>
              </View>
              <View style={styles.startBadge}>
                <Play size={14} color="#FFFFFF" />
                <Text style={styles.startBadgeText}>Start</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* Section: Recent Notices */}
        {notices.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>Campus Announcements</Text>
            </View>
            {notices.slice(0, 3).map((notice) => (
              <View key={notice.id} style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>{notice.title}</Text>
                <Text style={styles.noticeDesc} numberOfLines={2}>
                  {notice.content || notice.description}
                </Text>
              </View>
            ))}
          </>
        ) : null}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  greeting: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  centreBadge: {
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  centreBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface.subtle,
    borderWidth: 1,
    borderColor: Colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadows.sm,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
    marginTop: 2,
  },
  banner: {
    flexDirection: 'row',
    backgroundColor: Colors.brand.blue,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 24,
    ...Shadows.md,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  bannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  bannerButtonText: {
    color: Colors.brand.blue,
    fontSize: 11,
    fontWeight: '700',
  },
  bannerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.blue,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 8,
  },
  examCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 10,
    ...Shadows.sm,
  },
  examInfo: {
    flex: 1,
  },
  examTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  examSubject: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 4,
  },
  startBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  startBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 8,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  noticeDesc: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 4,
    lineHeight: 16,
  },
});
