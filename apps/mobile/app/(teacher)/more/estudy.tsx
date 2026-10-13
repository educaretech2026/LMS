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
} from 'lucide-react-native';

export default function TeacherEStudyScreen() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'ALL' | 'VIDEOS' | 'NOTES'>('ALL');

  // Upload Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [type, setType] = useState<'DOCUMENT' | 'VIDEO'>('DOCUMENT');
  const [url, setUrl] = useState('');
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadMaterials = async () => {
    try {
      const data = await fetchApi<any[]>('/study-materials');
      setMaterials(data || []);
    } catch (e) {
      console.error('Failed to load study materials', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMaterials();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadMaterials();
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: type === 'DOCUMENT' ? ['application/pdf', 'application/msword'] : ['video/*'],
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
      Alert.alert('Validation Error', 'Please enter a title for the study material.');
      return;
    }

    setUploading(true);
    try {
      let finalUrl = url.trim();

      // If local file was picked, upload to S3/R2 presigned URL
      if (selectedFileUri && selectedFileName) {
        const mime = type === 'DOCUMENT' ? 'application/pdf' : 'video/mp4';
        finalUrl = await uploadMobileFile(selectedFileUri, selectedFileName, mime);
      }

      if (!finalUrl) {
        Alert.alert('Validation Error', 'Please upload a file or provide a video/document URL.');
        setUploading(false);
        return;
      }

      await fetchApi('/study-materials', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          type: type === 'DOCUMENT' ? 'PDF' : 'VIDEO',
          subject: subject.trim() || 'General Academics',
          url: finalUrl,
        }),
      });

      Alert.alert('Success', 'Study material uploaded successfully!');
      setTitle('');
      setSubject('');
      setUrl('');
      setSelectedFileUri(null);
      setSelectedFileName(null);
      setShowUploadModal(false);
      loadMaterials();
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

  const filteredMaterials = materials.filter((m) => {
    const isVid = (m.type || '').toUpperCase().includes('VID');
    if (tab === 'VIDEOS' && !isVid) return false;
    if (tab === 'NOTES' && isVid) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const t = (m.title || '').toLowerCase();
      const s = (m.subject || m.subject?.name || '').toLowerCase();
      return t.includes(q) || s.includes(q);
    }
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Action Header */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>E-Study Repository</Text>
          <Text style={styles.headerSub}>Manage lecture videos & course notes for your batches</Text>
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

      {/* Search Bar */}
      <View style={styles.searchBar}>
        <Search size={18} color={Colors.text.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search materials by title or topic..."
          placeholderTextColor={Colors.text.muted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['ALL', 'VIDEOS', 'NOTES'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabChip, tab === t && styles.tabChipActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>
              {t === 'ALL' ? `All (${materials.length})` : t === 'VIDEOS' ? 'Video Lectures' : 'PDF Notes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Material List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Loading study materials...</Text>
          </View>
        ) : filteredMaterials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BookOpen size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No Materials Found</Text>
            <Text style={styles.emptySubtitle}>Upload lecture notes or videos to share with your students.</Text>
          </View>
        ) : (
          filteredMaterials.map((item) => {
            const isVid = (item.type || '').toUpperCase().includes('VID');
            const subj = item.subject?.name || item.subject || 'Course Notes';

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
                  <Text style={styles.subjectTag}>{subj}</Text>
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
                <Text style={styles.modalTitle}>Upload Study Material</Text>
                <Text style={styles.modalSubtitle}>Share documents or lectures with learners</Text>
              </View>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Unit 4 Electrostatics Handout"
                  placeholderTextColor={Colors.text.muted}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subject / Topic</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Physics / Electromagnetism"
                  placeholderTextColor={Colors.text.muted}
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>

              {/* Type Selector */}
              <View style={styles.typeSelectorRow}>
                <TouchableOpacity
                  style={[styles.typeOption, type === 'DOCUMENT' && styles.typeOptionActive]}
                  onPress={() => setType('DOCUMENT')}
                >
                  <FileText size={16} color={type === 'DOCUMENT' ? Colors.brand.blue : Colors.text.muted} />
                  <Text style={[styles.typeText, type === 'DOCUMENT' && styles.typeTextActive]}>
                    PDF Document
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.typeOption, type === 'VIDEO' && styles.typeOptionActive]}
                  onPress={() => setType('VIDEO')}
                >
                  <Video size={16} color={type === 'VIDEO' ? '#7C3AED' : Colors.text.muted} />
                  <Text style={[styles.typeText, type === 'VIDEO' && { color: '#7C3AED', fontWeight: '700' }]}>
                    Video Lecture
                  </Text>
                </TouchableOpacity>
              </View>

              {/* File Picker or URL */}
              <TouchableOpacity style={styles.filePickerBox} onPress={handlePickDocument}>
                <UploadCloud size={28} color={Colors.brand.blue} />
                <Text style={styles.filePickerPrompt}>
                  {selectedFileName ? selectedFileName : 'Tap to pick PDF / Media from device'}
                </Text>
                <Text style={styles.filePickerSub}>Files are stored securely in cloud storage</Text>
              </TouchableOpacity>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Or enter direct URL / YouTube link</Text>
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
                    <Text style={styles.submitUploadBtnText}>Publish Material</Text>
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
  topHeader: {
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
  searchBar: {
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
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tabChipActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabChipTextActive: {
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
    fontWeight: '700',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
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
    padding: 20,
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
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
