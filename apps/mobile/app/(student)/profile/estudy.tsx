import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import {
  BookOpen,
  FileText,
  Video,
  ExternalLink,
  Search,
  Atom,
  FlaskConical,
  Calculator,
  Dna,
  FolderOpen,
} from 'lucide-react-native';

const DEFAULT_SUBJECTS = [
  { id: 'all', name: 'All Subjects', icon: BookOpen, color: '#0F52BA', bg: '#EFF6FF' },
  { id: 'physics', name: 'Physics', icon: Atom, color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'chemistry', name: 'Chemistry', icon: FlaskConical, color: '#059669', bg: '#D1FAE5' },
  { id: 'mathematics', name: 'Mathematics', icon: Calculator, color: '#D97706', bg: '#FEF3C7' },
  { id: 'biology', name: 'Biology', icon: Dna, color: '#DC2626', bg: '#FEE2E2' },
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

  const filteredMaterials = materials.filter((m) => {
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

  const getSubjectMaterialCount = (subjectKeyword: string) => {
    if (subjectKeyword === 'all') return materials.length;
    return materials.filter((m) => {
      const s = (m.subject?.name || m.subject || '').toLowerCase();
      return s.includes(subjectKeyword.toLowerCase());
    }).length;
  };

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by topic, lesson, or chapter..."
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Horizontal Subject Carousel */}
      <View style={styles.subjectSection}>
        <Text style={styles.sectionHeading}>CURRICULUM SUBJECTS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectScroll}
        >
          {DEFAULT_SUBJECTS.map((sub) => {
            const IconComponent = sub.icon;
            const count = getSubjectMaterialCount(sub.id);
            const isSelected = selectedSubject === sub.id;

            return (
              <TouchableOpacity
                key={sub.id}
                style={[
                  styles.subjectCard,
                  isSelected && styles.subjectCardSelected,
                ]}
                onPress={() => setSelectedSubject(sub.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.subjectIconCircle, { backgroundColor: sub.bg }]}>
                  <IconComponent size={20} color={sub.color} />
                </View>
                <Text style={[styles.subjectName, isSelected && styles.subjectNameSelected]}>
                  {sub.name}
                </Text>
                <Text style={styles.subjectCount}>{count} items</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Format Category Filter Pills */}
      <View style={styles.formatFilterRow}>
        {(['ALL', 'VIDEOS', 'NOTES'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.formatChip, resourceType === t && styles.formatChipActive]}
            onPress={() => setResourceType(t)}
          >
            <Text style={[styles.formatChipText, resourceType === t && styles.formatChipTextActive]}>
              {t === 'ALL' ? 'All Resources' : t === 'VIDEOS' ? '🎬 Video Lectures' : '📄 PDF Handouts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Loading curriculum notes...</Text>
          </View>
        ) : filteredMaterials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FolderOpen size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No Materials Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedSubject !== 'all'
                ? `No lecture notes uploaded for ${selectedSubject} yet.`
                : 'Faculty will post study notes and class recordings here.'}
            </Text>
          </View>
        ) : (
          filteredMaterials.map((item) => {
            const isVid = (item.type || '').toUpperCase().includes('VID');
            const subj = item.subject?.name || item.subject || 'Academics';
            const chapter = item.chapter?.name || item.topic || 'Resource';

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                onPress={() => openMaterial(item.url)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isVid ? '#EDE9FE' : '#EFF6FF' },
                  ]}
                >
                  {isVid ? (
                    <Video size={22} color="#7C3AED" />
                  ) : (
                    <FileText size={22} color={Colors.brand.blue} />
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.subjectTag}>{subj}</Text>
                    <Text style={styles.topicTag}>• {chapter}</Text>
                  </View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemMeta}>
                    {isVid ? 'High-Def Video' : 'PDF Document'} •{' '}
                    {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                <View style={styles.openPill}>
                  <ExternalLink size={14} color={Colors.brand.blue} />
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
  subjectSection: {
    marginTop: 14,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 0.8,
    marginLeft: 16,
    marginBottom: 8,
  },
  subjectScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  subjectCard: {
    width: 110,
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadows.sm,
  },
  subjectCardSelected: {
    borderColor: Colors.brand.blue,
    borderWidth: 2,
    backgroundColor: '#FAFCFF',
  },
  subjectIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  subjectNameSelected: {
    color: Colors.brand.blue,
    fontWeight: '800',
  },
  subjectCount: {
    fontSize: 10,
    color: Colors.text.muted,
    marginTop: 2,
  },
  formatFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 14,
    gap: 8,
  },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  formatChipActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  formatChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  formatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    gap: 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 12,
    ...Shadows.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectTag: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
  },
  topicTag: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  openPill: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
});
