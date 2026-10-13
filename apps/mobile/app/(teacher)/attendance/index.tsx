import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import { CalendarCheck, Users, ChevronRight, CheckCircle2 } from 'lucide-react-native';

export default function TeacherAttendanceList() {
  const router = useRouter();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBatches = async () => {
    try {
      const data = await fetchApi<any[]>('/setup/batches');
      setBatches(data || []);
    } catch (e) {
      console.error('Failed to load batches', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadBatches();
  };

  const todayStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Batch Attendance</Text>
        <Text style={styles.subtitle}>Today: {todayStr}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.brand.blue]} />}
      >
        <Text style={styles.sectionTitle}>Select Batch to Take Attendance</Text>

        {loading ? (
          <ActivityIndicator color={Colors.brand.blue} style={{ marginTop: 40 }} />
        ) : batches.length === 0 ? (
          <View style={styles.emptyCard}>
            <CalendarCheck size={36} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No assigned batches found</Text>
          </View>
        ) : (
          batches.map((batch) => (
            <TouchableOpacity
              key={batch.id}
              style={styles.card}
              onPress={() =>
                router.push({
                  pathname: '/(teacher)/attendance/mark',
                  params: { batchId: batch.id, batchName: batch.name },
                } as any)
              }
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Users size={20} color={Colors.brand.blue} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.batchName}>{batch.name}</Text>
                <Text style={styles.batchMeta}>
                  {batch.board?.name || 'CBSE'} • {batch.standard?.name || 'Standard'} • {batch.centre?.name || 'Centre'}
                </Text>
              </View>

              <View style={styles.arrowWrap}>
                <Text style={styles.takeText}>Roll Call</Text>
                <ChevronRight size={16} color={Colors.brand.blue} />
              </View>
            </TouchableOpacity>
          ))
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 16,
    backgroundColor: Colors.surface.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.brand.blue,
    fontWeight: '700',
    marginTop: 2,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 20,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: 12,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 10,
    gap: 12,
    ...Shadows.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.brand.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batchName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  batchMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
  arrowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  takeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
});
