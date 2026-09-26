import React from 'react';
import { ColorValue, StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useTutorialFocusStore } from '../../src/store/tutorialFocusStore';
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
  tutorialRoute,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: ColorValue;
  size: number;
  focused: boolean;
  tutorialRoute?: string;
}) {
  const guideHighlight = useTutorialFocusStore((state) => Boolean(tutorialRoute && state.navigationRoute === tutorialRoute));
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive, guideHighlight && styles.iconWrapGuided]}>
      <Ionicons name={name} size={Math.min(size, 22)} color={color as string} />
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
          tabBarIcon: ({ color, size, focused }) => <TabIcon tutorialRoute="/tabs" name="home" color={color} size={size} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="career"
        options={{
          title: 'Career',
          href: null,
        }}
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
          tabBarIcon: ({ color, size, focused }) => <TabIcon tutorialRoute="/tabs/education" name="school" color={color} size={size} focused={focused} />,
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
  iconWrapGuided: { borderWidth: 1, borderColor: Colors.warning, backgroundColor: `${Colors.warning}18` },
  iconWrapActive: {
    backgroundColor: `${Colors.primary}16`,
  },
});
