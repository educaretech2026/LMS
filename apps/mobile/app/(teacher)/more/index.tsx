import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Shadows } from '../../../lib/theme';
import {
  User,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  MessagesSquare,
  Bell,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';

export default function TeacherMoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your Educare LMS faculty account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Educare Faculty';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials || 'FC'}</Text>
        </View>

        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <ShieldCheck size={12} color={Colors.brand.blue} />
            <Text style={styles.roleBadgeText}>Educare Faculty</Text>
          </View>
          {user?.centreName ? (
            <View style={styles.centreBadge}>
              <Text style={styles.centreBadgeText}>{user.centreName}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Faculty Tools & Shortcuts */}
      <Text style={styles.sectionHeader}>FACULTY MODULES</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(teacher)/more/exams' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#EDE9FE' }]}>
            <GraduationCap size={18} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Live MCQ Exams Tracker</Text>
            <Text style={styles.menuSubtitle}>Monitor active student test submissions</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(teacher)/attendance' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#DCFCE7' }]}>
            <CalendarCheck size={18} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>1-Tap Roll Call</Text>
            <Text style={styles.menuSubtitle}>Fast attendance marking for your batches</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(teacher)/assignments' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#FEF3C7' }]}>
            <ClipboardList size={18} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Homework & Submissions</Text>
            <Text style={styles.menuSubtitle}>Create tasks & grade student work</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={() => router.push('/(teacher)/doubts' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <MessagesSquare size={18} color={Colors.brand.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>1-on-1 Doubt Queue</Text>
            <Text style={styles.menuSubtitle}>Priority inbox for academic clearance</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Settings & System */}
      <Text style={styles.sectionHeader}>PREFERENCES & SYSTEM</Text>
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#F1F5F9' }]}>
            <Bell size={18} color={Colors.text.secondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Notifications Hub</Text>
            <Text style={styles.menuSubtitle}>Important academic updates & alerts</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { borderBottomWidth: 0 }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#FEE2E2' }]}>
            <LogOut size={18} color={Colors.status.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: Colors.status.error }]}>Log Out</Text>
            <Text style={styles.menuSubtitle}>Exit your faculty session safely</Text>
          </View>
          <ChevronRight size={18} color={Colors.status.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.footerInfo}>
        <Text style={styles.versionText}>Educare LMS • Faculty Edition v1.0.0</Text>
        <Text style={styles.copyrightText}>Protected by Institutional Authentication</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 56,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.md,
    marginBottom: 24,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: Colors.brand.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  email: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  centreBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  centreBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    marginBottom: 20,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  menuSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 1,
  },
  footerInfo: {
    alignItems: 'center',
    marginTop: 12,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  copyrightText: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
});
