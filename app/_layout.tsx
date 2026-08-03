import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/theme/colors';
import useGameStore from '../src/store/gameStore';
import NameEntryModal from '../src/components/NameEntryModal';
import WeekSummarySheet from '../src/components/WeekSummarySheet';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isLoading = useGameStore((s) => s?.isLoading);
  const loadSavedGame = useGameStore((s) => s?.loadSavedGame);

  useEffect(() => {
    loadSavedGame?.();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="tabs" />
        <Stack.Screen name="stock/[ticker]" />
        <Stack.Screen name="portfolio" />
        <Stack.Screen name="housing" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="achievements" />
        <Stack.Screen name="loans" />
      </Stack>
      <NameEntryModal />
      <WeekSummarySheet />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
