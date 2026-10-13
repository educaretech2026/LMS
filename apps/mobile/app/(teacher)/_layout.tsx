import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { LayoutDashboard, CalendarCheck, ClipboardList, MessagesSquare, Menu } from 'lucide-react-native';
import { Colors } from '../../lib/theme';
import { Platform } from 'react-native';

export default function TeacherTabsLayout() {
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => <CalendarCheck size={size - 2} color={color} />,
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
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, size }) => <Menu size={size - 2} color={color} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.navigate('/(teacher)/more');
          },
        }}
      />
    </Tabs>
  );
}
