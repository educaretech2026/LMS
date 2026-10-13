import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import {
  BookOpen, Video, CreditCard, CalendarCheck, Bell, LogOut,
  ChevronRight, Building2, User,
} from 'lucide-react-native';

export default function StudentProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Exit your student session?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Student';
  const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const services = [
    { label: 'E-Study Materials', sub: 'Notes & video lectures', icon: BookOpen, color: Colors.brand.blue, bg: Colors.brand.blueLight, route: '/(student)/profile/estudy', accent: Colors.brand.blue },
    { label: 'Live Classes', sub: 'Join real-time sessions', icon: Video, color: Colors.brand.red, bg: Colors.brand.redLight, route: '/(student)/profile/live-classes', accent: Colors.brand.red },
    { label: 'Attendance', sub: 'Your attendance record', icon: CalendarCheck, color: Colors.brand.emerald, bg: Colors.brand.emeraldLight, route: '/(student)/profile/attendance', accent: Colors.brand.emerald },
    { label: 'Student ID Card', sub: 'Digital QR identity', icon: CreditCard, color: Colors.brand.indigo, bg: Colors.brand.indigoLight, route: '/(student)/profile/id-card', accent: Colors.brand.indigo },
  ];

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>STUDENT ACCOUNT</Text>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.headerRole}>
          <Text style={styles.headerRoleText}>Student</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile summary */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{fullName}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.centreName && (
              <View style={styles.centreBadge}>
                <Building2 size={11} color={Colors.brand.blue} />
                <Text style={styles.centreBadgeText}>{user.centreName}</Text>
              </View>
            )}
          </View>
          <View style={styles.rolePill}>
            <User size={11} color={Colors.brand.blue} />
            <Text style={styles.rolePillText}>Enrolled</Text>
          </View>
        </View>

        {/* Academic Services */}
        <Text style={styles.sectionLabel}>ACADEMIC SERVICES</Text>
        {services.map(item => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.serviceCard, { borderLeftColor: item.accent }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.serviceIcon, { backgroundColor: item.bg }]}>
                <Icon size={20} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceTitle}>{item.label}</Text>
                <Text style={styles.serviceSub}>{item.sub}</Text>
              </View>
              <ChevronRight size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          );
        })}

        {/* System */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>ACCOUNT</Text>
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

        <Text style={styles.footer}>Educare LMS · Student Edition</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.surface.background },
  header: {
    paddingTop: Platform.OS === 'ios' ? 56 : 44, paddingBottom: 16,
    paddingHorizontal: 20, backgroundColor: Colors.surface.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border.default,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
  },
  headerEyebrow: { fontSize: 10, fontWeight: '700', color: Colors.brand.blue, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
  headerRole: { backgroundColor: Colors.brand.blueLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.sm },
  headerRoleText: { fontSize: 11, fontWeight: '700', color: Colors.brand.blue },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default, padding: 16,
    marginBottom: 20, ...Shadows.xs,
  },
  avatarCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.brand.blue, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  profileName: { fontSize: 16, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
  profileEmail: { fontSize: 12, color: Colors.text.muted, marginBottom: 6 },
  centreBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  centreBadgeText: { fontSize: 11, fontWeight: '600', color: Colors.brand.blue },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.brand.blueLight, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radii.sm, alignSelf: 'flex-start' },
  rolePillText: { fontSize: 11, fontWeight: '700', color: Colors.brand.blue },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: Colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  serviceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default, borderLeftWidth: 3,
    padding: 14, marginBottom: 10, ...Shadows.xs,
  },
  serviceIcon: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  serviceTitle: { fontSize: 14, fontWeight: '700', color: Colors.text.primary, marginBottom: 2 },
  serviceSub: { fontSize: 12, color: Colors.text.muted },
  opsCard: {
    backgroundColor: Colors.surface.card, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border.default, overflow: 'hidden', ...Shadows.xs,
  },
  opsRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  opsRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border.light },
  opsIcon: { width: 36, height: 36, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  opsTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  footer: { textAlign: 'center', fontSize: 11, color: Colors.text.muted, marginTop: 24 },
});
