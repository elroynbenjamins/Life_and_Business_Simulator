import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useGameStore from '../../src/store/gameStore';
import { getEducationAvailabilityNotice, getPromotionAssetNotice } from '../../src/engine/playerNotificationEngine';
import { useShallow } from 'zustand/react/shallow';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const notificationState = useGameStore(useShallow((state) => ({
    career: state.career,
    completedCourses: state.completedCourses ?? [],
    currentCourseId: state.currentCourseId,
    currentCarId: state.currentCarId ?? 'none',
    currentHousingId: state.currentHousingId ?? 'cheap_apartment',
    weeksEmployed: state.statistics?.weeksEmployed ?? 0,
    cash: state.cash ?? 0,
    inflationMultiplier: state.inflationMultiplier ?? 1,
  })));
  const educationNotice = getEducationAvailabilityNotice(notificationState);
  const promotionNotice = getPromotionAssetNotice(notificationState);
  const notificationBadgeStyle = { minWidth: 10, width: 10, height: 10, borderRadius: 5, fontSize: 0, top: 4 };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: 'Career',
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
          tabBarBadge: promotionNotice.blocked ? '' : undefined,
          tabBarBadgeStyle: notificationBadgeStyle,
        }}
      />
      <Tabs.Screen
        name="education"
        options={{
          title: 'Education',
          tabBarIcon: ({ color, size }) => <Ionicons name="school" size={size} color={color} />,
          tabBarBadge: educationNotice.available ? '' : undefined,
          tabBarBadgeStyle: notificationBadgeStyle,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistics',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
