import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import { BookOpen, FileText, Video, ExternalLink } from 'lucide-react-native';

export default function EstudyMaterialsScreen() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchApi<any[]>('/study-materials');
        setMaterials(data || []);
      } catch (err) {
        console.error('Failed to load materials', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const openMaterial = (url: string | null) => {
    if (!url) {
      Alert.alert('Notice', 'No direct link available for this resource.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open file link');
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {materials.length === 0 ? (
        <View style={styles.emptyCard}>
          <BookOpen size={36} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No study materials found</Text>
          <Text style={styles.emptySubtitle}>Your faculty will upload PDF notes and lecture videos here.</Text>
        </View>
      ) : (
        materials.map((item) => {
          const isVideo = item.type === 'VIDEO';
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => openMaterial(item.url)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconCircle, { backgroundColor: isVideo ? Colors.status.errorLight : Colors.brand.blueLight }]}>
                {isVideo ? (
                  <Video size={20} color={Colors.status.error} />
                ) : (
                  <FileText size={20} color={Colors.brand.blue} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemMeta}>
                  {item.chapter?.name || item.subject?.name || 'Study Material'} • {item.type}
                </Text>
              </View>

              <ExternalLink size={16} color={Colors.brand.blue} />
            </TouchableOpacity>
          );
        })
      )}
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
  emptyCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 11,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 10,
    gap: 12,
    ...Shadows.sm,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.text.muted,
    marginTop: 2,
  },
});
