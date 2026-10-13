import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Shadows } from '../../../lib/theme';
import {
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  MessagesSquare,
  BookOpen,
  Video,
  Bell,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Building2,
  SlidersHorizontal,
} from 'lucide-react-native';

export default function TeacherMoreScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out of your Educare LMS faculty account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Educare Faculty';
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        <View>
          <View style={styles.headerSubtitleRow}>
            <SlidersHorizontal size={14} color={Colors.brand.blue} />
            <Text style={styles.headerSubtitleText}>FACULTY CONTROL HUB</Text>
          </View>
          <Text style={styles.headerTitle}>More Options</Text>
        </View>
        <View style={styles.headerTag}>
          <Sparkles size={13} color="#D97706" />
          <Text style={styles.headerTagText}>Faculty v2.0</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Faculty Profile Summary Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials || 'FC'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email || 'faculty@educarelearning.in'}
            </Text>
            <View style={styles.profileBadgeRow}>
              <View style={styles.roleBadge}>
                <ShieldCheck size={11} color={Colors.brand.blue} />
                <Text style={styles.roleBadgeText}>Educare Faculty</Text>
              </View>
              {user?.centreName ? (
                <View style={styles.centreBadge}>
                  <Building2 size={11} color={Colors.text.secondary} />
                  <Text style={styles.centreBadgeText} numberOfLines={1}>
                    {user.centreName}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* SECTION 1: ACADEMIC & LEARNING PORTALS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>ACADEMIC & LEARNING SERVICES</Text>
          <Text style={styles.sectionBadge}>3 Portals</Text>
        </View>

        {/* E-Study Materials Card */}
        <TouchableOpacity
          style={[styles.portalCard, styles.portalCardEstudy]}
          onPress={() => router.push('/(teacher)/more/estudy' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#EEF2FF' }]}>
            <BookOpen size={24} color="#4F46E5" />
          </View>
          <View style={styles.portalContent}>
            <View style={styles.portalTitleRow}>
              <Text style={styles.portalTitle}>E-Study Materials</Text>
              <View style={[styles.microTag, { backgroundColor: '#E0E7FF' }]}>
                <Text style={[styles.microTagText, { color: '#4338CA' }]}>CURRICULUM</Text>
              </View>
            </View>
            <Text style={styles.portalDesc}>
              Subject-wise notes, handouts, video lectures & syllabus chapters
            </Text>
          </View>
          <View style={styles.chevronWrap}>
            <ChevronRight size={20} color="#4F46E5" />
          </View>
        </TouchableOpacity>

        {/* Live Online Classes Card */}
        <TouchableOpacity
          style={[styles.portalCard, styles.portalCardLive]}
          onPress={() => router.push('/(teacher)/more/live-classes' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
            <Video size={24} color="#DC2626" />
          </View>
          <View style={styles.portalContent}>
            <View style={styles.portalTitleRow}>
              <Text style={styles.portalTitle}>Live Online Classes</Text>
              <View style={[styles.microTag, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.microTagText, { color: '#DC2626' }]}>VIRTUAL</Text>
              </View>
            </View>
            <Text style={styles.portalDesc}>
              Schedule & host real-time video classrooms, meetings & streams
            </Text>
          </View>
          <View style={styles.chevronWrap}>
            <ChevronRight size={20} color="#DC2626" />
          </View>
        </TouchableOpacity>

        {/* Exam Manager Card */}
        <TouchableOpacity
          style={[styles.portalCard, styles.portalCardExam]}
          onPress={() => router.push('/(teacher)/more/exams' as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
            <GraduationCap size={24} color="#7C3AED" />
          </View>
          <View style={styles.portalContent}>
            <View style={styles.portalTitleRow}>
              <Text style={styles.portalTitle}>Exam Manager</Text>
              <View style={[styles.microTag, { backgroundColor: '#EDE9FE' }]}>
                <Text style={[styles.microTagText, { color: '#7C3AED' }]}>ASSESSMENTS</Text>
              </View>
            </View>
            <Text style={styles.portalDesc}>
              Create online MCQ tests, review question papers & scorecards
            </Text>
          </View>
          <View style={styles.chevronWrap}>
            <ChevronRight size={20} color="#7C3AED" />
          </View>
        </TouchableOpacity>

        {/* SECTION 2: CLASSROOM OPERATIONS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>CLASSROOM OPERATIONS</Text>
          <Text style={styles.sectionBadge}>Direct Access</Text>
        </View>

        <View style={styles.menuGroup}>
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

        {/* SECTION 3: SYSTEM & NOTIFICATIONS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>SYSTEM & ACCOUNT</Text>
        </View>

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
              <Text style={styles.menuSubtitle}>Academic announcements & alerts</Text>
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

        {/* Footer */}
        <View style={styles.footerInfo}>
          <Text style={styles.versionText}>Educare LMS • Faculty Edition v2.0</Text>
          <Text style={styles.copyrightText}>Institutional Academic Control Suite</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  topHeader: {
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    ...Shadows.sm,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerSubtitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.brand.blue,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: Colors.text.primary,
    letterSpacing: -0.4,
  },
  headerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  headerTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    gap: 14,
    marginBottom: 20,
    ...Shadows.sm,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glowBlue,
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  profileEmail: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  profileBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  centreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    maxWidth: 160,
  },
  centreBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 0.8,
  },
  sectionBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  portalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 12,
    gap: 14,
    ...Shadows.sm,
  },
  portalCardEstudy: {
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  portalCardLive: {
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  portalCardExam: {
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalContent: {
    flex: 1,
  },
  portalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  portalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  microTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  microTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  portalDesc: {
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuGroup: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 20,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    gap: 12,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 11,
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
    marginTop: 8,
    marginBottom: 16,
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
