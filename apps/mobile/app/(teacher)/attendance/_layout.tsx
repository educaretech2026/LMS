import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function TeacherAttendanceLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.brand.blue,
        headerStyle: { backgroundColor: Colors.surface.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Attendance', headerShown: false }} />
      <Stack.Screen name="mark" options={{ title: '1-Tap Roll Call' }} />
    </Stack>
  );
}
