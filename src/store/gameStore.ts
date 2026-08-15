import { create } from 'zustand';
import { GameState, INITIAL_GAME_STATE, INITIAL_STATISTICS, INITIAL_PROFILE, INITIAL_CAREER_STATE, WeekSummary, ActiveLoan, LifetimeStatistics, PlayerProfile, SaveSlotMeta, PeriodReport, TriggeredEvent, PendingInvestment, TempHappinessEffect, OwnedBusiness, OwnedProperty, BusinessEmployee, BusinessLoan, CareerState } from '../types/game';
import { initializeStocks, mergeStocks } from '../engine/stockEngine';
import { weeklyTick } from '../engine/weeklyTick';
import { getNetWorth, getPortfolioValue, getUnrealizedProfitLoss } from '../engine/financeEngine';
import { inflated } from '../engine/economyEngine';
import { createBusiness, generateCandidates, candidateToEmployee, getBusinessType, getUpgrade, calculateValuation, getTotalBusinessValue, applyMoraleAction, startTraining, startProject, resolveRetention, MIN_EMPLOYEES_REQUIRED } from '../engine/businessEngine';
import { createProperty, renovateProperty, getTotalPropertyValue } from '../engine/propertyEngine';
import { unlockPrestige, getPrestigeEffects } from '../engine/prestigeEngine';
import { getCareerSalary } from '../engine/careerEngine';
import { applyEducationRewards } from '../engine/skillEngine';
import { createInitialCompetitors } from '../engine/competitorEngine';
import { saveGame, loadGame, clearGame, getActiveSlot, setActiveSlot, loadAllSlotMeta, loadProfile, saveProfile } from '../utils/storage';
import coursesData from '../data/courses.json';
import jobsData from '../data/jobs.json';
import housingData from '../data/housing.json';
import carsData from '../data/cars.json';
import loansData from '../data/loans.json';
import achievementsData from '../data/achievements.json';
import careerPathsData from '../data/career_paths.json';
import companiesData from '../data/companies.json';
import { AD_GEM_REWARD, GEM_CASH_RATE } from '../constants/rewards';
import { AD_CONFIG } from '../services/adConfig';

interface GameStore extends GameState {
  isLoading: boolean;
  lastSummary: WeekSummary | null;
  showSummary: boolean;
  showNameModal: boolean;
  showSlotPicker: boolean;
  showMainMenu: boolean;
  slotPickerMode: 'load' | 'new';
  showNegativeCashModal: boolean;
  showPeriodReport: boolean;
  showScheduledAd: boolean;
  periodReport: PeriodReport | null;

  // Period tracking accumulators (reset every 20 weeks)
  periodIncome: number;
  periodExpenses: number;
  periodTax: number;
  periodWeeksEmployed: number;
  periodWeeksUnemployed: number;
  periodJobChanges: number;
  periodCoursesCompleted: number;
  periodStocksPurchased: number;
  periodLoansTaken: number;
  periodLoansRepaid: number;
  periodAchievements: number;
  periodStartWeek: number;

  // Player profile (cross-game)
  profile: PlayerProfile;
  activeSlot: number;
  slotMeta: Record<number, SaveSlotMeta>;

  loadSavedGame: () => Promise<void>;
  loadSlot: (slot: number) => Promise<void>;
  startNewGame: (name?: string) => Promise<void>;
  deleteSlot: (slot: number) => Promise<void>;
  setPlayerName: (name: string) => void;
  advanceWeek: () => void;
  dismissSummary: () => void;
  dismissNegativeCash: () => void;
  dismissPeriodReport: () => void;
  dismissScheduledAd: () => void;
  openSlotPicker: () => void;
  closeSlotPicker: () => void;
  continueGame: () => void;
  openMainMenu: () => void;
  beginNewGame: () => void;
  selectNewGameSlot: (slot: number) => Promise<void>;

  enrollCourse: (courseId: string) => void;
  speedUpEducationWithAd: () => void;
  applyForJob: (jobId: string) => void;
  quitJob: () => void;

  buyStock: (ticker: string, qty: number) => void;
  sellStock: (ticker: string, qty: number) => void;

  changeHousing: (housingId: string) => void;
  changeCar: (carId: string) => void;
  changeFoodLevel: (level: string) => void;
  togglePartTimeJob: () => void;
  grantAdReward: () => void;
  getAdUsage: () => { watchedToday: number; remaining: number; limitReached: boolean };
  buyHouseUpgrade: (upgradeId: string) => void;

  takeLoan: (loanId: string) => void;
  payOffLoan: (loanId: string) => void;

  // Events
  showEventModal: boolean;
  pendingEvent: TriggeredEvent | null;
  dismissEventModal: () => void;
  handleEventChoice: (choiceIndex: number) => void;

  // Gems
  watchAd: () => void;
  convertGemsToCash: (gems: number) => void;
  setAdsRemoved: () => void;

  // Career v2
  applyForCareerJob: (companyId: string, careerPathId: string, level: number) => void;
  quitCareerJob: () => void;

  // Properties
  buyProperty: (typeId: string) => void;
  sellProperty: (propertyId: string) => void;
  togglePropertyRental: (propertyId: string) => void;
  renovatePropertyAction: (propertyId: string) => void;

  // Prestige
  unlockPrestigeBonus: (bonusId: string) => void;

  // Business
  foundBusiness: (typeId: string, customName: string | null) => void;
  sellBusiness: (businessId: string) => void;
  openCandidatePool: (businessId: string, roleId: string) => void;
  hireCandidate: (businessId: string, candidateId: string) => void;
  cancelCandidatePool: (businessId: string) => void;
  fireEmployee: (businessId: string, employeeId: string) => void;
  applyMoraleActionToBusiness: (businessId: string, actionId: string) => void;
  startEmployeeTraining: (businessId: string, employeeId: string, trainingId: string) => void;
  startBusinessProject: (businessId: string, projectId: string) => void;
  resolveBusinessRetention: (businessId: string, choice: 'accept' | 'match_salary' | 'increase_salary' | 'promote' | 'let_go' | 'training' | 'deny') => void;
  setBusinessPricing: (businessId: string, strategy: OwnedBusiness['pricingStrategy']) => void;
  setBusinessAdvertising: (businessId: string, level: OwnedBusiness['advertisingLevel']) => void;
  buyBusinessUpgrade: (businessId: string, upgradeId: string) => void;
  takeBusinessLoan: (businessId: string, amount: number, interestRate: number, durationWeeks: number) => void;
  injectCashIntoBusiness: (businessId: string, amount: number) => void;
  withdrawFromBusiness: (businessId: string, amount: number) => void;

  getNetWorthValue: () => number;
  getPortfolioValueTotal: () => number;
}

const useGameStore = create<GameStore>((set, get) => ({
  ...INITIAL_GAME_STATE,
  isLoading: true,
  lastSummary: null,
  showSummary: false,
  showNameModal: false,
  showSlotPicker: false,
  showMainMenu: false,
  slotPickerMode: 'load',
  showNegativeCashModal: false,
  showPeriodReport: false,
  showScheduledAd: false,
  periodReport: null,
  periodIncome: 0,
  periodExpenses: 0,
  periodTax: 0,
  periodWeeksEmployed: 0,
  periodWeeksUnemployed: 0,
  periodJobChanges: 0,
  periodCoursesCompleted: 0,
  periodStocksPurchased: 0,
  periodLoansTaken: 0,
  periodLoansRepaid: 0,
  periodAchievements: 0,
  periodStartWeek: 1,
  showEventModal: false,
  pendingEvent: null,
  profile: { ...INITIAL_PROFILE },
  activeSlot: 0,
  slotMeta: {},

  loadSavedGame: async () => {
    const [profile, slotMeta, activeSlot] = await Promise.all([
      loadProfile(),
      loadAllSlotMeta(),
      getActiveSlot(),
    ]);
    const saved = await loadGame(activeSlot);
    if (saved?.initialized) {
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
        inflationMultiplier: saved.inflationMultiplier ?? 1.0,
        statistics: saved.statistics ?? { ...INITIAL_STATISTICS },
        tempHappinessEffects: saved.tempHappinessEffects ?? [],
        pendingInvestments: saved.pendingInvestments ?? [],
        recentEventIds: saved.recentEventIds ?? [],
        businesses: (saved.businesses ?? []).map((business) => ({
          ...business,
          purchasedUpgrades: [...new Set(business.purchasedUpgrades ?? [])],
          marketShareModifier: business.marketShareModifier ?? 0,
        })),
        skills: saved.skills ?? {},
        knowledge: saved.knowledge ?? {},
        career: saved.career ?? { ...INITIAL_CAREER_STATE },
        properties: saved.properties ?? [],
        competitors: saved.competitors ?? {},
        activeMarketSentiment: saved.activeMarketSentiment ?? null,
        activeMarketEvents: saved.activeMarketEvents ?? [],
        totalRealizedProfitLoss: saved.totalRealizedProfitLoss ?? 0,
      };
      // Migrate career state: remove old freelancing fields, add new fields
      if (merged.career) {
        const c = merged.career as any;
        delete c.isFreelancing;
        delete c.freelanceWeeklyIncome;
        if (typeof c.promotionProgress === 'undefined') c.promotionProgress = 0;
        if (typeof c.lastPerformanceEventWeek === 'undefined') c.lastPerformanceEventWeek = 0;
      }
      merged.stocks = mergeStocks(merged.stocks);
      // Migrate legacy profile
      if (profile && typeof (profile as any).prestigePoints === 'undefined') {
        (profile as any).prestigePoints = profile.totalXp ?? 0;
        (profile as any).unlockedPrestige = (profile as any).unlockedPrestige ?? [];
      }
      set({ ...merged, isLoading: false, showNameModal: false, showMainMenu: true, profile, slotMeta, activeSlot });
    } else {
      set({ isLoading: false, showMainMenu: true, showSlotPicker: false, profile, slotMeta, activeSlot });
    }
  },

  loadSlot: async (slot: number) => {
    await setActiveSlot(slot);
    const saved = await loadGame(slot);
    if (saved?.initialized) {
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
        inflationMultiplier: saved.inflationMultiplier ?? 1.0,
        statistics: saved.statistics ?? { ...INITIAL_STATISTICS },
        tempHappinessEffects: saved.tempHappinessEffects ?? [],
        pendingInvestments: saved.pendingInvestments ?? [],
        recentEventIds: saved.recentEventIds ?? [],
        businesses: (saved.businesses ?? []).map((business) => ({
          ...business,
          purchasedUpgrades: [...new Set(business.purchasedUpgrades ?? [])],
          marketShareModifier: business.marketShareModifier ?? 0,
        })),
        skills: saved.skills ?? {},
        knowledge: saved.knowledge ?? {},
        career: saved.career ?? { ...INITIAL_CAREER_STATE },
        properties: saved.properties ?? [],
        competitors: saved.competitors ?? {},
        activeMarketSentiment: saved.activeMarketSentiment ?? null,
        activeMarketEvents: saved.activeMarketEvents ?? [],
        totalRealizedProfitLoss: saved.totalRealizedProfitLoss ?? 0,
      };
      // Migrate career state
      if (merged.career) {
        const c = merged.career as any;
        delete c.isFreelancing;
        delete c.freelanceWeeklyIncome;
        if (typeof c.promotionProgress === 'undefined') c.promotionProgress = 0;
        if (typeof c.lastPerformanceEventWeek === 'undefined') c.lastPerformanceEventWeek = 0;
      }
      merged.stocks = mergeStocks(merged.stocks);
      const slotMeta = await loadAllSlotMeta();
      set({ ...merged, isLoading: false, showNameModal: false, showSlotPicker: false, showMainMenu: false, activeSlot: slot, slotMeta, lastSummary: null, showSummary: false });
    } else {
      // Empty slot — start new game here
      set({ activeSlot: slot, showSlotPicker: false, showMainMenu: false, showNameModal: true, slotPickerMode: 'load' });
    }
  },

  startNewGame: async (name?: string) => {
    const { activeSlot, profile } = get();
    await clearGame(activeSlot);
    const stocks = initializeStocks();
    // Apply prestige starting_cash bonus
    const prestigeFx = getPrestigeEffects(profile);
    const startingCash = 10000 + (prestigeFx.starting_cash ?? 0);
    const newState: GameState = {
      ...INITIAL_GAME_STATE,
      playerName: name?.trim?.() || 'Player',
      stocks,
      cash: startingCash,
      netWorthHistory: [startingCash],
    };
    await saveGame(newState, activeSlot);
    const slotMeta = await loadAllSlotMeta();
    set({ ...newState, isLoading: false, showNameModal: false, showSlotPicker: false, showMainMenu: false, slotPickerMode: 'load', lastSummary: null, showSummary: false, slotMeta });
  },

  deleteSlot: async (slot: number) => {
    await clearGame(slot);
    const slotMeta = await loadAllSlotMeta();
    set({ slotMeta });
  },

  setPlayerName: (name: string) => {
    set({ playerName: name || 'Player' });
    const s = get();
    saveGame(extractGameState(s), s.activeSlot);
  },

  advanceWeek: () => {
    const state = get();
    const gameState = extractGameState(state);

    // Check negative cash before advancing
    if ((gameState.cash ?? 0) < 0) {
      set({ showNegativeCashModal: true });
      return;
    }

    const { newState, summary } = weeklyTick(gameState);

    // Award XP + prestige points + gems for new achievements
    let profileUpdated = false;
    let newProfile = { ...state.profile };
    if ((summary.newAchievements?.length ?? 0) > 0) {
      let xpGained = 0;
      let gemsGained = 0;
      for (const id of summary.newAchievements) {
        const ach = (achievementsData ?? []).find((a) => a?.id === id);
        xpGained += ach?.xpReward ?? 0;
        gemsGained += (ach as any)?.gemReward ?? 0;
      }
      newProfile = {
        ...newProfile,
        totalXp: (newProfile.totalXp ?? 0) + xpGained,
        prestigePoints: (newProfile.prestigePoints ?? 0) + xpGained,
        gems: (newProfile.gems ?? 0) + gemsGained,
      };
      profileUpdated = true;
    }

    // Accumulate period stats
    const totalExp = summary.rentPaid + summary.utilityCost + summary.foodCost + summary.carCost + summary.courseCost + summary.loanPayments;
    const newPeriodIncome = (state.periodIncome ?? 0) + summary.salaryEarned;
    const newPeriodExpenses = (state.periodExpenses ?? 0) + totalExp;
    const newPeriodTax = (state.periodTax ?? 0) + summary.taxAmount;
    const isEmployed = !!(gameState.career?.companyId || gameState.currentJobId);
    const newPeriodWeeksEmployed = (state.periodWeeksEmployed ?? 0) + (isEmployed ? 1 : 0);
    const newPeriodWeeksUnemployed = (state.periodWeeksUnemployed ?? 0) + (isEmployed ? 0 : 1);
    const newPeriodCoursesCompleted = (state.periodCoursesCompleted ?? 0) + (summary.courseProgress?.includes('Completed') ? 1 : 0);
    const newPeriodAchievements = (state.periodAchievements ?? 0) + (summary.newAchievements?.length ?? 0);

    const periodAccum: Record<string, any> = {
      periodIncome: newPeriodIncome,
      periodExpenses: newPeriodExpenses,
      periodTax: newPeriodTax,
      periodWeeksEmployed: newPeriodWeeksEmployed,
      periodWeeksUnemployed: newPeriodWeeksUnemployed,
      periodJobChanges: state.periodJobChanges ?? 0,
      periodCoursesCompleted: newPeriodCoursesCompleted,
      periodStocksPurchased: state.periodStocksPurchased ?? 0,
      periodLoansTaken: state.periodLoansTaken ?? 0,
      periodLoansRepaid: state.periodLoansRepaid ?? 0,
      periodAchievements: newPeriodAchievements,
      periodStartWeek: state.periodStartWeek ?? 1,
    };

    // Check if this is a 20-week boundary
    const currentGlobalWeek = ((newState.year - 1) * 20) + newState.week;
    const is20WeekMark = currentGlobalWeek % 20 === 0 && currentGlobalWeek > 0;

    let periodReportUpdate: Record<string, any> = {};
    if (is20WeekMark) {
      const nw = getNetWorth(newState);
      const unrealizedPL = getUnrealizedProfitLoss(newState.stocks ?? [], newState.holdings ?? []);
      const report: PeriodReport = {
        fromWeek: periodAccum.periodStartWeek,
        toWeek: currentGlobalWeek,
        totalIncome: periodAccum.periodIncome,
        totalExpenses: periodAccum.periodExpenses,
        totalTax: periodAccum.periodTax,
        weeksEmployed: periodAccum.periodWeeksEmployed,
        weeksUnemployed: periodAccum.periodWeeksUnemployed,
        jobChanges: periodAccum.periodJobChanges,
        coursesCompleted: periodAccum.periodCoursesCompleted,
        stocksPurchased: periodAccum.periodStocksPurchased,
        loansTaken: periodAccum.periodLoansTaken,
        loansRepaid: periodAccum.periodLoansRepaid,
        currentCash: newState.cash,
        currentNetWorth: nw,
        currentHappiness: newState.happiness,
        achievementsUnlocked: periodAccum.periodAchievements,
        totalRealizedProfitLoss: newState.totalRealizedProfitLoss ?? 0,
        totalUnrealizedProfitLoss: unrealizedPL,
        totalDividends: newState.statistics?.totalDividendsReceived ?? 0,
      };
      periodReportUpdate = {
        periodReport: report,
        // Reset accumulators
        periodIncome: 0,
        periodExpenses: 0,
        periodTax: 0,
        periodWeeksEmployed: 0,
        periodWeeksUnemployed: 0,
        periodJobChanges: 0,
        periodCoursesCompleted: 0,
        periodStocksPurchased: 0,
        periodLoansTaken: 0,
        periodLoansRepaid: 0,
        periodAchievements: 0,
        periodStartWeek: currentGlobalWeek + 1,
      };
    }

    set({
      ...newState,
      lastSummary: summary,
      showSummary: true,
      ...(profileUpdated ? { profile: newProfile } : {}),
      ...(is20WeekMark ? periodReportUpdate : periodAccum),
    });
    saveGame(newState, state.activeSlot);
    if (profileUpdated) saveProfile(newProfile);
  },

  dismissSummary: () => {
    const state = get();
    const summary = state.lastSummary;
    const globalWeek = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const scheduledAd = globalWeek > 0 && globalWeek % 100 === 0;
    // If there's a choice/opportunity event, show event modal first
    if (summary?.lifeEvent && (summary.lifeEvent.type === 'choice' || summary.lifeEvent.type === 'opportunity')) {
      set({ showSummary: false, showEventModal: true, pendingEvent: summary.lifeEvent, showScheduledAd: scheduledAd });
    } else if (state.periodReport && !state.showPeriodReport) {
      set({ showSummary: false, showPeriodReport: true, showScheduledAd: scheduledAd });
    } else {
      set({ showSummary: false, showScheduledAd: scheduledAd });
    }
  },
  dismissNegativeCash: () => set({ showNegativeCashModal: false }),
  dismissPeriodReport: () => set({ showPeriodReport: false, periodReport: null }),
  dismissScheduledAd: () => set({ showScheduledAd: false }),
  dismissEventModal: () => {
    const state = get();
    // After event modal, check for period report
    if (state.periodReport && !state.showPeriodReport) {
      set({ showEventModal: false, pendingEvent: null, showPeriodReport: true });
    } else {
      set({ showEventModal: false, pendingEvent: null });
    }
  },
  handleEventChoice: (choiceIndex: number) => {
    const state = get();
    const event = state.pendingEvent;
    if (!event || !event.choices) return;
    const choice = event.choices[choiceIndex];
    if (!choice) return;

    let cashChange = 0;
    if (typeof choice.cost === 'number' && choice.cost > 0) {
      if ((state.cash ?? 0) < choice.cost) {
        // Can't afford — dismiss
        set({ showEventModal: false, pendingEvent: null });
        return;
      }
      cashChange = -(choice.cost);
    }
    if (typeof choice.cash === 'number') {
      cashChange += choice.cash;
    }

    const updates: Record<string, any> = {
      cash: (state.cash ?? 0) + cashChange,
    };

    if (event.businessId) {
      const businesses = (state.businesses ?? []).map((business) => {
        if (business.id !== event.businessId) return business;
        const businessCashChange = choice.businessCash ?? 0;
        if (businessCashChange < 0 && (business.balance ?? 0) < Math.abs(businessCashChange)) return business;
        const updatedBusiness = {
          ...business,
          balance: Math.max(0, (business.balance ?? 0) + businessCashChange),
          reputation: Math.max(0, Math.min(100, (business.reputation ?? 0) + (choice.reputation ?? 0))),
          marketShareModifier: Math.max(-30, Math.min(30, (business.marketShareModifier ?? 0) + (choice.marketShare ?? 0))),
        };
        return { ...updatedBusiness, valuation: calculateValuation(updatedBusiness) };
      });
      updates.businesses = businesses;
    }

    // Add temp happiness effect
    if (choice.happiness && choice.happiness !== 0) {
      const duration = choice.happinessDuration ?? 1;
      const newEffects = [...(state.tempHappinessEffects ?? []), { amount: choice.happiness, weeksRemaining: duration, source: event.title }];
      updates.tempHappinessEffects = newEffects;
    }

    // Handle opportunity investments
    if (choice.investmentId && event.investmentOutcomes) {
      const outcome = event.investmentOutcomes[choice.investmentId];
      if (outcome) {
        const newInv: PendingInvestment = {
          id: `${event.id}_${Date.now()}`,
          eventId: event.id,
          investmentId: choice.investmentId,
          amount: choice.cost ?? 0,
          successChance: outcome.successChance,
          returnMultiplier: outcome.returnMultiplier,
          failReturnMultiplier: outcome.failReturnMultiplier,
          weeksRemaining: outcome.weeksToResolve,
        };
        updates.pendingInvestments = [...(state.pendingInvestments ?? []), newInv];
      }
    }

    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);

    // Dismiss event modal
    if (state.periodReport && !state.showPeriodReport) {
      set({ showEventModal: false, pendingEvent: null, showPeriodReport: true });
    } else {
      set({ showEventModal: false, pendingEvent: null });
    }
  },
  openSlotPicker: () => set({ showSlotPicker: true, slotPickerMode: 'load' }),
  closeSlotPicker: () => set({ showSlotPicker: false }),
  continueGame: () => set({ showMainMenu: false }),
  openMainMenu: () => set({ showMainMenu: true }),
  beginNewGame: () => set({ showSlotPicker: true, slotPickerMode: 'new' }),
  selectNewGameSlot: async (slot: number) => {
    await setActiveSlot(slot);
    set({ activeSlot: slot, showSlotPicker: false, showMainMenu: false, showNameModal: true, slotPickerMode: 'load' });
  },

  enrollCourse: (courseId: string) => {
    const state = get();
    const course = (coursesData ?? []).find((c) => c?.id === courseId);
    if (!course) return;
    if (state?.currentCourseId) return;
    const alreadyDone = (state?.completedCourses ?? []).some((c) => c?.courseId === courseId);
    if (alreadyDone) return;
    if (course.prerequisite) {
      const hasPrereq = (state?.completedCourses ?? []).some((c) => c?.courseId === course.prerequisite);
      if (!hasPrereq) return;
    }
    const upfrontCost = course?.cost ?? 0;
    if (upfrontCost > 0 && (state?.cash ?? 0) < upfrontCost) return;

    const updates: Partial<GameState> = {
      cash: (state?.cash ?? 0) - upfrontCost,
      currentCourseId: courseId,
      courseWeeksCompleted: 0,
    };
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
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  speedUpEducationWithAd: () => {
    const state = get();
    if (!state.currentCourseId) return;
    const course = (coursesData as any[]).find((item) => item.id === state.currentCourseId);
    if (!course) return;
    const rewards = applyEducationRewards(state.skills ?? {}, state.knowledge ?? {}, course);
    const statistics = {
      ...(state.statistics ?? INITIAL_STATISTICS),
      coursesCompleted: (state.statistics?.coursesCompleted ?? 0) + 1,
    };
    const updates: any = {
      currentCourseId: null,
      courseWeeksCompleted: 0,
      completedCourses: [...(state.completedCourses ?? []), { courseId: course.id, name: course.name, completedWeek: state.week }],
      skills: rewards.updatedSkills,
      knowledge: rewards.updatedKnowledge,
      statistics,
      periodCoursesCompleted: (state.periodCoursesCompleted ?? 0) + 1,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  applyForJob: (jobId: string) => {
    const state = get();
    const job = (jobsData ?? []).find((j) => j?.id === jobId);
    if (!job) return;
    const hasReq = (state?.completedCourses ?? []).some((c) => c?.courseId === job?.requiredCourse);
    if (!hasReq) return;
    if ((state?.totalWeeksWorked ?? 0) < (job?.requiredExperienceWeeks ?? 0)) return;
    if (job?.requiresCar && (!state?.currentCarId || state?.currentCarId === 'none')) return;
    const housingTiers: Record<string, number> = { cheap_apartment: 0, studio_apartment: 1, small_house: 2, family_house: 3, luxury_villa: 4, mansion: 5 };
    const requiredHousingTier = (job.level ?? 1) >= 5 ? 2 : (job.level ?? 1) >= 3 ? 1 : 0;
    if ((housingTiers[state.currentHousingId ?? 'cheap_apartment'] ?? 0) < requiredHousingTier) return;
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

    const prevStats = state?.statistics ?? { ...INITIAL_STATISTICS };
    const newStats: LifetimeStatistics = { ...prevStats, jobsWorked: prevStats.jobsWorked + 1 };

    const updates = { currentJobId: jobId, careerHistory: newHistory, statistics: newStats, periodJobChanges: (state.periodJobChanges ?? 0) + 1, partTimeJob: false };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
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
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
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

    const prevStats = state?.statistics ?? { ...INITIAL_STATISTICS };
    const newStats: LifetimeStatistics = { ...prevStats, stocksPurchased: prevStats.stocksPurchased + qty };

    const updates = { cash: (state?.cash ?? 0) - totalCost, holdings: newHoldings, statistics: newStats, periodStocksPurchased: (state.periodStocksPurchased ?? 0) + qty };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  sellStock: (ticker: string, qty: number) => {
    const state = get();
    if (qty <= 0) return;
    const stock = (state?.stocks ?? []).find((s) => s?.ticker === ticker);
    if (!stock) return;
    const holding = (state?.holdings ?? []).find((h) => h?.ticker === ticker);
    if (!holding || (holding?.shares ?? 0) < qty) return;

    const totalValue = qty * (stock?.currentPrice ?? 0);
    const costBasis = qty * (holding?.avgBuyPrice ?? 0);
    const realizedPL = totalValue - costBasis;

    const newHoldings = (state?.holdings ?? []).map((h) => {
      if (h?.ticker === ticker) return { ...h, shares: (h?.shares ?? 0) - qty };
      return h;
    }).filter((h) => (h?.shares ?? 0) > 0);

    const prevStats = state?.statistics ?? { ...INITIAL_STATISTICS };
    const updates = {
      cash: (state?.cash ?? 0) + totalValue,
      holdings: newHoldings,
      totalRealizedProfitLoss: (state?.totalRealizedProfitLoss ?? 0) + realizedPL,
      statistics: {
        ...prevStats,
        totalRealizedProfitLoss: (prevStats.totalRealizedProfitLoss ?? 0) + realizedPL,
      },
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  changeHousing: (housingId: string) => {
    const state = get();
    const housing = (housingData ?? []).find((h) => h?.id === housingId);
    if (!housing) return;
    const newHistory = [...new Set([...(state?.housingHistory ?? []), housingId])];
    const updates = { currentHousingId: housingId, houseUpgrades: [] as string[], housingHistory: newHistory };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  changeCar: (carId: string) => {
    const state = get();
    const car = (carsData ?? []).find((c) => c?.id === carId);
    if (!car) return;
    const oldCar = (carsData ?? []).find((c) => c?.id === state?.currentCarId);
    const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
    const inflatedCost = inflated(car?.purchaseCost ?? 0, state?.inflationMultiplier ?? 1);
    const cost = inflatedCost - tradeIn;
    if ((state?.cash ?? 0) < cost) return;
    const updates = { currentCarId: carId, cash: (state?.cash ?? 0) - cost };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  changeFoodLevel: (level: string) => {
    const state = get();
    set({ foodLevel: level });
    saveGame(extractGameState({ ...state, foodLevel: level }), state.activeSlot);
  },

  togglePartTimeJob: () => {
    const state = get();
    if (state.currentJobId || state.career?.companyId) return;
    const newVal = !(state.partTimeJob ?? false);
    set({ partTimeJob: newVal } as any);
    saveGame(extractGameState({ ...state, partTimeJob: newVal }), state.activeSlot);
  },

  grantAdReward: () => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = (state as any).adLastWatchDate ?? '';
    const watchedToday = lastDate === today ? ((state as any).adWatchedToday ?? 0) : 0;
    const newProfile = { ...state.profile, gems: (state.profile.gems ?? 0) + AD_GEM_REWARD };
    const updates: any = {
      profile: newProfile,
      adWatchedToday: watchedToday + 1,
      adLastWatchDate: today,
    };
    set(updates);
    saveProfile(newProfile);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  getAdUsage: () => {
    const state = get();
    const today = new Date().toISOString().slice(0, 10);
    const lastDate = (state as any).adLastWatchDate ?? '';
    const watchedToday = lastDate === today ? ((state as any).adWatchedToday ?? 0) : 0;
    const remaining = Math.max(0, AD_CONFIG.DAILY_AD_LIMIT - watchedToday);
    return { watchedToday, remaining, limitReached: remaining <= 0 };
  },

  buyHouseUpgrade: (_upgradeId: string) => {
    // House upgrades removed
  },

  takeLoan: (loanId: string) => {
    const state = get();
    const isEmployed = !!(state?.currentJobId || state?.career?.companyId);
    if (!isEmployed) return; // Must have a job
    if ((state?.loans ?? []).length >= 3) return;
    if ((state?.loans ?? []).some((l) => l?.loanId === loanId)) return;
    const template = (loansData ?? []).find((l) => l?.id === loanId);
    if (!template) return;
    // Net worth requirement: must have net worth >= loan amount
    const nw = getNetWorth(state);
    if (nw < (template?.amount ?? 0)) return;
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

    const prevStats = state?.statistics ?? { ...INITIAL_STATISTICS };
    const newStats: LifetimeStatistics = { ...prevStats, loansTaken: prevStats.loansTaken + 1 };

    const updates = {
      loans: [...(state?.loans ?? []), newLoan],
      cash: (state?.cash ?? 0) + (template?.amount ?? 0),
      statistics: newStats,
      periodLoansTaken: (state.periodLoansTaken ?? 0) + 1,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  payOffLoan: (loanId: string) => {
    const state = get();
    const loan = (state?.loans ?? []).find((l) => l?.loanId === loanId);
    if (!loan) return;
    if ((state?.cash ?? 0) < (loan?.remainingAmount ?? 0)) return;

    const prevStats = state?.statistics ?? { ...INITIAL_STATISTICS };
    const newStats: LifetimeStatistics = { ...prevStats, loansRepaid: prevStats.loansRepaid + 1 };

    const updates = {
      loans: (state?.loans ?? []).filter((l) => l?.loanId !== loanId),
      cash: (state?.cash ?? 0) - (loan?.remainingAmount ?? 0),
      statistics: newStats,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  watchAd: () => {
    get().grantAdReward();
  },

  convertGemsToCash: (gems: number) => {
    const state = get();
    if (gems <= 0 || gems > (state.profile.gems ?? 0)) return;
    const cashAmount = gems * GEM_CASH_RATE;
    const newProfile = { ...state.profile, gems: (state.profile.gems ?? 0) - gems };
    const newCash = (state.cash ?? 0) + cashAmount;
    set({ profile: newProfile, cash: newCash });
    saveProfile(newProfile);
    saveGame(extractGameState({ ...state, cash: newCash }), state.activeSlot);
  },
  setAdsRemoved: () => {
    const state = get();
    const profile = { ...state.profile, adsRemoved: true };
    set({ profile, showScheduledAd: false });
    saveProfile(profile);
  },

  // ---- Career v2 Actions ----
  applyForCareerJob: (companyId: string, careerPathId: string, level: number) => {
    const state = get();
    const company = (companiesData as any[]).find((c) => c?.id === companyId);
    const path = (careerPathsData as any[]).find((p) => p?.id === careerPathId);
    if (!company || !path) return;
    if (!(company.careerPaths ?? []).includes(careerPathId)) return;

    const position = (path.positions as any[]).find((p: any) => p?.level === level);
    if (!position) return;

    // Check required course completed (minimum level based on job level)
    const requiredBase = path.requiredCourseBase;
    // L1/L2 need basic; L3/L4 need advanced (L2); L5+ need expert (L3)
    const minCourseLevel = level >= 5 ? 3 : (level >= 3 ? 2 : 1);
    const hasCourse = (state?.completedCourses ?? []).some((c) => {
      const cd = (coursesData as any[]).find((x) => x?.id === c.courseId);
      return cd?.baseId === requiredBase && (cd?.level ?? 1) >= minCourseLevel;
    });
    if (!hasCourse) return;

    // Car requirement: L1/L2 need used_car+, L3+ need suv+
    const CAR_TIER: Record<string, number> = { none: 0, used_car: 1, sedan: 2, suv: 3, sports_car: 4, luxury_car: 5 };
    const currentCarTier = CAR_TIER[state?.currentCarId ?? 'none'] ?? 0;
    const minCarTier = level >= 3 ? 3 : 1;
    if (currentCarTier < minCarTier) return;

    // Housing requirement: L3/L4 need Studio Apartment+, L5+ need Small House+.
    const HOUSING_TIER: Record<string, number> = { cheap_apartment: 0, studio_apartment: 1, small_house: 2, family_house: 3, luxury_villa: 4, mansion: 5 };
    const minHousingTier = level >= 5 ? 2 : level >= 3 ? 1 : 0;
    if ((HOUSING_TIER[state.currentHousingId ?? 'cheap_apartment'] ?? 0) < minHousingTier) return;

    // Can't apply while studying full-time (level 1 course)
    if (state?.currentCourseId) {
      const currentCourse = (coursesData as any[]).find((c) => c?.id === state.currentCourseId);
      if ((currentCourse?.level ?? 1) === 1) return;
    }

    const globalWeek = ((state.year - 1) * 20) + state.week;
    const newCareer: CareerState = {
      companyId,
      careerPathId,
      positionLevel: level,
      performance: 50,
      weeksInPosition: 0,
      weeksAtCompany: 0,
      salaryBonus: 1.0,
      performanceRaisesAtLevel: 0,
      lastRaiseWeek: globalWeek,
      networkingScore: state.career?.networkingScore ?? 0,
      promotionProgress: 0,
      lastPerformanceEventWeek: 0,
    };

    // Close legacy job
    const newHistory = [...(state?.careerHistory ?? [])];
    if (state?.currentJobId) {
      const lastEntry = newHistory[newHistory.length - 1];
      if (lastEntry && lastEntry?.endWeek === null) lastEntry.endWeek = state.week;
    }
    newHistory.push({ jobId: `${companyId}_${careerPathId}_${level}`, title: position.title, startWeek: state.week, endWeek: null });

    const prevStats = state?.statistics ?? { ...INITIAL_STATISTICS };
    const updates = {
      career: newCareer,
      currentJobId: null,
      careerHistory: newHistory,
      statistics: { ...prevStats, jobsWorked: prevStats.jobsWorked + 1 },
      periodJobChanges: (state.periodJobChanges ?? 0) + 1,
      partTimeJob: false,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  quitCareerJob: () => {
    const state = get();
    const career = state.career;
    if (!career?.companyId) return;

    const newHistory = [...(state?.careerHistory ?? [])];
    const lastEntry = newHistory[newHistory.length - 1];
    if (lastEntry && lastEntry?.endWeek === null) lastEntry.endWeek = state.week;

    const updates = {
      career: { ...INITIAL_CAREER_STATE, networkingScore: career?.networkingScore ?? 0 },
      careerHistory: newHistory,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  // ---- Property Actions ----
  buyProperty: (typeId: string) => {
    const state = get();
    const prop = createProperty(typeId, state.week, state.year, state.inflationMultiplier ?? 1);
    if (!prop) return;
    if ((state.cash ?? 0) < prop.purchasePrice) return;
    const updates = {
      cash: (state.cash ?? 0) - prop.purchasePrice,
      properties: [...(state.properties ?? []), prop],
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  sellProperty: (propertyId: string) => {
    const state = get();
    const prop = (state.properties ?? []).find((p) => p?.id === propertyId);
    if (!prop) return;
    const salePrice = prop.currentValue ?? prop.purchasePrice;
    const updates = {
      cash: (state.cash ?? 0) + salePrice,
      properties: (state.properties ?? []).filter((p) => p?.id !== propertyId),
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  togglePropertyRental: (propertyId: string) => {
    const state = get();
    const properties = (state.properties ?? []).map((p) =>
      p?.id === propertyId ? { ...p, isRentedOut: !p.isRentedOut } : p
    );
    set({ properties });
    saveGame(extractGameState({ ...state, properties }), state.activeSlot);
  },

  renovatePropertyAction: (propertyId: string) => {
    const state = get();
    const prop = (state.properties ?? []).find((p) => p?.id === propertyId);
    if (!prop) return;
    const result = renovateProperty(prop, state.inflationMultiplier ?? 1);
    if (!result) return;
    if ((state.cash ?? 0) < result.cost) return;
    const properties = (state.properties ?? []).map((p) =>
      p?.id === propertyId ? result.property : p
    );
    const updates = { cash: (state.cash ?? 0) - result.cost, properties };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  // ---- Prestige Actions ----
  unlockPrestigeBonus: (bonusId: string) => {
    const state = get();
    const result = unlockPrestige(state.profile, bonusId);
    if (!result) return;
    set({ profile: result });
    saveProfile(result);
  },

  // ---- Business Actions ----
  foundBusiness: (typeId: string, customName: string | null) => {
    const state = get();
    const type = getBusinessType(typeId);
    if (!type) return;
    const cost = inflated(type.startupCost ?? 0, state?.inflationMultiplier ?? 1);
    if ((state?.cash ?? 0) < cost) return;
    const biz = createBusiness(typeId, customName, state.week, state.year, state?.inflationMultiplier ?? 1);
    if (!biz) return;
    const updates = {
      cash: (state?.cash ?? 0) - cost,
      businesses: [...(state?.businesses ?? []), biz],
      competitors: {
        ...(state?.competitors ?? {}),
        [biz.id]: createInitialCompetitors(biz, ((state.year - 1) * 20) + state.week),
      },
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  sellBusiness: (businessId: string) => {
    const state = get();
    const biz = (state?.businesses ?? []).find((b) => b?.id === businessId);
    if (!biz) return;
    const salePrice = biz.valuation ?? 0;
    const updates = {
      cash: (state?.cash ?? 0) + salePrice,
      businesses: (state?.businesses ?? []).filter((b) => b?.id !== businessId),
      competitors: Object.fromEntries(Object.entries(state.competitors ?? {}).filter(([id]) => id !== businessId)),
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  openCandidatePool: (businessId: string, roleId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = { ...businesses[idx] };
    const type = getBusinessType(biz.typeId);
    if ((biz.employees?.length ?? 0) >= (type?.maxEmployees ?? 1)) return;

    // D&D-style recruit charges: 3 free, then paid €10k charges (max 5 stored, +1 per 5 weeks)
    const RECRUIT_COST = 10000;
    let free = biz.freeRecruits ?? 3;
    let charges = biz.recruitCharges ?? 0;
    if (free > 0) {
      // The free attempt is consumed only after a candidate is hired.
    } else if (charges > 0) {
      if ((biz.balance ?? 0) < RECRUIT_COST) return;
    } else {
      return; // no charges available
    }
    biz.freeRecruits = free;
    biz.recruitCharges = charges;

    const existingNames = (biz.employees ?? []).map((e) => e.name);
    biz.pendingCandidates = generateCandidates(roleId, existingNames, state?.inflationMultiplier ?? 1);
    biz.pendingCandidateRoleId = roleId;
    businesses[idx] = biz;
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  hireCandidate: (businessId: string, candidateId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = { ...businesses[idx] };
    const candidate = (biz.pendingCandidates ?? []).find((c) => c.id === candidateId);
    if (!candidate) return;
    const type = getBusinessType(biz.typeId);
    if ((biz.employees?.length ?? 0) >= (type?.maxEmployees ?? 1)) return;
    const emp = candidateToEmployee(candidate);
    if ((biz.freeRecruits ?? 3) > 0) {
      biz.freeRecruits = (biz.freeRecruits ?? 3) - 1;
    } else {
      const recruitCost = 10000;
      if ((biz.recruitCharges ?? 0) <= 0 || (biz.balance ?? 0) < recruitCost) return;
      biz.recruitCharges = (biz.recruitCharges ?? 0) - 1;
      biz.balance = (biz.balance ?? 0) - recruitCost;
    }
    biz.employees = [...(biz.employees ?? []), emp];
    biz.pendingCandidates = null;
    biz.pendingCandidateRoleId = null;
    // Timeline entry for notable hires
    if (emp.tier === 'epic' || emp.tier === 'legendary') {
      biz.timeline = [
        ...(biz.timeline ?? []),
        { week: state.week, year: state.year, title: `${emp.tier === 'legendary' ? '👑' : '💎'} Hired ${emp.name} (${emp.tier})`, icon: emp.tier === 'legendary' ? '👑' : '💎', kind: 'hire' as const },
      ].slice(-50);
    }
    businesses[idx] = biz;
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  cancelCandidatePool: (businessId: string) => {
    const state = get();
    const businesses = (state?.businesses ?? []).map((b) =>
      b?.id === businessId ? { ...b, pendingCandidates: null, pendingCandidateRoleId: null } : b
    );
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  applyMoraleActionToBusiness: (businessId: string, actionId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = businesses[idx];
    const result = applyMoraleAction(biz, actionId);
    if (!result.updatedBusiness) return;
    // Deduct only from the business account.
    let updatedBiz = result.updatedBusiness;
    if ((updatedBiz.balance ?? 0) < result.cost) return;
    updatedBiz = { ...updatedBiz, balance: updatedBiz.balance - result.cost };
    businesses[idx] = updatedBiz;
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  startEmployeeTraining: (businessId: string, employeeId: string, trainingId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = businesses[idx];
    const result = startTraining(biz, employeeId, trainingId, state.inflationMultiplier);
    if (!result.updatedBusiness) return;
    let updatedBiz = result.updatedBusiness;
    if ((updatedBiz.balance ?? 0) < result.cost) return;
    updatedBiz = { ...updatedBiz, balance: updatedBiz.balance - result.cost };
    businesses[idx] = updatedBiz;
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  startBusinessProject: (businessId: string, projectId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = businesses[idx];
    const result = startProject(biz, projectId, state.inflationMultiplier);
    if (!result.updatedBusiness) return;
    let updatedBiz = result.updatedBusiness;
    if ((updatedBiz.balance ?? 0) < result.cost) return;
    updatedBiz = { ...updatedBiz, balance: updatedBiz.balance - result.cost };
    businesses[idx] = updatedBiz;
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  resolveBusinessRetention: (businessId: string, choice) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = businesses[idx];
    const result = resolveRetention(biz, choice);
    let newCash = state.cash;
    let updatedBiz = result.updatedBusiness;
    if (result.costDelta > 0) {
      if ((updatedBiz.balance ?? 0) >= result.costDelta) {
        updatedBiz = { ...updatedBiz, balance: updatedBiz.balance - result.costDelta };
      } else if (newCash >= result.costDelta) {
        newCash -= result.costDelta;
      }
    }
    businesses[idx] = updatedBiz;
    set({ businesses, cash: newCash });
    saveGame(extractGameState({ ...state, businesses, cash: newCash }), state.activeSlot);
  },

  fireEmployee: (businessId: string, employeeId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = { ...businesses[idx] };
    biz.employees = (biz.employees ?? []).filter((e) => e?.id !== employeeId);
    businesses[idx] = biz;
    const updates = { businesses };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  setBusinessPricing: (businessId: string, strategy: OwnedBusiness['pricingStrategy']) => {
    const state = get();
    const businesses = (state?.businesses ?? []).map((b) =>
      b?.id === businessId ? { ...b, pricingStrategy: strategy } : b
    );
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  setBusinessAdvertising: (businessId: string, level: OwnedBusiness['advertisingLevel']) => {
    const state = get();
    const businesses = (state?.businesses ?? []).map((b) =>
      b?.id === businessId ? { ...b, advertisingLevel: level } : b
    );
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  buyBusinessUpgrade: (businessId: string, upgradeId: string) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = { ...businesses[idx] };
    if ((biz.purchasedUpgrades ?? []).includes(upgradeId)) return;
    // Only 1 upgrade at a time
    if (biz.activeUpgrade) return;
    const upgrade = getUpgrade(upgradeId);
    if (!upgrade) return;
    const cost = inflated(upgrade.cost ?? 0, state?.inflationMultiplier ?? 1);
    // Pay only from business balance — cannot go negative
    const bizBal = biz.balance ?? 0;
    if (bizBal < cost) return;
    biz.balance = bizBal - cost;
    // Start upgrade timer (16-30 weeks)
    const weeks = 16 + Math.floor(Math.random() * 15);
    biz.activeUpgrade = { upgradeId, weeksRemaining: weeks };
    businesses[idx] = biz;
    const updates = { businesses };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  takeBusinessLoan: (businessId: string, amount: number, interestRate: number, durationWeeks: number) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = { ...businesses[idx] };
    if ((biz.businessLoans?.length ?? 0) >= 3) return;
    const totalRepayment = amount * (1 + interestRate);
    const weeklyPayment = Math.ceil(totalRepayment / durationWeeks);
    const loan: BusinessLoan = {
      id: `bloan_${Date.now()}`,
      amount,
      remainingAmount: totalRepayment,
      weeklyPayment,
      weeksRemaining: durationWeeks,
      interestRate,
    };
    biz.businessLoans = [...(biz.businessLoans ?? []), loan];
    biz.balance = (biz.balance ?? 0) + amount;
    businesses[idx] = biz;
    const updates = { businesses };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  injectCashIntoBusiness: (businessId: string, amount: number) => {
    const state = get();
    if (amount <= 0 || (state?.cash ?? 0) < amount) return;
    const businesses = (state?.businesses ?? []).map((b) =>
      b?.id === businessId ? { ...b, balance: (b?.balance ?? 0) + amount } : b
    );
    const updates = { cash: (state?.cash ?? 0) - amount, businesses };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  withdrawFromBusiness: (businessId: string, amount: number) => {
    const state = get();
    const biz = (state?.businesses ?? []).find((b) => b?.id === businessId);
    if (!biz || amount <= 0 || (biz?.balance ?? 0) < amount) return;
    const businesses = (state?.businesses ?? []).map((b) =>
      b?.id === businessId ? { ...b, balance: (b?.balance ?? 0) - amount } : b
    );
    const updates = { cash: (state?.cash ?? 0) + amount, businesses };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
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
    age: state?.age ?? 20,
    cash: state?.cash ?? 10000,
    inflationMultiplier: state?.inflationMultiplier ?? 1.0,
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
    statistics: state?.statistics ?? { ...INITIAL_STATISTICS },
    currentHeadline: state?.currentHeadline ?? '',
    initialized: true,
    tempHappinessEffects: state?.tempHappinessEffects ?? [],
    pendingInvestments: state?.pendingInvestments ?? [],
    recentEventIds: state?.recentEventIds ?? [],
    businesses: state?.businesses ?? [],
    skills: state?.skills ?? {},
    knowledge: state?.knowledge ?? {},
    career: state?.career ?? { ...INITIAL_CAREER_STATE },
    properties: state?.properties ?? [],
    competitors: state?.competitors ?? {},
    activeMarketSentiment: state?.activeMarketSentiment ?? null,
    activeMarketEvents: state?.activeMarketEvents ?? [],
    totalRealizedProfitLoss: state?.totalRealizedProfitLoss ?? 0,
    newsHistory: (state as any)?.newsHistory ?? [],
    partTimeJob: (state as any)?.partTimeJob ?? false,
    adWatchedToday: (state as any)?.adWatchedToday ?? 0,
    adLastWatchDate: (state as any)?.adLastWatchDate ?? '',
  };
}

export default useGameStore;
