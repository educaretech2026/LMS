import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function AssignmentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.brand.blue,
        headerStyle: { backgroundColor: Colors.surface.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Homework & Assignments', headerShown: false }} />
      <Stack.Screen name="[id]/submit" options={{ title: 'Submit Homework' }} />
    </Stack>
  );
}
