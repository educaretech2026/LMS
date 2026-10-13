import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows, Radii } from '../../../lib/theme';
import {
  BookOpen,
  FileText,
  Video,
  ExternalLink,
  Search,
  X,
  Play,
  Download,
} from 'lucide-react-native';

const SUBJECT_FILTERS = [
  { id: 'all', name: 'All' },
  { id: 'physics', name: 'Physics' },
  { id: 'chemistry', name: 'Chemistry' },
  { id: 'mathematics', name: 'Math' },
  { id: 'biology', name: 'Biology' },
];

export default function StudentEstudyCurriculumScreen() {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [resourceType, setResourceType] = useState<'ALL' | 'VIDEOS' | 'NOTES'>('ALL');
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
      const data = await fetchApi<any[]>('/study-materials');
      setMaterials(data || []);
    } catch (err) {
      console.error('Failed to load materials', err);
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

  const openMaterial = (url: string | null) => {
    if (!url) {
      Alert.alert('Notice', 'No direct link available for this resource.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open file link');
    });
  };

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const isVid = (m.type || '').toUpperCase().includes('VID');

      if (resourceType === 'VIDEOS' && !isVid) return false;
      if (resourceType === 'NOTES' && isVid) return false;

      if (selectedSubject !== 'all') {
        const sName = (m.subject?.name || m.subject || '').toLowerCase();
        if (!sName.includes(selectedSubject.toLowerCase())) return false;
      }

      if (search.trim()) {
        const q = search.toLowerCase();
        const t = (m.title || '').toLowerCase();
        const s = (m.subject?.name || m.subject || '').toLowerCase();
        const c = (m.chapter?.name || m.chapter || '').toLowerCase();
        return t.includes(q) || s.includes(q) || c.includes(q);
      }
      return true;
    });
  }, [materials, resourceType, selectedSubject, search]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerEyebrow}>CURRICULUM</Text>
            <Text style={styles.title}>E-Study Hub</Text>
          </View>
          <View style={styles.badgeCount}>
            <Text style={styles.badgeCountText}>{materials.length} Items</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Search size={14} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, chapters, topics..."
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

        {/* Type toggles */}
        <View style={styles.typeRow}>
          {(['ALL', 'VIDEOS', 'NOTES'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeButton, resourceType === t && styles.typeButtonActive]}
              onPress={() => setResourceType(t)}
            >
              <Text style={[styles.typeText, resourceType === t && styles.typeTextActive]}>
                {t === 'ALL' ? 'All Resources' : t === 'VIDEOS' ? 'Video Lectures' : 'Notes & PDF'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subject horizontal chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectScroll}
        >
          {SUBJECT_FILTERS.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.subjectChip, selectedSubject === s.id && styles.subjectChipActive]}
              onPress={() => setSelectedSubject(s.id)}
            >
              <Text
                style={[
                  styles.subjectChipText,
                  selectedSubject === s.id && styles.subjectChipTextActive,
                ]}
              >
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.brand.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : filteredMaterials.length === 0 ? (
          <View style={styles.emptyCard}>
            <BookOpen size={32} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No study materials found</Text>
          </View>
        ) : (
          filteredMaterials.map((item) => {
            const isVid = (item.type || '').toUpperCase().includes('VID');
            const fileUrl = item.fileUrl || item.url || null;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => openMaterial(fileUrl)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isVid ? Colors.brand.redLight : Colors.brand.blueLight },
                  ]}
                >
                  {isVid ? (
                    <Video size={18} color={Colors.brand.red} />
                  ) : (
                    <FileText size={18} color={Colors.brand.blue} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.materialTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.subjectTag}>
                      {item.subject?.name || item.subject || 'General'}
                    </Text>
                    {item.chapter && (
                      <Text style={styles.chapterTag} numberOfLines={1}>
                        {item.chapter?.name || item.chapter}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionBtn}>
                  {isVid ? (
                    <Play size={13} color={Colors.brand.blue} />
                  ) : (
                    <ExternalLink size={13} color={Colors.brand.blue} />
                  )}
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
    paddingBottom: 10,
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
  badgeCount: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radii.sm,
  },
  badgeCountText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
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
  typeRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface.subtle,
    borderRadius: Radii.md,
    padding: 3,
    marginBottom: 10,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: Radii.sm,
  },
  typeButtonActive: {
    backgroundColor: Colors.surface.card,
    ...Shadows.xs,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  typeTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  subjectScroll: {
    gap: 6,
    paddingBottom: 4,
  },
  subjectChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border.default,
    backgroundColor: Colors.surface.card,
  },
  subjectChipActive: {
    backgroundColor: Colors.brand.blueLight,
    borderColor: Colors.brand.blue,
  },
  subjectChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  subjectChipTextActive: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    padding: 12,
    marginBottom: 8,
    ...Shadows.xs,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  chapterTag: {
    fontSize: 10,
    color: Colors.text.muted,
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: Radii.sm,
    backgroundColor: Colors.brand.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
