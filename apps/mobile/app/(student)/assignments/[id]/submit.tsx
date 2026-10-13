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
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { fetchApi } from '../../../../lib/api';
import { uploadMobileFile } from '../../../../lib/upload';
import { Colors, Shadows } from '../../../../lib/theme';
import {
  ClipboardList,
  Calendar,
  Camera,
  FileUp,
  Award,
  CheckCircle2,
  Trash2,
  Download,
} from 'lucide-react-native';

export default function SubmitAssignmentScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchApi<any>(`/assignments/${id}`);
        setAssignment(data);
        if (data.submissions && data.submissions.length > 0) {
          const sub = data.submissions[0];
          setNotes(sub.notes || '');
          if (Array.isArray(sub.attachments)) {
            setAttachmentUrls(sub.attachments);
          }
        }
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to load assignment');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

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
        const filename = `assignment_${Date.now()}.jpg`;
        const uploadedUrl = await uploadMobileFile(asset.uri, filename, 'image/jpeg');
        setAttachmentUrls((prev) => [...prev, uploadedUrl]);
      }
    } catch (e: any) {
      Alert.alert('Upload Failed', e.message || 'Could not upload attachment');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!notes.trim() && attachmentUrls.length === 0) {
      Alert.alert('Incomplete', 'Please provide notes or attach a file before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      await fetchApi(`/assignments/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          notes,
          attachments: attachmentUrls,
        }),
      });

      Alert.alert('Success', 'Your assignment has been submitted to your teacher!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  const submission = assignment?.submissions && assignment.submissions.length > 0 ? assignment.submissions[0] : null;
  const isGraded = submission?.status === 'GRADED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Assignment Header Card */}
      <View style={styles.card}>
        <View style={styles.subjectBadge}>
          <Text style={styles.subjectBadgeText}>{assignment?.subject?.name || 'Subject'}</Text>
        </View>
        <Text style={styles.title}>{assignment?.title}</Text>
        {assignment?.description ? (
          <Text style={styles.desc}>{assignment.description}</Text>
        ) : null}

        <View style={styles.dueRow}>
          <Calendar size={13} color={Colors.text.muted} />
          <Text style={styles.dueText}>
            Due: {assignment?.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No date'}
          </Text>
        </View>
      </View>

      {/* If Graded: Score and Teacher Feedback Banner */}
      {isGraded ? (
        <View style={styles.gradedCard}>
          <View style={styles.gradedHeader}>
            <Award size={20} color={Colors.status.success} />
            <Text style={styles.gradedTitle}>Graded: {submission.grade} Marks</Text>
          </View>
          {submission.feedback ? (
            <Text style={styles.feedbackText}>
              Teacher Feedback: "{submission.feedback}"
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Submission Form Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {submission ? 'Your Submission' : 'Turn In Your Work'}
        </Text>

        <Text style={styles.fieldLabel}>Student Notes & Explanations</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Type any answers or explanatory notes for your teacher..."
          placeholderTextColor={Colors.text.muted}
          multiline
          numberOfLines={4}
          value={notes}
          onChangeText={setNotes}
          editable={!isGraded}
        />

        {/* Attachment Uploads */}
        <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Worksheet / Photo Attachments</Text>
        
        {attachmentUrls.map((url, idx) => (
          <View key={idx} style={styles.attachmentRow}>
            <Image source={{ uri: url }} style={styles.previewThumbnail} />
            <Text style={styles.attachmentName} numberOfLines={1}>
              Attachment {idx + 1}
            </Text>
            {!isGraded ? (
              <TouchableOpacity
                onPress={() => setAttachmentUrls((prev) => prev.filter((_, i) => i !== idx))}
                style={styles.deleteAttach}
              >
                <Trash2 size={16} color={Colors.brand.red} />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}

        {!isGraded ? (
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={pickImage}
            disabled={uploadingFile}
            activeOpacity={0.8}
          >
            {uploadingFile ? (
              <ActivityIndicator size="small" color={Colors.brand.blue} />
            ) : (
              <>
                <Camera size={16} color={Colors.brand.blue} />
                <Text style={styles.uploadButtonText}>Attach Photo / Solution Document</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {!isGraded ? (
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {submission ? 'Update Submission' : 'Submit Homework'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
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
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 16,
    ...Shadows.sm,
  },
  subjectBadge: {
    backgroundColor: Colors.brand.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  subjectBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  desc: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 6,
    lineHeight: 18,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 14,
  },
  dueText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  gradedCard: {
    backgroundColor: Colors.status.successLight,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  gradedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gradedTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.status.success,
  },
  feedbackText: {
    fontSize: 12,
    color: Colors.text.primary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  textArea: {
    backgroundColor: Colors.surface.subtle,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: Colors.text.primary,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.subtle,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  previewThumbnail: {
    width: 36,
    height: 36,
    borderRadius: 6,
    marginRight: 10,
  },
  attachmentName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  deleteAttach: {
    padding: 6,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand.blue,
    borderRadius: 12,
    paddingVertical: 12,
    backgroundColor: Colors.brand.blueLight,
    gap: 6,
    marginTop: 6,
  },
  uploadButtonText: {
    color: Colors.brand.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: Colors.brand.blue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    ...Shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
