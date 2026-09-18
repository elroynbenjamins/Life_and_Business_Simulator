import { create } from 'zustand';
import { GameState, INITIAL_GAME_STATE, INITIAL_STATISTICS, INITIAL_PROFILE, INITIAL_CAREER_STATE, INITIAL_RELATIONSHIP_STATE, INITIAL_LIFECYCLE_STATE, WeekSummary, ActiveLoan, LifetimeStatistics, PlayerProfile, SaveSlotMeta, PeriodReport, TriggeredEvent, PendingInvestment, TempHappinessEffect, OwnedBusiness, OwnedProperty, BusinessEmployee, BusinessLoan, CareerState, BankDeposit, EducationCareerReminder, DatingPreference, RelationshipConnection, FamilyPlan, MarriageAgreement, RelationshipFinancialObligation, SharedGoalType, EstatePlanType, EstateStructureType, SuccessionAssetStrategy } from '../types/game';
import { initializeStocks, mergeStocks } from '../engine/stockEngine';
import { weeklyTick } from '../engine/weeklyTick';
import { getNetWorth, getPortfolioValue, getUnrealizedProfitLoss } from '../engine/financeEngine';
import { inflated } from '../engine/economyEngine';
import { createBusiness, generateCandidates, candidateToEmployee, getBusinessType, getUpgrade, calculateValuation, getTotalBusinessValue, applyMoraleAction, startTraining, startProject, resolveRetention, MIN_EMPLOYEES_REQUIRED, canStartBusinessExpansion, getBusinessLocationTemplate, getScaledLocationCosts } from '../engine/businessEngine';
import { createProperty, renovateProperty, getTotalPropertyValue } from '../engine/propertyEngine';
import { ensureAuctions, getInspectionCost, inspectAuction, leaveAuction, placeAuctionBid } from '../engine/auctionEngine';
import { unlockPrestige, getPrestigeEffects } from '../engine/prestigeEngine';
import { getSuccessionPreview } from '../engine/lifecycleEngine';
import { createInitialFamilyTree, syncFamilyTree, transitionFamilyTreeToChild } from '../engine/familyTreeEngine';
import { getCareerSalary } from '../engine/careerEngine';
import { applyEducationRewards } from '../engine/skillEngine';
import { createInitialCompetitors, migrateBusinessCompetitors } from '../engine/competitorEngine';
import { generateRelationshipCandidates, getDateConnectionGain, getDateCost, getChildPersonality, getFamilyFormationProfile, getNormalizedDatingAgeBounds, getProposalCost, getWeddingCost, isNormalizedAgeMatch, revealNextTrait } from '../engine/relationshipEngine';
import { saveGame, loadGame, clearGame, getActiveSlot, setActiveSlot, loadAllSlotMeta, loadProfile, saveProfile } from '../utils/storage';
import coursesData from '../data/courses.json';
import jobsData from '../data/jobs.json';
import housingData from '../data/housing.json';
import carsData from '../data/cars.json';
import loansData from '../data/loans.json';
import achievementsData from '../data/achievements.json';
import relationshipNamesData from '../data/relationship_names.json';
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
  showTutorial: boolean;
  slotPickerMode: 'load' | 'new';
  showNegativeCashModal: boolean;
  showPeriodReport: boolean;
  showScheduledAd: boolean;
  showEducationCareerReminder: boolean;
  showRelationshipEventModal: boolean;
  relationshipFeedback: { title: string; message: string; positive: boolean } | null;
  educationCareerReminder: EducationCareerReminder | null;
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
  startNewGame: (name?: string, relationshipModeEnabled?: boolean) => Promise<void>;
  deleteSlot: (slot: number) => Promise<void>;
  setPlayerName: (name: string) => void;
  advanceWeek: () => void;
  dismissSummary: () => void;
  dismissNegativeCash: () => void;
  dismissPeriodReport: () => void;
  dismissScheduledAd: () => void;
  dismissEducationCareerReminder: () => void;
  openSlotPicker: () => void;
  closeSlotPicker: () => void;
  continueGame: () => void;
  openMainMenu: () => void;
  beginNewGame: () => void;
  openTutorial: () => void;
  dismissTutorial: () => void;
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
  getDailyLoginStatus: () => { available: boolean; streak: number; reward: number };
  claimDailyLoginReward: () => number;
  buyHouseUpgrade: (upgradeId: string) => void;

  takeLoan: (loanId: string) => void;
  payOffLoan: (loanId: string) => void;
  openBankDeposit: (amount: number, durationWeeks: 20 | 40 | 60) => void;

  // Personal life
  setRelationshipModeEnabled: (enabled: boolean) => void;
  setDatingPreferences: (preference: DatingPreference, minAge: number, maxAge: number) => void;
  inviteOnDate: (candidateId: string, kind: 'coffee' | 'dinner' | 'activity') => void;
  planDate: (connectionId: string, kind: 'coffee' | 'dinner' | 'activity') => void;
  askBecomePartners: (connectionId: string) => void;
  moveInWithPartner: (split: 'equal' | 'proportional' | 'player_pays_most') => void;
  spendTimeWithPartner: () => void;
  givePartnerGift: (tier: 'small' | 'nice' | 'luxury') => void;
  discussFinancesWithPartner: () => void;
  proposeToPartner: (ring: 'simple' | 'classic' | 'luxury') => void;
  marryPartner: (wedding: 'courthouse' | 'standard' | 'luxury', agreement: MarriageAgreement) => void;
  setFamilyPlan: (plan: Exclude<FamilyPlan, 'not_discussed'>) => void;
  fundChildEducation: (childId: string, amount: number) => void;
  spendTimeWithChild: (childId: string) => void;
  endDatingConnection: (connectionId: string) => void;
  endPartnership: () => void;
  divorcePartner: () => void;
  relationshipCounseling: () => void;
  setSharedRelationshipGoal: (type: SharedGoalType) => void;
  cancelSharedRelationshipGoal: () => void;
  setEstatePlan: (planType: EstatePlanType, structure: EstateStructureType, successorId: string | null) => void;
  continueAsChild: (childId: string, financeTaxWithLoan: boolean, assetStrategy?: SuccessionAssetStrategy) => void;
  dismissRelationshipEventModal: () => void;
  handleRelationshipEventChoice: (choiceIndex: number) => void;
  dismissRelationshipFeedback: () => void;

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
  placePropertyAuctionBid: (auctionId: string, amount: number) => void;
  inspectPropertyAuction: (auctionId: string) => void;
  leavePropertyAuction: (auctionId: string) => void;

  // Prestige
  unlockPrestigeBonus: (bonusId: string) => void;

  // Business
  foundBusiness: (typeId: string, customName: string | null) => void;
  sellBusiness: (businessId: string) => void;
  designateFamilyBusiness: (businessId: string) => void;
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
  startBusinessExpansion: (businessId: string, templateId: string) => void;
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
  showTutorial: false,
  slotPickerMode: 'load',
  showNegativeCashModal: false,
  showPeriodReport: false,
  showScheduledAd: false,
  showEducationCareerReminder: false,
  showRelationshipEventModal: false,
  relationshipFeedback: null,
  educationCareerReminder: null,
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
        pendingCarDelivery: saved.pendingCarDelivery ?? null,
        foodLevel: saved.foodLevel ?? 'basic',
        loans: saved.loans ?? [],
        bankDeposits: saved.bankDeposits ?? [],
        happiness: saved.happiness ?? 30,
        totalWeeksWorked: saved.totalWeeksWorked ?? 0,
        earningsSinceLastTax: saved.earningsSinceLastTax ?? 0,
        lastTaxWeek: saved.lastTaxWeek ?? 0,
        totalTaxPaid: saved.totalTaxPaid ?? 0,
        unlockedAchievements: saved.unlockedAchievements ?? [],
        inflationMultiplier: saved.inflationMultiplier ?? 1.0,
        statistics: { ...INITIAL_STATISTICS, ...(saved.statistics ?? {}) },
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
        activeAuctions: saved.activeAuctions ?? [],
        competitors: saved.competitors ?? {},
        activeMarketSentiment: saved.activeMarketSentiment ?? null,
        activeMarketEvents: saved.activeMarketEvents ?? [],
        totalRealizedProfitLoss: saved.totalRealizedProfitLoss ?? 0,
        relationshipModeEnabled: saved.relationshipModeEnabled ?? false,
        relationshipState: {
          ...INITIAL_RELATIONSHIP_STATE,
          ...(saved.relationshipState ?? {}),
          weeklyCandidates: saved.relationshipState?.weeklyCandidates ?? [],
          activeConnections: saved.relationshipState?.activeConnections ?? [],
          formerPartners: saved.relationshipState?.formerPartners ?? [],
          financialObligations: saved.relationshipState?.financialObligations ?? [],
          timeline: saved.relationshipState?.timeline ?? [],
          children: (saved.relationshipState?.children ?? []).map((child) => ({
            ...child,
            parentRelationship: child.parentRelationship ?? 75,
            personality: child.personality ?? getChildPersonality(child.id),
            descendants: child.descendants ?? [],
            childrenCount: child.childrenCount ?? child.descendants?.length ?? 0,
            debt: child.debt ?? 0,
            failureCount: child.failureCount ?? 0,
            businessValue: child.businessValue ?? 0,
          })),
          recentRelationshipEventIds: saved.relationshipState?.recentRelationshipEventIds ?? [],
          pendingEvent: saved.relationshipState?.pendingEvent ?? null,
          financialSnapshot: saved.relationshipState?.financialSnapshot ?? null,
          sharedGoal: saved.relationshipState?.sharedGoal ?? null,
          lastStabilityWarningWeek: saved.relationshipState?.lastStabilityWarningWeek ?? 0,
          estatePlan: {
            ...INITIAL_RELATIONSHIP_STATE.estatePlan,
            ...(saved.relationshipState?.estatePlan ?? {}),
          },
          estateSettlement: saved.relationshipState?.estateSettlement ?? null,
        },
        lifecycle: { ...INITIAL_LIFECYCLE_STATE, ...(saved.lifecycle ?? {}) },
        lastMacroCrashWeek: saved.lastMacroCrashWeek ?? 0,
        generation: saved.generation ?? 1,
        familyLegacy: saved.familyLegacy ?? [],
        familyTree: saved.familyTree ?? createInitialFamilyTree(saved.playerName ?? 'Player', saved.age ?? 20, saved.year ?? 1, saved.generation ?? 1),
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
      const loadGlobalWeek = ((merged.year - 1) * 20) + merged.week;
      merged.competitors = Object.fromEntries(merged.businesses.map((business) => [business.id, migrateBusinessCompetitors(business, merged.competitors[business.id] ?? [], loadGlobalWeek)]));
      merged.activeAuctions = ensureAuctions(merged.activeAuctions, ((merged.year - 1) * 20) + merged.week, merged.inflationMultiplier, getNetWorth(merged));
      merged.familyTree = syncFamilyTree(merged);
      // Migrate legacy profile
      if (profile && typeof (profile as any).prestigePoints === 'undefined') {
        (profile as any).prestigePoints = profile.totalXp ?? 0;
        (profile as any).unlockedPrestige = (profile as any).unlockedPrestige ?? [];
      }
      set({ ...merged, isLoading: false, showNameModal: false, showMainMenu: true, showRelationshipEventModal: false, relationshipFeedback: null, profile, slotMeta, activeSlot });
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
        pendingCarDelivery: saved.pendingCarDelivery ?? null,
        foodLevel: saved.foodLevel ?? 'basic',
        loans: saved.loans ?? [],
        bankDeposits: saved.bankDeposits ?? [],
        happiness: saved.happiness ?? 30,
        totalWeeksWorked: saved.totalWeeksWorked ?? 0,
        earningsSinceLastTax: saved.earningsSinceLastTax ?? 0,
        lastTaxWeek: saved.lastTaxWeek ?? 0,
        totalTaxPaid: saved.totalTaxPaid ?? 0,
        unlockedAchievements: saved.unlockedAchievements ?? [],
        inflationMultiplier: saved.inflationMultiplier ?? 1.0,
        statistics: { ...INITIAL_STATISTICS, ...(saved.statistics ?? {}) },
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
        activeAuctions: saved.activeAuctions ?? [],
        competitors: saved.competitors ?? {},
        activeMarketSentiment: saved.activeMarketSentiment ?? null,
        activeMarketEvents: saved.activeMarketEvents ?? [],
        totalRealizedProfitLoss: saved.totalRealizedProfitLoss ?? 0,
        relationshipModeEnabled: saved.relationshipModeEnabled ?? false,
        relationshipState: {
          ...INITIAL_RELATIONSHIP_STATE,
          ...(saved.relationshipState ?? {}),
          weeklyCandidates: saved.relationshipState?.weeklyCandidates ?? [],
          activeConnections: saved.relationshipState?.activeConnections ?? [],
          formerPartners: saved.relationshipState?.formerPartners ?? [],
          financialObligations: saved.relationshipState?.financialObligations ?? [],
          timeline: saved.relationshipState?.timeline ?? [],
          children: (saved.relationshipState?.children ?? []).map((child) => ({
            ...child,
            parentRelationship: child.parentRelationship ?? 75,
            personality: child.personality ?? getChildPersonality(child.id),
            descendants: child.descendants ?? [],
            childrenCount: child.childrenCount ?? child.descendants?.length ?? 0,
            debt: child.debt ?? 0,
            failureCount: child.failureCount ?? 0,
            businessValue: child.businessValue ?? 0,
          })),
          recentRelationshipEventIds: saved.relationshipState?.recentRelationshipEventIds ?? [],
          pendingEvent: saved.relationshipState?.pendingEvent ?? null,
          financialSnapshot: saved.relationshipState?.financialSnapshot ?? null,
          sharedGoal: saved.relationshipState?.sharedGoal ?? null,
          lastStabilityWarningWeek: saved.relationshipState?.lastStabilityWarningWeek ?? 0,
          estatePlan: {
            ...INITIAL_RELATIONSHIP_STATE.estatePlan,
            ...(saved.relationshipState?.estatePlan ?? {}),
          },
          estateSettlement: saved.relationshipState?.estateSettlement ?? null,
        },
        lifecycle: { ...INITIAL_LIFECYCLE_STATE, ...(saved.lifecycle ?? {}) },
        lastMacroCrashWeek: saved.lastMacroCrashWeek ?? 0,
        generation: saved.generation ?? 1,
        familyLegacy: saved.familyLegacy ?? [],
        familyTree: saved.familyTree ?? createInitialFamilyTree(saved.playerName ?? 'Player', saved.age ?? 20, saved.year ?? 1, saved.generation ?? 1),
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
      const slotGlobalWeek = ((merged.year - 1) * 20) + merged.week;
      merged.competitors = Object.fromEntries(merged.businesses.map((business) => [business.id, migrateBusinessCompetitors(business, merged.competitors[business.id] ?? [], slotGlobalWeek)]));
      merged.activeAuctions = ensureAuctions(merged.activeAuctions, ((merged.year - 1) * 20) + merged.week, merged.inflationMultiplier, getNetWorth(merged));
      merged.familyTree = syncFamilyTree(merged);
      const slotMeta = await loadAllSlotMeta();
      set({ ...merged, isLoading: false, showNameModal: false, showSlotPicker: false, showMainMenu: false, showRelationshipEventModal: false, relationshipFeedback: null, activeSlot: slot, slotMeta, lastSummary: null, showSummary: false });
    } else {
      // Empty slot — start new game here
      set({ activeSlot: slot, showSlotPicker: false, showMainMenu: false, showNameModal: true, slotPickerMode: 'load' });
    }
  },

  startNewGame: async (name?: string, relationshipModeEnabled = false) => {
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
      relationshipModeEnabled,
      familyTree: createInitialFamilyTree(name?.trim?.() || 'Player', 20, 1, 1),
      activeAuctions: ensureAuctions([], 1, 1, startingCash),
    };
    await saveGame(newState, activeSlot);
    const slotMeta = await loadAllSlotMeta();
    set({ ...newState, isLoading: false, showNameModal: false, showSlotPicker: false, showMainMenu: false, showRelationshipEventModal: false, relationshipFeedback: null, showTutorial: true, slotPickerMode: 'load', lastSummary: null, showSummary: false, slotMeta });
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

    if (gameState.lifecycle?.isDead) return;

    // Check negative cash before advancing
    if ((gameState.cash ?? 0) < 0) {
      set({ showNegativeCashModal: true });
      return;
    }

    const { newState, summary } = weeklyTick(gameState, getPrestigeEffects(state.profile));

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
    const totalExp = summary.rentPaid + summary.utilityCost + summary.foodCost + summary.carCost + summary.courseCost + summary.loanPayments + (summary.relationshipHouseholdCost ?? 0) + (summary.familyCost ?? 0) + (summary.relationshipObligationCost ?? 0);
    const newPeriodIncome = (state.periodIncome ?? 0) + summary.salaryEarned + (summary.partTimeIncome ?? 0) + (summary.partnerContribution ?? 0);
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
      educationCareerReminder: summary.educationCareerReminder,
      showEducationCareerReminder: false,
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
    } else if (summary?.relationshipEventTitle && state.relationshipModeEnabled && state.relationshipState?.pendingEvent) {
      set({ showSummary: false, showRelationshipEventModal: true, showScheduledAd: scheduledAd });
    } else if (state.periodReport && !state.showPeriodReport) {
      set({ showSummary: false, showPeriodReport: true, showScheduledAd: scheduledAd });
    } else {
      set({ showSummary: false, showScheduledAd: scheduledAd, showEducationCareerReminder: !scheduledAd && !!state.educationCareerReminder });
    }
  },
  dismissNegativeCash: () => set({ showNegativeCashModal: false }),
  dismissPeriodReport: () => {
    const state = get();
    set({ showPeriodReport: false, periodReport: null, showEducationCareerReminder: !state.showScheduledAd && !!state.educationCareerReminder });
  },
  dismissScheduledAd: () => {
    const state = get();
    set({ showScheduledAd: false, showEducationCareerReminder: !!state.educationCareerReminder });
  },
  dismissEducationCareerReminder: () => set({ showEducationCareerReminder: false, educationCareerReminder: null }),
  dismissEventModal: () => {
    const state = get();
    // After business event, show any pending personal-life decision next.
    if (state.lastSummary?.relationshipEventTitle && state.relationshipModeEnabled && state.relationshipState?.pendingEvent) {
      set({ showEventModal: false, pendingEvent: null, showRelationshipEventModal: true });
    } else if (state.periodReport && !state.showPeriodReport) {
      set({ showEventModal: false, pendingEvent: null, showPeriodReport: true });
    } else {
      set({ showEventModal: false, pendingEvent: null, showEducationCareerReminder: !state.showScheduledAd && !!state.educationCareerReminder });
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
    if (state.lastSummary?.relationshipEventTitle && state.relationshipModeEnabled && state.relationshipState?.pendingEvent) {
      set({ showEventModal: false, pendingEvent: null, showRelationshipEventModal: true });
    } else if (state.periodReport && !state.showPeriodReport) {
      set({ showEventModal: false, pendingEvent: null, showPeriodReport: true });
    } else {
      set({ showEventModal: false, pendingEvent: null });
    }
  },
  openSlotPicker: () => set({ showSlotPicker: true, slotPickerMode: 'load' }),
  closeSlotPicker: () => set({ showSlotPicker: false }),
  continueGame: () => set({ showMainMenu: false }),
  openMainMenu: () => set({ showMainMenu: true }),
  openTutorial: () => set({ showTutorial: true }),
  dismissTutorial: () => set({ showTutorial: false }),
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
    const newStats: LifetimeStatistics = {
      ...INITIAL_STATISTICS,
      ...prevStats,
      stocksPurchased: prevStats.stocksPurchased + qty,
      highestStockPortfolioValue: Math.max(
        prevStats.highestStockPortfolioValue ?? 0,
        getPortfolioValue(state.stocks ?? [], newHoldings),
      ),
    };

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
    const profitPercent = costBasis > 0 ? (realizedPL / costBasis) * 100 : 0;

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
        highestSoldStockProfitPercent: Math.max(prevStats.highestSoldStockProfitPercent ?? 0, profitPercent),
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
    if (state.pendingCarDelivery) return;
    const car = (carsData ?? []).find((c) => c?.id === carId);
    if (!car) return;
    const oldCar = (carsData ?? []).find((c) => c?.id === state?.currentCarId);
    const tradeIn = Math.round(((oldCar?.purchaseCost ?? 0) * 0.4));
    const inflatedCost = inflated(car?.purchaseCost ?? 0, state?.inflationMultiplier ?? 1);
    const cost = inflatedCost - tradeIn;
    if ((state?.cash ?? 0) < cost) return;
    const updates = carId === 'none'
      ? { currentCarId: carId, pendingCarDelivery: null, cash: (state?.cash ?? 0) - cost }
      : { pendingCarDelivery: { carId, weeksRemaining: 1 }, cash: (state?.cash ?? 0) - cost };
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

  getDailyLoginStatus: () => {
    const profile = get().profile;
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const available = profile.lastLoginClaimDate !== localDate;
    if (!available) return { available: false, streak: profile.loginStreak ?? 0, reward: 0 };
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const streak = profile.lastLoginClaimDate === yesterdayDate ? (profile.loginStreak ?? 0) + 1 : 1;
    return { available: true, streak, reward: Math.min(50, 10 + (streak - 1) * 5) };
  },

  claimDailyLoginReward: () => {
    const status = get().getDailyLoginStatus();
    if (!status.available) return 0;
    const state = get();
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const profile = {
      ...state.profile,
      gems: (state.profile.gems ?? 0) + status.reward,
      lastLoginClaimDate: localDate,
      loginStreak: status.streak,
    };
    set({ profile });
    saveProfile(profile);
    return status.reward;
  },

  buyHouseUpgrade: (_upgradeId: string) => {
    // House upgrades removed
  },


  setRelationshipModeEnabled: (enabled) => {
    const state = get();
    const relationshipState = state.relationshipState ?? { ...INITIAL_RELATIONSHIP_STATE };

    if (!enabled) {
      const hasCommitments =
        !!relationshipState.partnerId ||
        (relationshipState.activeConnections?.length ?? 0) > 0 ||
        (relationshipState.children?.length ?? 0) > 0 ||
        (relationshipState.financialObligations?.length ?? 0) > 0 ||
        (relationshipState.familyExpansionWeeksRemaining ?? 0) > 0;
      if (hasCommitments) {
        set({
          relationshipFeedback: {
            title: 'Personal Life Still Active',
            message: 'End active dating/relationships and finish family or legal obligations before disabling this mode.',
            positive: false,
          },
        });
        return;
      }
    }

    const nextRelationshipState = enabled && !relationshipState.preferencesSet
      ? { ...relationshipState, weeklyCandidates: [] }
      : relationshipState;
    const updates = { relationshipModeEnabled: enabled, relationshipState: nextRelationshipState, ...(enabled ? {} : { showRelationshipEventModal: false }) };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  setDatingPreferences: (preference, minAge, maxAge) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const bounds = getNormalizedDatingAgeBounds(state.age ?? 20);
    const safeMin = Math.max(bounds.min, Math.min(minAge, maxAge));
    const safeMax = Math.min(bounds.max, Math.max(minAge, maxAge));
    const normalizedMin = safeMin <= safeMax ? safeMin : bounds.min;
    const normalizedMax = safeMin <= safeMax ? safeMax : bounds.max;
    const nextRelationship = {
      ...state.relationshipState,
      preferencesSet: true,
      preference,
      minAge: normalizedMin,
      maxAge: normalizedMax,
      minAgeOffset: normalizedMin - (state.age ?? 20),
      maxAgeOffset: normalizedMax - (state.age ?? 20),
    };
    const baseState = { ...extractGameState(state), relationshipState: nextRelationship };
    nextRelationship.weeklyCandidates = generateRelationshipCandidates(baseState, 3);
    nextRelationship.candidateRefreshWeek = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    set({ relationshipState: nextRelationship });
    saveGame(extractGameState({ ...state, relationshipState: nextRelationship }), state.activeSlot);
  },

  inviteOnDate: (candidateId, kind) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    if ((state.relationshipState?.activeConnections?.length ?? 0) >= 3) return;
    const candidate = (state.relationshipState?.weeklyCandidates ?? []).find((item) => item.id === candidateId);
    if (!candidate || !isNormalizedAgeMatch(state.age ?? 20, candidate.age ?? 18)) return;
    const cost = getDateCost(kind, state.inflationMultiplier ?? 1);
    if ((state.cash ?? 0) < cost) return;

    const baseConnection: RelationshipConnection = {
      ...candidate,
      stage: 'dating',
      connection: 20,
      relationship: 0,
      dates: 1,
      weeksKnown: 0,
    };
    const gain = getDateConnectionGain(baseConnection, kind);
    const connection = revealNextTrait({ ...baseConnection, connection: Math.min(100, 20 + gain) });
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: [...(state.relationshipState?.activeConnections ?? []), connection],
      weeklyCandidates: (state.relationshipState?.weeklyCandidates ?? []).filter((item) => item.id !== candidateId),
      personalActionWeek: gw,
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `First date with ${candidate.name}` }],
    };
    const updates = { cash: (state.cash ?? 0) - cost, relationshipState };
    set({ ...updates, relationshipFeedback: { title: 'First Date', message: `The date with ${candidate.name} increased your connection by ${gain} points.`, positive: true } });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  planDate: (connectionId, kind) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const existing = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === connectionId);
    if (!existing) return;
    const cost = getDateCost(kind, state.inflationMultiplier ?? 1);
    if ((state.cash ?? 0) < cost) return;
    const gain = getDateConnectionGain(existing, kind);

    const connections = (state.relationshipState?.activeConnections ?? []).map((item) => {
      if (item.id !== connectionId) return item;
      if (item.stage === 'dating') {
        return revealNextTrait({
          ...item,
          connection: Math.min(100, (item.connection ?? 0) + gain),
          dates: (item.dates ?? 0) + 1,
        });
      }
      return {
        ...item,
        relationship: Math.min(100, (item.relationship ?? 70) + Math.max(3, Math.round(gain / 2))),
        dates: (item.dates ?? 0) + 1,
      };
    });
    const relationshipState = { ...state.relationshipState, activeConnections: connections, personalActionWeek: gw };
    const updates = { cash: (state.cash ?? 0) - cost, relationshipState };
    set({ ...updates, relationshipFeedback: { title: 'Date Complete', message: `You spent time together and the relationship improved.`, positive: true } });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  askBecomePartners: (connectionId) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const connection = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === connectionId);
    if (!connection || connection.stage !== 'dating' || connection.connection < 60 || connection.dates < 3 || !isNormalizedAgeMatch(state.age ?? 20, connection.age ?? 18)) return;

    const acceptanceChance = Math.min(0.92, 0.62 + Math.max(0, connection.connection - 60) / 100);
    const accepted = Math.random() < acceptanceChance;
    let connections: RelationshipConnection[];
    let partnerId = state.relationshipState.partnerId;
    let timeline = state.relationshipState.timeline ?? [];
    if (accepted) {
      const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
      const partner = { ...connection, stage: 'partner' as const, relationship: Math.max(70, connection.connection), becamePartnerWeek: gw };
      connections = [partner];
      partnerId = partner.id;
      timeline = [...timeline, { week: state.week, year: state.year, title: `Became partners with ${partner.name}` }];
    } else {
      connections = (state.relationshipState?.activeConnections ?? []).map((item) =>
        item.id === connectionId ? { ...item, connection: Math.max(0, item.connection - 8) } : item
      );
    }
    const relationshipState = { ...state.relationshipState, activeConnections: connections, partnerId, timeline };
    set({ relationshipState, relationshipFeedback: accepted
      ? { title: 'New Relationship', message: `${connection.name} said yes. You are now officially partners.`, positive: true }
      : { title: 'Not Yet', message: `${connection.name} is not ready to become exclusive yet.`, positive: false } });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  moveInWithPartner: (split) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || !['partner', 'engaged'].includes(partner.stage) || partner.relationship < 75 || partner.weeksKnown < 8) return;
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const connections = (state.relationshipState?.activeConnections ?? []).map((item) =>
      item.id === partner.id
        ? {
            ...item,
            stage: item.stage === 'partner' ? 'living_together' as const : item.stage,
            isCohabiting: true,
            householdSplit: split,
            movedInWeek: item.movedInWeek ?? gw,
          }
        : item
    );
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: connections,
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Moved in with ${partner.name}` }],
    };
    set({ relationshipState, relationshipFeedback: { title: 'Living Together', message: `You and ${partner.name} now share a household.`, positive: true } });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  spendTimeWithPartner: () => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner) return;
    const connections = (state.relationshipState?.activeConnections ?? []).map((item) =>
      item.id === partner.id ? { ...item, relationship: Math.min(100, (item.relationship ?? 70) + 4) } : item
    );
    const relationshipState = { ...state.relationshipState, activeConnections: connections, personalActionWeek: gw };
    const tempHappinessEffects = [...(state.tempHappinessEffects ?? []), { amount: 3, weeksRemaining: 2, source: 'Quality Time' }];
    const updates = { relationshipState, tempHappinessEffects };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  givePartnerGift: (tier) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner) return;
    const base = tier === 'small' ? 100 : tier === 'nice' ? 500 : 2500;
    const cost = Math.round(base * (state.inflationMultiplier ?? 1));
    if ((state.cash ?? 0) < cost) return;

    let gain = tier === 'small' ? 2 : tier === 'nice' ? 4 : 7;
    if (partner.financialStyle === 'frugal' && tier === 'luxury') gain = 2;
    if (partner.financialStyle === 'frugal' && tier === 'small') gain = 4;
    if (partner.financialStyle === 'luxury' && tier === 'luxury') gain = 9;
    if (partner.financialStyle === 'luxury' && tier === 'small') gain = 1;

    const connections = (state.relationshipState?.activeConnections ?? []).map((item) =>
      item.id === partner.id ? { ...item, relationship: Math.min(100, (item.relationship ?? 70) + gain) } : item
    );
    const relationshipState = { ...state.relationshipState, activeConnections: connections, personalActionWeek: gw };
    const updates = { cash: (state.cash ?? 0) - cost, relationshipState };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  discussFinancesWithPartner: () => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner) return;
    const connections = (state.relationshipState?.activeConnections ?? []).map((item) =>
      item.id === partner.id
        ? {
            ...item,
            relationship: Math.min(100, (item.relationship ?? 70) + 2),
            visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'] as RelationshipConnection['visibleTraits'],
          }
        : item
    );
    const relationshipState = { ...state.relationshipState, activeConnections: connections, personalActionWeek: gw };
    set({ relationshipState });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  proposeToPartner: (ring) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || !['partner', 'living_together'].includes(partner.stage) || partner.relationship < 82 || partner.weeksKnown < 12 || !isNormalizedAgeMatch(state.age ?? 20, partner.age ?? 18)) return;

    const cost = getProposalCost(ring, state.inflationMultiplier ?? 1);
    if ((state.cash ?? 0) < cost) return;
    const ringBonus = ring === 'simple' ? 0 : ring === 'classic' ? 0.05 : 0.08;
    const styleBonus = partner.financialStyle === 'frugal' && ring === 'simple' ? 0.05
      : partner.financialStyle === 'frugal' && ring === 'luxury' ? -0.04
        : partner.financialStyle === 'luxury' && ring === 'luxury' ? 0.05 : 0;
    const chance = Math.max(0.55, Math.min(0.97, 0.65 + (partner.relationship - 82) * 0.012 + ringBonus + styleBonus));
    const accepted = Math.random() < chance;

    const connections = (state.relationshipState?.activeConnections ?? []).map((item) => {
      if (item.id !== partner.id) return item;
      if (!accepted) return { ...item, relationship: Math.max(0, item.relationship - 8) };
      const relationshipBoost = ring === 'luxury' ? 6 : ring === 'classic' ? 4 : 3;
      return {
        ...item,
        stage: 'engaged' as const,
        engagedWeek: gw,
        relationship: Math.min(100, item.relationship + relationshipBoost),
        isCohabiting: item.isCohabiting || item.stage === 'living_together',
      };
    });
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: connections,
      personalActionWeek: gw,
      timeline: accepted
        ? [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Got engaged to ${partner.name}` }]
        : state.relationshipState.timeline,
    };
    const updates = { cash: (state.cash ?? 0) - cost, relationshipState };
    set({ ...updates, relationshipFeedback: accepted
      ? { title: 'Engaged!', message: `${partner.name} accepted your proposal.`, positive: true }
      : { title: 'Proposal Declined', message: `${partner.name} is not ready for marriage. The relationship took a hit.`, positive: false } });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  marryPartner: (wedding, agreement) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || partner.stage !== 'engaged' || partner.relationship < 80 || !isNormalizedAgeMatch(state.age ?? 20, partner.age ?? 18)) return;
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if (gw - (partner.engagedWeek ?? gw) < 3) return;

    const totalCost = getWeddingCost(wedding, state.inflationMultiplier ?? 1);
    const partnerShare = Math.min(Math.round(totalCost * 0.25), Math.round((partner.savings ?? 0) * 0.35));
    const playerCost = Math.max(0, totalCost - partnerShare);
    if ((state.cash ?? 0) < playerCost) return;

    const connections = (state.relationshipState?.activeConnections ?? []).map((item) => {
      if (item.id !== partner.id) return item;
      const weddingBoost = wedding === 'luxury' ? 7 : wedding === 'standard' ? 5 : 3;
      const styleAdjustment = item.financialStyle === 'frugal' && wedding === 'luxury' ? -2
        : item.financialStyle === 'luxury' && wedding === 'luxury' ? 2 : 0;
      return {
        ...item,
        stage: 'married' as const,
        isCohabiting: true,
        householdSplit: item.householdSplit ?? 'proportional',
        marriageAgreement: agreement,
        marriedWeek: gw,
        netWorthAtMarriage: getNetWorth(state),
        savings: Math.max(0, (item.savings ?? 0) - partnerShare),
        relationship: Math.min(100, item.relationship + weddingBoost + styleAdjustment),
      };
    });

    const relationshipState = {
      ...state.relationshipState,
      activeConnections: connections,
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Married ${partner.name}` }],
    };
    const tempHappinessEffects = [...(state.tempHappinessEffects ?? []), { amount: 10, weeksRemaining: 4, source: 'Wedding' }];
    const updates = { cash: (state.cash ?? 0) - playerCost, relationshipState, tempHappinessEffects };
    set({ ...updates, relationshipFeedback: { title: 'Married', message: `You and ${partner.name} are now married.`, positive: true } });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  setFamilyPlan: (plan) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || !(partner.isCohabiting || partner.stage === 'living_together' || partner.stage === 'married') || partner.relationship < 70) return;

    let acceptedPlan: FamilyPlan = plan;
    let relationshipDelta = 0;
    let familyExpansionWeeksRemaining = state.relationshipState.familyExpansionWeeksRemaining ?? 0;
    let cash = state.cash ?? 0;

    if (plan === 'trying') {
      const children = state.relationshipState.children ?? [];
      const youngestBirthWeek = children.reduce((latest, child) => Math.max(latest, child.birthGlobalWeek ?? 0), 0);
      const tooSoonAfterLastChild = youngestBirthWeek > 0 && gw - youngestBirthWeek < 40;
      const tooSoonAfterAttempt = (state.relationshipState.lastFamilyAttemptWeek ?? 0) > 0
        && gw - (state.relationshipState.lastFamilyAttemptWeek ?? 0) < 10;
      const playerAge = state.age ?? 20;
      const partnerAge = partner.age ?? 20;
      const familyProfile = getFamilyFormationProfile(playerAge, partnerAge, children.length);
      const oldestAge = Math.max(playerAge, partnerAge);
      const prospectiveDuration = familyProfile.durationWeeks;
      const wouldCrossAgeLimit = oldestAge === 42 && (state.week ?? 1) + prospectiveDuration > 20;
      const ageLimitReached = !familyProfile.allowedByAge || wouldCrossAgeLimit;
      const tooYoung = playerAge < 21 || partnerAge < 21;

      if (children.length >= familyProfile.maxChildren || familyExpansionWeeksRemaining > 0 || tooSoonAfterLastChild || tooSoonAfterAttempt || ageLimitReached || tooYoung) {
        set({
          relationshipFeedback: {
            title: 'Family Plans',
            message: children.length >= 3
              ? 'This generation has reached the maximum of three children.'
              : ageLimitReached
                ? 'New family expansion must be completed before age 43.'
                : tooYoung
                  ? 'Family expansion becomes available from age 21.'
                  : tooSoonAfterLastChild
                    ? 'Wait about two in-game years between children.'
                    : tooSoonAfterAttempt
                      ? 'Give it some time before trying again.'
                      : 'Your family is already growing.',
            positive: false,
          },
        });
        return;
      }

      const setupCost = Math.round(1000 * (state.inflationMultiplier ?? 1));
      if (cash < setupCost) return;

      let successChance = familyProfile.baseSuccessChance;
      if (partner.familyGoal === 'wants_children') successChance = Math.min(0.95, successChance * 1.10);
      if (partner.familyGoal === 'unsure') successChance *= 0.70;

      const attemptSucceeded = partner.familyGoal !== 'no_children' && Math.random() < successChance;
      cash -= setupCost;

      if (partner.familyGoal === 'no_children') {
        acceptedPlan = 'no_children';
        relationshipDelta = -8;
      } else if (!attemptSucceeded) {
        acceptedPlan = 'later';
        relationshipDelta = partner.familyGoal === 'wants_children' ? 0 : -1;
      } else {
        acceptedPlan = 'trying';
        familyExpansionWeeksRemaining = familyProfile.durationWeeks;
        relationshipDelta = partner.familyGoal === 'wants_children' ? 5 : 2;
      }
    } else if (plan === 'no_children') {
      relationshipDelta = partner.familyGoal === 'wants_children' ? -6 : 3;
    } else if (plan === 'later') {
      relationshipDelta = partner.familyGoal === 'wants_children' ? 1 : 2;
    }

    const connections = (state.relationshipState?.activeConnections ?? []).map((item) =>
      item.id === partner.id ? { ...item, relationship: Math.max(0, Math.min(100, item.relationship + relationshipDelta)) } : item
    );
    const timeline = acceptedPlan === 'trying' && familyExpansionWeeksRemaining > 0
      ? [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Decided with ${partner.name} to grow the family` }]
      : state.relationshipState.timeline;
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: connections,
      familyPlan: acceptedPlan,
      familyExpansionWeeksRemaining,
      lastFamilyAttemptWeek: plan === 'trying' ? gw : (state.relationshipState.lastFamilyAttemptWeek ?? 0),
      personalActionWeek: gw,
      timeline,
    };
    const updates = { cash, relationshipState };
    const familyFeedback = plan === 'trying'
      ? (acceptedPlan === 'trying' && familyExpansionWeeksRemaining > 0
        ? { title: 'Family Plans', message: `${partner.name} agrees. Your family will grow in the coming weeks.`, positive: true }
        : { title: 'Family Plans', message: partner.familyGoal === 'no_children' ? `${partner.name} does not want children.` : `It did not work out this time. You can try again later.`, positive: false })
      : { title: 'Family Plans', message: 'You discussed what you both want for the future.', positive: relationshipDelta >= 0 };
    set({ ...updates, relationshipFeedback: familyFeedback });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  fundChildEducation: (childId, amount) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    if (!Number.isFinite(amount) || amount <= 0 || amount > (state.cash ?? 0)) return;
    const child = (state.relationshipState?.children ?? []).find((item) => item.id === childId);
    if (!child || (child.age ?? 0) >= 18) return;
    const relationshipGain = amount >= 10000 ? 3 : amount >= 5000 ? 2 : 1;
    const children = (state.relationshipState?.children ?? []).map((item) =>
      item.id === childId
        ? {
            ...item,
            educationFund: (item.educationFund ?? 0) + Math.floor(amount),
            parentRelationship: Math.min(100, (item.parentRelationship ?? 75) + relationshipGain),
          }
        : item
    );
    const relationshipState = { ...state.relationshipState, children };
    const updates = { cash: (state.cash ?? 0) - Math.floor(amount), relationshipState };
    set({
      ...updates,
      relationshipFeedback: {
        title: 'Education Support',
        message: `You invested in ${child.name}'s future.`,
        positive: true,
      },
    });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  spendTimeWithChild: (childId) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const child = (state.relationshipState?.children ?? []).find((item) => item.id === childId);
    if (!child) return;
    const gain = (child.age ?? 0) < 18 ? 5 : 3;
    const children = (state.relationshipState?.children ?? []).map((item) =>
      item.id === childId
        ? { ...item, parentRelationship: Math.min(100, (item.parentRelationship ?? 75) + gain) }
        : item
    );
    const relationshipState = {
      ...state.relationshipState,
      children,
      personalActionWeek: gw,
      timeline: [...(state.relationshipState?.timeline ?? []), {
        week: state.week,
        year: state.year,
        title: `Spent quality time with ${child.name}`,
      }],
    };
    const tempHappinessEffects = [
      ...(state.tempHappinessEffects ?? []),
      { amount: 2, weeksRemaining: 2, source: `Time with ${child.name}` },
    ];
    const updates = { relationshipState, tempHappinessEffects };
    set({
      ...updates,
      relationshipFeedback: {
        title: 'Quality Time',
        message: `Your relationship with ${child.name} improved.`,
        positive: true,
      },
    });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  endDatingConnection: (connectionId) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const connection = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === connectionId);
    if (!connection || connection.stage !== 'dating') return;
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: (state.relationshipState?.activeConnections ?? []).filter((item) => item.id !== connectionId),
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Stopped dating ${connection.name}` }],
    };
    set({ relationshipState });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  endPartnership: () => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || partner.stage === 'married') return;
    const endedWeek = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const formerPartner = { ...partner, isCohabiting: false, endedWeek, endedReason: 'breakup' as const };
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: (state.relationshipState?.activeConnections ?? []).filter((item) => item.id !== partner.id),
      formerPartners: [...(state.relationshipState?.formerPartners ?? []), formerPartner],
      partnerId: null,
      familyPlan: 'not_discussed' as const,
      familyExpansionWeeksRemaining: 0,
      pendingEvent: null,
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Relationship with ${partner.name} ended` }],
    };
    set({
      relationshipState,
      relationshipFeedback: { title: 'Relationship Ended', message: `You and ${partner.name} have separated.`, positive: false },
    });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  divorcePartner: () => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || partner.stage !== 'married') return;

    const currentNetWorth = getNetWorth(extractGameState(state));
    const marriageStartNetWorth = partner.netWorthAtMarriage ?? currentNetWorth;
    const maritalGrowth = Math.max(0, currentNetWorth - marriageStartNetWorth);
    const inflation = state.inflationMultiplier ?? 1;
    const legalFees = Math.round(5000 * inflation);
    const sharedGrowthSettlement = partner.marriageAgreement === 'shared_future' ? Math.round(maritalGrowth * 0.5) : 0;
    const settlementTotal = legalFees + sharedGrowthSettlement;
    const durationWeeks = sharedGrowthSettlement > 0 ? 40 : 10;
    const obligation: RelationshipFinancialObligation | null = settlementTotal > 0 ? {
      id: `divorce_${Date.now()}`,
      type: sharedGrowthSettlement > 0 ? 'divorce_settlement' : 'legal_fees',
      label: sharedGrowthSettlement > 0 ? `Divorce settlement with ${partner.name}` : `Divorce legal fees`,
      remainingAmount: settlementTotal,
      weeklyPayment: Math.max(1, Math.ceil(settlementTotal / durationWeeks)),
      weeksRemaining: durationWeeks,
    } : null;

    const endedWeek = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const formerPartner = { ...partner, isCohabiting: false, endedWeek, endedReason: 'divorce' as const };
    const relationshipState = {
      ...state.relationshipState,
      activeConnections: (state.relationshipState?.activeConnections ?? []).filter((item) => item.id !== partner.id),
      formerPartners: [...(state.relationshipState?.formerPartners ?? []), formerPartner],
      partnerId: null,
      familyPlan: 'not_discussed' as const,
      familyExpansionWeeksRemaining: 0,
      pendingEvent: null,
      financialObligations: obligation
        ? [...(state.relationshipState?.financialObligations ?? []), obligation]
        : (state.relationshipState?.financialObligations ?? []),
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Divorced ${partner.name}` }],
    };
    set({
      relationshipState,
      relationshipFeedback: {
        title: 'Divorce Finalized',
        message: partner.marriageAgreement === 'shared_future'
          ? `Future-growth agreement: ${formatCurrencySafe(sharedGrowthSettlement)} of marital growth plus legal fees will be paid over ${durationWeeks} weeks.`
          : `Separate assets were preserved. Legal fees of ${formatCurrencySafe(legalFees)} will be paid over ${durationWeeks} weeks.`,
        positive: false,
      },
    });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  setSharedRelationshipGoal: (type) => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || !['living_together', 'engaged', 'married'].includes(partner.stage)) return;

    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const inflation = state.inflationMultiplier ?? 1;
    const housingOrder = ['cheap_apartment', 'studio_apartment', 'small_house', 'family_house', 'luxury_villa', 'mansion'];
    const currentHousingIndex = Math.max(0, housingOrder.indexOf(state.currentHousingId));
    const currentNetWorth = getNetWorth(state);
    let target = 0;

    if (type === 'cash_buffer') {
      target = Math.round(Math.max(10000 * inflation, (state.cash ?? 0) * 1.25));
    } else if (type === 'net_worth') {
      const milestones = [50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000];
      target = milestones.find((value) => value > currentNetWorth) ?? Math.ceil(currentNetWorth * 1.5);
    } else if (type === 'better_home') {
      target = Math.min(housingOrder.length - 1, currentHousingIndex + 1);
      if (target <= currentHousingIndex) return;
    } else {
      const childCount = Math.max(1, state.relationshipState?.children?.length ?? 0);
      target = Math.round(10000 * inflation * childCount);
    }

    const relationshipState = {
      ...state.relationshipState,
      sharedGoal: { type, target, startedGlobalWeek: gw, completed: false },
      timeline: [...(state.relationshipState?.timeline ?? []), {
        week: state.week,
        year: state.year,
        title: `Set a shared ${type.replace(/_/g, ' ')} goal`,
      }],
    };
    set({
      relationshipState,
      relationshipFeedback: {
        title: 'Shared Goal Set',
        message: 'You and your partner now have a financial goal to work toward together.',
        positive: true,
      },
    });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  cancelSharedRelationshipGoal: () => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    if (!state.relationshipState?.sharedGoal) return;
    const relationshipState = { ...state.relationshipState, sharedGoal: null };
    set({ relationshipState });
    saveGame(extractGameState({ ...state, relationshipState }), state.activeSlot);
  },

  setEstatePlan: (planType, structure, successorId) => {
    const state = get();
    if (!state.relationshipModeEnabled) return;

    const partner = (state.relationshipState?.activeConnections ?? []).find(
      (item) => item.id === state.relationshipState?.partnerId && item.stage === 'married'
    ) ?? null;
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const adultChildren = (state.relationshipState?.children ?? []).filter((child) =>
      Math.floor((gw - (child.birthGlobalWeek ?? gw)) / 20) >= 18
    );
    if (!partner && adultChildren.length === 0 && (state.relationshipState?.children?.length ?? 0) === 0) return;

    const eligibleSuccessorIds = new Set<string>();
    if (partner) eligibleSuccessorIds.add(partner.id);
    for (const child of adultChildren) eligibleSuccessorIds.add(child.id);
    const safeSuccessorId = successorId && eligibleSuccessorIds.has(successorId) ? successorId : null;

    const currentStructure = state.relationshipState?.estatePlan?.structure ?? 'none';
    const structureRank: Record<EstateStructureType, number> = { none: 0, will: 1, family_trust: 2 };
    let setupCost = 0;
    if (structureRank[structure] > structureRank[currentStructure]) {
      if (structure === 'will') setupCost = Math.round(2000 * (state.inflationMultiplier ?? 1));
      if (structure === 'family_trust') setupCost = Math.round(25000 * (state.inflationMultiplier ?? 1));
    }
    if ((state.cash ?? 0) < setupCost) return;

    const relationshipState = {
      ...state.relationshipState,
      estatePlan: {
        planType,
        structure,
        successorId: safeSuccessorId,
        updatedGlobalWeek: gw,
      },
      timeline: [...(state.relationshipState?.timeline ?? []), {
        week: state.week,
        year: state.year,
        title: structure === 'none' ? 'Updated family inheritance wishes' : `Updated estate plan (${structure.replace(/_/g, ' ')})`,
      }],
    };
    const updates = { cash: (state.cash ?? 0) - setupCost, relationshipState };
    set({
      ...updates,
      relationshipFeedback: {
        title: 'Estate Plan Updated',
        message: structure === 'family_trust'
          ? 'A family trust is now in place, reducing future estate administration costs.'
          : structure === 'will'
            ? 'Your will is now documented, reducing future estate administration costs.'
            : 'Your inheritance preferences are saved, but no formal estate structure is in place.',
        positive: true,
      },
    });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  relationshipCounseling: () => {
    if (!get().relationshipModeEnabled) return;
    const state = get();
    const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    if ((state.relationshipState?.personalActionWeek ?? 0) === gw) return;
    const partner = (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId);
    if (!partner || partner.relationship >= 65) return;
    const cost = Math.round(1200 * (state.inflationMultiplier ?? 1));
    if ((state.cash ?? 0) < cost) return;
    const activeConnections = (state.relationshipState?.activeConnections ?? []).map((item) =>
      item.id === partner.id ? { ...item, relationship: Math.min(100, (item.relationship ?? 0) + 12) } : item
    );
    const relationshipState = {
      ...state.relationshipState,
      activeConnections,
      personalActionWeek: gw,
      timeline: [...(state.relationshipState?.timeline ?? []), { week: state.week, year: state.year, title: `Worked on relationship with ${partner.name}` }],
    };
    const updates = { cash: (state.cash ?? 0) - cost, relationshipState };
    set({
      ...updates,
      relationshipFeedback: { title: 'Relationship Counseling', message: 'You made time to work through the problems together.', positive: true },
    });
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  continueAsChild: (childId, financeTaxWithLoan, assetStrategy = 'liquidate') => {
    const state = get();
    if (!state.lifecycle?.isDead) return;
    const child = (state.relationshipState?.children ?? []).find((item) => item.id === childId);
    const preview = getSuccessionPreview(state, childId, assetStrategy);
    if (!child || !preview || !preview.willingToSucceed) return;
    if (!financeTaxWithLoan && preview.taxCashAvailable < preview.inheritanceTax) return;

    const inheritedBusinesses = preview.inheritedBusinessValue > 0
      ? (state.businesses ?? []).filter((business) => business.familyBusiness?.isFamilyBusiness).map((business) => ({
          ...business,
          familyBusiness: business.familyBusiness?.isFamilyBusiness
            ? {
                ...business.familyBusiness,
                generationsOwned: Math.max(1, business.familyBusiness.generationsOwned ?? 1) + 1,
                controllerName: child.name,
                controllerPersonId: `person:${child.id}`,
                familyOwnershipPct: 100,
              }
            : {
                isFamilyBusiness: true,
                familyName: `${state.playerName} Family`,
                founderGeneration: state.generation ?? 1,
                generationsOwned: 2,
                controllerName: child.name,
                controllerPersonId: `person:${child.id}`,
                familyOwnershipPct: 100,
                designatedYear: state.year,
              },
          timeline: [
            ...(business.timeline ?? []),
            {
              week: state.week,
              year: state.year,
              title: `👪 Passed to Generation ${(state.generation ?? 1) + 1}: ${child.name}`,
              icon: '👪',
              kind: 'event' as const,
            },
          ].slice(-50),
        }))
      : [];

    const inheritanceLoanPrincipal = financeTaxWithLoan ? preview.inheritanceTax : 0;
    const inheritanceLoan: ActiveLoan | null = inheritanceLoanPrincipal > 0
      ? (() => {
          const totalRepayment = Math.ceil(inheritanceLoanPrincipal * 1.06);
          const durationWeeks = 80;
          return {
            loanId: `inheritance_tax_g${(state.generation ?? 1) + 1}`,
            name: 'Inheritance Tax Loan',
            originalAmount: inheritanceLoanPrincipal,
            remainingAmount: totalRepayment,
            weeklyPayment: Math.ceil(totalRepayment / durationWeeks),
            weeksRemaining: durationWeeks,
          };
        })()
      : null;

    const fullPortfolioValue = getPortfolioValue(state.stocks ?? [], state.holdings ?? []);
    const stockRatio = fullPortfolioValue > 0
      ? Math.max(0, Math.min(1, preview.inheritedStockValue / fullPortfolioValue))
      : 0;
    const inheritedHoldings = stockRatio > 0
      ? (state.holdings ?? []).map((holding) => {
          const stock = (state.stocks ?? []).find((item) => item.ticker === holding.ticker);
          return {
            ...holding,
            shares: stockRatio >= 0.999 ? holding.shares : Math.floor((holding.shares ?? 0) * stockRatio),
            avgBuyPrice: stock?.currentPrice ?? holding.avgBuyPrice,
          };
        }).filter((holding) => (holding.shares ?? 0) > 0)
      : [];
    const actualStockValue = getPortfolioValue(state.stocks ?? [], inheritedHoldings);
    const stockRoundingCash = Math.max(0, preview.inheritedStockValue - actualStockValue);
    const inheritedProperties = (state.properties ?? []).filter((property) =>
      (preview.inheritedPropertyIds ?? []).includes(property.id)
    );
    const liquidStartingCash = preview.existingSavings + preview.inheritedCash + stockRoundingCash;
    const cashAfterTax = financeTaxWithLoan
      ? liquidStartingCash
      : Math.max(0, liquidStartingCash - preview.inheritanceTax);
    const nextGeneration = (state.generation ?? 1) + 1;
    const legacyEntry = {
      generation: state.generation ?? 1,
      name: state.playerName,
      deathAge: state.lifecycle.deathAge ?? state.age,
      deathYear: state.lifecycle.deathYear ?? state.year,
      finalNetWorth: state.relationshipState?.estateSettlement?.netEstate ?? getNetWorth(state),
      successorName: child.name,
    };

    const occupationTitleToLegacyJob: Record<string, string> = {
      'Retail Employee': 'cashier',
      'Administrative Assistant': 'office_assistant',
      'Assistant Accountant': 'accountant',
      'Marketing Specialist': 'marketing_specialist',
      'Software Developer': 'software_developer',
    };
    const inheritedJobId = occupationTitleToLegacyJob[child.occupationTitle ?? ''] ?? null;

    const inheritedCompetitors = Object.fromEntries(
      inheritedBusinesses.map((business) => [business.id, state.competitors?.[business.id] ?? []])
    );
    const inheritedJob = inheritedJobId ? (jobsData as any[]).find((job) => job.id === inheritedJobId) : null;
    const inheritedCourse = inheritedJob
      ? (coursesData as any[]).find((course) => course.id === inheritedJob.requiredCourse)
      : null;
    const inheritedCompletedCourses = inheritedCourse
      ? [{ courseId: inheritedCourse.id, name: inheritedCourse.name, completedWeek: state.week }]
      : [];


    const currentGlobalWeek = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
    const successorPartner: RelationshipConnection | null = child.partnerName
      ? {
          id: `generation_partner_${nextGeneration}`,
          name: child.partnerName,
          gender: child.partnerGender ?? 'woman',
          age: Math.max(18, preview.childAge),
          occupationId: 'legacy_partner',
          occupationTitle: 'Professional',
          weeklyIncome: Math.max(500, Math.round((child.weeklyIncome ?? 700) * 0.8)),
          savings: Math.max(5000, Math.round((child.savings ?? 0) * 0.5)),
          financialStyle: 'balanced',
          riskTolerance: 'balanced',
          ambition: 'career_minded',
          familyGoal: (child.childrenCount ?? 0) > 0 ? 'wants_children' : 'unsure',
          visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
          stage: 'living_together',
          connection: 80,
          relationship: 82,
          dates: 0,
          weeksKnown: 20,
          isCohabiting: true,
          householdSplit: 'proportional',
          employmentStatus: 'employed',
          unemploymentWeeks: 0,
          careerLevel: 1,
          lastCareerEventWeek: currentGlobalWeek,
          familyTreePersonId: `inlaw:${child.id}`,
        }
      : null;

    const existingDescendants = child.descendants ?? [];
    const successorChildren = existingDescendants.length > 0
      ? existingDescendants.map((descendant) => ({
          id: descendant.id,
          name: descendant.name,
          gender: descendant.gender,
          birthGlobalWeek: descendant.birthGlobalWeek,
          age: descendant.age,
          educationFund: 0,
          status: 'dependent' as const,
          occupationTitle: null,
          weeklyIncome: 0,
          savings: 0,
          homeStatus: 'renting' as const,
          partnerName: null,
          partnerGender: null,
          childrenCount: 0,
          descendants: [],
          otherParentId: successorPartner?.id ?? null,
          parentRelationship: 78,
          personality: getChildPersonality(descendant.id),
        }))
      : Array.from({ length: child.childrenCount ?? 0 }, (_, index) => {
          const childAge = Math.min(17, Math.max(0, preview.childAge - 25 - index * 2));
          const girls = (relationshipNamesData as any).women as string[];
          const boys = (relationshipNamesData as any).men as string[];
          const gender = index % 2 === 0 ? 'girl' as const : 'boy' as const;
          const namePool = gender === 'girl' ? girls : boys;
          const name = namePool[(nextGeneration * 3 + index) % namePool.length];
          return {
            id: `generation_child_${nextGeneration}_${index}`,
            name,
            gender,
            birthGlobalWeek: currentGlobalWeek - childAge * 20,
            age: childAge,
            educationFund: 0,
            status: 'dependent' as const,
            occupationTitle: null,
            weeklyIncome: 0,
            savings: 0,
            homeStatus: 'renting' as const,
            partnerName: null,
            partnerGender: null,
            childrenCount: 0,
            descendants: [],
            otherParentId: successorPartner?.id ?? null,
            parentRelationship: 78,
            personality: getChildPersonality(`generation_child_${nextGeneration}_${index}`),
          };
        });

    const relationshipState = {
      ...INITIAL_RELATIONSHIP_STATE,
      preferencesSet: !!successorPartner,
      partnerId: successorPartner?.id ?? null,
      activeConnections: successorPartner ? [successorPartner] : [],
      children: successorChildren,
      familyPlan: successorChildren.length > 0 ? 'later' as const : 'not_discussed' as const,
      timeline: successorPartner
        ? [{ week: state.week, year: state.year, title: `Generation ${nextGeneration} began with ${successorPartner.name}` }]
        : [],
    };

    const transitionedFamilyTree = transitionFamilyTreeToChild(state, child.id, nextGeneration);

    const newState: GameState = {
      ...INITIAL_GAME_STATE,
      playerName: child.name,
      week: state.week,
      year: state.year,
      age: preview.childAge,
      cash: cashAfterTax,
      inflationMultiplier: state.inflationMultiplier,
      currentHousingId: child.homeStatus === 'homeowner' ? 'small_house' : 'studio_apartment',
      housingHistory: [child.homeStatus === 'homeowner' ? 'small_house' : 'studio_apartment'],
      currentCarId: 'none',
      pendingCarDelivery: null,
      foodLevel: 'basic',
      currentJobId: inheritedJobId,
      careerHistory: [],
      completedCourses: inheritedCompletedCourses,
      totalWeeksWorked: 0,
      stocks: state.stocks ?? [],
      holdings: inheritedHoldings,
      loans: inheritanceLoan ? [inheritanceLoan] : [],
      bankDeposits: [],
      happiness: 45,
      netWorthHistory: [],
      earningsSinceLastTax: 0,
      lastTaxWeek: state.lastTaxWeek,
      totalTaxPaid: 0,
      unlockedAchievements: state.unlockedAchievements ?? [],
      statistics: {
        ...INITIAL_STATISTICS,
        highestCash: cashAfterTax,
        highestNetWorth: cashAfterTax + inheritedBusinesses.reduce((sum, business) => sum + (business.valuation ?? 0), 0),
      },
      currentHeadline: `Generation ${nextGeneration}: ${child.name} continues the family legacy.`,
      initialized: true,
      tempHappinessEffects: [],
      pendingInvestments: [],
      recentEventIds: [],
      businesses: inheritedBusinesses,
      skills: {},
      knowledge: {},
      career: { ...INITIAL_CAREER_STATE },
      properties: inheritedProperties,
      activeAuctions: (state.activeAuctions ?? []).map((auction) => ({
        ...auction,
        playerHighestBid: 0,
        playerIsHighestBidder: false,
      })),
      competitors: inheritedCompetitors,
      activeMarketSentiment: state.activeMarketSentiment,
      activeMarketEvents: state.activeMarketEvents,
      totalRealizedProfitLoss: 0,
      newsHistory: [...(state.newsHistory ?? [])].slice(-20),
      partTimeJob: false,
      adWatchedToday: state.adWatchedToday ?? 0,
      adLastWatchDate: state.adLastWatchDate ?? '',
      relationshipModeEnabled: state.relationshipModeEnabled,
      relationshipState,
      lifecycle: { ...INITIAL_LIFECYCLE_STATE },
      lastMacroCrashWeek: state.lastMacroCrashWeek ?? 0,
      generation: nextGeneration,
      familyLegacy: [...(state.familyLegacy ?? []), legacyEntry],
      familyTree: transitionedFamilyTree,
    };
    newState.netWorthHistory = [getNetWorth(newState)];

    set({
      ...newState,
      lastSummary: null,
      showSummary: false,
      showRelationshipEventModal: false,
      relationshipFeedback: {
        title: `Generation ${nextGeneration}`,
        message: financeTaxWithLoan
          ? `${child.name} inherited the estate and financed ${formatCurrencySafe(preview.inheritanceTax)} of inheritance tax with an 80-week estate loan.`
          : `${child.name} inherited the estate and paid ${formatCurrencySafe(preview.inheritanceTax)} inheritance tax in cash.`,
        positive: true,
      },
      periodIncome: 0,
      periodExpenses: 0,
      periodTax: 0,
      periodWeeksEmployed: 0,
      periodWeeksUnemployed: 0,
      periodJobChanges: 0,
      periodCoursesCompleted: 0,
      periodStocksPurchased: 0,
      periodLoansTaken: inheritanceLoan ? 1 : 0,
      periodLoansRepaid: 0,
      periodAchievements: 0,
      periodStartWeek: ((state.year - 1) * 20) + state.week,
    });
    saveGame(newState, state.activeSlot);
  },

  dismissRelationshipEventModal: () => {
    const state = get();
    if (state.periodReport && !state.showPeriodReport) {
      set({ showRelationshipEventModal: false, showPeriodReport: true });
    } else {
      set({ showRelationshipEventModal: false, showEducationCareerReminder: !state.showScheduledAd && !!state.educationCareerReminder });
    }
  },

  handleRelationshipEventChoice: (choiceIndex) => {
    const state = get();
    const event = state.relationshipState?.pendingEvent;
    if (!event) return;
    const choice = event.choices?.[choiceIndex];
    if (!choice) return;
    const cost = choice.cost ?? 0;
    if (cost > (state.cash ?? 0)) return;

    const partnerId = state.relationshipState.partnerId;
    const activeConnections = (state.relationshipState.activeConnections ?? []).map((item) =>
      item.id === partnerId
        ? { ...item, relationship: Math.max(0, Math.min(100, (item.relationship ?? 70) + (choice.relationship ?? 0))) }
        : item
    );
    const children = choice.childId
      ? (state.relationshipState.children ?? []).map((child) =>
          child.id === choice.childId
            ? {
                ...child,
                savings: Math.max(0, (child.savings ?? 0) + (choice.childSavings ?? 0)),
                parentRelationship: Math.max(
                  0,
                  Math.min(100, (child.parentRelationship ?? 75) + (choice.childRelationship ?? 0)),
                ),
              }
            : child
        )
      : state.relationshipState.children;
    const relationshipState = {
      ...state.relationshipState,
      activeConnections,
      children,
      pendingEvent: null,
    };
    const tempHappinessEffects = choice.happiness
      ? [...(state.tempHappinessEffects ?? []), {
          amount: choice.happiness,
          weeksRemaining: choice.happinessDuration ?? 1,
          source: event.title,
        }]
      : state.tempHappinessEffects;

    const updates = {
      cash: (state.cash ?? 0) - cost,
      relationshipState,
      tempHappinessEffects,
    };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);

    if (state.periodReport && !state.showPeriodReport) {
      set({ showRelationshipEventModal: false, showPeriodReport: true });
    } else {
      set({ showRelationshipEventModal: false });
    }
  },

  dismissRelationshipFeedback: () => set({ relationshipFeedback: null }),

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
    const prestigeEffects = getPrestigeEffects(state.profile);
    const effectiveInterestRate = Math.max(0, (template?.interestRate ?? 0) - (prestigeEffects.loan_rate_reduction ?? 0));
    const totalRepayment = (template?.amount ?? 0) * (1 + effectiveInterestRate);
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

  openBankDeposit: (amount: number, durationWeeks: 20 | 40 | 60) => {
    const state = get();
    if (!Number.isFinite(amount) || amount <= 0 || amount > (state.cash ?? 0)) return;
    if ((state.bankDeposits ?? []).length >= 3) return;
    const rates: Record<number, number> = { 20: 0.05, 40: 0.09, 60: 0.14 };
    const depositInterestBonus = getPrestigeEffects(state.profile).bank_deposit_interest_bonus ?? 0;
    const deposit: BankDeposit = {
      id: `deposit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      amount: Math.floor(amount),
      durationWeeks,
      weeksRemaining: durationWeeks,
      interestRate: rates[durationWeeks] + depositInterestBonus,
    };
    const updates = { cash: state.cash - deposit.amount, bankDeposits: [...(state.bankDeposits ?? []), deposit] };
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

  placePropertyAuctionBid: (auctionId: string, amount: number) => {
    const state = get();
    const globalWeek = ((state.year - 1) * 20) + state.week;
    const auction = (state.activeAuctions ?? []).find((item) => item.id === auctionId);
    if (!auction || globalWeek >= auction.auctionEndWeek || amount > state.cash || amount < auction.currentBid + auction.minimumBidIncrease) return;
    const activeAuctions = state.activeAuctions.map((item) => item.id === auctionId ? placeAuctionBid(item, amount) : item);
    set({ activeAuctions });
    saveGame(extractGameState({ ...state, activeAuctions }), state.activeSlot);
  },

  inspectPropertyAuction: (auctionId: string) => {
    const state = get();
    const auction = (state.activeAuctions ?? []).find((item) => item.id === auctionId);
    if (!auction || auction.inspectionPurchased) return;
    const cost = getInspectionCost(auction);
    if (state.cash < cost) return;
    const activeAuctions = state.activeAuctions.map((item) => item.id === auctionId ? { ...inspectAuction(item), inspectionCostPaid: cost } : item);
    const updates = { cash: state.cash - cost, activeAuctions };
    set(updates);
    saveGame(extractGameState({ ...state, ...updates }), state.activeSlot);
  },

  leavePropertyAuction: (auctionId: string) => {
    const state = get();
    const activeAuctions = (state.activeAuctions ?? []).map((item) => item.id === auctionId ? leaveAuction(item) : item);
    set({ activeAuctions });
    saveGame(extractGameState({ ...state, activeAuctions }), state.activeSlot);
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

  designateFamilyBusiness: (businessId) => {
    const state = get();
    if (state.lifecycle?.isDead) return;
    const business = (state.businesses ?? []).find((item) => item.id === businessId);
    if (!business) return;
    const hasFamily = (state.relationshipState?.children?.length ?? 0) > 0
      || !!state.relationshipState?.partnerId
      || (state.generation ?? 1) > 1;
    if (!hasFamily) return;

    const businesses = (state.businesses ?? []).map((item) =>
      item.id === businessId
        ? {
            ...item,
            familyBusiness: {
              isFamilyBusiness: true,
              familyName: item.familyBusiness?.familyName ?? `${state.playerName} Family`,
              founderGeneration: item.familyBusiness?.founderGeneration ?? (state.generation ?? 1),
              generationsOwned: item.familyBusiness?.generationsOwned ?? 1,
              controllerName: state.playerName,
              controllerPersonId: state.familyTree?.currentPlayerId ?? null,
              familyOwnershipPct: 100,
              designatedYear: item.familyBusiness?.designatedYear ?? state.year,
            },
          }
        : item
    );
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
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

  startBusinessExpansion: (businessId: string, templateId: string) => {
    const state = get();
    const businesses = [...(state.businesses ?? [])];
    const index = businesses.findIndex((business) => business.id === businessId);
    if (index < 0) return;
    const business = businesses[index];
    const template = getBusinessLocationTemplate(templateId);
    const costs = getScaledLocationCosts(business, templateId, state.inflationMultiplier ?? 1);
    if (!template || !costs || !canStartBusinessExpansion(business, templateId) || business.balance < costs.purchaseCost) return;
    businesses[index] = {
      ...business,
      balance: business.balance - costs.purchaseCost,
      activeExpansion: { templateId, weeksRemaining: template.buildWeeks },
      timeline: [...(business.timeline ?? []), { week: state.week, year: state.year, title: `Started expansion: ${template.name}`, icon: '🏗️', kind: 'expansion' as const }].slice(-50),
    };
    set({ businesses });
    saveGame(extractGameState({ ...state, businesses }), state.activeSlot);
  },

  takeBusinessLoan: (businessId: string, amount: number, interestRate: number, durationWeeks: number) => {
    const state = get();
    const businesses = [...(state?.businesses ?? [])];
    const idx = businesses.findIndex((b) => b?.id === businessId);
    if (idx < 0) return;
    const biz = { ...businesses[idx] };
    if ((biz.businessLoans?.length ?? 0) >= 3) return;
    const effectiveInterestRate = Math.max(0, interestRate - (getPrestigeEffects(state.profile).loan_rate_reduction ?? 0));
    const totalRepayment = amount * (1 + effectiveInterestRate);
    const weeklyPayment = Math.ceil(totalRepayment / durationWeeks);
    const loan: BusinessLoan = {
      id: `bloan_${Date.now()}`,
      amount,
      remainingAmount: totalRepayment,
      weeklyPayment,
      weeksRemaining: durationWeeks,
      interestRate: effectiveInterestRate,
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

function formatCurrencySafe(value: number): string {
  return '€' + Math.round(value).toLocaleString('en-US');
}

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
    pendingCarDelivery: state?.pendingCarDelivery ?? null,
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
    bankDeposits: state?.bankDeposits ?? [],
    happiness: state?.happiness ?? 30,
    netWorthHistory: state?.netWorthHistory ?? [10000],
    earningsSinceLastTax: state?.earningsSinceLastTax ?? 0,
    lastTaxWeek: state?.lastTaxWeek ?? 0,
    totalTaxPaid: state?.totalTaxPaid ?? 0,
    unlockedAchievements: state?.unlockedAchievements ?? [],
    statistics: { ...INITIAL_STATISTICS, ...(state?.statistics ?? {}) },
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
    activeAuctions: state?.activeAuctions ?? [],
    competitors: state?.competitors ?? {},
    activeMarketSentiment: state?.activeMarketSentiment ?? null,
    activeMarketEvents: state?.activeMarketEvents ?? [],
    totalRealizedProfitLoss: state?.totalRealizedProfitLoss ?? 0,
    newsHistory: (state as any)?.newsHistory ?? [],
    partTimeJob: (state as any)?.partTimeJob ?? false,
    adWatchedToday: (state as any)?.adWatchedToday ?? 0,
    adLastWatchDate: (state as any)?.adLastWatchDate ?? '',
    relationshipModeEnabled: state?.relationshipModeEnabled ?? false,
    relationshipState: state?.relationshipState ?? { ...INITIAL_RELATIONSHIP_STATE },
    lifecycle: state?.lifecycle ?? { ...INITIAL_LIFECYCLE_STATE },
    lastMacroCrashWeek: state?.lastMacroCrashWeek ?? 0,
    generation: state?.generation ?? 1,
    familyLegacy: state?.familyLegacy ?? [],
    familyTree: state?.familyTree ?? createInitialFamilyTree(state?.playerName ?? 'Player', state?.age ?? 20, state?.year ?? 1, state?.generation ?? 1),
  };
}

export default useGameStore;
