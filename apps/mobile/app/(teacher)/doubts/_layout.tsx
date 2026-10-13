import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function TeacherDoubtsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.surface.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[id]/chat"
        options={{
          headerShown: true,
          title: 'Resolve Doubt',
          headerTintColor: Colors.brand.blue,
          headerStyle: { backgroundColor: Colors.surface.card },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
