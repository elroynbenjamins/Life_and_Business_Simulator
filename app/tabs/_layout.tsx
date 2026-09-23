import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useGameStore from '../../src/store/gameStore';
import { getEducationAvailabilityNotice } from '../../src/engine/playerNotificationEngine';
import { useShallow } from 'zustand/react/shallow';

function TabIcon({
  name,
  color,
  size,
  focused,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  size: number;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={Math.min(size, 22)} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const notificationState = useGameStore(useShallow((state) => ({
    completedCourses: state.completedCourses ?? [],
    currentCourseId: state.currentCourseId,
    weeksEmployed: state.statistics?.weeksEmployed ?? 0,
    cash: state.cash ?? 0,
    inflationMultiplier: state.inflationMultiplier ?? 1,
  })));
  const educationNotice = getEducationAvailabilityNotice(notificationState);
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
          paddingTop: 3,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: -1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="home" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="career"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="business"
        options={{
          title: 'Business',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="business" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="education"
        options={{
          title: 'Education',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="school" color={color} size={size} focused={focused} />,
          tabBarBadge: educationNotice.available ? '' : undefined,
          tabBarBadgeStyle: notificationBadgeStyle,
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: 'Market',
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="trending-up" color={color} size={size} focused={focused} />,
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
          tabBarIcon: ({ color, size, focused }) => <TabIcon name="stats-chart" color={color} size={size} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    minWidth: 36,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: `${Colors.primary}16`,
  },
});
