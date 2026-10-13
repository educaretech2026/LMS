import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function TeacherAssignmentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.brand.blue,
        headerStyle: { backgroundColor: Colors.surface.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Assignments', headerShown: false }} />
      <Stack.Screen name="create" options={{ title: 'Create Homework', presentation: 'modal' }} />
      <Stack.Screen name="[id]/submissions" options={{ title: 'Student Submissions' }} />
    </Stack>
  );
}
