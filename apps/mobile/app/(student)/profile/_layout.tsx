import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function ProfileLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.brand.blue,
        headerStyle: { backgroundColor: Colors.surface.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Profile & Academics', headerShown: false }} />
      <Stack.Screen name="id-card" options={{ title: 'Digital Student ID Card' }} />
      <Stack.Screen name="estudy" options={{ title: 'E-Study Materials' }} />
      <Stack.Screen name="attendance" options={{ title: 'Attendance Record' }} />
      <Stack.Screen name="live-classes" options={{ title: 'Live Online Classes' }} />
    </Stack>
  );
}
