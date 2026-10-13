import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useAuth } from '../../../hooks/useAuth';
import { Colors, Shadows } from '../../../lib/theme';
import { GraduationCap, QrCode } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function StudentIdCardScreen() {
  const { user } = useAuth();

  const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Student Name';
  const studentCode = `EDU-${(user?.id || '0000').substring(0, 8).toUpperCase()}`;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.logoBadge}>
            <GraduationCap size={24} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.brandTitle}>EDUCARE</Text>
            <Text style={styles.brandSubtitle}>LEARNING SYSTEMS</Text>
          </View>
        </View>

        {/* Student Identity */}
        <View style={styles.identitySection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {fullName.charAt(0)}
            </Text>
          </View>

          <Text style={styles.studentName}>{fullName}</Text>
          <Text style={styles.studentId}>{studentCode}</Text>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailCol}>
            <Text style={styles.detailKey}>CAMPUS</Text>
            <Text style={styles.detailVal}>{user?.centreName || 'Main Centre'}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.detailKey}>ROLE</Text>
            <Text style={styles.detailVal}>STUDENT</Text>
          </View>
        </View>

        {/* QR Verification Mockup */}
        <View style={styles.qrSection}>
          <View style={styles.qrBox}>
            <QrCode size={110} color={Colors.text.primary} />
          </View>
          <Text style={styles.qrHint}>Scan for institutional entry & attendance</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: width - 48,
    maxWidth: 360,
    backgroundColor: Colors.surface.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  cardHeader: {
    backgroundColor: Colors.brand.blue,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  identitySection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: Colors.brand.blueLight,
    borderWidth: 3,
    borderColor: Colors.brand.blue,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.brand.blue,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text.primary,
  },
  studentId: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.muted,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border.subtle,
  },
  detailCol: {
    alignItems: 'center',
  },
  detailKey: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.text.muted,
    letterSpacing: 1,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 2,
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: Colors.surface.subtle,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
    marginBottom: 8,
  },
  qrHint: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.muted,
  },
});
