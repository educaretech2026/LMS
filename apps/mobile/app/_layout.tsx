import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { Colors } from '../lib/theme';

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const { user, token, role, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inStudentGroup = segments[0] === '(student)';
    const inTeacherGroup = segments[0] === '(teacher)';
    const inSharedScreen = segments[0] === 'notifications';

    if (!token || !user) {
      if (!inAuthGroup) {
        router.replace('/(auth)/login' as any);
      }
    } else {
      // User is authenticated
      if (inSharedScreen) {
        return;
      }

      if (role === 'TEACHER') {
        if (!inTeacherGroup) {
          router.replace('/(teacher)' as any);
        }
      } else {
        // STUDENT or default
        if (!inStudentGroup) {
          router.replace('/(student)' as any);
        }
      }
    }
  }, [user, token, role, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>E</Text>
        </View>
        <Text style={styles.appName}>Educare LMS</Text>
        <ActivityIndicator size="small" color={Colors.brand.blue} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <NavigationGuard>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.surface.background } }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(student)" options={{ headerShown: false }} />
            <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
            <Stack.Screen
              name="notifications/index"
              options={{
                headerShown: true,
                title: 'Notifications',
                headerTintColor: Colors.brand.blue,
                headerStyle: { backgroundColor: Colors.surface.card },
              }}
            />
          </Stack>
        </NavigationGuard>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.brand.blue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.brand.blue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  appName: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
});
