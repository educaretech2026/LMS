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
} from 'lucide-react-native';

export default function TeacherDoubtChatScreen() {
  const { id } = useLocalSearchParams();
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

  const flatListRef = useRef<FlatList>(null);

  const loadThread = async () => {
    try {
      const data = await fetchApi<any>(`/doubts/${id}`);
      setDoubt(data);
      setMessages(data.messages || []);
    } catch (e) {
      console.error('Failed to load doubt thread', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThread();
    const interval = setInterval(loadThread, 5000);
    return () => clearInterval(interval);
  }, [id]);

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
      await fetchApi(`/doubts/${id}/messages`, {
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
          await fetchApi(`/doubts/${id}/status`, {
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
    try {
      await fetchApi(`/doubts/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      await loadThread();
      Alert.alert('Status Updated', `Doubt marked as ${newStatus.toLowerCase()}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status');
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
});
