import React from 'react';
import { Stack } from 'expo-router';
import { Colors } from '../../../lib/theme';

export default function DoubtsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: Colors.brand.blue,
        headerStyle: { backgroundColor: Colors.surface.card },
        headerTitleStyle: { fontWeight: '700', fontSize: 16 },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Doubt Clearance', headerShown: false }} />
      <Stack.Screen name="ask" options={{ title: 'Ask a Doubt', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Academic Discussion' }} />
      <Stack.Screen name="[id]/chat" options={{ title: 'Academic Discussion' }} />
    </Stack>
  );
}
