import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function TeacherMoreLayout() {
  return (
    <Stack
      initialRouteName="index"
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
          title: 'Exam Manager',
          headerTintColor: Colors.brand.blue,
          headerStyle: { backgroundColor: Colors.surface.card },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 16, color: Colors.text.primary },
        }}
      />
      <Stack.Screen
        name="estudy"
        options={{
          headerShown: true,
          title: 'E-Study Hub',
          headerTintColor: Colors.brand.blue,
          headerStyle: { backgroundColor: Colors.surface.card },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 16, color: Colors.text.primary },
        }}
      />
      <Stack.Screen
        name="live-classes"
        options={{
          headerShown: true,
          title: 'Live Classes',
          headerTintColor: Colors.brand.blue,
          headerStyle: { backgroundColor: Colors.surface.card },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700', fontSize: 16, color: Colors.text.primary },
        }}
      />
    </Stack>
  );
}
