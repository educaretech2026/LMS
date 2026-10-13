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
  CreditCard,
  BookOpen,
  CalendarCheck,
  Video,
  Bell,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';

export default function StudentProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your Educare LMS account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Student User';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header Info Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarInitials}>{initials || 'ST'}</Text>
        </View>

        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.roleBadge}>
            <ShieldCheck size={12} color={Colors.brand.blue} />
            <Text style={styles.roleBadgeText}>Enrolled Student</Text>
          </View>
          {user?.centreName ? (
            <View style={styles.centreBadge}>
              <Text style={styles.centreBadgeText}>{user.centreName}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Menu Options Group */}
      <View style={styles.menuGroup}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(student)/profile/live-classes' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: '#FEE2E2' }]}>
            <Video size={18} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Live Online Classes</Text>
            <Text style={styles.menuSubtitle}>Join real-time interactive lectures</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(student)/profile/id-card' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: Colors.brand.blueLight }]}>
            <CreditCard size={18} color={Colors.brand.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Digital Student ID Card</Text>
            <Text style={styles.menuSubtitle}>Scan-ready QR code identity</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(student)/profile/estudy' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: Colors.status.indigoLight }]}>
            <BookOpen size={18} color={Colors.status.indigo} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>E-Study Materials</Text>
            <Text style={styles.menuSubtitle}>Video lectures & PDF notes</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/(student)/profile/attendance' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: Colors.status.successLight }]}>
            <CalendarCheck size={18} color={Colors.status.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Attendance History</Text>
            <Text style={styles.menuSubtitle}>Calendar record & stats</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: Colors.status.warningLight }]}>
            <Bell size={18} color={Colors.status.warning} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Notifications</Text>
            <Text style={styles.menuSubtitle}>Academic updates & alerts</Text>
          </View>
          <ChevronRight size={18} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color={Colors.brand.red} />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Educare LMS Mobile v1.0.0 (Build 57)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 54,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 24,
    ...Shadows.sm,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.brand.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Shadows.md,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  email: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  centreBadge: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  centreBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  menuGroup: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    marginBottom: 24,
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    gap: 14,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  menuSubtitle: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.redLight,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  logoutText: {
    color: Colors.brand.red,
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 20,
  },
});
