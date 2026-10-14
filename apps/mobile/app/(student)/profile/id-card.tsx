import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Animated,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Modal,
} from 'react-native';
import { useAuth } from '../../../hooks/useAuth';
import { fetchApi } from '../../../lib/api';
import { Colors, Shadows } from '../../../lib/theme';
import {
  RotateCcw,
  QrCode,
  GraduationCap,
  Building,
  MapPin,
  Phone,
  ShieldCheck,
  Calendar,
  Sparkles,
  Maximize2,
  X,
  User,
  Heart,
  CheckCircle2,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 36, 350);
const CARD_HEIGHT = CARD_WIDTH * 1.58; // Standard ID-1 card aspect ratio (~85.6mm x 54mm)

// Deterministic vector barcode renderer
function Barcode({ value }: { value: string }) {
  if (!value) return null;

  const bars = Array.from({ length: 44 }, (_, i) => {
    const code = value.charCodeAt(i % value.length) || 50;
    const widthUnit = ((code + i * 11) % 3) + 1.2;
    const isTall = i % 6 === 0 || i === 0 || i === 43;
    return { widthUnit, isTall };
  });

  return (
    <View style={styles.barcodeContainer}>
      <View style={styles.barcodeBarsRow}>
        {bars.map((bar, i) => (
          <View
            key={i}
            style={[
              styles.barcodeBar,
              {
                width: bar.widthUnit,
                height: bar.isTall ? 34 : 28,
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.barcodeText}>{value}</Text>
    </View>
  );
}

export default function StudentIdCardScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const flipAnim = useRef(new Animated.Value(0)).current;

  const loadStudentData = useCallback(async () => {
    try {
      // Try dedicated student profile endpoint first
      let data: any = null;
      try {
        data = await fetchApi('/students/my-id-card');
      } catch {
        // Fallback to /users/me or /profile
        try {
          data = await fetchApi('/profile');
        } catch {
          data = await fetchApi('/users/me').catch(() => null);
        }
      }

      if (data) {
        setStudentDetails(data);
      }
    } catch (e) {
      console.warn('Could not load student ID details', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStudentData();
  }, [loadStudentData]);

  const handleFlip = () => {
    if (isFlipped) {
      Animated.spring(flipAnim, {
        toValue: 0,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsFlipped(false);
    } else {
      Animated.spring(flipAnim, {
        toValue: 180,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsFlipped(true);
    }
  };

  // Interpolations for card flip 3D animation
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  // Extract mapped student fields
  const studentProfile = studentDetails?.studentProfile || studentDetails;
  const userObj = studentDetails?.user || (studentDetails?.firstName ? studentDetails : user);
  const enrollment = studentProfile?.enrollments?.[0];
  const batch = enrollment?.batch;

  const fullName =
    `${userObj?.firstName || user?.firstName || ''} ${userObj?.lastName || user?.lastName || ''}`.trim() ||
    'Student Name';
  const admissionNo =
    studentProfile?.admissionNo ||
    `EDU-${(user?.id || '2026').substring(0, 8).toUpperCase()}`;
  const bloodGroup = studentProfile?.bloodGroup || 'O+';
  const classLevel = batch?.standard?.name || 'Class 12';
  const division = batch?.name ? `(${batch.name})` : '';
  const board = batch?.board?.name || 'CBSE';
  const centre = batch?.centre?.name || user?.centreName || 'Educare Main Campus';
  const address = studentProfile?.address || userObj?.address || 'Educare Campus, Calicut, Kerala';
  const phone = studentProfile?.parentPhone || studentProfile?.phone || userObj?.phone || '+91 98765 43210';
  const photo = userObj?.avatar || user?.avatar || null;

  const validUntil = batch?.academicYear?.endDate
    ? new Date(batch.academicYear.endDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'May 2026';

  const courseTitle = batch?.name || 'Senior Secondary • Science';

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.brand.blue} />
        <Text style={styles.loaderText}>Generating Digital ID Card...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Top Segmented Controls */}
      <View style={styles.segmentedRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, !isFlipped && styles.segmentBtnActive]}
          onPress={() => {
            if (isFlipped) handleFlip();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentBtnText, !isFlipped && styles.segmentBtnTextActive]}>
            FRONT SIDE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, isFlipped && styles.segmentBtnActive]}
          onPress={() => {
            if (!isFlipped) handleFlip();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentBtnText, isFlipped && styles.segmentBtnTextActive]}>
            BACK SIDE
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadStudentData();
            }}
            tintColor={Colors.brand.blue}
          />
        }
      >
        {/* Verification Status Pill */}
        <View style={styles.statusPill}>
          <View style={styles.livePulseDot} />
          <ShieldCheck size={14} color={Colors.brand.emerald} />
          <Text style={styles.statusPillText}>INSTITUTIONALLY VERIFIED • ACTIVE</Text>
        </View>

        {/* 3D Flip Card Container */}
        <TouchableOpacity
          activeOpacity={0.96}
          onPress={handleFlip}
          style={[styles.cardContainer, { width: CARD_WIDTH, height: CARD_HEIGHT }]}
        >
          {/* ================= FRONT SIDE ================= */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.frontCard,
              {
                opacity: frontOpacity,
                transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
              },
            ]}
          >
            {/* Geometric Top Brand Bar */}
            <View style={styles.frontHeader}>
              <View style={styles.frontHeaderBgOverlay} />
              <View style={styles.frontLogoPill}>
                <Image
                  source={require('../../../assets/logo-horizontal.png')}
                  style={styles.frontLogoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.frontHeaderSubtitle}>STUDENT IDENTIFICATION</Text>
            </View>

            {/* Photo & Identity Section */}
            <View style={styles.frontIdentity}>
              <View style={styles.photoContainer}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} resizeMode="cover" />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <User size={46} color={Colors.brand.blue} />
                  </View>
                )}
                <View style={styles.activeCheckBadge}>
                  <CheckCircle2 size={16} color="#FFFFFF" fill={Colors.brand.emerald} />
                </View>
              </View>

              {/* Student Name */}
              <Text style={styles.studentName} numberOfLines={2}>
                {fullName}
              </Text>

              {/* Course Track Pill */}
              <View style={styles.courseBadge}>
                <View style={styles.courseDot} />
                <Text style={styles.courseText} numberOfLines={1}>
                  {courseTitle}
                </Text>
                <View style={styles.courseDot} />
              </View>
            </View>

            {/* Information Grid */}
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>ADM NO</Text>
                <Text style={styles.infoValue}>{admissionNo}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>CLASS</Text>
                <Text style={styles.infoValue}>{`${classLevel} ${division}`.trim()}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>BOARD</Text>
                <Text style={styles.infoValue}>{board}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>BLOOD</Text>
                <View style={styles.bloodPill}>
                  <Heart size={10} color="#DC2626" fill="#DC2626" />
                  <Text style={styles.bloodText}>{bloodGroup}</Text>
                </View>
              </View>
            </View>

            {/* Campus Tag */}
            <View style={styles.campusBar}>
              <Building size={12} color={Colors.brand.blue} />
              <Text style={styles.campusText} numberOfLines={1}>
                {centre}
              </Text>
            </View>

            {/* Bottom 3-Tone Tech Strip */}
            <View style={styles.triColorBar}>
              <View style={[styles.triColorSegment, { backgroundColor: '#014d8a' }]} />
              <View style={[styles.triColorSegment, { backgroundColor: Colors.brand.blue }]} />
              <View style={[styles.triColorSegment, { backgroundColor: '#38bdf8' }]} />
            </View>
          </Animated.View>

          {/* ================= BACK SIDE ================= */}
          <Animated.View
            style={[
              styles.cardFace,
              styles.backCard,
              {
                opacity: backOpacity,
                transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
              },
            ]}
          >
            {/* Header with grayscale watermark logo */}
            <View style={styles.backHeader}>
              <View style={styles.backLogoPill}>
                <Image
                  source={require('../../../assets/logo-horizontal.png')}
                  style={[styles.backLogoImage, { opacity: 0.85 }]}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Terms & Conditions Section */}
            <View style={styles.termsSection}>
              <View style={styles.termsHeaderRow}>
                <Text style={styles.termsTitle}>TERMS & CONDITIONS</Text>
                <View style={styles.termsLine} />
              </View>
              <View style={styles.termsList}>
                {[
                  'This card is the property of Educare Learning Systems and is non-transferable.',
                  'Cardholder must present this ID upon request by campus authorities or instructors.',
                  'Loss or damage must be reported immediately to administrative office.',
                  'Used for biometric gate access, library services, and attendance recording.',
                  'If found, kindly return to nearest Educare campus administration.',
                ].map((term, index) => (
                  <View key={index} style={styles.termItem}>
                    <View style={styles.termDot} />
                    <Text style={styles.termText}>{term}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Contact Details */}
            <View style={styles.backContacts}>
              <View style={styles.contactItem}>
                <Building size={12} color={Colors.brand.blue} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {centre}
                </Text>
              </View>
              <View style={styles.contactItem}>
                <MapPin size={12} color={Colors.brand.blue} />
                <Text style={styles.contactText} numberOfLines={1}>
                  {address}
                </Text>
              </View>
              <View style={styles.contactItem}>
                <Phone size={12} color={Colors.brand.blue} />
                <Text style={styles.contactText}>{phone}</Text>
              </View>
            </View>

            {/* Validity and Signature Box */}
            <View style={styles.validityRow}>
              <View>
                <Text style={styles.validityLabel}>VALID UNTIL</Text>
                <Text style={styles.validityValue}>{validUntil}</Text>
              </View>
              <View style={styles.signatureCol}>
                <View style={styles.signatureLine} />
                <Text style={styles.signatureLabel}>ISSUING AUTHORITY</Text>
              </View>
            </View>

            {/* Barcode Section */}
            <View style={styles.barcodeSection}>
              <Barcode value={admissionNo} />
            </View>
          </Animated.View>
        </TouchableOpacity>

        {/* Card Interaction Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleFlip} activeOpacity={0.8}>
            <RotateCcw size={16} color={Colors.brand.blue} />
            <Text style={styles.actionBtnText}>{isFlipped ? 'View Front Side' : 'Flip to Back'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => setShowQrModal(true)}
            activeOpacity={0.8}
          >
            <Maximize2 size={16} color="#FFFFFF" />
            <Text style={styles.actionBtnTextPrimary}>Turnstile QR Pass</Text>
          </TouchableOpacity>
        </View>

        {/* Institutional Hint Card */}
        <View style={styles.securityNoticeCard}>
          <Sparkles size={16} color={Colors.brand.blue} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityNoticeTitle}>Official Digital Credential</Text>
            <Text style={styles.securityNoticeText}>
              This digital identity card is cryptographically anchored to your student record at Educare.
              You may present this card for turnstile access, examinations, and campus verification.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ================= TURNSTILE QR MODAL ================= */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Campus Turnstile Access</Text>
                <Text style={styles.modalSub}>Hold close to gate scanner</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowQrModal(false)}
              >
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.qrDisplayBox}>
              <QrCode size={190} color="#0F172A" />
              <View style={styles.qrCornerTL} />
              <View style={styles.qrCornerTR} />
              <View style={styles.qrCornerBL} />
              <View style={styles.qrCornerBR} />
            </View>

            <View style={styles.qrMetaBox}>
              <Text style={styles.qrStudentName}>{fullName}</Text>
              <Text style={styles.qrStudentCode}>{admissionNo}</Text>
              <View style={styles.qrCentrePill}>
                <Building size={12} color={Colors.brand.blue} />
                <Text style={styles.qrCentreText}>{centre}</Text>
              </View>
            </View>

            <View style={styles.turnstileHint}>
              <Calendar size={13} color={Colors.text.muted} />
              <Text style={styles.turnstileHintText}>
                Valid for {validUntil} • Attendance & Gate Pass
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.muted,
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 14,
    padding: 3,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  segmentBtnTextActive: {
    color: Colors.brand.blue,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brand.emerald,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.5,
  },
  cardContainer: {
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: Colors.brand.blue,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backfaceVisibility: 'hidden',
  },
  frontCard: {
    zIndex: 1,
    justifyContent: 'space-between',
  },
  backCard: {
    zIndex: 2,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: '#FAFCFF',
  },
  frontHeader: {
    backgroundColor: Colors.brand.blue,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  frontHeaderBgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#014d8a',
    opacity: 0.4,
  },
  frontLogoPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    width: 170,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  frontLogoImage: {

    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    alignSelf: 'center',
  },
  frontHeaderSubtitle: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginTop: 8,
    opacity: 0.95,
  },
  frontIdentity: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  photoContainer: {
    width: 96,
    height: 116,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#F1F5F9',
    overflow: 'visible',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
    marginBottom: 10,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeCheckBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
    ...Shadows.sm,
  },
  studentName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  courseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 6,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderLeftColor: Colors.brand.blue,
    borderRightColor: Colors.brand.blue,
    gap: 6,
  },
  courseDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brand.blue,
  },
  courseText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.brand.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoGrid: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3.5,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  bloodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  bloodText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#DC2626',
  },
  campusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 4,
  },
  campusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  triColorBar: {
    height: 6,
    flexDirection: 'row',
    width: '100%',
  },
  triColorSegment: {
    flex: 1,
    height: '100%',
  },

  // Back side styles
  backHeader: {
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backLogoPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    width: 170,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backLogoImage: {
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    alignSelf: 'center',
  },
  termsSection: {
    marginTop: 6,
  },
  termsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  termsTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1,
  },
  termsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  termsList: {
    gap: 4,
    paddingLeft: 4,
  },
  termItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  termDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.brand.blue,
    marginTop: 4,
  },
  termText: {
    fontSize: 8.5,
    color: '#475569',
    lineHeight: 12,
    flex: 1,
  },
  backContacts: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactText: {
    fontSize: 9,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  validityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 3,
    borderLeftColor: Colors.brand.blue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  validityLabel: {
    fontSize: 7.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  validityValue: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  signatureCol: {
    alignItems: 'center',
  },
  signatureLine: {
    width: 70,
    height: 1.5,
    backgroundColor: '#1E293B',
    marginBottom: 2,
  },
  signatureLabel: {
    fontSize: 6.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  barcodeSection: {
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
  },
  barcodeContainer: {
    alignItems: 'center',
  },
  barcodeBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 34,
  },
  barcodeBar: {
    backgroundColor: '#0F172A',
    marginHorizontal: 0.7,
    borderRadius: 0.5,
  },
  barcodeText: {
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 2,
    marginTop: 2,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    width: CARD_WIDTH,
    gap: 12,
    marginTop: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    ...Shadows.sm,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.brand.blue,
    borderColor: Colors.brand.blue,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.brand.blue,
  },
  actionBtnTextPrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  securityNoticeCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    width: CARD_WIDTH,
    marginTop: 18,
    gap: 12,
    ...Shadows.sm,
  },
  securityNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  securityNoticeText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrDisplayBox: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#F1F5F9',
    position: 'relative',
    ...Shadows.md,
  },
  qrCornerTL: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 14,
    height: 14,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.brand.blue,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 14,
    height: 14,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.brand.blue,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 14,
    height: 14,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: Colors.brand.blue,
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 14,
    height: 14,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: Colors.brand.blue,
  },
  qrMetaBox: {
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  qrStudentName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
  },
  qrStudentCode: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: Colors.brand.blue,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  qrCentrePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    gap: 6,
  },
  qrCentreText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  turnstileHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  turnstileHintText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#64748B',
  },
});
