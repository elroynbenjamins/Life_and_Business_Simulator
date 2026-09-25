import { chapterSessionKey, getChapterStep, getChapterContext, TUTORIAL_CHAPTERS } from '../engine/tutorialChapterEngine';
import { useGameDialogVisible } from './GameDialog';
import React, { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import useGameStore from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { useTutorialFocusStore } from '../store/tutorialFocusStore';
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

export default function TutorialDock() {
  const pathname = usePathname();
  const dialogVisible = useGameDialogVisible();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const game = useGameStore(useShallow((state) => ({
    cash: state.cash, businesses: state.businesses, holdingCompanies: state.holdingCompanies,
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
  const { activeScope, sessions, storageWarning, hydrate, pause, reconcile, settle, setHighlight, chapters, activeChapterKey, chapterRevision, uiBlockers, settleChapter } = useTutorialStore(useShallow((state) => ({
    activeScope: state.activeScope, sessions: state.sessions, storageWarning: state.storageWarning,
    chapters: state.chapters, activeChapterKey: state.activeChapterKey, chapterRevision: state.chapterRevision,
    uiBlockers: state.uiBlockers, settleChapter: state.settleChapter,
    hydrate: state.hydrate, pause: state.pause, reconcile: state.reconcile,
    settle: state.settle, setHighlight: state.setHighlight,
  })));
  const focus = useTutorialFocusStore(useShallow((state) => ({ request: state.request, status: state.status })));
  const session = sessions.find((entry) => entry.scope === activeScope);
  const openingStep = getTutorialStep(session);
  const chapter = chapters.find(entry => chapterSessionKey(entry.scope, entry.chapter) === activeChapterKey);
  const chapterStep = getChapterStep(chapter);
  const context = chapter ? getChapterContext(chapter, {
    cash: game.cash ?? 0, businesses: game.businesses ?? [], holdingCompanies: game.holdingCompanies ?? [],
  }) : null;
  const step = chapterStep ?? openingStep;
  const guidedScope = chapter?.scope ?? activeScope;
  const subjectAvailable = !chapter || Boolean(context?.exists);
  const active = Boolean(step && subjectAvailable && guidedScope === game.scope && !game.blocked
    && !keyboardVisible && !dialogVisible && Object.keys(uiBlockers).length === 0);
  const lessonSteps = chapter ? TUTORIAL_CHAPTERS[chapter.chapter].steps : TUTORIAL_STEPS;
  const lastStep = lessonSteps[lessonSteps.length - 1]?.id === step?.id;
  const onRoute = Boolean(step && isTutorialRoute(pathname, step.route));

  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (guidedScope && (guidedScope !== game.scope || game.leaveGame || !subjectAvailable)) pause();
  }, [guidedScope, game.scope, game.leaveGame, subjectAvailable, pause]);
  useEffect(() => {
    if (active && !chapter) reconcile(game);
  }, [active, game.scope, game.globalWeek, game.hasEducation, game.isStudying, game.hasIncome, chapter?.chapter, reconcile]);
  useEffect(() => {
    const presentation = useTutorialFocusStore.getState();
    presentation.clear();
    setHighlight(active && onRoute ? step?.target ?? null : null);
    if (active && step) {
      useTutorialFocusStore.setState({ navigationRoute: onRoute ? null : step.route });
      if (onRoute && step.target) presentation.locate(step.target);
    }
    return () => { setHighlight(null); useTutorialFocusStore.getState().clear(); };
  }, [active, onRoute, step?.id, step?.target, step?.route, chapterRevision, setHighlight]);
  useEffect(() => {
    if (!active || !onRoute || focus.status !== 'locating') return;
    const timer = setTimeout(() => useTutorialFocusStore.getState().report(focus.request, 'unavailable'), 1200);
    return () => clearTimeout(timer);
  }, [active, onRoute, focus.request, focus.status]);
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { pause(); return true; });
    return () => subscription.remove();
  }, [active, pause]);

  if (!active || !step) return null;
  const finish = (skip = false) => {
    if (chapter && chapterStep && activeChapterKey) {
      // A rendered lesson from a previous save/subject must not acknowledge a new one.
      if (tutorialSnapshot().scope !== chapter.scope) return;
      settleChapter(activeChapterKey, chapterStep.id, chapterRevision, skip);
    } else if (session && openingStep) settle(session.scope, openingStep.id, tutorialSnapshot(), skip);
  };
  return (
    <View style={[styles.dock, { maxHeight: height * 0.42 }]} testID="tutorial-dock">
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: Math.max(8, insets.bottom) }]}>
        <View style={styles.heading}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>{chapter ? TUTORIAL_CHAPTERS[chapter.chapter].title.toUpperCase() : 'GUIDED OPENING'} · {lessonSteps.findIndex((item) => item.id === step.id) + 1}/{lessonSteps.length}</Text>
            <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">{step.title}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Pause guided introduction" onPress={pause} style={styles.pause}>
            <Text style={styles.secondaryText}>Pause</Text>
          </Pressable>
        </View>
        {context && <Text style={styles.subject} accessibilityLiveRegion="polite">{context.name} · {context.detail}</Text>}
        <Text style={styles.body}>{step.body}</Text>
        {storageWarning && <Text style={styles.warning}>Progress is kept for this session, but could not be saved on this device.</Text>}
        {onRoute && focus.status === 'unavailable' && <Text style={styles.warning} accessibilityLiveRegion="polite">
          {step.id === 'education'
            ? 'No available course control was found. Check course requirements, retry Show me, or leave education for later.'
            : 'This control could not be located. You can keep exploring, retry Show me, or skip this lesson.'}
        </Text>}
        <View style={styles.actions}>
          {!onRoute ? (
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.navigate(step.route)}>
              <Text style={styles.primaryText}>{step.action}</Text>
            </Pressable>
          ) : <>
            {step.kind === 'read' && <Pressable accessibilityRole="button"
              disabled={Boolean(chapter && focus.status !== 'located')}
              accessibilityState={{ disabled: Boolean(chapter && focus.status !== 'located') }}
              style={[styles.primary, chapter && focus.status !== 'located' && { opacity: 0.45 }]} onPress={() => finish()}>
              <Text style={styles.primaryText}>{lastStep ? 'Finish guide' : 'Got it'}</Text>
            </Pressable>}
            {step.target && <Pressable accessibilityRole="button" accessibilityLabel="Show tutorial control" style={styles.secondary}
              onPress={() => { if (step.target) useTutorialFocusStore.getState().locate(step.target); }}>
              <Text style={styles.secondaryText}>Show me</Text>
            </Pressable>}
          </>}
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => finish(true)}>
            <Text style={styles.secondaryText}>Do this later</Text>
          </Pressable>
        </View>
        {onRoute && step.kind === 'action' && <Text style={styles.actionHint}>Use the real controls above. A successful action advances the guide.</Text>}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  dock: { backgroundColor: Colors.card, borderTopWidth: 2, borderTopColor: Colors.primary, flexShrink: 0 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingHorizontal: 14, paddingTop: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 3 },
  pause: { minHeight: 44, minWidth: 50, alignItems: 'center', justifyContent: 'center' },
  subject: { color: Colors.info, fontSize: 12, lineHeight: 18, marginTop: 5 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginVertical: 7 },
  warning: { color: Colors.warning, fontSize: 11, lineHeight: 16, marginBottom: 7 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  primary: { flexGrow: 1, minHeight: 44, backgroundColor: Colors.primary, borderRadius: 10, padding: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.white, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  secondary: { minHeight: 44, padding: 10, justifyContent: 'center' },
  secondaryText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  actionHint: { color: Colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 5 },
});
