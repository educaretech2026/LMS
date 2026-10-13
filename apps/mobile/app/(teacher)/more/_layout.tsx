import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function TeacherMoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.surface.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="exams"
        options={{
          headerShown: true,
          title: 'Live Exams Tracker',
          headerTintColor: Colors.brand.blue,
          headerStyle: { backgroundColor: Colors.surface.card },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
