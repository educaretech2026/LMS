import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function ExamsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.brand.blue,
        headerStyle: { backgroundColor: Colors.surface.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Exams & Tests', headerShown: false }} />
      <Stack.Screen name="[id]/take" options={{ title: 'Examination', headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="[id]/result" options={{ title: 'Exam Results' }} />
    </Stack>
  );
}
