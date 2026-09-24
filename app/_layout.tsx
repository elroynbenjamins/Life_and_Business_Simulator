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
import BusinessBalanceWarning from '../src/components/BusinessBalanceWarning';
import TutorialModal from '../src/components/TutorialModal';
import TutorialDock from '../src/components/TutorialDock';
import ContentUpdateModal from '../src/components/ContentUpdateModal';
import { initializeAdConsent } from '../src/services/adPrivacyManager';
import EducationCareerReminderModal from '../src/components/EducationCareerReminderModal';
import { ThemeProvider, useThemePreference } from '../src/theme/ThemeProvider';
import DeathModal from '../src/components/DeathModal';
import RelationshipEventModal from '../src/components/RelationshipEventModal';
import ReviewPromptModal from '../src/components/ReviewPromptModal';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return <ThemeProvider><RootContent /></ThemeProvider>;
}

function RootContent() {
  const isLoading = useGameStore((s) => s?.isLoading);
  const loadSavedGame = useGameStore((s) => s?.loadSavedGame);
  const { resolvedScheme } = useThemePreference();

  useEffect(() => {
    loadSavedGame?.();
    void initializeAdConsent();
  }, []);
  useEffect(() => { if (!isLoading) SplashScreen.hideAsync(); }, [isLoading]);

  if (isLoading) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }
  return (
    <SafeAreaProvider key={resolvedScheme}>
      <StatusBar style={resolvedScheme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.game}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background }, animation: 'slide_from_right' }}>
          <Stack.Screen name="tabs" />
          <Stack.Screen name="stock/[ticker]" />
          <Stack.Screen name="portfolio" />
          <Stack.Screen name="housing" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="loans" />
          <Stack.Screen name="support" />
          <Stack.Screen name="business" />
          <Stack.Screen name="prestige" />
          <Stack.Screen name="properties" />
          <Stack.Screen name="info" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="relationships" />
          <Stack.Screen name="family-tree" />
          <Stack.Screen name="succession" />
        </Stack>
        <TutorialDock />
      </View>
      <MainMenu />
      <SaveSlotPicker />
      <NameEntryModal />
      <TutorialModal />
      <ContentUpdateModal />
      <WeekSummarySheet />
      <NegativeCashModal />
      <EventModal />
      <PeriodReportModal />
      <ScheduledAdModal />
      <EducationCareerReminderModal />
      <RelationshipEventModal />
      <ReviewPromptModal />
      <DeathModal />
      <GameDialog />
      <BusinessBalanceWarning />
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  game: { flex: 1 },
  loading: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
});
