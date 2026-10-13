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
  Alert,
  Modal,
  Linking,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { fetchApi } from '../../../lib/api';
import { uploadMobileFile } from '../../../lib/upload';
import { Colors, Shadows } from '../../../lib/theme';
import { AcademicHierarchyPicker, AcademicHierarchyValue } from '../../../components/AcademicHierarchyPicker';
import {
  BookOpen,
  Plus,
  Video,
  FileText,
  Search,
  ExternalLink,
  Trash2,
  X,
  CheckCircle2,
  UploadCloud,
  Sparkles,
  Atom,
  FlaskConical,
  Calculator,
  Dna,
  ChevronRight,
  FolderOpen,
  Layers,
} from 'lucide-react-native';

const DEFAULT_SUBJECTS = [
  { id: 'all', name: 'All Subjects', icon: BookOpen, color: Colors.brand.blue, bg: Colors.brand.blueLight },
  { id: 'physics', name: 'Physics', icon: Atom, color: Colors.brand.indigo, bg: Colors.brand.indigoLight },
  { id: 'chemistry', name: 'Chemistry', icon: FlaskConical, color: Colors.brand.emerald, bg: Colors.brand.emeraldLight },
  { id: 'mathematics', name: 'Mathematics', icon: Calculator, color: Colors.brand.amber, bg: Colors.brand.amberLight },
  { id: 'biology', name: 'Biology', icon: Dna, color: Colors.brand.red, bg: Colors.brand.redLight },
];

export default function TeacherEStudyCurriculumScreen() {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [resourceType, setResourceType] = useState<'ALL' | 'VIDEOS' | 'NOTES'>('ALL');
  const [materials, setMaterials] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Main filter hierarchy
  const [filterHierarchy, setFilterHierarchy] = useState<AcademicHierarchyValue>({});

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [uploadHierarchy, setUploadHierarchy] = useState<AcademicHierarchyValue>({});

  // Deep Curriculum State (Chapter, Topic, Subtopic)
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [customChapterName, setCustomChapterName] = useState('');

  const [topics, setTopics] = useState<any[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [customTopicName, setCustomTopicName] = useState('');

  const [subtopics, setSubtopics] = useState<any[]>([]);
  const [selectedSubtopicId, setSelectedSubtopicId] = useState<string | null>(null);
  const [customSubtopicName, setCustomSubtopicName] = useState('');

  const [uploadType, setUploadType] = useState<'DOCUMENT' | 'VIDEO'>('DOCUMENT');
  const [url, setUrl] = useState('');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    try {
      const [materialsData, subjectsData] = await Promise.all([
        fetchApi<any[]>('/study-materials').catch(() => []),
        fetchApi<any[]>('/setup/subjects').catch(() => []),
      ]);
      setMaterials(materialsData || []);
      setSubjectsList(subjectsData || []);
    } catch (e) {
      console.error('Failed to load study materials', e);
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

  // Cascade Chapters when syllabusId or board+standard+subject change
  useEffect(() => {
    let isMounted = true;
    async function loadChapters() {
      if (!uploadHierarchy.syllabusId && (!uploadHierarchy.boardId || !uploadHierarchy.standardId)) {
        setChapters([]);
        return;
      }
      try {
        let sylId = uploadHierarchy.syllabusId;
        if (!sylId && uploadHierarchy.boardId && uploadHierarchy.standardId && uploadHierarchy.subjectId) {
          const syls = await fetchApi<any[]>(
            `/setup/syllabi?boardId=${uploadHierarchy.boardId}&standardId=${uploadHierarchy.standardId}`
          ).catch(() => []);
          const match = syls.find(s => s.subjectId === uploadHierarchy.subjectId || s.subject?.id === uploadHierarchy.subjectId);
          if (match) sylId = match.id;
        }

        const query = sylId ? `?syllabusId=${sylId}` : '';
        const chList = await fetchApi<any[]>(`/setup/chapters${query}`).catch(() => []);
        if (isMounted) {
          setChapters(Array.isArray(chList) ? chList : []);
        }
      } catch (e) {
        if (isMounted) setChapters([]);
      }
    }
    loadChapters();
    return () => { isMounted = false; };
  }, [uploadHierarchy.syllabusId, uploadHierarchy.boardId, uploadHierarchy.standardId, uploadHierarchy.subjectId]);

  // Cascade Topics when chapter is selected
  useEffect(() => {
    let isMounted = true;
    async function loadTopics() {
      if (!selectedChapterId) {
        setTopics([]);
        setSelectedTopicId(null);
        return;
      }
      const ch = chapters.find(c => c.id === selectedChapterId);
      if (ch && Array.isArray(ch.topics) && ch.topics.length > 0) {
        setTopics(ch.topics);
        return;
      }
      try {
        const tList = await fetchApi<any[]>(`/setup/topics?chapterId=${selectedChapterId}`).catch(() => []);
        if (isMounted) {
          setTopics(Array.isArray(tList) ? tList : []);
        }
      } catch (e) {
        if (isMounted) setTopics([]);
      }
    }
    loadTopics();
    return () => { isMounted = false; };
  }, [selectedChapterId, chapters]);

  // Cascade Subtopics when topic is selected
  useEffect(() => {
    let isMounted = true;
    async function loadSubtopics() {
      if (!selectedTopicId) {
        setSubtopics([]);
        setSelectedSubtopicId(null);
        return;
      }
      const tp = topics.find(t => t.id === selectedTopicId);
      if (tp && Array.isArray(tp.subtopics) && tp.subtopics.length > 0) {
        setSubtopics(tp.subtopics);
        return;
      }
      try {
        const stList = await fetchApi<any[]>(`/setup/subtopics?topicId=${selectedTopicId}`).catch(() => []);
        if (isMounted) {
          setSubtopics(Array.isArray(stList) ? stList : []);
        }
      } catch (e) {
        if (isMounted) setSubtopics([]);
      }
    }
    loadSubtopics();
    return () => { isMounted = false; };
  }, [selectedTopicId, topics]);

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: uploadType === 'DOCUMENT' ? ['application/pdf', 'application/msword'] : ['video/*'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets[0]) {
        const file = res.assets[0];
        setSelectedFileUri(file.uri);
        setSelectedFileName(file.name);
      }
    } catch (err: any) {
      Alert.alert('Error picking document', err.message);
    }
  };

  const handleUploadMaterial = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a title for the study material.');
      return;
    }
    if (!uploadHierarchy.boardId || !uploadHierarchy.standardId || !uploadHierarchy.subjectId) {
      Alert.alert('Missing Hierarchy', 'Please select Board, Class, and Subject using the hierarchy picker.');
      return;
    }

    setUploading(true);
    try {
      let finalUrl = url.trim();

      if (selectedFileUri && selectedFileName) {
        const mime = uploadType === 'DOCUMENT' ? 'application/pdf' : 'video/mp4';
        finalUrl = await uploadMobileFile(selectedFileUri, selectedFileName, mime);
      }

      if (!finalUrl) {
        Alert.alert('Missing Resource', 'Please attach a file or provide a video/document URL.');
        setUploading(false);
        return;
      }

      // Resolve or create chapter if custom name entered
      let finalChapterId = selectedChapterId;
      if (!finalChapterId && customChapterName.trim() && uploadHierarchy.syllabusId) {
        try {
          const newCh = await fetchApi('/setup/chapters', {
            method: 'POST',
            body: JSON.stringify({ name: customChapterName.trim(), syllabusId: uploadHierarchy.syllabusId }),
          });
          if (newCh?.id) finalChapterId = newCh.id;
        } catch (e) {
          // Fall back gracefully
        }
      }

      // Resolve or create topic if custom name entered (optional)
      let finalTopicId = selectedTopicId;
      if (!finalTopicId && customTopicName.trim() && finalChapterId) {
        try {
          const newTop = await fetchApi('/setup/topics', {
            method: 'POST',
            body: JSON.stringify({ name: customTopicName.trim(), chapterId: finalChapterId }),
          });
          if (newTop?.id) finalTopicId = newTop.id;
        } catch (e) {
          // Fall back gracefully
        }
      }

      // Resolve or create subtopic if custom name entered (optional)
      let finalSubtopicId = selectedSubtopicId;
      if (!finalSubtopicId && customSubtopicName.trim() && finalTopicId) {
        try {
          const newSub = await fetchApi('/setup/subtopics', {
            method: 'POST',
            body: JSON.stringify({ name: customSubtopicName.trim(), topicId: finalTopicId }),
          });
          if (newSub?.id) finalSubtopicId = newSub.id;
        } catch (e) {
          // Fall back gracefully
        }
      }

      await fetchApi('/study-materials', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          type: uploadType === 'DOCUMENT' ? 'PDF' : 'VIDEO',
          boardId: uploadHierarchy.boardId,
          standardId: uploadHierarchy.standardId,
          subjectId: uploadHierarchy.subjectId,
          syllabusId: uploadHierarchy.syllabusId,
          chapterId: finalChapterId || undefined,
          topicId: finalTopicId || undefined,
          subtopicId: finalSubtopicId || undefined,
          url: finalUrl,
        }),
      });

      Alert.alert('Published', 'Study material published to curriculum successfully!');
      setTitle('');
      setUrl('');
      setSelectedFileUri(null);
      setSelectedFileName(null);
      setSelectedChapterId(null);
      setCustomChapterName('');
      setSelectedTopicId(null);
      setCustomTopicName('');
      setSelectedSubtopicId(null);
      setCustomSubtopicName('');
      setShowUploadModal(false);
      loadData();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload study material');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = (id: string) => {
    Alert.alert('Delete Material', 'Are you sure you want to remove this study material?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetchApi(`/study-materials/${id}`, { method: 'DELETE' });
            setMaterials((prev) => prev.filter((m) => m.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete material');
          }
        },
      },
    ]);
  };

  const handleOpenMaterial = (item: any) => {
    const targetUrl = item.url || item.playUrl;
    if (targetUrl) {
      Linking.openURL(targetUrl).catch(() => {
        Alert.alert('Error', 'Cannot open document link.');
      });
    }
  };

  // Filter Materials
  const filteredMaterials = materials.filter((m) => {
    const isVid = (m.type || '').toUpperCase().includes('VID');

    // Resource Type Filter
    if (resourceType === 'VIDEOS' && !isVid) return false;
    if (resourceType === 'NOTES' && isVid) return false;

    // Subject Filter
    if (selectedSubject !== 'all') {
      const sName = (m.subject?.name || m.subject || '').toLowerCase();
      if (!sName.includes(selectedSubject.toLowerCase())) return false;
    }

    // Keyword Search
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
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>E-Study Curriculum Hub</Text>
          <Text style={styles.headerSub}>Structured syllabus materials, handouts & video lessons</Text>
        </View>

        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => setShowUploadModal(true)}
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by topic, chapter, or handout title..."
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Institutional Filter Hierarchy */}
      <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
        <AcademicHierarchyPicker
          label="Filter by Academic Level"
          showBatch={false}
          showSubject={false}
          value={filterHierarchy}
          onChange={setFilterHierarchy}
        />
      </View>

      {/* Horizontal Subject Carousel */}
      <View style={styles.subjectSection}>
        <Text style={styles.sectionHeading}>SELECT SUBJECT</Text>
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
              {t === 'ALL' ? 'All Formats' : t === 'VIDEOS' ? '🎬 Video Lectures' : '📄 PDF Handouts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Materials List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Fetching curriculum materials...</Text>
          </View>
        ) : filteredMaterials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FolderOpen size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No Materials Found</Text>
            <Text style={styles.emptySubtitle}>
              {selectedSubject !== 'all'
                ? `No items uploaded for ${selectedSubject} yet.`
                : 'Upload lecture notes or recorded classes to share with students.'}
            </Text>
            <TouchableOpacity
              style={styles.uploadPromptBtn}
              onPress={() => setShowUploadModal(true)}
            >
              <Plus size={14} color="#FFFFFF" />
              <Text style={styles.uploadPromptBtnText}>Upload to this Subject</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredMaterials.map((item) => {
            const isVid = (item.type || '').toUpperCase().includes('VID');
            const subj = item.syllabus?.subject?.name || item.subject?.name || item.subject || 'Academics';
            const boardName = item.syllabus?.board?.name;
            const stdName = item.syllabus?.standard?.name;
            const chapterName = item.chapter?.name;
            const topicName = item.topic?.name;
            const subtopicName = item.subtopic?.name;

            return (
              <View key={item.id} style={styles.materialCard}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: isVid ? '#EDE9FE' : '#EFF6FF' },
                  ]}
                >
                  {isVid ? <Video size={22} color="#7C3AED" /> : <FileText size={22} color={Colors.brand.blue} />}
                </View>

                <View style={{ flex: 1 }}>
                  {(boardName || stdName) && (
                    <Text style={styles.boardBadgeText}>
                      {[boardName, stdName].filter(Boolean).join(' • ')}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <Text style={styles.subjectTag}>{subj}</Text>
                    {chapterName && <Text style={styles.topicTag}>• {chapterName}</Text>}
                    {topicName && <Text style={styles.subtopicTag}>› {topicName}</Text>}
                    {subtopicName && <Text style={styles.subtopicTag}>› {subtopicName}</Text>}
                  </View>
                  <Text style={styles.materialTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.materialMeta}>
                    {isVid ? 'Video Lecture' : 'PDF Document'} •{' '}
                    {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </Text>
                </View>

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.openBtn}
                    onPress={() => handleOpenMaterial(item)}
                    activeOpacity={0.8}
                  >
                    <ExternalLink size={16} color={Colors.brand.blue} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => handleDeleteMaterial(item.id)}
                    activeOpacity={0.8}
                  >
                    <Trash2 size={16} color={Colors.status.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Upload Material Modal */}
      <Modal visible={showUploadModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Upload Curriculum Material</Text>
                <Text style={styles.modalSubtitle}>Institutional hierarchy & curriculum mapping</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Institutional Hierarchy Picker */}
              <AcademicHierarchyPicker
                label="Academic Hierarchy"
                required
                showBatch={false}
                value={uploadHierarchy}
                onChange={setUploadHierarchy}
              />

              {/* Deep Curriculum Hierarchy: Chapter */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Chapter *</Text>
                  {selectedChapterId && (
                    <TouchableOpacity onPress={() => { setSelectedChapterId(null); setCustomChapterName(''); }}>
                      <Text style={{ fontSize: 11, color: Colors.brand.red, fontWeight: '600' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {chapters.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {chapters.map((c) => {
                      const sel = selectedChapterId === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.curriculumChip, sel && styles.curriculumChipActive]}
                          onPress={() => {
                            setSelectedChapterId(c.id);
                            setCustomChapterName(c.name);
                          }}
                        >
                          <Text style={[styles.curriculumChipText, sel && styles.curriculumChipTextActive]}>
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder={chapters.length > 0 ? 'Or enter custom chapter title' : 'Enter chapter title (e.g. Thermodynamics)'}
                  placeholderTextColor={Colors.text.muted}
                  value={customChapterName}
                  onChangeText={(txt) => {
                    setCustomChapterName(txt);
                    if (selectedChapterId) setSelectedChapterId(null);
                  }}
                />
              </View>

              {/* Deep Curriculum Hierarchy: Topic (Optional) */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Topic (Optional)</Text>
                  {selectedTopicId && (
                    <TouchableOpacity onPress={() => { setSelectedTopicId(null); setCustomTopicName(''); }}>
                      <Text style={{ fontSize: 11, color: Colors.brand.red, fontWeight: '600' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {topics.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {topics.map((t) => {
                      const sel = selectedTopicId === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.curriculumChip, sel && styles.curriculumChipActive]}
                          onPress={() => {
                            setSelectedTopicId(t.id);
                            setCustomTopicName(t.name);
                          }}
                        >
                          <Text style={[styles.curriculumChipText, sel && styles.curriculumChipTextActive]}>
                            {t.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder="Optional topic (e.g. Carnot Cycle)"
                  placeholderTextColor={Colors.text.muted}
                  value={customTopicName}
                  onChangeText={(txt) => {
                    setCustomTopicName(txt);
                    if (selectedTopicId) setSelectedTopicId(null);
                  }}
                />
              </View>

              {/* Deep Curriculum Hierarchy: Subtopic (Optional) */}
              <View style={styles.inputGroup}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.inputLabel}>Subtopic (Optional)</Text>
                  {selectedSubtopicId && (
                    <TouchableOpacity onPress={() => { setSelectedSubtopicId(null); setCustomSubtopicName(''); }}>
                      <Text style={{ fontSize: 11, color: Colors.brand.red, fontWeight: '600' }}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {subtopics.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
                    {subtopics.map((st) => {
                      const sel = selectedSubtopicId === st.id;
                      return (
                        <TouchableOpacity
                          key={st.id}
                          style={[styles.curriculumChip, sel && styles.curriculumChipActive]}
                          onPress={() => {
                            setSelectedSubtopicId(st.id);
                            setCustomSubtopicName(st.name);
                          }}
                        >
                          <Text style={[styles.curriculumChipText, sel && styles.curriculumChipTextActive]}>
                            {st.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <TextInput
                  style={styles.textInput}
                  placeholder="Optional subtopic (e.g. Reversible Efficiency)"
                  placeholderTextColor={Colors.text.muted}
                  value={customSubtopicName}
                  onChangeText={(txt) => {
                    setCustomSubtopicName(txt);
                    if (selectedSubtopicId) setSelectedSubtopicId(null);
                  }}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Resource Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Unit 3 Comprehensive Formula Sheet"
                  placeholderTextColor={Colors.text.muted}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Type Selector */}
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeOption, uploadType === 'DOCUMENT' && styles.typeOptionActive]}
                  onPress={() => setUploadType('DOCUMENT')}
                >
                  <FileText size={16} color={uploadType === 'DOCUMENT' ? Colors.brand.blue : Colors.text.muted} />
                  <Text style={[styles.typeText, uploadType === 'DOCUMENT' && styles.typeTextActive]}>
                    PDF Document
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeOption, uploadType === 'VIDEO' && styles.typeOptionActive]}
                  onPress={() => setUploadType('VIDEO')}
                >
                  <Video size={16} color={uploadType === 'VIDEO' ? '#7C3AED' : Colors.text.muted} />
                  <Text style={[styles.typeText, uploadType === 'VIDEO' && { color: '#7C3AED', fontWeight: '700' }]}>
                    Video Lesson
                  </Text>
                </TouchableOpacity>
              </View>

              {/* File Picker or URL */}
              <TouchableOpacity style={styles.filePickerBox} onPress={handlePickDocument}>
                <UploadCloud size={26} color={Colors.brand.blue} />
                <Text style={styles.filePickerPrompt}>
                  {selectedFileName ? selectedFileName : 'Pick File from Mobile Device'}
                </Text>
                <Text style={styles.filePickerSub}>Files upload directly to cloud storage</Text>
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Or Enter Video / Resource Link</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://..."
                  placeholderTextColor={Colors.text.muted}
                  value={url}
                  onChangeText={setUrl}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitUploadBtn, uploading && styles.submitUploadBtnDisabled]}
                onPress={handleUploadMaterial}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={styles.submitUploadBtnText}>Publish to Curriculum</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...Shadows.sm,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  uploadPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  uploadPromptBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  materialCard: {
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
  materialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  materialMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  openBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  trashBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  modalBody: {
    paddingVertical: 14,
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  subjectChipsSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chipOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  chipOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.brand.blue,
  },
  chipOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  chipOptionTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text.primary,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  typeOptionActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  typeTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  filePickerBox: {
    borderWidth: 2,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 6,
  },
  filePickerPrompt: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.blue,
    textAlign: 'center',
  },
  filePickerSub: {
    fontSize: 11,
    color: Colors.text.muted,
  },
  submitUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.brand.blue,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
    ...Shadows.glowBlue,
  },
  submitUploadBtnDisabled: {
    opacity: 0.6,
  },
  submitUploadBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  boardBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtopicTag: {
    fontSize: 10,
    color: Colors.text.muted,
    fontWeight: '500',
  },
  curriculumChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  curriculumChipActive: {
    backgroundColor: 'rgba(1,98,177,0.12)',
    borderColor: Colors.brand.blue,
  },
  curriculumChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  curriculumChipTextActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
});

