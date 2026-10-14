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
  Bell, Users, CalendarCheck, ClipboardList, MessagesSquare,
  GraduationCap, BookOpen, Video, ArrowRight, AlertCircle, ChevronRight,
} from 'lucide-react-native';

export default function TeacherHomeScreen() {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();

  const [batches, setBatches] = useState<any[]>([]);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [liveClasses, setLiveClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [bd, dd, ad, ed, ld] = await Promise.all([
        fetchApi<any[]>('/setup/batches').catch(() => []),
        fetchApi<any[]>('/doubts').catch(() => []),
        fetchApi<any[]>('/assignments').catch(() => []),
        fetchApi<any[]>('/exams').catch(() => []),
        fetchApi<any[]>('/live-class').catch(() => []),
      ]);
      setBatches(bd || []);
      setDoubts(dd || []);
      setAssignments(ad || []);
      setExams(ed || []);
      setLiveClasses(ld || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingDoubts = doubts.filter(d => d.status === 'OPEN' || d.status === 'IN_PROGRESS');
  const urgentDoubts = pendingDoubts.filter(d => d.priority === 'URGENT' || d.priority === 'HIGH');
  const liveNow = liveClasses.filter(c => c.status === 'LIVE');

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Faculty';
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  const metrics = [
    { label: 'Batches', value: batches.length, color: Colors.brand.blue, onPress: () => router.push('/(teacher)/attendance' as any) },
    { label: 'Doubts', value: pendingDoubts.length, color: Colors.brand.amber, onPress: () => router.push('/(teacher)/doubts' as any) },
    { label: 'Homework', value: assignments.length, color: Colors.brand.emerald, onPress: () => router.push('/(teacher)/assignments' as any) },
    { label: 'Live', value: liveNow.length, color: Colors.brand.red, onPress: () => router.push('/(teacher)/more/live-classes' as any) },
  ];

  const services = [
    { label: 'Roll Call', icon: CalendarCheck, color: Colors.brand.emerald, bg: Colors.brand.emeraldLight, route: '/(teacher)/attendance' },
    { label: 'Exams', icon: GraduationCap, color: Colors.brand.indigo, bg: Colors.brand.indigoLight, route: '/(teacher)/more/exams' },
    { label: 'E-Study', icon: BookOpen, color: Colors.brand.blue, bg: Colors.brand.blueLight, route: '/(teacher)/more/estudy' },
    { label: 'Live Class', icon: Video, color: Colors.brand.red, bg: Colors.brand.redLight, route: '/(teacher)/more/live-classes' },
    { label: 'Homework', icon: ClipboardList, color: Colors.brand.amber, bg: Colors.brand.amberLight, route: '/(teacher)/assignments' },
    { label: 'Doubts', icon: MessagesSquare, color: Colors.brand.blue, bg: Colors.brand.blueLight, route: '/(teacher)/doubts' },
  ];

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={Colors.brand.blue} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header Banner — web gradient with geometry rings */}
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
              {user?.centreName ? <Text style={styles.bannerSub}>{user.centreName}</Text> : null}
            </View>
          </View>
          <View style={styles.bannerRight}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/notifications' as any)}
            >
              <Bell size={18} color="#FFFFFF" />
              {unreadCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : pendingDoubts.length > 0 ? (
                <View style={styles.bellDot} />
              ) : null}
            </TouchableOpacity>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>TEACHER</Text>
            </View>
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
        {/* Urgent Alert */}
        {urgentDoubts.length > 0 && (
          <TouchableOpacity
            style={styles.urgentBanner}
            onPress={() => router.push('/(teacher)/doubts' as any)}
            activeOpacity={0.85}
          >
            <AlertCircle size={16} color={Colors.brand.red} />
            <Text style={styles.urgentText}>{urgentDoubts.length} urgent {urgentDoubts.length === 1 ? 'doubt' : 'doubts'} awaiting response</Text>
            <ArrowRight size={14} color={Colors.brand.red} />
          </TouchableOpacity>
        )}

        {/* Metrics Strip */}
        <View style={styles.metricsRow}>
          {metrics.map((m) => (
            <TouchableOpacity key={m.label} style={styles.metricCard} onPress={m.onPress} activeOpacity={0.8}>
              <View style={[styles.metricTopBar, { backgroundColor: m.color }]} />
              <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
              <Text style={styles.metricLabel}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* My Batches */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>MY BATCHES</Text>
            <TouchableOpacity onPress={() => router.push('/(teacher)/attendance' as any)}>
              <Text style={styles.sectionAction}>Attendance <ArrowRight size={11} color={Colors.brand.blue} /></Text>
            </TouchableOpacity>
          </View>
          {batches.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No batches assigned</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {batches.map((b: any, i: number) => (
                <View key={b.id} style={[styles.listRow, i < batches.length - 1 && styles.listRowBorder]}>
                  <View style={styles.batchCodeBox}>
                    <Text style={styles.batchCode}>{(b.name || b.code || 'B').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{b.name || b.code}</Text>
                    <View style={styles.rowTagRow}>
                      {b.board ? (
                        <Text style={styles.tag}>
                          {typeof b.board === 'object' ? b.board?.name : b.board}
                        </Text>
                      ) : null}
                      {b.classs ? (
                        <Text style={styles.tag}>
                          Class {typeof b.classs === 'object' ? b.classs?.name : b.classs}
                        </Text>
                      ) : null}
                      <Text style={styles.tagDim}><Users size={10} color={Colors.text.muted} /> {b.studentCount || 0}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.actionChip}
                    onPress={() => router.push('/(teacher)/attendance' as any)}
                  >
                    <Text style={styles.actionChipText}>Roll Call</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Services Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FACULTY TOOLS</Text>
          <View style={styles.servicesGrid}>
            {services.map((s) => {
              const Icon = s.icon;
              return (
                <TouchableOpacity
                  key={s.label}
                  style={styles.serviceItem}
                  onPress={() => router.push(s.route as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.serviceIcon, { backgroundColor: s.bg }]}>
                    <Icon size={20} color={s.color} />
                  </View>
                  <Text style={styles.serviceLabel}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Priority Doubts */}
        {pendingDoubts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>OPEN DOUBTS</Text>
              <TouchableOpacity onPress={() => router.push('/(teacher)/doubts' as any)}>
                <Text style={styles.sectionAction}>View All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              {pendingDoubts.slice(0, 4).map((d: any, i: number) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.listRow, i < Math.min(pendingDoubts.length, 4) - 1 && styles.listRowBorder]}
                  onPress={() => router.push('/(teacher)/doubts' as any)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{d.question || 'Doubt'}</Text>
                    <View style={styles.rowTagRow}>
                      <Text style={styles.tagDim}>
                        {typeof d.studentName === 'object' ? d.studentName?.name : d.studentName || 'Student'}
                      </Text>
                      {d.subject ? (
                        <Text style={styles.tag}>
                          {typeof d.subject === 'object' ? d.subject?.name : d.subject}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {(d.priority === 'URGENT' || d.priority === 'HIGH') && (
                    <View style={styles.urgentPill}>
                      <Text style={styles.urgentPillText}>URGENT</Text>
                    </View>
                  )}
                  <ChevronRight size={14} color={Colors.text.muted} />
                </TouchableOpacity>
              ))}
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
  // Banner
  banner: {
    backgroundColor: Colors.brand.blue,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
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
  bellDot: { position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.brand.red, borderWidth: 1.5, borderColor: Colors.brand.blue },
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
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  // Urgent Alert
  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.brand.redLight, borderWidth: 1, borderColor: `${Colors.brand.red}30`,
    borderRadius: Radii.md, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  urgentText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.brand.red },
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
  sectionTitle: { fontSize: 11, fontWeight: '800', color: Colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionAction: { fontSize: 12, fontWeight: '700', color: Colors.brand.blue },
  // Card
  card: { backgroundColor: Colors.surface.card, borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border.default, overflow: 'hidden', ...Shadows.xs },
  emptyCard: { backgroundColor: Colors.surface.card, borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border.default, paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.text.muted },
  // List rows
  listRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  rowTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 3 },
  rowTagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  tag: { fontSize: 10, fontWeight: '600', color: Colors.text.secondary, backgroundColor: Colors.surface.subtle, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.sm },
  tagDim: { fontSize: 10, color: Colors.text.muted },
  batchCodeBox: { width: 36, height: 36, borderRadius: Radii.md, backgroundColor: Colors.brand.blueLight, alignItems: 'center', justifyContent: 'center' },
  batchCode: { fontSize: 15, fontWeight: '800', color: Colors.brand.blue },
  actionChip: { backgroundColor: Colors.brand.blue, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.sm },
  actionChipText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  // Services Grid
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  serviceItem: {
    width: '30%', backgroundColor: Colors.surface.card, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border.default, paddingVertical: 16,
    alignItems: 'center', gap: 8, ...Shadows.xs,
    flexGrow: 1,
  },
  serviceIcon: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  serviceLabel: { fontSize: 11, fontWeight: '700', color: Colors.text.secondary, textAlign: 'center' },
  // Urgency
  urgentPill: { backgroundColor: Colors.brand.redLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  urgentPillText: { fontSize: 9, fontWeight: '800', color: Colors.brand.red, letterSpacing: 0.5 },
});
