import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
  Circle,
} from 'react-native-svg';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  GraduationCap,
  Briefcase,
  HelpCircle,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '../../hooks/useAuth';
import { Colors } from '../../lib/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LoginScreen() {
  const { login } = useAuth();
  const [roleTab, setRoleTab] = useState<'STUDENT' | 'FACULTY'>('STUDENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  // Animation controllers
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 40,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();

    // Gentle ambient orb breathing
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Incomplete Credentials', 'Please enter your institutional email and account password.');
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert(
        'Authentication Failed',
        err.message || 'The credentials you entered are incorrect. Please verify your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleHelpDesk = () => {
    Alert.alert(
      'Institutional Support',
      'If you have forgotten your password or have trouble logging in, please contact your Educare Centre Administrator or IT Helpdesk.\n\nSupport Email: support@educarelearning.in',
      [{ text: 'Close', style: 'cancel' }]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Background Cosmic Canvas with SVG Radial Gradients ── */}
      <View style={StyleSheet.absoluteFill}>
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
          <Defs>
            <RadialGradient id="bgGrad" cx="50%" cy="30%" rx="90%" ry="90%">
              <Stop offset="0%" stopColor="#0d235c" stopOpacity="1" />
              <Stop offset="50%" stopColor="#07122e" stopOpacity="1" />
              <Stop offset="100%" stopColor="#020817" stopOpacity="1" />
            </RadialGradient>
            <LinearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
              <Stop offset="50%" stopColor="#38bdf8" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect width={SCREEN_WIDTH} height={SCREEN_HEIGHT} fill="url(#bgGrad)" />
        </Svg>
      </View>

      {/* ── Glowing Luminous Ambient Orbs ── */}
      <Animated.View
        style={[
          styles.ambientOrbBlue,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[
          styles.ambientOrbRed,
          {
            transform: [{ scale: pulseAnim }],
          },
        ]}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* ── Hero Brand Crest & Header ── */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: logoScale }],
              },
            ]}
          >
            {/* Logo Crest with Concentric Luminous Glow */}
            <View style={styles.crestWrapper}>
              <View style={styles.crestGlowRing} />
              <View style={styles.logoBadge}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Brand Title & Tagline */}
            <Text style={styles.brandTitle}>EDUCARE</Text>
            <View style={styles.brandSubtitleRow}>
              <Sparkles size={11} color="#38bdf8" />
              <Text style={styles.brandSubtitle}>INSTITUTIONAL MANAGEMENT SUITE</Text>
              <Sparkles size={11} color="#38bdf8" />
            </View>
          </Animated.View>

          {/* ── Main Glassmorphic Login Card ── */}
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Card Header */}
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Sign In</Text>
                <Text style={styles.cardSubtitle}>Access your academic ecosystem</Text>
              </View>
              <View style={styles.securityPill}>
                <ShieldCheck size={13} color="#22c55e" />
                <Text style={styles.securityPillText}>SSL 256-bit</Text>
              </View>
            </View>

            {/* Role Tab Selector (Student vs Faculty) */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, roleTab === 'STUDENT' && styles.tabButtonActive]}
                onPress={() => setRoleTab('STUDENT')}
                activeOpacity={0.8}
              >
                <GraduationCap
                  size={15}
                  color={roleTab === 'STUDENT' ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    roleTab === 'STUDENT' && styles.tabButtonTextActive,
                  ]}
                >
                  Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabButton, roleTab === 'FACULTY' && styles.tabButtonActive]}
                onPress={() => setRoleTab('FACULTY')}
                activeOpacity={0.8}
              >
                <Briefcase
                  size={14}
                  color={roleTab === 'FACULTY' ? '#FFFFFF' : 'rgba(255,255,255,0.45)'}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    roleTab === 'FACULTY' && styles.tabButtonTextActive,
                  ]}
                >
                  Faculty & Staff
                </Text>
              </TouchableOpacity>
            </View>

            {/* Email Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>
                {roleTab === 'STUDENT' ? 'Student Email' : 'Institutional Email'}
              </Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'email' && styles.inputWrapperFocused,
                ]}
              >
                <Mail
                  size={18}
                  color={focusedField === 'email' ? '#38bdf8' : 'rgba(255,255,255,0.35)'}
                  style={styles.fieldIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  selectionColor="#38bdf8"
                  placeholder={
                    roleTab === 'STUDENT'
                      ? 'student@educarelearning.in'
                      : 'faculty@educarelearning.in'
                  }
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'password' && styles.inputWrapperFocused,
                ]}
              >
                <Lock
                  size={18}
                  color={focusedField === 'password' ? '#38bdf8' : 'rgba(255,255,255,0.35)'}
                  style={styles.fieldIcon}
                />
                <TextInput
                  style={styles.textInput}
                  value={password}
                  onChangeText={setPassword}
                  selectionColor="#38bdf8"
                  placeholder="Enter your security password"
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onSubmitEditing={handleLogin}
                  returnKeyType="go"
                />
                <TouchableOpacity
                  style={styles.eyeIconBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff size={18} color="rgba(255,255,255,0.5)" />
                  ) : (
                    <Eye size={18} color="rgba(255,255,255,0.5)" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Options Row: Remember Me & Need Help */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberMeRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.8}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                </View>
                <Text style={styles.rememberMeText}>Remember Session</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.helpLink}
                onPress={handleHelpDesk}
                activeOpacity={0.7}
              >
                <HelpCircle size={13} color="#38bdf8" />
                <Text style={styles.helpLinkText}>Need Help?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign In CTA Button */}
            <TouchableOpacity
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <Text style={styles.loginBtnText}>Authenticating...</Text>
                </View>
              ) : (
                <View style={styles.btnTextRow}>
                  <Text style={styles.loginBtnText}>Sign In to Dashboard</Text>
                  <ArrowRight size={17} color="#FFFFFF" strokeWidth={2.5} />
                </View>
              )}
            </TouchableOpacity>

            {/* Bottom Security Note */}
            <View style={styles.securityNote}>
              <ShieldCheck size={13} color="rgba(255,255,255,0.4)" />
              <Text style={styles.securityNoteText}>
                Encrypted authentication for accredited institutions
              </Text>
            </View>
          </Animated.View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Educare Learning Systems • Institutional Edition v2.4
            </Text>
            <Text style={styles.footerSubtext}>
              All Rights Reserved © {new Date().getFullYear()}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07122e',
  },
  keyboardRoot: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 32,
    justifyContent: 'center',
  },

  // Ambient orbs in background
  ambientOrbBlue: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(37, 99, 235, 0.22)',
  },
  ambientOrbRed: {
    position: 'absolute',
    bottom: 60,
    right: -50,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(220, 38, 38, 0.16)',
  },

  // Header / Logo crest
  headerSection: {
    alignItems: 'center',
    marginBottom: 26,
  },
  crestWrapper: {
    width: 86,
    height: 86,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 14,
  },
  crestGlowRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  brandSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  brandSubtitle: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 2.2,
    color: 'rgba(255, 255, 255, 0.65)',
    textTransform: 'uppercase',
  },

  // Main Login Card (Glassmorphic)
  card: {
    backgroundColor: 'rgba(11, 25, 56, 0.85)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 2,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  securityPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22c55e',
    letterSpacing: 0.2,
  },

  // Role Tab Switcher
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 10,
    gap: 7,
  },
  tabButtonActive: {
    backgroundColor: '#0162B1',
    shadowColor: '#0162B1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Input Fields
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.4,
    marginBottom: 7,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 13,
  },
  inputWrapperFocused: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.07)',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fieldIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#FFFFFF',
    height: '100%',
  },
  eyeIconBtn: {
    padding: 6,
  },

  // Options row
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 20,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 17,
    height: 17,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0162B1',
    borderColor: '#38bdf8',
  },
  rememberMeText: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.65)',
    fontWeight: '500',
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  helpLinkText: {
    fontSize: 11.5,
    color: '#38bdf8',
    fontWeight: '600',
  },

  // CTA Sign In button
  loginBtn: {
    height: 50,
    backgroundColor: '#0162B1',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0162B1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  btnTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Security Note
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  securityNoteText: {
    fontSize: 10.5,
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '500',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.25)',
    marginTop: 3,
    textAlign: 'center',
  },
});
