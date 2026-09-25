import React, { useEffect, useId, useRef } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import { Colors } from '../theme/colors';
import useGameStore from '../store/gameStore';
import { useTutorialStore } from '../store/tutorialStore';
import { useTutorialFocusStore } from '../store/tutorialFocusStore';
import { getTutorialScope, TutorialTargetId } from '../engine/tutorialEngine';
import { chapterSessionKey, getChapterStep, getChapterContext, TUTORIAL_CHAPTERS, TutorialChapterId } from '../engine/tutorialChapterEngine';
import { useTutorialAnchor } from './TutorialScrollView';
import { tutorialSnapshot } from './TutorialDock';

type ChapterStep = NonNullable<ReturnType<typeof getChapterStep>>;
export default function TutorialChapterLauncher({ chapter, subjectId }: { chapter: TutorialChapterId; subjectId?: string }) {
  const router = useRouter();
  const scope = useGameStore((state) => getTutorialScope(state.activeSlot ?? 0, state.playerName ?? 'Player', state.generation ?? 1));
  const { ready, chapters, activeChapterKey, hydrate, startChapter } = useTutorialStore(useShallow((state) => ({
    ready: state.ready, chapters: state.chapters, activeChapterKey: state.activeChapterKey,
    hydrate: state.hydrate, startChapter: state.startChapter,
  })));
  useEffect(() => { void hydrate(); }, [hydrate]);
  const key = chapterSessionKey(scope, chapter);
  const session = chapters.find((entry) => chapterSessionKey(entry.scope, entry.chapter) === key);
  if (activeChapterKey === key && session?.subjectId === subjectId) return null;
  if (!subjectId) return <Text style={styles.hint}>Open an owned {chapter === 'business' ? 'business' : 'holding company'} to take this optional tour.</Text>;
  const unfinished = Boolean(getChapterStep(session));
  const verb = unfinished ? 'Resume' : session ? 'Replay' : 'Start';
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready }} disabled={!ready}
    style={[styles.launcher, !ready && { opacity: 0.5 }]} onPress={() => {
      const snapshot = tutorialSnapshot();
      // Resolve against the live save at tap time, not a stale render closure.
      if (snapshot.scope !== scope) return;
      const candidate = { scope, chapter, subjectId, baselineWeek: snapshot.globalWeek, completed: [], skipped: [] };
      if (!getChapterContext(candidate, useGameStore.getState()).exists) return;
      startChapter(snapshot, chapter, subjectId, !unfinished);
      const current = useTutorialStore.getState().chapters.find((entry) => chapterSessionKey(entry.scope, entry.chapter) === key);
      const step = getChapterStep(current);
      if (step) router.navigate(step.route);
    }}>
    <Text style={styles.label}>{verb} {TUTORIAL_CHAPTERS[chapter].title} tour</Text>
    <Text style={styles.hint}>Optional · {TUTORIAL_CHAPTERS[chapter].steps.length} short lessons · No spending required</Text>
  </Pressable>;
}

/** Owns only presentation, never game commands. Show me may reveal a hidden section. */
export function useTutorialChapterScreen(chapter: TutorialChapterId, subjectId: string | undefined, section: string,
  onReveal: (step: ChapterStep, subjectId: string) => void) {
  const pathname = usePathname();
  const liveScope = useGameStore(state => getTutorialScope(state.activeSlot ?? 0, state.playerName ?? 'Player', state.generation ?? 1));
  const session = useTutorialStore((state) => state.chapters.find((entry) =>
    chapterSessionKey(entry.scope, entry.chapter) === state.activeChapterKey));
  const step = session?.chapter === chapter ? getChapterStep(session) : null;
  const request = useTutorialFocusStore((state) => step && state.target === step.target && state.status === 'locating' ? state.request : -1);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  useEffect(() => {
    if (request < 0 || !session || !step || session.scope !== liveScope || pathname !== step.route) return;
    reveal.current(step, session.subjectId);
  }, [request, session?.subjectId, step?.id, pathname, liveScope]);
  const correctScreen = Boolean(session && session.scope === liveScope && step && pathname === step.route && session.subjectId === subjectId && step.section === section);
  return (target: TutorialTargetId): TutorialTargetId | undefined => correctScreen ? target : undefined;
}
export function cancelTutorialReveal() {
  const focus = useTutorialFocusStore.getState();
  focus.clear();
}
export function useTutorialScreenBlocker(blocked: boolean) {
  const key = useId();
  useEffect(() => {
    useTutorialStore.getState().setUiBlocked(key, blocked);
    return () => useTutorialStore.getState().setUiBlocked(key, false);
  }, [key, blocked]);
}
export function TutorialAnchor({ id, children, style }: { id?: TutorialTargetId; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const anchor = useTutorialAnchor(id);
  return <View ref={anchor.ref} collapsable={false} onLayout={anchor.onLayout}
    testID={id ? `tutorial-target-${id}` : undefined}
    style={[styles.anchor, style, anchor.highlighted && styles.highlight]}>{children}</View>;
}
const styles = StyleSheet.create({
  launcher: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 10, minHeight: 44, marginBottom: 10 },
  label: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  anchor: { borderWidth: 1, borderColor: 'transparent', borderRadius: 8 },
  highlight: { borderColor: Colors.warning },
});
