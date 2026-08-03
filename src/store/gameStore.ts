import { create } from 'zustand';
import { GameState, INITIAL_GAME_STATE, WeekSummary, StockHolding } from '../types/game';
import { initializeStocks } from '../engine/stockEngine';
import { weeklyTick } from '../engine/weeklyTick';
import { getNetWorth, getPortfolioValue } from '../engine/financeEngine';
import { saveGame, loadGame, clearGame } from '../utils/storage';
import coursesData from '../data/courses.json';
import jobsData from '../data/jobs.json';
import housingData from '../data/housing.json';

interface GameStore extends GameState {
  isLoading: boolean;
  lastSummary: WeekSummary | null;
  showSummary: boolean;
  showNameModal: boolean;

  loadSavedGame: () => Promise<void>;
  startNewGame: (name?: string) => Promise<void>;
  setPlayerName: (name: string) => void;
  advanceWeek: () => void;
  dismissSummary: () => void;

  enrollCourse: (courseId: string) => void;
  applyForJob: (jobId: string) => void;
  quitJob: () => void;

  buyStock: (ticker: string, qty: number) => void;
  sellStock: (ticker: string, qty: number) => void;

  changeHousing: (housingId: string) => void;

  getNetWorthValue: () => number;
  getPortfolioValueTotal: () => number;
}

const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_GAME_STATE,
  isLoading: true,
  lastSummary: null,
  showSummary: false,
  showNameModal: false,

  loadSavedGame: async () => {
    const saved = await loadGame();
    if (saved?.initialized) {
      set({ ...saved, isLoading: false, showNameModal: false });
    } else {
      set({ isLoading: false, showNameModal: true });
    }
  },

  startNewGame: async (name?: string) => {
    await clearGame();
    const stocks = initializeStocks();
    const newState: GameState = {
      ...INITIAL_GAME_STATE,
      playerName: name?.trim?.() || 'Player',
      stocks,
    };
    set({ ...newState, isLoading: false, showNameModal: false, lastSummary: null, showSummary: false });
    await saveGame(newState);
  },

  setPlayerName: (name: string) => {
    set({ playerName: name || 'Player' });
    const s = get();
    saveGame(extractGameState(s));
  },

  advanceWeek: () => {
    const state = get();
    const gameState = extractGameState(state);
    const { newState, summary } = weeklyTick(gameState);
    set({ ...newState, lastSummary: summary, showSummary: true });
    saveGame(newState);
  },

  dismissSummary: () => set({ showSummary: false }),

  enrollCourse: (courseId: string) => {
    const state = get();
    const course = (coursesData ?? []).find((c) => c?.id === courseId);
    if (!course) return;
    if ((state?.cash ?? 0) < (course?.cost ?? 0)) return;
    if (state?.currentCourseId) return;
    const alreadyDone = (state?.completedCourses ?? []).some((c) => c?.courseId === courseId);
    if (alreadyDone) return;

    const updates = {
      cash: (state?.cash ?? 0) - (course?.cost ?? 0),
      currentCourseId: courseId,
      courseWeeksCompleted: 0,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  applyForJob: (jobId: string) => {
    const state = get();
    const job = (jobsData ?? []).find((j) => j?.id === jobId);
    if (!job) return;
    const hasReq = (state?.completedCourses ?? []).some((c) => c?.courseId === job?.requiredCourse);
    if (!hasReq) return;

    const now = state?.week ?? 1;
    const newHistory = [...(state?.careerHistory ?? [])];
    if (state?.currentJobId) {
      const lastEntry = newHistory[newHistory.length - 1];
      if (lastEntry && lastEntry?.endWeek === null) {
        lastEntry.endWeek = now;
      }
    }
    newHistory.push({ jobId, title: job?.title ?? '', startWeek: now, endWeek: null });

    const updates = { currentJobId: jobId, careerHistory: newHistory };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  quitJob: () => {
    const state = get();
    if (!state?.currentJobId) return;
    const newHistory = [...(state?.careerHistory ?? [])];
    const lastEntry = newHistory[newHistory.length - 1];
    if (lastEntry && lastEntry?.endWeek === null) {
      lastEntry.endWeek = state?.week ?? 1;
    }
    const updates = { currentJobId: null, careerHistory: newHistory };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  buyStock: (ticker: string, qty: number) => {
    const state = get();
    if (qty <= 0) return;
    const stock = (state?.stocks ?? []).find((s) => s?.ticker === ticker);
    if (!stock) return;
    const totalCost = qty * (stock?.currentPrice ?? 0);
    if ((state?.cash ?? 0) < totalCost) return;

    const newHoldings = [...(state?.holdings ?? [])];
    const existing = newHoldings.find((h) => h?.ticker === ticker);
    if (existing) {
      const totalShares = (existing?.shares ?? 0) + qty;
      const totalSpent = (existing?.shares ?? 0) * (existing?.avgBuyPrice ?? 0) + totalCost;
      existing.avgBuyPrice = totalShares > 0 ? totalSpent / totalShares : 0;
      existing.shares = totalShares;
    } else {
      newHoldings.push({ ticker, shares: qty, avgBuyPrice: stock?.currentPrice ?? 0 });
    }

    const updates = { cash: (state?.cash ?? 0) - totalCost, holdings: newHoldings };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  sellStock: (ticker: string, qty: number) => {
    const state = get();
    if (qty <= 0) return;
    const stock = (state?.stocks ?? []).find((s) => s?.ticker === ticker);
    if (!stock) return;
    const holding = (state?.holdings ?? []).find((h) => h?.ticker === ticker);
    if (!holding || (holding?.shares ?? 0) < qty) return;

    const totalValue = qty * (stock?.currentPrice ?? 0);
    const newHoldings = (state?.holdings ?? []).map((h) => {
      if (h?.ticker === ticker) {
        return { ...h, shares: (h?.shares ?? 0) - qty };
      }
      return h;
    }).filter((h) => (h?.shares ?? 0) > 0);

    const updates = { cash: (state?.cash ?? 0) + totalValue, holdings: newHoldings };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  changeHousing: (housingId: string) => {
    const state = get();
    const housing = (housingData ?? []).find((h) => h?.id === housingId);
    if (!housing) return;
    set({ currentHousingId: housingId });
    saveGame(extractGameState({ ...state, currentHousingId: housingId }));
  },

  getNetWorthValue: () => {
    const state = get();
    return getNetWorth(extractGameState(state));
  },

  getPortfolioValueTotal: () => {
    const state = get();
    return getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  },
}));

function extractGameState(state: Partial<GameStore> & Partial<GameState>): GameState {
  return {
    playerName: state?.playerName ?? 'Player',
    week: state?.week ?? 1,
    year: state?.year ?? 1,
    age: state?.age ?? 22,
    cash: state?.cash ?? 10000,
    currentHousingId: state?.currentHousingId ?? 'cheap_apartment',
    currentJobId: state?.currentJobId ?? null,
    currentCourseId: state?.currentCourseId ?? null,
    courseWeeksCompleted: state?.courseWeeksCompleted ?? 0,
    completedCourses: state?.completedCourses ?? [],
    careerHistory: state?.careerHistory ?? [],
    stocks: state?.stocks ?? [],
    holdings: state?.holdings ?? [],
    netWorthHistory: state?.netWorthHistory ?? [10000],
    currentHeadline: state?.currentHeadline ?? '',
    initialized: true,
  };
}

export default useGameStore;
