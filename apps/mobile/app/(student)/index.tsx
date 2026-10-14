import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { fetchApi } from '../../lib/api';
import { Colors, Shadows, Radii } from '../../lib/theme';
import { useNotifications } from '../../context/NotificationContext';
import {
  Bell, BookOpen, Video, FileText, CreditCard, ClipboardList,
  MessagesSquare, ChevronRight, ArrowRight, Radio,
} from 'lucide-react-native';

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const [assignments, setAssignments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [ad, ed, dd, ld] = await Promise.all([
        fetchApi<any[]>('/assignments').catch(() => []),
        fetchApi<any[]>('/exams').catch(() => []),
        fetchApi<any[]>('/doubts').catch(() => []),
        fetchApi<any[]>('/live-class').catch(() => []),
      ]);
      setAssignments(ad || []);
      setExams(ed || []);
      setDoubts(dd || []);
      setLiveClasses(ld || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pending = assignments.filter(a => a.status === 'PENDING' || !a.submitted);
  const upcoming = exams.filter(e => e.status !== 'ENDED');
  const openDoubts = doubts.filter(d => d.status === 'OPEN');
  const liveNow = liveClasses.filter(c => c.status === 'LIVE');
  const upcomingClasses = liveClasses.filter(c => c.status !== 'ENDED').slice(0, 3);

  const fullName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Student';
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const quickActions = [
    { label: 'Study Materials', icon: BookOpen, color: Colors.brand.blue, bg: Colors.brand.blueLight, route: '/(student)/profile/estudy' },
    { label: 'Live Classes', icon: Video, color: Colors.brand.red, bg: Colors.brand.redLight, route: '/(student)/profile/live-classes' },
    { label: 'Exams & Results', icon: FileText, color: Colors.brand.indigo, bg: Colors.brand.indigoLight, route: '/(student)/exams' },
    { label: 'Ask a Doubt', icon: MessagesSquare, color: Colors.brand.amber, bg: Colors.brand.amberLight, route: '/(student)/doubts' },
  ];

  if (loading) {
    return <View style={styles.loader}><ActivityIndicator color={Colors.brand.blue} /></View>;
  }

  return (
    <View style={styles.root}>
      {/* Web-style gradient banner */}
      <View style={styles.banner}>
        <View style={styles.geoRing1} />
        <View style={styles.geoRing2} />
        <View style={styles.redLine} />
        <View style={styles.bannerTop}>
          <View style={styles.bannerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View>
              <Text style={styles.bannerGreeting}>Welcome back</Text>
              <Text style={styles.bannerName}>{fullName}</Text>
              {user?.centreName && <Text style={styles.bannerSub}>{user.centreName}</Text>}
            </View>
          </View>
          <View style={styles.bannerRight}>
            <TouchableOpacity
              style={styles.idCardBannerBtn}
              onPress={() => router.push('/(student)/profile/id-card' as any)}
              activeOpacity={0.8}
            >
              <CreditCard size={11} color="#FFFFFF" />
              <Text style={styles.idCardBannerBtnText}>ID CARD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bellButton} onPress={() => router.push('/notifications' as any)}>
              <Bell size={18} color="#FFFFFF" />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.rolePill}><Text style={styles.rolePillText}>STUDENT</Text></View>
          </View>
        </View>
        <Text style={styles.bannerDate}>{today}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.brand.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Live Class spotlight */}
        {liveNow.length > 0 && (
          <TouchableOpacity
            style={styles.liveBanner}
            onPress={() => router.push('/(student)/profile/live-classes' as any)}
            activeOpacity={0.85}
          >
            <View style={styles.livePulse}>
              <Radio size={13} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.liveBannerTitle}>LIVE NOW — {liveNow[0].title}</Text>
              <Text style={styles.liveBannerSub}>{liveNow[0].teacherName || 'Faculty'}</Text>
            </View>
            <ArrowRight size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Metrics */}
        <View style={styles.metricsRow}>
          {[
            { label: 'Pending', value: pending.length, color: Colors.brand.amber, route: '/(student)/assignments' },
            { label: 'Exams', value: upcoming.length, color: Colors.brand.indigo, route: '/(student)/exams' },
            { label: 'Doubts', value: openDoubts.length, color: Colors.brand.blue, route: '/(student)/doubts' },
            { label: 'Live', value: liveNow.length, color: Colors.brand.red, route: '/(student)/profile/live-classes' },
          ].map(m => (
            <TouchableOpacity key={m.label} style={styles.metricCard} onPress={() => router.push(m.route as any)} activeOpacity={0.8}>
              <View style={[styles.metricTopBar, { backgroundColor: m.color }]} />
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QUICK ACCESS</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map(a => {
              const Icon = a.icon;
              return (
                <TouchableOpacity
                  key={a.label}
                  style={styles.actionCard}
                  onPress={() => router.push(a.route as any)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                    <Icon size={22} color={a.color} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Upcoming Classes */}
        {upcomingClasses.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>UPCOMING CLASSES</Text>
              <TouchableOpacity onPress={() => router.push('/(student)/profile/live-classes' as any)}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {upcomingClasses.map((cls: any, i: number) => {
                const isLive = cls.status === 'LIVE';
                const dt = new Date(cls.scheduledAt);
                return (
                  <TouchableOpacity
                    key={cls.id}
                    style={[styles.listRow, i < upcomingClasses.length - 1 && styles.listRowBorder]}
                    onPress={() => router.push('/(student)/profile/live-classes' as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.classIndicator, { backgroundColor: isLive ? Colors.brand.redLight : Colors.brand.blueLight }]}>
                      <Video size={14} color={isLive ? Colors.brand.red : Colors.brand.blue} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{cls.title}</Text>
                      <Text style={styles.rowSub}>{cls.teacherName || 'Faculty'} · {isLive ? 'LIVE' : dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </View>
                    {isLive ? (
                      <View style={styles.livePill}><Text style={styles.livePillText}>LIVE</Text></View>
                    ) : (
                      <ChevronRight size={14} color={Colors.text.muted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Pending Homework */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>PENDING HOMEWORK</Text>
              <TouchableOpacity onPress={() => router.push('/(student)/assignments' as any)}>
                <Text style={styles.sectionLink}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {pending.slice(0, 3).map((a: any, i: number) => {
                const due = a.dueDate ? new Date(a.dueDate) : null;
                const isOverdue = due && due < new Date();
                return (
                  <View key={a.id} style={[styles.listRow, i < Math.min(pending.length, 3) - 1 && styles.listRowBorder]}>
                    <View style={[styles.classIndicator, { backgroundColor: Colors.brand.amberLight }]}>
                      <ClipboardList size={14} color={Colors.brand.amber} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{a.title || a.description || 'Assignment'}</Text>
                      {due && (
                        <Text style={[styles.rowSub, isOverdue && { color: Colors.brand.red }]}>
                          Due {due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </Text>
                      )}
                    </View>
                    {isOverdue && <View style={styles.overduePill}><Text style={styles.overduePillText}>OVERDUE</Text></View>}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface.background },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.surface.background },
  banner: {
    backgroundColor: Colors.brand.blue, paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden', position: 'relative',
  },
  geoRing1: {
    position: 'absolute', top: -40, right: 10, width: 130, height: 130,
    borderRadius: 65, borderWidth: 24, borderColor: 'rgba(255,255,255,0.07)',
  },
  geoRing2: {
    position: 'absolute', bottom: -20, right: -10, width: 80, height: 80,
    borderRadius: 40, borderWidth: 14, borderColor: 'rgba(255,255,255,0.05)',
  },
  redLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1.5, backgroundColor: Colors.brand.red, opacity: 0.8 },
  bannerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  bannerGreeting: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '500', marginBottom: 1 },
  bannerName: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  bannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  bannerDate: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 10, fontWeight: '500' },
  bannerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bellButton: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0f172a',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  rolePill: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  rolePillText: { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.2 },
  idCardBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
  },
  idCardBannerBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  // Live banner
  liveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.brand.red, borderRadius: Radii.md,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
  },
  livePulse: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  liveBannerTitle: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  liveBannerSub: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  // Metrics
  metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  metricCard: {
    flex: 1, backgroundColor: Colors.surface.card, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border.default, overflow: 'hidden',
    paddingVertical: 14, paddingHorizontal: 12, ...Shadows.xs,
  },
  metricTopBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  metricValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  metricLabel: { fontSize: 10, color: Colors.text.muted, fontWeight: '600', letterSpacing: 0.5, marginTop: 2, textTransform: 'uppercase' },
  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  sectionLink: { fontSize: 12, fontWeight: '700', color: Colors.brand.blue },
  // Actions grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    width: '47%', backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default, padding: 16,
    alignItems: 'center', gap: 10, ...Shadows.xs, flexGrow: 1,
  },
  actionIcon: { width: 46, height: 46, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, fontWeight: '700', color: Colors.text.primary, textAlign: 'center' },
  // Card
  card: { backgroundColor: Colors.surface.card, borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border.default, overflow: 'hidden', ...Shadows.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
  rowSub: { fontSize: 11, color: Colors.text.muted, fontWeight: '500' },
  classIndicator: { width: 34, height: 34, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  livePill: { backgroundColor: Colors.brand.redLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  livePillText: { fontSize: 9, fontWeight: '800', color: Colors.brand.red, letterSpacing: 0.5 },
  overduePill: { backgroundColor: Colors.brand.redLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  overduePillText: { fontSize: 9, fontWeight: '800', color: Colors.brand.red, letterSpacing: 0.5 },
});
