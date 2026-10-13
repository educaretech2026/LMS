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
import { fetchApi } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Shadows } from '../../../lib/theme';
import {
  Video,
  Plus,
  Play,
  Calendar,
  Clock,
  Radio,
  ExternalLink,
  Trash2,
  X,
  CheckCircle2,
  Users,
} from 'lucide-react-native';

export default function TeacherLiveClassesScreen() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'ALL' | 'UPCOMING' | 'ENDED'>('ALL');

  // Schedule Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('60');
  const [zoomLink, setZoomLink] = useState('');
  const [creating, setCreating] = useState(false);

  const loadClasses = async () => {
    try {
      const data = await fetchApi<any[]>('/live-class');
      setClasses(data || []);
    } catch (e) {
      console.error('Failed to load live classes', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadClasses();
  };

  const handleCreateClass = async () => {
    if (!title.trim() || !subject.trim()) {
      Alert.alert('Validation Error', 'Title and subject are required.');
      return;
    }

    setCreating(true);
    try {
      const teacherName =
        `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Educare Faculty';

      await fetchApi('/live-class', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          subject: subject.trim(),
          duration: parseInt(duration, 10) || 60,
          scheduledAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          teacherName,
          zoomLink: zoomLink.trim() || undefined,
        }),
      });

      Alert.alert('Success', 'Live class scheduled successfully!');
      setTitle('');
      setSubject('');
      setZoomLink('');
      setShowModal(false);
      loadClasses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not schedule live class');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'SCHEDULED' | 'LIVE' | 'ENDED') => {
    try {
      await fetchApi(`/live-class/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      loadClasses();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update status');
    }
  };

  const handleDeleteClass = (id: string) => {
    Alert.alert('Delete Session', 'Are you sure you want to delete this live class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetchApi(`/live-class/${id}`, { method: 'DELETE' });
            setClasses((prev) => prev.filter((c) => c.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const handleJoinClass = (meetingUrl: string) => {
    if (meetingUrl) {
      Linking.openURL(meetingUrl).catch(() => {
        Alert.alert('Error', 'Cannot open meeting link.');
      });
    } else {
      Alert.alert('No Link', 'No meeting URL was specified for this session.');
    }
  };

  const filteredClasses = classes.filter((c) => {
    if (tab === 'UPCOMING' && c.status === 'ENDED') return false;
    if (tab === 'ENDED' && c.status !== 'ENDED') return false;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Live Online Classes</Text>
          <Text style={styles.headerSub}>Host real-time interactive lectures & doubt sessions</Text>
        </View>

        <TouchableOpacity style={styles.scheduleBtn} onPress={() => setShowModal(true)}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.scheduleBtnText}>Schedule</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {(['ALL', 'UPCOMING', 'ENDED'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabChip, tab === t && styles.tabChipActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabChipText, tab === t && styles.tabChipTextActive]}>
              {t === 'ALL' ? `All Classes (${classes.length})` : t === 'UPCOMING' ? 'Live & Scheduled' : 'Past Classes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Classes List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.brand.blue} />
            <Text style={styles.loadingText}>Loading live class schedules...</Text>
          </View>
        ) : filteredClasses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Video size={48} color={Colors.text.muted} />
            <Text style={styles.emptyTitle}>No Live Classes</Text>
            <Text style={styles.emptySubtitle}>Schedule an upcoming lecture using the button above.</Text>
          </View>
        ) : (
          filteredClasses.map((item) => {
            const isLive = item.status === 'LIVE';
            const isEnded = item.status === 'ENDED';
            const meetUrl = item.zoomLink || item.meetLink || '';

            return (
              <View key={item.id} style={[styles.classCard, isLive && styles.classCardLive]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.subjectTag}>{item.subject || 'Interactive Lecture'}</Text>
                    <Text style={styles.classTitle}>{item.title}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      isLive ? styles.statusBadgeLive : isEnded ? styles.statusBadgeEnded : styles.statusBadgeScheduled,
                    ]}
                  >
                    {isLive && <Radio size={12} color="#DC2626" />}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isLive ? { color: '#DC2626' } : isEnded ? { color: Colors.text.muted } : { color: Colors.brand.blue },
                      ]}
                    >
                      {item.status || 'SCHEDULED'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Calendar size={13} color={Colors.text.muted} />
                    <Text style={styles.metricText}>
                      {new Date(item.scheduledAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Clock size={13} color={Colors.text.muted} />
                    <Text style={styles.metricText}>{item.duration || 60} mins</Text>
                  </View>
                </View>

                {/* Actions Row */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.launchBtn, isLive ? styles.launchBtnLive : styles.launchBtnDefault]}
                    onPress={() => handleJoinClass(meetUrl)}
                    activeOpacity={0.8}
                  >
                    <Play size={14} color="#FFFFFF" />
                    <Text style={styles.launchBtnText}>{isLive ? 'Join Live Stream' : 'Start Session'}</Text>
                  </TouchableOpacity>

                  {isLive ? (
                    <TouchableOpacity
                      style={styles.endBtn}
                      onPress={() => handleUpdateStatus(item.id, 'ENDED')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.endBtnText}>End Class</Text>
                    </TouchableOpacity>
                  ) : !isEnded ? (
                    <TouchableOpacity
                      style={styles.goLiveBtn}
                      onPress={() => handleUpdateStatus(item.id, 'LIVE')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.goLiveBtnText}>Go Live</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={styles.trashBtn}
                    onPress={() => handleDeleteClass(item.id)}
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

      {/* Schedule Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Schedule Live Class</Text>
                <Text style={styles.modalSubtitle}>Create Google Meet / Live stream room</Text>
              </View>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Session Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Physics Chapter 3 Live Problem Solving"
                  placeholderTextColor={Colors.text.muted}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Subject / Topic *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Physics"
                  placeholderTextColor={Colors.text.muted}
                  value={subject}
                  onChangeText={setSubject}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Duration (minutes)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Meeting Link (Google Meet / Zoom / LiveKit)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://meet.google.com/..."
                  placeholderTextColor={Colors.text.muted}
                  value={zoomLink}
                  onChangeText={setZoomLink}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitScheduleBtn, creating && styles.submitScheduleBtnDisabled]}
                onPress={handleCreateClass}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <CheckCircle2 size={18} color="#FFFFFF" />
                    <Text style={styles.submitScheduleBtnText}>Broadcast Session</Text>
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
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.brand.blue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    ...Shadows.sm,
  },
  scheduleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
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
    gap: 12,
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
  classCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  classCardLive: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  subjectTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text.primary,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeLive: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeScheduled: {
    backgroundColor: '#EFF6FF',
  },
  statusBadgeEnded: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  launchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  launchBtnLive: {
    backgroundColor: '#DC2626',
    ...Shadows.sm,
  },
  launchBtnDefault: {
    backgroundColor: Colors.brand.blue,
  },
  launchBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  goLiveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  goLiveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  endBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
  endBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  trashBtn: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
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
  submitScheduleBtn: {
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
  submitScheduleBtnDisabled: {
    opacity: 0.6,
  },
  submitScheduleBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
