import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import {
  BookOpen, Video, GraduationCap, CalendarCheck, ClipboardList,
  MessagesSquare, Bell, LogOut, ChevronRight, Building2,
} from 'lucide-react-native';

type ServiceItem = {
  label: string;
  sub: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  route: string;
  accent?: string;
};

const ACADEMIC_PORTALS: ServiceItem[] = [
  {
    label: 'E-Study Hub',
    sub: 'Notes, handouts & video lectures',
    icon: BookOpen,
    iconColor: Colors.brand.blue,
    iconBg: Colors.brand.blueLight,
    route: '/(teacher)/more/estudy',
    accent: Colors.brand.blue,
  },
  {
    label: 'Live Classes',
    sub: 'Schedule & host online sessions',
    icon: Video,
    iconColor: Colors.brand.red,
    iconBg: Colors.brand.redLight,
    route: '/(teacher)/more/live-classes',
    accent: Colors.brand.red,
  },
  {
    label: 'Exam Manager',
    sub: 'Create MCQ tests & view scorecards',
    icon: GraduationCap,
    iconColor: Colors.brand.indigo,
    iconBg: Colors.brand.indigoLight,
    route: '/(teacher)/more/exams',
    accent: Colors.brand.indigo,
  },
];

const OPERATIONS: ServiceItem[] = [
  {
    label: 'Roll Call',
    sub: 'Quick attendance',
    icon: CalendarCheck,
    iconColor: Colors.brand.emerald,
    iconBg: Colors.brand.emeraldLight,
    route: '/(teacher)/attendance',
  },
  {
    label: 'Homework',
    sub: 'Tasks & submissions',
    icon: ClipboardList,
    iconColor: Colors.brand.amber,
    iconBg: Colors.brand.amberLight,
    route: '/(teacher)/assignments',
  },
  {
    label: 'Doubt Queue',
    sub: 'Student Q&A',
    icon: MessagesSquare,
    iconColor: Colors.brand.blue,
    iconBg: Colors.brand.blueLight,
    route: '/(teacher)/doubts',
  },
];

export default function TeacherMoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Exit your faculty session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Faculty';
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>FACULTY SERVICES</Text>
          <Text style={styles.headerTitle}>More</Text>
        </View>
        <View style={styles.headerRole}>
          <Text style={styles.headerRoleText}>Teacher</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile row */}
        <View style={styles.profileRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
            <Text style={styles.profileEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
          {user?.centreName && (
            <View style={styles.centreBadge}>
              <Building2 size={11} color={Colors.text.muted} />
              <Text style={styles.centreBadgeText} numberOfLines={1}>{user.centreName}</Text>
            </View>
          )}
        </View>

        {/* Academic Portals */}
        <Text style={styles.sectionLabel}>ACADEMIC MANAGEMENT</Text>
        {ACADEMIC_PORTALS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.portalCard, { borderLeftColor: item.accent }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.portalIcon, { backgroundColor: item.iconBg }]}>
                <Icon size={22} color={item.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.portalTitle}>{item.label}</Text>
                <Text style={styles.portalSub}>{item.sub}</Text>
              </View>
              <ChevronRight size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          );
        })}

        {/* Classroom Operations */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>CLASSROOM OPERATIONS</Text>
        <View style={styles.opsCard}>
          {OPERATIONS.map((item, i) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.label}
                style={[styles.opsRow, i < OPERATIONS.length - 1 && styles.opsRowBorder]}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.75}
              >
                <View style={[styles.opsIcon, { backgroundColor: item.iconBg }]}>
                  <Icon size={17} color={item.iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.opsTitle}>{item.label}</Text>
                  <Text style={styles.opsSub}>{item.sub}</Text>
                </View>
                <ChevronRight size={15} color={Colors.text.muted} />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* System */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>SYSTEM</Text>
        <View style={styles.opsCard}>
          <TouchableOpacity
            style={[styles.opsRow, styles.opsRowBorder]}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.75}
          >
            <View style={[styles.opsIcon, { backgroundColor: Colors.surface.subtle }]}>
              <Bell size={17} color={Colors.text.secondary} />
            </View>
            <Text style={[styles.opsTitle, { flex: 1 }]}>Notifications</Text>
            <ChevronRight size={15} color={Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.opsRow} onPress={handleLogout} activeOpacity={0.75}>
            <View style={[styles.opsIcon, { backgroundColor: Colors.brand.redLight }]}>
              <LogOut size={17} color={Colors.brand.red} />
            </View>
            <Text style={[styles.opsTitle, { flex: 1, color: Colors.brand.red }]}>Sign Out</Text>
            <ChevronRight size={15} color={Colors.brand.red} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Educare LMS · Faculty Edition</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerEyebrow: { fontSize: 10, fontWeight: '700', color: Colors.brand.blue, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  headerRole: { backgroundColor: Colors.brand.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.sm },
  headerRoleText: { fontSize: 11, fontWeight: '700', color: Colors.brand.blue },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  // Profile
  profileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default, padding: 14,
    marginBottom: 20, ...Shadows.xs,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.brand.blue, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  profileName: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
  profileEmail: { fontSize: 12, color: Colors.text.muted },
  centreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface.subtle, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.sm, maxWidth: 120 },
  centreBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.text.muted },
  // Section label
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  // Portal cards (big with left accent)
  portalCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default,
    borderLeftWidth: 3, padding: 16, marginBottom: 10, ...Shadows.xs,
  },
  portalIcon: { width: 44, height: 44, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  portalTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
  portalSub: { fontSize: 12, color: Colors.text.muted },
  // Ops card (grouped list)
  opsCard: {
    backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default, overflow: 'hidden', ...Shadows.xs,
  },
  opsRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  opsRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  opsIcon: { width: 36, height: 36, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  opsTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary, marginBottom: 1 },
  opsSub: { fontSize: 11, color: Colors.text.muted },
  footer: { textAlign: 'center', fontSize: 11, color: Colors.text.muted, marginTop: 24 },
});
