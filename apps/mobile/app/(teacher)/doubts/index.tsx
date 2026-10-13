import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import {
  MessagesSquare,
  Search,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Filter,
  User,
} from 'lucide-react-native';

export default function TeacherDoubtsQueue() {
  const router = useRouter();
  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ANSWERED' | 'RESOLVED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'URGENT' | 'HIGH'>('ALL');

  const loadDoubts = async () => {
    try {
      const data = await fetchApi<any[]>('/doubts');
      setDoubts(data || []);
    } catch (e) {
      console.error('Failed to load doubts queue', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDoubts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDoubts();
  };

  const filteredDoubts = doubts.filter((d) => {
    // Status filter
    if (statusFilter === 'PENDING' && (d.status === 'ANSWERED' || d.status === 'RESOLVED' || d.status === 'CLOSED')) {
      return false;
    }
    if (statusFilter === 'ANSWERED' && d.status !== 'ANSWERED') {
      return false;
    }
    if (statusFilter === 'RESOLVED' && d.status !== 'RESOLVED' && d.status !== 'CLOSED') {
      return false;
    }

    // Priority filter
    if (priorityFilter !== 'ALL' && d.priority !== priorityFilter) {
      return false;
    }

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const title = (d.title || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      const studentName = (d.student?.user?.name || d.student?.name || '').toLowerCase();
      const subject = (d.subject?.name || d.subject || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || studentName.includes(q) || subject.includes(q);
    }

    return true;
  });

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return { bg: Colors.brand.redLight, text: Colors.brand.red, label: 'Urgent' };
      case 'HIGH':
        return { bg: Colors.brand.amberLight, text: Colors.brand.amber, label: 'High' };
      case 'MEDIUM':
        return { bg: Colors.brand.blueLight, text: Colors.brand.blue, label: 'Medium' };
      default:
        return { bg: Colors.surface.subtle, text: Colors.text.muted, label: 'Normal' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return { bg: Colors.brand.emeraldLight, text: Colors.brand.emerald, label: 'Resolved' };
      case 'ANSWERED':
        return { bg: Colors.brand.blueLight, text: Colors.brand.blue, label: 'Answered' };
      default:
        return { bg: Colors.brand.amberLight, text: Colors.brand.amber, label: 'Open' };
    }
  };

  const pendingCount = doubts.filter(
    (d) => d.status !== 'ANSWERED' && d.status !== 'RESOLVED' && d.status !== 'CLOSED'
  ).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>STUDENT Q&A</Text>
            <Text style={styles.title}>Doubts Queue</Text>
          </View>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{pendingCount} Open</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by student, subject, or question..."
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Chips */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setStatusFilter('ALL')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'ALL' && styles.filterChipTextActive]}>
              All ({doubts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'PENDING' && styles.filterChipActive]}
            onPress={() => setStatusFilter('PENDING')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'PENDING' && styles.filterChipTextActive]}>
              Pending ({pendingCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'ANSWERED' && styles.filterChipActive]}
            onPress={() => setStatusFilter('ANSWERED')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'ANSWERED' && styles.filterChipTextActive]}>
              Answered
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'RESOLVED' && styles.filterChipActive]}
            onPress={() => setStatusFilter('RESOLVED')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'RESOLVED' && styles.filterChipTextActive]}>
              Resolved
            </Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={[styles.filterChip, priorityFilter === 'URGENT' && styles.filterChipUrgent]}
            onPress={() => setPriorityFilter(priorityFilter === 'URGENT' ? 'ALL' : 'URGENT')}
          >
            <AlertCircle size={12} color={priorityFilter === 'URGENT' ? '#DC2626' : Colors.text.muted} />
            <Text
              style={[
                styles.filterChipText,
                priorityFilter === 'URGENT' && { color: '#DC2626', fontWeight: '700' },
              ]}
            >
              Urgent Only
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Fetching assigned doubts...</Text>
          </View>
        ) : filteredDoubts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessagesSquare size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>Queue is Clean</Text>
            <Text style={styles.emptySubtitle}>
              {search || statusFilter !== 'ALL' || priorityFilter !== 'ALL'
                ? 'No doubts match the selected criteria.'
                : 'All student questions have been addressed!'}
            </Text>
          </View>
        ) : (
          filteredDoubts.map((item) => {
            const pStyle = getPriorityStyle(item.priority);
            const sStyle = getStatusBadge(item.status);
            const studentName = item.student?.user?.name || item.student?.name || 'Student';
            const subjectName = item.subject?.name || item.subject || 'Academics';
            const msgCount = (item.messages?.length || 0);

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => router.push(`/(teacher)/doubts/${item.id}/chat` as any)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.studentInfoRow}>
                    <View style={styles.studentAvatar}>
                      <User size={14} color={Colors.brand.blue} />
                    </View>
                    <View>
                      <Text style={styles.studentName}>{studentName}</Text>
                      <Text style={styles.subjectText}>{subjectName}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <View style={[styles.badge, { backgroundColor: pStyle.bg }]}>
                      <Text style={[styles.badgeText, { color: pStyle.text }]}>{pStyle.label}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: sStyle.bg }]}>
                      <Text style={[styles.badgeText, { color: sStyle.text }]}>{sStyle.label}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                {item.teacher ? (
                  <View style={styles.assignedBadgeRow}>
                    <Text style={styles.assignedBadgeText}>
                      Faculty: Prof. {item.teacher.firstName} {item.teacher.lastName || ''}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.footerLeft}>
                    <Clock size={13} color={Colors.text.muted} />
                    <Text style={styles.footerDate}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    <Text style={styles.msgCounter}>• {msgCount} msg{msgCount === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={styles.replyAction}>
                    <Text style={styles.replyActionText}>
                      {item.status === 'RESOLVED' ? 'View Thread' : 'Answer Question'}
                    </Text>
                    <ChevronRight size={14} color={Colors.brand.blue} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  headerBadge: {
    backgroundColor: Colors.brand.amberLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.amber,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    color: Colors.text.primary,
  },
  filterBar: {
    marginTop: 8,
    marginBottom: 4,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  filterChipUrgent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.border.default,
    marginHorizontal: 4,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  studentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subjectText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  assignedBadgeRow: {
    backgroundColor: 'rgba(1,98,177,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(1,98,177,0.15)',
  },
  assignedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerDate: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  msgCounter: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  replyActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
});
