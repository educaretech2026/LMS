import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import { MessagesSquare, Plus, ChevronRight, Search, X } from 'lucide-react-native';

export default function StudentDoubtsList() {
  const router = useRouter();
  const [tab, setTab] = useState<'ACTIVE' | 'RESOLVED'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [doubts, setDoubts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDoubts = async () => {
    try {
      const data = await fetchApi<any[]>('/doubts');
      setDoubts(data || []);
    } catch (e) {
      console.error('Failed to load doubts', e);
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

  const activeDoubts = useMemo(
    () => doubts.filter((d) => d.status !== 'RESOLVED' && d.status !== 'CLOSED'),
    [doubts]
  );
  const resolvedDoubts = useMemo(
    () => doubts.filter((d) => d.status === 'RESOLVED' || d.status === 'CLOSED'),
    [doubts]
  );

  const displayedList = useMemo(() => {
    let list = tab === 'ACTIVE' ? [...activeDoubts] : [...resolvedDoubts];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          (d.question || '').toLowerCase().includes(q) ||
          (d.subject || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [tab, activeDoubts, resolvedDoubts, search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>ACADEMIC SUPPORT</Text>
            <Text style={styles.title}>Doubts</Text>
          </View>
          <TouchableOpacity
            style={styles.askButton}
            onPress={() => router.push('/(student)/doubts/ask' as any)}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#FFFFFF" />
            <Text style={styles.askButtonText}>Ask Doubt</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Search size={14} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions or subjects..."
            placeholderTextColor={Colors.text.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={14} color={Colors.text.muted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'ACTIVE' && styles.tabButtonActive]}
            onPress={() => setTab('ACTIVE')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'ACTIVE' && styles.tabTextActive]}>
              Active ({activeDoubts.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'RESOLVED' && styles.tabButtonActive]}
            onPress={() => setTab('RESOLVED')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, tab === 'RESOLVED' && styles.tabTextActive]}>
              Resolved ({resolvedDoubts.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : displayedList.length === 0 ? (
          <View style={styles.emptyCard}>
            <MessagesSquare size={32} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>
              {search
                ? 'No matching questions found'
                : tab === 'ACTIVE'
                ? 'No active doubts'
                : 'No resolved questions'}
            </Text>
          </View>
        ) : (
          displayedList.map((doubt) => {
            const isResolved = doubt.status === 'RESOLVED';
            const isUrgent = doubt.priority === 'URGENT' || doubt.priority === 'HIGH';

            return (
              <TouchableOpacity
                key={doubt.id}
                style={[styles.card, isUrgent && { borderColor: `${Colors.brand.red}40` }]}
                onPress={() => router.push(`/(student)/doubts/${doubt.id}` as any)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.cardAccent,
                    {
                      backgroundColor: isResolved
                        ? Colors.brand.emerald
                        : isUrgent
                        ? Colors.brand.red
                        : Colors.brand.blue,
                    },
                  ]}
                />
                <View style={styles.cardInner}>
                  <View style={styles.cardTop}>
                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>{doubt.subject || 'General'}</Text>
                    </View>

                    {isUrgent && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>URGENT</Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isResolved
                            ? Colors.brand.emeraldLight
                            : Colors.brand.blueLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          {
                            color: isResolved ? Colors.brand.emerald : Colors.brand.blue,
                          },
                        ]}
                      >
                        {isResolved ? 'Answered' : 'Pending'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.questionText} numberOfLines={2}>
                    {doubt.question}
                  </Text>

                  <View style={styles.metaRow}>
                    <Text style={styles.dateText}>
                      {doubt.createdAt
                        ? new Date(doubt.createdAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Recent'}
                    </Text>
                    <ChevronRight size={14} color={Colors.text.muted} style={{ marginLeft: 'auto' }} />
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
    letterSpacing: -0.4,
  },
  askButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radii.md,
    ...Shadows.glowBlue,
  },
  askButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface.subtle,
    borderRadius: Radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.primary,
    padding: 0,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.subtle,
    borderRadius: Radii.md,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  tabButtonActive: {
    backgroundColor: Colors.surface.card,
    ...Shadows.xs,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  tabTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 20,
    gap: 10,
    ...Shadows.xs,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 10,
    overflow: 'hidden',
    ...Shadows.xs,
  },
  cardAccent: {
    height: 2,
  },
  cardInner: {
    padding: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  subjectBadge: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  urgentBadge: {
    backgroundColor: Colors.brand.redLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  urgentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.brand.red,
    letterSpacing: 0.5,
  },
  statusBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Radii.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    lineHeight: 20,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '500',
  },
});
