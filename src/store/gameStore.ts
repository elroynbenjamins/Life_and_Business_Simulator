import { create } from 'zustand';
import { GameState, INITIAL_GAME_STATE, WeekSummary, ActiveLoan } from '../types/game';
import { initializeStocks } from '../engine/stockEngine';
import { weeklyTick } from '../engine/weeklyTick';
import { getNetWorth, getPortfolioValue } from '../engine/financeEngine';
import { saveGame, loadGame, clearGame } from '../utils/storage';
import coursesData from '../data/courses.json';
import jobsData from '../data/jobs.json';
import housingData from '../data/housing.json';
import carsData from '../data/cars.json';
import loansData from '../data/loans.json';

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
  changeCar: (carId: string) => void;
  changeFoodLevel: (level: string) => void;
  buyHouseUpgrade: (upgradeId: string) => void;

  takeLoan: (loanId: string) => void;
  payOffLoan: (loanId: string) => void;

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
      // Merge with defaults for Phase 2 fields
      const merged: GameState = {
        ...INITIAL_GAME_STATE,
        ...saved,
        houseUpgrades: saved.houseUpgrades ?? [],
        housingHistory: saved.housingHistory ?? [saved.currentHousingId ?? 'cheap_apartment'],
        currentCarId: saved.currentCarId ?? 'none',
        foodLevel: saved.foodLevel ?? 'basic',
        loans: saved.loans ?? [],
        happiness: saved.happiness ?? 30,
        totalWeeksWorked: saved.totalWeeksWorked ?? 0,
        earningsSinceLastTax: saved.earningsSinceLastTax ?? 0,
        lastTaxWeek: saved.lastTaxWeek ?? 0,
        totalTaxPaid: saved.totalTaxPaid ?? 0,
        unlockedAchievements: saved.unlockedAchievements ?? [],
      };
      set({ ...merged, isLoading: false, showNameModal: false });
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
    if (state?.currentCourseId) return;
    const alreadyDone = (state?.completedCourses ?? []).some((c) => c?.courseId === courseId);
    if (alreadyDone) return;
    // Check prerequisite
    if (course.prerequisite) {
      const hasPrereq = (state?.completedCourses ?? []).some((c) => c?.courseId === course.prerequisite);
      if (!hasPrereq) return;
    }
    // Level 1: upfront cost, can't work while studying
    const upfrontCost = course?.cost ?? 0;
    if (upfrontCost > 0 && (state?.cash ?? 0) < upfrontCost) return;

    const updates: Partial<GameState> = {
      cash: (state?.cash ?? 0) - upfrontCost,
      currentCourseId: courseId,
      courseWeeksCompleted: 0,
    };
    // Level 1 course: auto-quit job
    if ((course?.level ?? 1) === 1 && state?.currentJobId) {
      const newHistory = [...(state?.careerHistory ?? [])];
      const lastEntry = newHistory[newHistory.length - 1];
      if (lastEntry && lastEntry?.endWeek === null) {
        lastEntry.endWeek = state?.week ?? 1;
      }
      updates.currentJobId = null;
      updates.careerHistory = newHistory;
    }
    set(updates as any);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  applyForJob: (jobId: string) => {
    const state = get();
    const job = (jobsData ?? []).find((j) => j?.id === jobId);
    if (!job) return;
    // Check required course
    const hasReq = (state?.completedCourses ?? []).some((c) => c?.courseId === job?.requiredCourse);
    if (!hasReq) return;
    // Check experience
    if ((state?.totalWeeksWorked ?? 0) < (job?.requiredExperienceWeeks ?? 0)) return;
    // Check car requirement
    if (job?.requiresCar && (!state?.currentCarId || state?.currentCarId === 'none')) return;
    // Check not studying level 1 course
    if (state?.currentCourseId) {
      const currentCourse = (coursesData ?? []).find((c) => c?.id === state.currentCourseId);
      if ((currentCourse?.level ?? 1) === 1) return;
    }

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
      if (h?.ticker === ticker) return { ...h, shares: (h?.shares ?? 0) - qty };
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
    const newHistory = [...new Set([...(state?.housingHistory ?? []), housingId])];
    // Reset house upgrades when moving
    const updates = { currentHousingId: housingId, houseUpgrades: [] as string[], housingHistory: newHistory };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  changeCar: (carId: string) => {
    const state = get();
    const car = (carsData ?? []).find((c) => c?.id === carId);
    if (!car) return;
    // Trade-in: get 40% of old car value
    const oldCar = (carsData ?? []).find((c) => c?.id === state?.currentCarId);
    const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
    const cost = (car?.purchaseCost ?? 0) - tradeIn;
    if ((state?.cash ?? 0) < cost) return;
    const updates = { currentCarId: carId, cash: (state?.cash ?? 0) - cost };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  changeFoodLevel: (level: string) => {
    const state = get();
    set({ foodLevel: level });
    saveGame(extractGameState({ ...state, foodLevel: level }));
  },

  buyHouseUpgrade: (upgradeId: string) => {
    const state = get();
    if ((state?.houseUpgrades ?? []).includes(upgradeId)) return;
    const upgradeData = require('../data/house_upgrades.json') as any[];
    const upgrade = (upgradeData ?? []).find((u: any) => u?.id === upgradeId);
    if (!upgrade) return;
    if ((state?.cash ?? 0) < (upgrade?.cost ?? 0)) return;
    const newUpgrades = [...(state?.houseUpgrades ?? []), upgradeId];
    const updates = { houseUpgrades: newUpgrades, cash: (state?.cash ?? 0) - (upgrade?.cost ?? 0) };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  takeLoan: (loanId: string) => {
    const state = get();
    // Max 3 active loans
    if ((state?.loans ?? []).length >= 3) return;
    // Can't have same loan type
    if ((state?.loans ?? []).some((l) => l?.loanId === loanId)) return;
    const template = (loansData ?? []).find((l) => l?.id === loanId);
    if (!template) return;
    const totalRepayment = (template?.amount ?? 0) * (1 + (template?.interestRate ?? 0));
    const weeklyPayment = Math.ceil(totalRepayment / (template?.durationWeeks ?? 1));
    const newLoan: ActiveLoan = {
      loanId: template?.id ?? '',
      name: template?.name ?? '',
      originalAmount: template?.amount ?? 0,
      remainingAmount: totalRepayment,
      weeklyPayment,
      weeksRemaining: template?.durationWeeks ?? 0,
    };
    const updates = {
      loans: [...(state?.loans ?? []), newLoan],
      cash: (state?.cash ?? 0) + (template?.amount ?? 0),
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
  },

  payOffLoan: (loanId: string) => {
    const state = get();
    const loan = (state?.loans ?? []).find((l) => l?.loanId === loanId);
    if (!loan) return;
    if ((state?.cash ?? 0) < (loan?.remainingAmount ?? 0)) return;
    const updates = {
      loans: (state?.loans ?? []).filter((l) => l?.loanId !== loanId),
      cash: (state?.cash ?? 0) - (loan?.remainingAmount ?? 0),
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }));
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
    houseUpgrades: state?.houseUpgrades ?? [],
    housingHistory: state?.housingHistory ?? ['cheap_apartment'],
    currentCarId: state?.currentCarId ?? 'none',
    foodLevel: state?.foodLevel ?? 'basic',
    currentCourseId: state?.currentCourseId ?? null,
    courseWeeksCompleted: state?.courseWeeksCompleted ?? 0,
    completedCourses: state?.completedCourses ?? [],
    currentJobId: state?.currentJobId ?? null,
    careerHistory: state?.careerHistory ?? [],
    totalWeeksWorked: state?.totalWeeksWorked ?? 0,
    stocks: state?.stocks ?? [],
    holdings: state?.holdings ?? [],
    loans: state?.loans ?? [],
    happiness: state?.happiness ?? 30,
    netWorthHistory: state?.netWorthHistory ?? [10000],
    earningsSinceLastTax: state?.earningsSinceLastTax ?? 0,
    lastTaxWeek: state?.lastTaxWeek ?? 0,
    totalTaxPaid: state?.totalTaxPaid ?? 0,
    unlockedAchievements: state?.unlockedAchievements ?? [],
    currentHeadline: state?.currentHeadline ?? '',
    initialized: true,
  };
}

export default useGameStore;
