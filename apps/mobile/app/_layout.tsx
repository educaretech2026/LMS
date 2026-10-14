import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { Colors } from '../lib/theme';
import { SplashScreen } from '../components/SplashScreen';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import { NotificationBanner } from '../components/NotificationBanner';

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
    return <View style={styles.darkBackground} />;
  }

  return <>{children}</>;
}

function GlobalBanner() {
  const { activeBanner, dismissBanner } = useNotifications();
  return <NotificationBanner banner={activeBanner} onDismiss={dismissBanner} />;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NotificationProvider>
          <StatusBar style={showSplash ? 'light' : 'dark'} />
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
          <GlobalBanner />
          {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  darkBackground: {
    flex: 1,
    backgroundColor: '#07122e',
  },
});
