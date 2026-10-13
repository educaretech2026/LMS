import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { fetchApi } from '../../../lib/api';
import { uploadMobileFile } from '../../../lib/upload';
import { Colors, Shadows } from '../../../lib/theme';
import { Camera, Trash2, Send, AlertTriangle } from 'lucide-react-native';

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

export default function AskDoubtModal() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<typeof PRIORITIES[number]>('MEDIUM');
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(true);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [subList, staffList] = await Promise.all([
          fetchApi<any[]>('/setup/subjects').catch(() => []),
          fetchApi<any[]>('/staff').catch(() => []),
        ]);
        setSubjects(subList || []);
        if (subList && subList.length > 0) setSelectedSubjectId(subList[0].id);

        const faculty = (staffList || []).filter(
          (s: any) => s.role === 'TEACHER' || s.role?.name === 'TEACHER' || s.teacherProfile
        );
        setTeachers(faculty);
        if (faculty.length > 0) setSelectedTeacherId(faculty[0].userId || faculty[0].id);
      } catch (err) {
        console.error('Failed to load subjects or teachers', err);
      } finally {
        setLoadingSetup(false);
      }
    }
    loadMeta();
  }, []);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingImage(true);
        const filename = `doubt_${Date.now()}.jpg`;
        const url = await uploadMobileFile(asset.uri, filename, 'image/jpeg');
        setImageUrl(url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Could not upload doubt image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Field', 'Please enter a question title or topic.');
      return;
    }
    if (!selectedTeacherId) {
      Alert.alert('Missing Teacher', 'Please select a faculty member to ask.');
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi('/doubts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
          subjectId: selectedSubjectId || undefined,
          teacherId: selectedTeacherId,
          attachments: imageUrl ? [{ url: imageUrl, filename: 'photo.jpg', type: 'IMAGE' }] : [],
        }),
      });

      Alert.alert('Doubt Posted', 'Your question has been assigned to the teacher.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Submission Error', err.message || 'Failed to submit doubt.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingSetup) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Question Headline *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Can't balance Redox Equation in Step 2"
          placeholderTextColor={Colors.text.muted}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Detailed Explanation</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe where you got stuck or what concept is unclear..."
          placeholderTextColor={Colors.text.muted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Subject Picker */}
      {subjects.length > 0 ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {subjects.map((sub) => {
              const isSelected = selectedSubjectId === sub.id;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSelectedSubjectId(sub.id)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Teacher Picker */}
      {teachers.length > 0 ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Select Teacher to Ask *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
            {teachers.map((t) => {
              const tid = t.userId || t.id;
              const isSelected = selectedTeacherId === tid;
              const tname = `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.name || 'Teacher';

              return (
                <TouchableOpacity
                  key={tid}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSelectedTeacherId(tid)}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {tname}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Priority Selector */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Priority Level</Text>
        <View style={styles.priorityRow}>
          {PRIORITIES.map((p) => {
            const isSelected = priority === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.priorityChip, isSelected && styles.priorityChipActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityText, isSelected && styles.priorityTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Photo Attachment */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Textbook / Problem Snapshot</Text>
        {imageUrl ? (
          <View style={styles.imagePreviewWrapper}>
            <Image source={{ uri: imageUrl }} style={styles.imagePreview} resizeMode="contain" />
            <TouchableOpacity onPress={() => setImageUrl('')} style={styles.deleteImageBtn}>
              <Trash2 size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickImage}
            disabled={uploadingImage}
            activeOpacity={0.8}
          >
            {uploadingImage ? (
              <ActivityIndicator color={Colors.brand.blue} />
            ) : (
              <>
                <Camera size={20} color={Colors.brand.blue} />
                <Text style={styles.uploadBtnText}>Attach Photo of Question</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Send size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Post Doubt</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: Colors.text.primary,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  pickerRow: {
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  chipActive: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  priorityChipActive: {
    backgroundColor: Colors.brand.blueLight,
    borderColor: Colors.brand.blue,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  priorityTextActive: {
    color: Colors.brand.blue,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.blue,
    borderRadius: 14,
    paddingVertical: 16,
    backgroundColor: Colors.brand.blueLight,
    gap: 8,
  },
  uploadBtnText: {
    color: Colors.brand.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  imagePreviewWrapper: {
    position: 'relative',
    backgroundColor: Colors.surface.card,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
  },
  deleteImageBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: Colors.brand.red,
    padding: 6,
    borderRadius: 8,
  },
  submitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 10,
    ...Shadows.sm,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
