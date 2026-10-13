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
import { Camera, Trash2, Send } from 'lucide-react-native';
import { AcademicHierarchyPicker, AcademicHierarchyValue } from '../../../components/AcademicHierarchyPicker';

export default function CreateAssignmentScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hierarchy, setHierarchy] = useState<AcademicHierarchyValue>({});
  const [dueDateDays, setDueDateDays] = useState(3);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setUploadingFile(true);
        const filename = `assignment_doc_${Date.now()}.jpg`;
        const url = await uploadMobileFile(asset.uri, filename, 'image/jpeg');
        setAttachmentUrl(url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Could not upload worksheet file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Incomplete', 'Please enter an assignment title.');
      return;
    }
    if (!hierarchy.batchId || !hierarchy.subjectId) {
      Alert.alert('Missing Target', 'Please select academic hierarchy down to Subject and Batch.');
      return;
    }

    setSubmitting(true);
    try {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + dueDateDays);

      await fetchApi('/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          batchId: hierarchy.batchId,
          subjectId: hierarchy.subjectId,
          dueDate: dueDate.toISOString(),
          attachments: attachmentUrl ? [{ url: attachmentUrl, filename: 'worksheet.jpg' }] : [],
        }),
      });

      Alert.alert('Success', 'Homework assignment posted to students!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Title */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Assignment Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Chapter 4 Practice Worksheet"
          placeholderTextColor={Colors.text.muted}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Instructions & Tasks</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Specify exercise numbers, questions, or guidance..."
          placeholderTextColor={Colors.text.muted}
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Target Academic Hierarchy */}
      <AcademicHierarchyPicker
        label="Target Academic Level & Batch"
        required
        value={hierarchy}
        onChange={setHierarchy}
      />

      {/* Due Date Offset */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Due In Days</Text>
        <View style={styles.dueRow}>
          {[1, 2, 3, 5, 7].map((days) => (
            <TouchableOpacity
              key={days}
              style={[styles.dueChip, dueDateDays === days && styles.dueChipActive]}
              onPress={() => setDueDateDays(days)}
            >
              <Text style={[styles.dueChipText, dueDateDays === days && styles.dueChipTextActive]}>
                {days} {days === 1 ? 'Day' : 'Days'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Worksheet Photo Upload */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Worksheet Attachment (Optional)</Text>
        {attachmentUrl ? (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: attachmentUrl }} style={styles.imagePreview} resizeMode="contain" />
            <TouchableOpacity onPress={() => setAttachmentUrl('')} style={styles.deleteAttachBtn}>
              <Trash2 size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.uploadBtn}
            onPress={pickImage}
            disabled={uploadingFile}
            activeOpacity={0.8}
          >
            {uploadingFile ? (
              <ActivityIndicator color={Colors.brand.blue} />
            ) : (
              <>
                <Camera size={18} color={Colors.brand.blue} />
                <Text style={styles.uploadBtnText}>Attach Worksheet / Question Paper</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        onPress={handleCreate}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Send size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Post Assignment to Batch</Text>
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
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  chipRow: {
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
  dueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dueChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  dueChipActive: {
    backgroundColor: Colors.brand.blueLight,
    borderColor: Colors.brand.blue,
  },
  dueChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  dueChipTextActive: {
    color: Colors.brand.blue,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: Colors.brand.blueLight,
    gap: 8,
  },
  uploadBtnText: {
    color: Colors.brand.blue,
    fontSize: 13,
    fontWeight: '700',
  },
  imagePreviewWrap: {
    position: 'relative',
    backgroundColor: Colors.surface.card,
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  deleteAttachBtn: {
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
