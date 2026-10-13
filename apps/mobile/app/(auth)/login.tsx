import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Shadows } from '../../lib/theme';
import { Mail, Lock, Eye, EyeOff, GraduationCap, ArrowRight } from 'lucide-react-native';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <GraduationCap size={36} color={Colors.brand.blue} />
          </View>
          <Text style={styles.title}>Educare LMS</Text>
          <Text style={styles.subtitle}>Welcome back! Please sign in to your account</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Email Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color={Colors.text.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="name@educarelearning.in"
                placeholderTextColor={Colors.text.muted}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setErrorMessage('');
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={Colors.text.muted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={Colors.text.muted}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setErrorMessage('');
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={18} color={Colors.text.muted} />
                ) : (
                  <Eye size={18} color={Colors.text.muted} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.loginButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.loginButtonText}>Sign In</Text>
                <ArrowRight size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Protected by Educare Learning Systems
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.brand.blueLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    ...Shadows.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 6,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border.default,
    ...Shadows.md,
  },
  errorBox: {
    backgroundColor: Colors.status.errorLight,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 12,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.subtle,
    borderWidth: 1,
    borderColor: Colors.border.default,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: Colors.text.primary,
    fontSize: 14,
  },
  eyeButton: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: Colors.brand.blue,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...Shadows.sm,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: Colors.text.muted,
  },
});
