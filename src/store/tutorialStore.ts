import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  getTutorialStep, newTutorialSession, normalizeTutorialSessions, reconcileTutorial,
  settleTutorialStep, TUTORIAL_VERSION, TutorialSession, TutorialSnapshot,
  TutorialStepId, TutorialTargetId,
} from '../engine/tutorialEngine';
import {
  chapterSessionKey, getChapterStep, isChapterSubjectId, normalizeChapterSessions, settleChapterStep,
  TutorialChapterId, TutorialChapterSession, TutorialChapterStepId,
} from '../engine/tutorialChapterEngine';

export const TUTORIAL_STORAGE_KEY = 'life_empire_guidance_v1';
let hydration: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();
export const flushTutorialWrites = () => writes;

type TutorialStore = {
  ready: boolean;
  storageWarning: boolean;
  sessions: TutorialSession[];
  activeScope: string | null;
  highlight: TutorialTargetId | null;
  chapters: TutorialChapterSession[];
  activeChapterKey: string | null;
  chapterRevision: number;
  uiBlockers: Record<string, boolean>;
  hydrate: () => Promise<void>;
  start: (snapshot: TutorialSnapshot, replay?: boolean) => void;
  startChapter: (snapshot: TutorialSnapshot, chapter: TutorialChapterId, subjectId: string, replay?: boolean) => void;
  settleChapter: (key: string, id: TutorialChapterStepId, revision: number, skip?: boolean) => void;
  resetChapters: (scope: string) => void;
  setUiBlocked: (key: string, blocked: boolean) => void;
  forget: (scope: string) => Promise<void>;
  pause: () => void;
  settle: (scope: string, id: TutorialStepId, snapshot: TutorialSnapshot, skip?: boolean) => void;
  reconcile: (snapshot: TutorialSnapshot) => void;
  setHighlight: (target: TutorialTargetId | null) => void;
};
function persist(sessions: TutorialSession[]) {
  const chapters = useTutorialStore.getState().chapters;
  // Keep the old payload compatible; capture BOTH histories before queuing the write.
  const payload = JSON.stringify({ version: TUTORIAL_VERSION, sessions, ...(chapters.length ? { chapters } : {}) });
  writes = writes.catch(() => undefined).then(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, payload);
      useTutorialStore.setState({ storageWarning: false });
    } catch { useTutorialStore.setState({ storageWarning: true }); }
  });
}
export const useTutorialStore = create<TutorialStore>((set, get) => {
  const saveSession = (session: TutorialSession) => {
    const sessions = [...get().sessions.filter((entry) => entry.scope !== session.scope), session].slice(-12);
    set({ sessions, activeScope: getTutorialStep(session) ? get().activeScope : null, highlight: null });
    persist(sessions);
  };
  const saveChapter = (session: TutorialChapterSession) => {
    const key = chapterSessionKey(session.scope, session.chapter);
    const chapters = [...get().chapters.filter((entry) => chapterSessionKey(entry.scope, entry.chapter) !== key), session].slice(-24);
    set({ chapters, activeChapterKey: getChapterStep(session) ? key : null,
      chapterRevision: get().chapterRevision + 1, highlight: null });
    persist(get().sessions);
  };
  return {
    ready: false, storageWarning: false, sessions: [], activeScope: null, highlight: null,
    chapters: [], activeChapterKey: null, chapterRevision: 0, uiBlockers: {},
    hydrate: () => {
      if (!hydration) hydration = (async () => {
        try {
          const raw = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
          const payload: unknown = raw ? JSON.parse(raw) : null;
          set({ sessions: normalizeTutorialSessions(payload), chapters: normalizeChapterSessions(payload), ready: true });
        } catch { set({ sessions: [], chapters: [], ready: true, storageWarning: true }); }
      })();
      return hydration;
    },
    start: (snapshot, replay = false) => {
      if (!get().ready) return;
      const previous = get().sessions.find((session) => session.scope === snapshot.scope);
      const canResume = !replay && previous && getTutorialStep(previous) && previous.baselineWeek <= snapshot.globalWeek;
      const session = reconcileTutorial(canResume ? previous : newTutorialSession(snapshot), snapshot);
      set({ activeScope: snapshot.scope, activeChapterKey: null, chapterRevision: get().chapterRevision + 1, highlight: null });
      saveSession(session);
    },
    startChapter: (snapshot, chapter, subjectId, replay = false) => {
      if (!get().ready || !isChapterSubjectId(subjectId)) return;
      const key = chapterSessionKey(snapshot.scope, chapter);
      const previous = get().chapters.find((entry) => chapterSessionKey(entry.scope, entry.chapter) === key);
      const canResume = !replay && previous && getChapterStep(previous) && previous.baselineWeek <= snapshot.globalWeek;
      const session: TutorialChapterSession = canResume ? { ...previous, subjectId }
        : { scope: snapshot.scope, chapter, subjectId, baselineWeek: snapshot.globalWeek, completed: [], skipped: [] };
      set({ activeScope: null });
      saveChapter(session);
    },
    settleChapter: (key, id, revision, skip = false) => {
      if (key !== get().activeChapterKey || revision !== get().chapterRevision || Object.keys(get().uiBlockers).length) return;
      const previous = get().chapters.find((entry) => chapterSessionKey(entry.scope, entry.chapter) === key);
      if (!previous) return;
      const next = settleChapterStep(previous, id, skip);
      if (next !== previous) saveChapter(next);
    },
    resetChapters: (scope) => {
      const active = get().chapters.find((entry) => chapterSessionKey(entry.scope, entry.chapter) === get().activeChapterKey);
      set({ chapters: get().chapters.filter((entry) => entry.scope !== scope),
        ...(active?.scope === scope ? { activeChapterKey: null, highlight: null } : {}),
        chapterRevision: get().chapterRevision + 1 });
      persist(get().sessions);
    },
    setUiBlocked: (key, blocked) => {
      if (Boolean(get().uiBlockers[key]) === blocked) return;
      const uiBlockers = { ...get().uiBlockers };
      if (blocked) uiBlockers[key] = true; else delete uiBlockers[key];
      set({ uiBlockers });
    },
    forget: async (scope) => {
      await get().hydrate();
      const activeChapter = get().chapters.find((entry) => chapterSessionKey(entry.scope, entry.chapter) === get().activeChapterKey);
      const sessions = get().sessions.filter((entry) => entry.scope !== scope);
      set({ sessions, chapters: get().chapters.filter((entry) => entry.scope !== scope),
        ...(get().activeScope === scope ? { activeScope: null, highlight: null } : {}),
        ...(activeChapter?.scope === scope ? { activeChapterKey: null, highlight: null } : {}),
        chapterRevision: get().chapterRevision + 1 });
      persist(sessions);
    },
    pause: () => set({ activeScope: null, activeChapterKey: null, highlight: null, chapterRevision: get().chapterRevision + 1 }),
    settle: (scope, id, snapshot, skip = false) => {
      if (scope !== get().activeScope || snapshot.scope !== scope) return;
      const previous = get().sessions.find((session) => session.scope === scope);
      if (!previous) return;
      const settled = settleTutorialStep(previous, id, skip);
      if (settled !== previous) saveSession(reconcileTutorial(settled, snapshot));
    },
    reconcile: (snapshot) => {
      if (get().activeScope !== snapshot.scope) return;
      const session = get().sessions.find((entry) => entry.scope === snapshot.scope);
      if (!session) return;
      const result = reconcileTutorial(session, snapshot);
      if (result !== session) saveSession(result);
    },
    setHighlight: (highlight) => { if (get().highlight !== highlight) set({ highlight }); },
  };
});
export function useTutorialHighlight(target: TutorialTargetId | undefined, disabled = false): boolean {
  return useTutorialStore((state) => Boolean(target && !disabled && state.highlight === target));
}
