import React, { useState } from 'react';
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
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Shadows, Radii } from '../../lib/theme';

const DEMO_ACCOUNTS = [
  { label: 'Faculty', email: 'akshaid@educarelearning.in', password: 'password123' },
  { label: 'Student', email: 'akshai@educarelearning.in', password: 'password123' },
];

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner — web gradient style */}
        <View style={styles.banner}>
          {/* Geometric accents (like web) */}
          <View style={styles.geoCircle1} />
          <View style={styles.geoCircle2} />
          {/* Red bottom accent line (web brand signature) */}
          <View style={styles.redLine} />

          <View style={styles.logoContainer}>
            <View style={styles.logoMark}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.brandName}>Educare LMS</Text>
              <Text style={styles.brandTagline}>INSTITUTIONAL MANAGEMENT SUITE</Text>
            </View>
          </View>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Access your academic dashboard</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, focusedField === 'email' && styles.inputFocused]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@educarelearning.in"
              placeholderTextColor={Colors.text.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, focusedField === 'password' && styles.inputFocused]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={Colors.text.muted}
              secureTextEntry
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Demo Accounts */}
          <View style={styles.demoSection}>
            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>Quick Demo</Text>
              <View style={styles.divider} />
            </View>
            <View style={styles.demoRow}>
              {DEMO_ACCOUNTS.map((acc) => (
                <TouchableOpacity
                  key={acc.label}
                  style={styles.demoChip}
                  onPress={() => { setEmail(acc.email); setPassword(acc.password); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.demoChipText}>{acc.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.footer}>Educare Learning System © 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scroll: {
    flexGrow: 1,
  },
  // Banner — matches web teacher/student dashboard header
  banner: {
    backgroundColor: Colors.brand.blue,
    paddingTop: Platform.OS === 'ios' ? 64 : 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  geoCircle1: {
    position: 'absolute',
    top: -40,
    right: 20,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 24,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  geoCircle2: {
    position: 'absolute',
    bottom: -20,
    right: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 14,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  redLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Colors.brand.red,
    opacity: 0.7,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoMark: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  logoImage: {
    width: 44,
    height: 44,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  // Card
  card: {
    backgroundColor: Colors.surface.card,
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: Radii.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadows.md,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: Colors.text.muted,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    letterSpacing: 0.3,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: Radii.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.text.primary,
    backgroundColor: Colors.surface.background,
  },
  inputFocused: {
    borderColor: Colors.brand.blue,
    backgroundColor: Colors.surface.card,
  },
  loginBtn: {
    height: 48,
    backgroundColor: Colors.brand.blue,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Shadows.glowBlue,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  // Demo
  demoSection: {
    marginTop: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border.default,
  },
  dividerText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  demoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoChip: {
    flex: 1,
    height: 38,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface.subtle,
  },
  demoChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: Colors.text.muted,
    paddingBottom: 32,
    paddingTop: 4,
  },
});
