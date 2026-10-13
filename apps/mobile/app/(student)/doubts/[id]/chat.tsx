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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../../../hooks/useAuth';
import { fetchApi } from '../../../../lib/api';
import { Colors, Shadows } from '../../../../lib/theme';
import { Send, CheckCircle2, Shield, Image as ImageIcon } from 'lucide-react-native';

export default function DoubtChatScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const [doubt, setDoubt] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

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

    // Fast polling every 5 seconds for new faculty responses
    const interval = setInterval(loadThread, 5000);
    return () => clearInterval(interval);
  }, [id]);

  const handleSendMessage = async () => {
    if (!inputContent.trim() || sending) return;

    const optimisticText = inputContent.trim();
    setInputContent('');
    setSending(true);

    try {
      await fetchApi(`/doubts/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: optimisticText,
        }),
      });

      await loadThread();
    } catch (e: any) {
      Alert.alert('Send Error', e.message || 'Could not send message');
      setInputContent(optimisticText);
    } finally {
      setSending(false);
    }
  };

  const handleResolveDoubt = async () => {
    Alert.alert(
      'Resolve Doubt',
      'Are you satisfied with the faculty explanation? This will mark the question as resolved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Resolved',
          style: 'default',
          onPress: async () => {
            try {
              await fetchApi(`/doubts/${id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: 'RESOLVED' }),
              });
              await loadThread();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not update status');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  const isResolved = doubt?.status === 'RESOLVED' || doubt?.status === 'CLOSED';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      style={styles.container}
    >
      {/* Header Info Card */}
      <View style={styles.threadHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {doubt?.title}
          </Text>
          <Text style={styles.headerTeacher}>
            Faculty:{' '}
            {doubt?.teacher
              ? `${doubt.teacher.firstName || ''} ${doubt.teacher.lastName || ''}`.trim()
              : 'Assigned Faculty'}
          </Text>
        </View>

        {!isResolved ? (
          <TouchableOpacity style={styles.resolveBtn} onPress={handleResolveDoubt}>
            <CheckCircle2 size={13} color={Colors.status.success} />
            <Text style={styles.resolveBtnText}>Resolve</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.resolvedPill}>
            <Text style={styles.resolvedPillText}>Resolved</Text>
          </View>
        )}
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.id;
          const isSupervisor = item.isInternalAdminNote || item.senderRole === 'SUPERVISOR';

          return (
            <View
              style={[
                styles.messageRow,
                isMine ? styles.myMessageRow : styles.otherMessageRow,
              ]}
            >
              <View
                style={[
                  styles.bubble,
                  isMine ? styles.myBubble : styles.otherBubble,
                  isSupervisor && styles.supervisorBubble,
                ]}
              >
                {/* Supervisor Badge */}
                {isSupervisor ? (
                  <View style={styles.supervisorBadge}>
                    <Shield size={10} color={Colors.status.warning} />
                    <Text style={styles.supervisorBadgeText}>Academic Supervisor</Text>
                  </View>
                ) : null}

                <Text style={[styles.messageText, isMine && styles.myMessageText]}>
                  {item.content}
                </Text>

                {/* Attachments if any */}
                {item.attachments && Array.isArray(item.attachments) ? (
                  <View style={styles.attachmentsContainer}>
                    {item.attachments.map((att: any, idx: number) => (
                      <Image
                        key={idx}
                        source={{ uri: att.url || att }}
                        style={styles.chatImage}
                        resizeMode="contain"
                      />
                    ))}
                  </View>
                ) : null}

                <Text style={[styles.timestamp, isMine && styles.myTimestamp]}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input Bar */}
      {!isResolved ? (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your response to teacher..."
            placeholderTextColor={Colors.text.muted}
            value={inputContent}
            onChangeText={setInputContent}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputContent.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSendMessage}
            disabled={!inputContent.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.closedFooter}>
          <Text style={styles.closedFooterText}>This academic discussion has been marked resolved.</Text>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  headerTeacher: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  resolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.status.successLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  resolveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.status.success,
  },
  resolvedPill: {
    backgroundColor: Colors.surface.subtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resolvedPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.muted,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
    ...Shadows.sm,
  },
  myBubble: {
    backgroundColor: Colors.brand.blue,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: Colors.surface.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  supervisorBubble: {
    backgroundColor: Colors.status.warningLight,
    borderColor: '#FDE68A',
  },
  supervisorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  supervisorBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.status.warning,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 13,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 9,
    color: Colors.text.muted,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  myTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  attachmentsContainer: {
    marginTop: 8,
  },
  chatImage: {
    width: 200,
    height: 140,
    borderRadius: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface.subtle,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text.primary,
    maxHeight: 80,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.blue,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  closedFooter: {
    padding: 16,
    backgroundColor: Colors.surface.card,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  closedFooterText: {
    fontSize: 12,
    color: Colors.text.muted,
    fontWeight: '600',
  },
});
