import { create } from 'zustand';
import type { TutorialTargetId } from '../engine/tutorialEngine';

export type TutorialFocusStatus = 'idle' | 'locating' | 'located' | 'unavailable' | 'cancelled';
interface TutorialFocusStore {
  target: TutorialTargetId | null;
  request: number;
  status: TutorialFocusStatus;
  navigationRoute: string | null;
  locate: (target: TutorialTargetId) => void;
  report: (request: number, status: TutorialFocusStatus) => void;
  clear: () => void;
}

// Ephemeral presentation only. Never written to gameplay or tutorial storage.
export const useTutorialFocusStore = create<TutorialFocusStore>((set, get) => ({
  target: null, request: 0, status: 'idle', navigationRoute: null,
  locate: (target) => set({ target, request: get().request + 1, status: 'locating' }),
  report: (request, status) => {
    if (get().request === request && get().status === 'locating') set({ status });
  },
  clear: () => set({ target: null, request: get().request + 1, status: 'idle', navigationRoute: null }),
}));
