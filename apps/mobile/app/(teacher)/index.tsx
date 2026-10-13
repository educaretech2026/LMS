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
} from 'lucide-react-native';

export default function TeacherHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [batches, setBatches] = useState<any[]>([]);
  const [doubts, setDoubts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [batchesData, doubtsData, assignmentsData] = await Promise.all([
        fetchApi<any[]>('/setup/batches').catch(() => []),
        fetchApi<any[]>('/doubts').catch(() => []),
        fetchApi<any[]>('/assignments').catch(() => []),
      ]);
      setBatches(batchesData || []);
      setDoubts(doubtsData || []);
      setAssignments(assignmentsData || []);
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

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Teacher';

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Faculty Portal,</Text>
          <Text style={styles.name}>{fullName}</Text>
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
        {/* Pending Alerts Banner */}
        {pendingDoubts.length > 0 ? (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(teacher)/doubts' as any)}
            activeOpacity={0.8}
          >
            <View style={styles.alertIconCircle}>
              <MessagesSquare size={18} color={Colors.status.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {pendingDoubts.length} Pending Student Questions
              </Text>
              <Text style={styles.alertSubtitle}>
                {urgentDoubts.length > 0
                  ? `${urgentDoubts.length} marked as URGENT priority`
                  : 'Students waiting for academic guidance'}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.status.error} />
          </TouchableOpacity>
        ) : null}

        {/* Quick Action Cards */}
        <Text style={styles.sectionTitle}>Quick Classroom Actions</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(teacher)/attendance/mark' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: Colors.status.successLight }]}>
              <CalendarCheck size={22} color={Colors.status.success} />
            </View>
            <Text style={styles.quickTitle}>Take Attendance</Text>
            <Text style={styles.quickSub}>1-Tap batch roll call</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(teacher)/assignments/create' as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: Colors.brand.blueLight }]}>
              <ClipboardList size={22} color={Colors.brand.blue} />
            </View>
            <Text style={styles.quickTitle}>Assign Homework</Text>
            <Text style={styles.quickSub}>Upload worksheets</Text>
          </TouchableOpacity>
        </View>

        {/* My Batches Roster */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My Batches & Classes</Text>
          <Text style={styles.counterText}>{batches.length} Batches</Text>
        </View>

        {batches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Users size={32} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No assigned batches found</Text>
          </View>
        ) : (
          batches.map((batch) => (
            <View key={batch.id} style={styles.batchCard}>
              <View style={styles.batchInfo}>
                <Text style={styles.batchName}>{batch.name}</Text>
                <Text style={styles.batchMeta}>
                  {batch.board?.name || 'CBSE'} • {batch.standard?.name || 'Standard'} • {batch.centre?.name || 'Main'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.rollCallShortcut}
                onPress={() => router.push({ pathname: '/(teacher)/attendance/mark', params: { batchId: batch.id } } as any)}
                activeOpacity={0.8}
              >
                <Text style={styles.rollCallShortcutText}>Roll Call</Text>
              </TouchableOpacity>
            </View>
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
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  alertIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.status.error,
  },
  alertSubtitle: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.blue,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  quickCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadows.sm,
  },
  quickIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  quickSub: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 2,
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
  batchCard: {
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
  batchInfo: {
    flex: 1,
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
  rollCallShortcut: {
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rollCallShortcutText: {
    color: Colors.status.success,
    fontSize: 12,
    fontWeight: '700',
  },
});
