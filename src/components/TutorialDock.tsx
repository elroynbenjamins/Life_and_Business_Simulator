import React, { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { getTutorialScope, getTutorialStep, isTutorialRoute, TUTORIAL_STEPS, TutorialSnapshot } from '../engine/tutorialEngine';
import { Colors } from '../theme/colors';

export function tutorialSnapshot(): TutorialSnapshot {
  const state = useGameStore.getState();
  return {
    scope: getTutorialScope(state.activeSlot ?? 0, state.playerName ?? 'Player', state.generation ?? 1),
    globalWeek: ((state.year ?? 1) - 1) * 20 + (state.week ?? 1),
    hasEducation: Boolean(state.currentCourseId || state.completedCourses?.length),
    isStudying: Boolean(state.currentCourseId),
    hasIncome: Boolean(state.partTimeJob || state.currentJobId || state.career?.companyId),
  };
}

// An in-layout dock, not a transparent full-screen Modal. It cannot swallow
// touches on the game, obscure the navigation bar, or cover an ad/purchase dialog.
export default function TutorialDock() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const game = useGameStore(useShallow((state) => ({
    scope: getTutorialScope(state.activeSlot ?? 0, state.playerName ?? 'Player', state.generation ?? 1),
    globalWeek: ((state.year ?? 1) - 1) * 20 + (state.week ?? 1),
    hasEducation: Boolean(state.currentCourseId || state.completedCourses?.length),
    isStudying: Boolean(state.currentCourseId),
    hasIncome: Boolean(state.partTimeJob || state.currentJobId || state.career?.companyId),
    blocked: state.isLoading || !state.initialized || state.showMainMenu || state.showSlotPicker
      || state.showNameModal || state.showTutorial || state.showEducationOnboarding
      || state.showContentUpdateModal || state.showSummary || state.showNegativeCashModal
      || state.showPeriodReport || state.showScheduledAd || state.showEducationCareerReminder
      || state.showRelationshipEventModal || state.showEventModal || state.showReviewPrompt
      || Boolean(state.lifecycle?.isDead),
    leaveGame: state.showMainMenu || state.showSlotPicker || state.showNameModal || Boolean(state.lifecycle?.isDead),
  })));
  const { activeScope, sessions, storageWarning, hydrate, pause, reconcile, settle, setHighlight } = useTutorialStore(useShallow((state) => ({
    activeScope: state.activeScope, sessions: state.sessions, storageWarning: state.storageWarning,
    hydrate: state.hydrate, pause: state.pause, reconcile: state.reconcile,
    settle: state.settle, setHighlight: state.setHighlight,
  })));
  const session = sessions.find((entry) => entry.scope === activeScope);
  const step = getTutorialStep(session);
  const active = Boolean(step && activeScope === game.scope && !game.blocked && !keyboardVisible);
  const onRoute = Boolean(step && isTutorialRoute(pathname, step.route));

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (activeScope && (activeScope !== game.scope || game.leaveGame)) pause();
  }, [activeScope, game.scope, game.leaveGame, pause]);
  useEffect(() => {
    if (active) reconcile(game);
  }, [active, game.scope, game.globalWeek, game.hasEducation, game.isStudying, game.hasIncome, reconcile]);
  useEffect(() => {
    setHighlight(active && onRoute ? step?.target ?? null : null);
    return () => setHighlight(null);
  }, [active, onRoute, step?.id, step?.target, setHighlight]);
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { pause(); return true; });
    return () => subscription.remove();
  }, [active, pause]);

  if (!active || !step || !session) return null;
  const finish = (skip = false) => settle(session.scope, step.id, tutorialSnapshot(), skip);
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(8, insets.bottom), maxHeight: height * 0.38 }]} testID="tutorial-dock">
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>GUIDED OPENING · {TUTORIAL_STEPS.findIndex((item) => item.id === step.id) + 1}/{TUTORIAL_STEPS.length}</Text>
          <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">{step.title}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Pause guided introduction" onPress={pause} style={styles.pause}>
          <Text style={styles.secondaryText}>Pause</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.copyScroll} contentContainerStyle={styles.copy}>
        <Text style={styles.body}>{step.body}</Text>
        {storageWarning && <Text style={styles.warning}>Progress is kept for this session, but could not be saved on this device.</Text>}
      </ScrollView>
      <View style={styles.actions}>
        {!onRoute ? (
          <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.navigate(step.route)}>
            <Text style={styles.primaryText}>{step.action}</Text>
          </Pressable>
        ) : step.kind === 'read' ? (
          <Pressable accessibilityRole="button" style={styles.primary} onPress={() => finish()}>
            <Text style={styles.primaryText}>{step.id === 'weekly_result' ? 'Finish guide' : 'Got it'}</Text>
          </Pressable>
        ) : <Text style={styles.actionHint}>Use the real controls above. Progress updates after a successful action.</Text>}
        <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => finish(true)}>
          <Text style={styles.secondaryText}>Do this later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { backgroundColor: Colors.card, borderTopWidth: 2, borderTopColor: Colors.primary, paddingHorizontal: 14, paddingTop: 10, flexShrink: 0 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 3 },
  pause: { minHeight: 44, minWidth: 50, alignItems: 'center', justifyContent: 'center' },
  copyScroll: { flexShrink: 1 },
  copy: { paddingVertical: 7 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  warning: { color: Colors.warning, fontSize: 11, lineHeight: 16, marginTop: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { flex: 1, minHeight: 44, backgroundColor: Colors.primary, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.white, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  secondary: { minHeight: 44, padding: 10, justifyContent: 'center' },
  secondaryText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  actionHint: { flex: 1, color: Colors.textMuted, fontSize: 11, lineHeight: 15 },
});
