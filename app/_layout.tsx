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
import SaveSlotPicker from '../src/components/SaveSlotPicker';
import NegativeCashModal from '../src/components/NegativeCashModal';
import PeriodReportModal from '../src/components/PeriodReportModal';
import EventModal from '../src/components/EventModal';
import ScheduledAdModal from '../src/components/ScheduledAdModal';
import MainMenu from '../src/components/MainMenu';
import GameDialog from '../src/components/GameDialog';
import { initializeAdConsent } from '../src/services/adPrivacyManager';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isLoading = useGameStore((s) => s?.isLoading);
  const loadSavedGame = useGameStore((s) => s?.loadSavedGame);

  useEffect(() => {
    loadSavedGame?.();
    void initializeAdConsent();
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
        <Stack.Screen name="support" />
        <Stack.Screen name="business" />
        <Stack.Screen name="skills" />
        <Stack.Screen name="prestige" />
        <Stack.Screen name="properties" />
        <Stack.Screen name="info" />
      </Stack>
      <MainMenu />
      <SaveSlotPicker />
      <NameEntryModal />
      <WeekSummarySheet />
      <NegativeCashModal />
      <EventModal />
      <PeriodReportModal />
      <ScheduledAdModal />
      <GameDialog />
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
