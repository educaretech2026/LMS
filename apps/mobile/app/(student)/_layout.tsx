import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Home, FileText, ClipboardList, MessagesSquare, User } from 'lucide-react-native';
import { Colors } from '../../lib/theme';
import { Platform } from 'react-native';

export default function StudentTabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brand.blue,
        tabBarInactiveTintColor: Colors.text.muted,
        tabBarStyle: {
          backgroundColor: Colors.surface.card,
          borderTopWidth: 1,
          borderTopColor: Colors.border.default,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 10,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exams"
        options={{
          title: 'Exams',
          tabBarIcon: ({ color, size }) => <FileText size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Homework',
          tabBarIcon: ({ color, size }) => <ClipboardList size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="doubts"
        options={{
          title: 'Doubts',
          tabBarIcon: ({ color, size }) => <MessagesSquare size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.navigate('/(student)/profile');
          },
        }}
      />
    </Tabs>
  );
}
