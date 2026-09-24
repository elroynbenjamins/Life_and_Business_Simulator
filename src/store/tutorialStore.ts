import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  getTutorialStep, newTutorialSession, normalizeTutorialSessions, reconcileTutorial,
  settleTutorialStep, TUTORIAL_VERSION, TutorialSession, TutorialSnapshot,
  TutorialStepId, TutorialTargetId,
} from '../engine/tutorialEngine';

export const TUTORIAL_STORAGE_KEY = 'life_empire_guidance_v1';
let hydration: Promise<void> | null = null;
let writes: Promise<void> = Promise.resolve();

/** Await outstanding sidecar writes for deterministic tests and orderly shutdown. */
export const flushTutorialWrites = () => writes;

type TutorialStore = {
  ready: boolean;
  storageWarning: boolean;
  sessions: TutorialSession[];
  activeScope: string | null;
  highlight: TutorialTargetId | null;
  hydrate: () => Promise<void>;
  start: (snapshot: TutorialSnapshot, replay?: boolean) => void;
  forget: (scope: string) => Promise<void>;
  pause: () => void;
  settle: (scope: string, id: TutorialStepId, snapshot: TutorialSnapshot, skip?: boolean) => void;
  reconcile: (snapshot: TutorialSnapshot) => void;
  setHighlight: (target: TutorialTargetId | null) => void;
};

function persist(sessions: TutorialSession[]) {
  const payload = JSON.stringify({ version: TUTORIAL_VERSION, sessions });
  // Serialize writes: a slow earlier save must never overwrite a later completion.
  writes = writes.catch(() => undefined).then(async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEY, payload);
      useTutorialStore.setState({ storageWarning: false });
    } catch {
      // Guidance continues in memory; never block play for a storage error.
      useTutorialStore.setState({ storageWarning: true });
    }
  });
}

export const useTutorialStore = create<TutorialStore>((set, get) => {
  const saveSession = (session: TutorialSession) => {
    const sessions = [...get().sessions.filter((entry) => entry.scope !== session.scope), session].slice(-12);
    set({ sessions, activeScope: getTutorialStep(session) ? get().activeScope : null, highlight: null });
    persist(sessions);
  };
  return {
    ready: false, storageWarning: false, sessions: [], activeScope: null, highlight: null,
    hydrate: () => {
      if (!hydration) {
        hydration = (async () => {
          try {
            const raw = await AsyncStorage.getItem(TUTORIAL_STORAGE_KEY);
            const sessions = raw ? normalizeTutorialSessions(JSON.parse(raw)) : [];
            set({ sessions, ready: true });
          } catch {
            set({ sessions: [], ready: true, storageWarning: true });
          }
        })();
      }
      return hydration;
    },
    start: (snapshot, replay = false) => {
      if (!get().ready) return;
      const previous = get().sessions.find((session) => session.scope === snapshot.scope);
      // A replaced/rolled-back save must never wait to catch up to an old baseline.
      const canResume = !replay && previous && getTutorialStep(previous)
        && previous.baselineWeek <= snapshot.globalWeek;
      const session = reconcileTutorial(canResume ? previous : newTutorialSession(snapshot), snapshot);
      set({ activeScope: snapshot.scope, highlight: null });
      saveSession(session);
    },
    forget: async (scope) => {
      await get().hydrate();
      const sessions = get().sessions.filter((entry) => entry.scope !== scope);
      set({ sessions, ...(get().activeScope === scope ? { activeScope: null, highlight: null } : {}) });
      persist(sessions);
    },
    pause: () => set({ activeScope: null, highlight: null }),
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
    setHighlight: (highlight) => {
      if (get().highlight !== highlight) set({ highlight });
    },
  };
});

export function useTutorialHighlight(target: TutorialTargetId | undefined, disabled = false): boolean {
  return useTutorialStore((state) => Boolean(target && !disabled && state.highlight === target));
}
