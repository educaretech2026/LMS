import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../hooks/useAuth';
import { fetchApi } from '../../../../lib/api';
import { Colors, Shadows } from '../../../../lib/theme';
import { pickAndUploadImage } from '../../../../lib/upload';
import {
  Send,
  CheckCircle2,
  Image as ImageIcon,
  User,
  AlertCircle,
  X,
  Clock,
  Sparkles,
  UserCheck,
} from 'lucide-react-native';

export default function TeacherDoubtChatScreen() {
  const { id } = useLocalSearchParams();
  const doubtId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const router = useRouter();

  const [doubt, setDoubt] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Faculty Reassignment Modal State
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  const loadThread = async () => {
    if (!doubtId || doubtId === 'undefined') return;
    try {
      const data = await fetchApi<any>(`/doubts/${doubtId}`);
      if (isMountedRef.current) {
        setDoubt(data);
        setMessages(data.messages || []);
      }
    } catch (e: any) {
      if (e?.status === 401) {
        return;
      }
      console.warn('Failed to load doubt thread:', e?.message || e);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (!doubtId || doubtId === 'undefined') {
      setLoading(false);
      return;
    }

    loadThread();
    const interval = setInterval(() => {
      loadThread();
    }, 5000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [doubtId]);

  const handlePickAttachment = async () => {
    try {
      setUploadingAttachment(true);
      const url = await pickAndUploadImage();
      if (url) {
        setPendingAttachment(url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Could not upload attachment');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!inputContent.trim() && !pendingAttachment) || sending) return;

    const messageText = inputContent.trim();
    const attachmentUrl = pendingAttachment;

    setInputContent('');
    setPendingAttachment(null);
    setSending(true);

    try {
      await fetchApi(`/doubts/${doubtId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: messageText,
          message: messageText,
          attachmentUrls: attachmentUrl ? [attachmentUrl] : undefined,
          attachments: attachmentUrl ? [attachmentUrl] : undefined,
        }),
      });

      // Automatically flip doubt status to ANSWERED if it was OPEN
      if (doubt?.status === 'OPEN') {
        try {
          await fetchApi(`/doubts/${doubtId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'ANSWERED' }),
          });
        } catch (_) {}
      }

      await loadThread();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (e: any) {
      Alert.alert('Send Error', e.message || 'Could not send message');
      setInputContent(messageText);
      setPendingAttachment(attachmentUrl);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'ANSWERED' | 'RESOLVED' | 'OPEN') => {
    if (!doubtId) return;
    try {
      await fetchApi(`/doubts/${doubtId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadThread();
      Alert.alert('Status Updated', `Doubt marked as ${newStatus.toLowerCase()}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status');
    }
  };

  const handleOpenReassignModal = async () => {
    setShowReassignModal(true);
    setLoadingTeachers(true);
    try {
      const list = await fetchApi<any[]>('/doubts/teachers/available');
      setTeachers(Array.isArray(list) ? list : []);
      // If currently assigned teacher exists, prefill
      if (doubt?.teacherId) {
        setSelectedTeacherId(doubt.teacherId);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not load faculty list');
    } finally {
      setLoadingTeachers(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!selectedTeacherId) {
      Alert.alert('Select Faculty', 'Please select a faculty member to delegate this doubt session.');
      return;
    }
    if (selectedTeacherId === doubt?.teacherId) {
      Alert.alert('Already Assigned', 'This doubt is already assigned to this faculty member.');
      return;
    }

    setReassigning(true);
    try {
      await fetchApi(`/doubts/${doubtId}/reassign`, {
        method: 'PATCH',
        body: JSON.stringify({ teacherId: selectedTeacherId }),
      });
      setShowReassignModal(false);
      Alert.alert('Faculty Reassigned', 'Doubt has been successfully delegated to the selected faculty.');
      await loadThread();
    } catch (err: any) {
      Alert.alert('Reassign Failed', err.message || 'Could not reassign doubt session');
    } finally {
      setReassigning(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  const studentName = doubt?.student?.user?.name || doubt?.student?.name || 'Student';
  const isResolved = doubt?.status === 'RESOLVED' || doubt?.status === 'CLOSED';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={styles.container}
    >
      {/* Student Question Summary Header */}
      <View style={styles.threadHeader}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <User size={13} color={Colors.brand.blue} />
              <Text style={styles.studentLabel}>Student: {studentName}</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {doubt?.title}
            </Text>
          </View>

          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{doubt?.status || 'OPEN'}</Text>
          </View>
        </View>

        <Text style={styles.doubtQuestion} numberOfLines={3}>
          {doubt?.description}
        </Text>

        {/* Action buttons row */}
        <View style={styles.statusBarRow}>
          {doubt?.status !== 'RESOLVED' && (
            <TouchableOpacity
              style={styles.resolveButton}
              onPress={() => handleUpdateStatus('RESOLVED')}
              activeOpacity={0.8}
            >
              <CheckCircle2 size={13} color="#FFFFFF" />
              <Text style={styles.resolveButtonText}>Mark Resolved</Text>
            </TouchableOpacity>
          )}

          {doubt?.status === 'RESOLVED' ? (
            <TouchableOpacity
              style={styles.reopenButton}
              onPress={() => handleUpdateStatus('OPEN')}
              activeOpacity={0.8}
            >
              <Text style={styles.reopenButtonText}>Reopen Doubt</Text>
            </TouchableOpacity>
          ) : doubt?.status !== 'ANSWERED' ? (
            <TouchableOpacity
              style={styles.markAnsweredButton}
              onPress={() => handleUpdateStatus('ANSWERED')}
              activeOpacity={0.8}
            >
              <Text style={styles.markAnsweredButtonText}>Mark Answered</Text>
            </TouchableOpacity>
          ) : null}

          {/* Reassign Faculty Button */}
          <TouchableOpacity
            style={styles.reassignButton}
            onPress={handleOpenReassignModal}
            activeOpacity={0.8}
          >
            <UserCheck size={13} color={Colors.brand.blue} />
            <Text style={styles.reassignButtonText}>Reassign</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages Thread */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => item.id || `msg-${index}`}
        contentContainerStyle={styles.messagesContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id || item.authorId === user?.id || item.sender?.id === user?.id;
          const senderRole = item.senderRole || item.sender?.role?.name || item.author?.role?.name || (isMe ? 'TEACHER' : 'STUDENT');
          const isTeacher = senderRole === 'TEACHER' || isMe;
          const authorName = item.sender?.name || item.author?.name || (isMe ? 'You' : studentName);

          const attachmentList: string[] = item.attachmentUrls || (item.attachments ? (Array.isArray(item.attachments) ? item.attachments : [item.attachments]) : []);

          return (
            <View style={[styles.messageRow, isTeacher ? styles.messageRowRight : styles.messageRowLeft]}>
              <View style={[styles.messageBubble, isTeacher ? styles.teacherBubble : styles.studentBubble]}>
                <View style={styles.bubbleAuthorRow}>
                  <Text style={[styles.bubbleAuthorName, isTeacher && styles.teacherBubbleAuthor]}>
                    {authorName}
                  </Text>
                  <View style={[styles.roleTag, isTeacher ? styles.teacherRoleTag : styles.studentRoleTag]}>
                    <Text style={[styles.roleTagText, isTeacher && { color: Colors.brand.blue }]}>
                      {isTeacher ? 'Faculty' : 'Student'}
                    </Text>
                  </View>
                </View>

                {item.content || item.message ? (
                  <Text style={[styles.messageText, isTeacher ? styles.teacherText : styles.studentText]}>
                    {item.content || item.message}
                  </Text>
                ) : null}

                {/* Attachments preview */}
                {attachmentList.length > 0 && (
                  <View style={styles.attachmentsContainer}>
                    {attachmentList.map((url, i) => (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.9}
                        onPress={() => setPreviewImage(url)}
                      >
                        <Image source={{ uri: url }} style={styles.messageImage} resizeMode="cover" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={[styles.messageTime, isTeacher ? styles.teacherTime : styles.studentTime]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Sparkles size={28} color={Colors.brand.blue} />
            <Text style={styles.emptyMessagesTitle}>Begin the conversation</Text>
            <Text style={styles.emptyMessagesSubtitle}>
              Provide a clear, detailed explanation or upload a solution diagram below.
            </Text>
          </View>
        }
      />

      {/* Attachment Preview (if selected) */}
      {pendingAttachment && (
        <View style={styles.pendingAttachmentCard}>
          <Image source={{ uri: pendingAttachment }} style={styles.pendingImage} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pendingText}>Image attachment attached</Text>
            <Text style={styles.pendingSub}>Ready to send with your answer</Text>
          </View>
          <TouchableOpacity onPress={() => setPendingAttachment(null)} style={styles.removePendingButton}>
            <X size={16} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}

      {/* Composer Input Bar */}
      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachmentButton}
          onPress={handlePickAttachment}
          disabled={uploadingAttachment}
        >
          {uploadingAttachment ? (
            <ActivityIndicator size="small" color={Colors.brand.blue} />
          ) : (
            <ImageIcon size={20} color={Colors.text.muted} />
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="Explain solution or concept..."
          placeholderTextColor={Colors.text.muted}
          value={inputContent}
          onChangeText={setInputContent}
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            (!inputContent.trim() && !pendingAttachment) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendMessage}
          disabled={(!inputContent.trim() && !pendingAttachment) || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Send size={18} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Modal for viewing image full-screen */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.imageModalBackground}>
          <TouchableOpacity style={styles.closeModalButton} onPress={() => setPreviewImage(null)}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Reassign Faculty Modal */}
      <Modal visible={showReassignModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Delegate Doubt Session</Text>
                <Text style={styles.modalSubtitle}>
                  Reassign to a specialized faculty member
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowReassignModal(false)}>
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {loadingTeachers ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={Colors.brand.blue} />
                <Text style={{ marginTop: 8, fontSize: 12, color: Colors.text.muted }}>
                  Fetching available faculty...
                </Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 340, marginTop: 12 }} showsVerticalScrollIndicator={false}>
                {teachers.map((t) => {
                  const isSel = selectedTeacherId === t.id;
                  const isCurrent = doubt?.teacherId === t.id;
                  const teacherName = `${t.firstName} ${t.lastName || ''}`.trim();
                  const subjectsStr =
                    t.teacherProfile?.subjects?.map((s: any) => s.name).join(', ') ||
                    (t.role?.name === 'TEACHER' ? 'Faculty Member' : 'Educare Staff');

                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.teacherCard, isSel && styles.teacherCardSelected]}
                      onPress={() => setSelectedTeacherId(t.id)}
                    >
                      <View style={[styles.teacherAvatar, isSel && styles.teacherAvatarSelected]}>
                        <User size={16} color={isSel ? '#FFFFFF' : Colors.brand.blue} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.teacherName, isSel && styles.teacherNameSelected]}>
                            Prof. {teacherName}
                          </Text>
                          {isCurrent && (
                            <View style={styles.currentBadge}>
                              <Text style={styles.currentBadgeText}>Current</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.teacherSubject}>{subjectsStr}</Text>
                      </View>
                      {isSel && (
                        <CheckCircle2 size={18} color={Colors.brand.blue} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.reassignModalFooter}>
              <TouchableOpacity
                style={[
                  styles.confirmReassignBtn,
                  (!selectedTeacherId || reassigning) && styles.btnDisabled,
                ]}
                onPress={handleConfirmReassign}
                disabled={!selectedTeacherId || reassigning}
              >
                {reassigning ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <UserCheck size={16} color="#FFFFFF" />
                    <Text style={styles.confirmReassignBtnText}>Confirm Reassignment</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  threadHeader: {
    backgroundColor: Colors.surface.card,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    ...Shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  studentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.brand.blue,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  doubtQuestion: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    marginVertical: 8,
  },
  statusBarRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resolveButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reopenButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  reopenButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  markAnsweredButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  markAnsweredButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 16,
    ...Shadows.sm,
  },
  teacherBubble: {
    backgroundColor: Colors.brand.blue,
    borderBottomRightRadius: 4,
  },
  studentBubble: {
    backgroundColor: Colors.surface.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  bubbleAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  bubbleAuthorName: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  teacherBubbleAuthor: {
    color: '#FFFFFF',
  },
  roleTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  teacherRoleTag: {
    backgroundColor: '#FFFFFF',
  },
  studentRoleTag: {
    backgroundColor: '#F1F5F9',
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.text.muted,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  teacherText: {
    color: '#FFFFFF',
  },
  studentText: {
    color: Colors.text.primary,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  teacherTime: {
    color: '#E0E7FF',
  },
  studentTime: {
    color: Colors.text.muted,
  },
  attachmentsContainer: {
    marginTop: 8,
    gap: 6,
  },
  messageImage: {
    width: 200,
    height: 140,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  emptyMessages: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyMessagesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  emptyMessagesSubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  pendingAttachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 8,
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 8,
  },
  pendingImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  pendingSub: {
    fontSize: 10,
    color: Colors.text.secondary,
  },
  removePendingButton: {
    padding: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: 8,
  },
  attachmentButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  imageModalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: '95%',
    height: '80%',
  },
  reassignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(1,98,177,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(1,98,177,0.25)',
  },
  reassignButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },

  // Reassign Modal
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.text.muted,
    marginTop: 2,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surface.subtle,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 8,
  },
  teacherCardSelected: {
    backgroundColor: 'rgba(1,98,177,0.08)',
    borderColor: Colors.brand.blue,
  },
  teacherAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatarSelected: {
    backgroundColor: Colors.brand.blue,
  },
  teacherName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  teacherNameSelected: {
    color: Colors.brand.blue,
  },
  teacherSubject: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 1,
  },
  currentBadge: {
    backgroundColor: 'rgba(1,98,177,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
  },
  reassignModalFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  confirmReassignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.brand.blue,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmReassignBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
