// ── Skills & Knowledge ──
export interface SkillCategoryData {
  id: string;
  name: string;
  description: string;
}
export interface KnowledgeCategoryData {
  id: string;
  name: string;
  description: string;
}

// ── Career System ──
export interface CompanyData {
  id: string;
  name: string;
  industry: string;
  description: string;
  careerPaths: string[];
  salaryMultiplier: number;
  promotionSpeed: number;
  culture: number;
  layoffRisk: number;
  size: string;
}

export interface CareerPosition {
  level: number;
  title: string;
  baseSalary: number;
  reqKnowledge: Record<string, number>;
  reqSkills: Record<string, number>;
  reqWeeks: number;
}

export interface CareerPathData {
  id: string;
  name: string;
  requiredCourseBase: string;
  positions: CareerPosition[];
}

export interface CareerState {
  companyId: string | null;
  careerPathId: string | null;
  positionLevel: number;
  performance: number;
  weeksInPosition: number;
  weeksAtCompany: number;
  salaryBonus: number;
  lastRaiseWeek: number;
  networkingScore: number;
  promotionProgress: number; // 0-100, promote at 100
  lastPerformanceEventWeek: number;
}

export const INITIAL_CAREER_STATE: CareerState = {
  companyId: null,
  careerPathId: null,
  positionLevel: 0,
  performance: 50,
  weeksInPosition: 0,
  weeksAtCompany: 0,
  salaryBonus: 1.0,
  lastRaiseWeek: 0,
  networkingScore: 0,
  promotionProgress: 0,
  lastPerformanceEventWeek: 0,
};

// ── Market Sentiment ──
export interface ActiveMarketSentiment {
  id: string;
  name: string;
  effects: Record<string, number>;
  volatilityMultiplier: number;
  weeksRemaining: number;
}

export interface ActiveMarketEvent {
  id: string;
  title: string;
  effects: Record<string, number>;
  assetTypes?: Array<'stock' | 'commodity' | 'etf'>;
  weeksRemaining: number;
}

// ── Real Estate ──
export interface PropertyTypeData {
  id: string;
  name: string;
  type: string;
  purchasePrice: number;
  weeklyRentalIncome: number;
  weeklyMaintenance: number;
  appreciationRate: number;
  renovationCost: number;
  renovationValueBoost: number;
  description: string;
}

export interface OwnedProperty {
  id: string;
  typeId: string;
  name: string;
  purchasePrice: number;
  currentValue: number;
  isRentedOut: boolean;
  isRenovated: boolean;
  purchaseWeek: number;
  purchaseYear: number;
  weeklyIncome: number;
  weeklyMaintenance: number;
}

// ── Prestige ──
export interface PrestigeBonus {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  effect: { type: string; value: number };
}

// ── Competitor AI ──
export interface BusinessCompetitor {
  id: string;
  name: string;
  strength: number; // 0-100
  enteredWeek: number;
}

export interface CourseData {
  id: string;
  baseId: string;
  name: string;
  level: number;
  duration: number;
  cost: number;
  weeklyCost: number;
  prerequisite: string | null;
  category?: string;
  skillRewards?: Record<string, number>;
  knowledgeRewards?: Record<string, number>;
}

export interface JobData {
  id: string;
  baseId: string;
  title: string;
  level: number;
  weeklySalary: number;
  requiredCourse: string;
  requiresCar: boolean;
  requiredExperienceWeeks: number;
}

export interface StockData {
  ticker: string;
  company: string;
  sector: string;
  startPrice: number;
  type: string;
}

export interface HousingData {
  id: string;
  name: string;
  weeklyRent: number;
  happiness: number;
  description: string;
}

export interface CarData {
  id: string;
  name: string;
  purchaseCost: number;
  weeklyCost: number;
  happiness: number;
  description: string;
}

export interface FoodData {
  id: string;
  name: string;
  weeklyCost: number;
  happiness: number;
  description: string;
}

export interface HouseUpgradeData {
  id: string;
  name: string;
  cost: number;
  happiness: number;
  description: string;
}

export interface LoanTemplate {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  durationWeeks: number;
}

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  gemReward?: number;
  icon: string;
}

export interface NewsEvent {
  headline: string;
  effects: Record<string, number>;
}

export interface StockHolding {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
}

export interface StockState {
  ticker: string;
  currentPrice: number;
  priceHistory: number[];
}

export interface CareerHistoryEntry {
  jobId: string;
  title: string;
  startWeek: number;
  endWeek: number | null;
}

export interface CompletedCourse {
  courseId: string;
  name: string;
  completedWeek: number;
}

export interface ActiveLoan {
  loanId: string;
  name: string;
  originalAmount: number;
  remainingAmount: number;
  weeklyPayment: number;
  weeksRemaining: number;
}

export interface LifetimeStatistics {
  weeksPlayed: number;
  totalSalaryEarned: number;
  totalTaxesPaid: number;
  totalLivingCosts: number;
  highestCash: number;
  highestNetWorth: number;
  largestStockGain: number;
  largestStockLoss: number;
  stocksPurchased: number;
  coursesCompleted: number;
  jobsWorked: number;
  weeksEmployed: number;
  weeksUnemployed: number;
  loansTaken: number;
  loansRepaid: number;
  totalRealizedProfitLoss: number;
  totalDividendsReceived: number;
}

export const INITIAL_STATISTICS: LifetimeStatistics = {
  weeksPlayed: 0,
  totalSalaryEarned: 0,
  totalTaxesPaid: 0,
  totalLivingCosts: 0,
  highestCash: 10000,
  highestNetWorth: 10000,
  largestStockGain: 0,
  largestStockLoss: 0,
  stocksPurchased: 0,
  coursesCompleted: 0,
  jobsWorked: 0,
  weeksEmployed: 0,
  weeksUnemployed: 0,
  loansTaken: 0,
  loansRepaid: 0,
  totalRealizedProfitLoss: 0,
  totalDividendsReceived: 0,
};

export interface WeekSummary {
  salaryEarned: number;
  rentPaid: number;
  utilityCost: number;
  foodCost: number;
  carCost: number;
  courseCost: number;
  loanPayments: number;
  stockChanges: { ticker: string; change: number }[];
  courseProgress: string | null;
  headline: string;
  newWeek: number;
  happiness: number;
  newAchievements: string[];
  isTaxWeek: boolean;
  taxAmount: number;
  earningsForTaxPeriod: number;
  inflationEvent: boolean;
  inflationRate: number;
  inflationMultiplier: number;
  salaryReduced: boolean;
  lifeEvent: TriggeredEvent | null;
  investmentResult: { name: string; invested: number; returned: number; success: boolean } | null;
  // Business summary
  businessTotalProfit: number;
  businessEvents: { businessName: string; eventTitle: string; icon: string }[];
  // Property summary
  propertyIncome: number;
  // Career summary
  careerRaise: boolean;
  careerPromotion: string | null;
  promotionBlockedReason: string | null;
  skillGains: Record<string, number>;
  // Market events
  marketSentimentName: string | null;
  marketEventTitle: string | null;
  // D20 performance event
  performanceEventResult: { roll: number; needed: number; success: boolean } | null;
  // Realized P/L this week
  realizedProfitLoss: number;
  // Dividends
  dividendIncome: number;
  // Part-time income
  partTimeIncome: number;
}

/** Yearly summary (every 20 weeks) - combines period report + tax */
export interface PeriodReport {
  fromWeek: number;
  toWeek: number;
  totalIncome: number;
  totalExpenses: number;
  totalTax: number;
  weeksEmployed: number;
  weeksUnemployed: number;
  jobChanges: number;
  coursesCompleted: number;
  stocksPurchased: number;
  loansTaken: number;
  loansRepaid: number;
  currentCash: number;
  currentNetWorth: number;
  currentHappiness: number;
  achievementsUnlocked: number;
  totalRealizedProfitLoss: number;
  totalUnrealizedProfitLoss: number;
  totalDividends: number;
}

/** Temporary happiness modifier (from events) */
export interface TempHappinessEffect {
  amount: number;
  weeksRemaining: number;
  source: string;
}

/** Pending opportunity investment */
export interface PendingInvestment {
  id: string;
  eventId: string;
  investmentId: string;
  amount: number;
  successChance: number;
  returnMultiplier: number;
  failReturnMultiplier: number;
  weeksRemaining: number;
}

/** Rarity tier for employees & candidates */
export type EmployeeTier = 'common' | 'rare' | 'epic' | 'legendary';

/** A small stat buff attached to an employee */
export interface EmployeeBuff {
  type: 'revenue' | 'expense' | 'morale' | 'productivity' | 'reputation';
  value: number; // magnitude — interpreted per type
  label: string; // display label
}

/** Business employee */
export interface BusinessEmployee {
  id: string;
  roleId: string;
  name: string;
  skill: number; // 1-100
  morale: number; // 1-100
  experience: number; // weeks in role/industry
  potential: number; // 1-100 - growth ceiling
  age: number;
  weeksEmployed: number;
  weeklySalary: number;
  inTrainingId?: string | null;
  trainingWeeksRemaining?: number;
  // D&D-style tier + buffs
  tier?: EmployeeTier;
  buffs?: EmployeeBuff[];
}

/** Candidate for hire (not yet employed) */
export interface EmployeeCandidate {
  id: string;
  roleId: string;
  name: string;
  skill: number;
  potential: number;
  experience: number;
  age: number;
  weeklySalary: number;
  archetype: 'young' | 'balanced' | 'veteran';
  tier?: EmployeeTier;
  buffs?: EmployeeBuff[];
}

/** Business timeline event */
export interface BusinessTimelineEntry {
  week: number;
  year: number;
  title: string;
  icon?: string;
  kind?: 'founded' | 'level' | 'project' | 'event' | 'hire' | 'season' | 'upgrade';
}

/** Active business project (marketing campaign, R&D, etc.) */
export interface ActiveBusinessProject {
  id: string;
  projectType: string; // 'marketing_campaign' | 'efficiency' | 'product_improvement' | etc.
  requiredRoleId: string;
  cost: number;
  weeksRemaining: number;
  totalWeeks: number;
  revenueMultiplier: number;
  expenseMultiplier: number;
  reputationBonus: number;
  succeeded: boolean;
  resolved: boolean;
  neededRoll?: number;
  actualRoll?: number;
  projectName?: string;
}

/** Detailed weekly expense breakdown */
export interface BusinessExpenseBreakdown {
  rent: number;
  salaries: number;
  cogs: number;
  utilities: number;
  marketing: number;
  insurance: number;
  maintenance: number;
  taxes: number;
  loanInterest: number;
  misc: number;
}

/** Business loan (separate from personal loans) */
export interface BusinessLoan {
  id: string;
  amount: number;
  remainingAmount: number;
  weeklyPayment: number;
  weeksRemaining: number;
  interestRate: number;
}

/** Active business event effect */
export interface ActiveBusinessEvent {
  eventId: string;
  revenueMultiplier: number;
  expenseMultiplier: number;
  weeksRemaining: number;
}

/** Owned business instance */
export interface OwnedBusiness {
  id: string; // unique instance id
  typeId: string; // references business_types.json
  name: string;
  foundedWeek: number;
  foundedYear: number;
  // Financials
  balance: number; // business bank account
  totalRevenue: number;
  totalExpenses: number;
  lastWeekRevenue: number;
  lastWeekExpenses: number;
  lastWeekProfit: number;
  // Status
  reputation: number; // 0-100
  level: number; // 0-7 index into levelThresholds
  valuation: number;
  /** Persistent percentage-point adjustment earned or lost through decisions. */
  marketShareModifier?: number;
  // Settings
  pricingStrategy: 'budget' | 'standard' | 'premium' | 'luxury';
  advertisingLevel: 'none' | 'basic' | 'moderate' | 'aggressive';
  // People
  employees: BusinessEmployee[];
  // Upgrades
  purchasedUpgrades: string[];
  activeUpgrade?: { upgradeId: string; weeksRemaining: number } | null;
  // Loans
  businessLoans: BusinessLoan[];
  // Active events
  activeEvents: ActiveBusinessEvent[];
  // History
  weeklyProfitHistory: number[];
  // NEW: candidate pool for pending hire
  pendingCandidates?: EmployeeCandidate[] | null;
  pendingCandidateRoleId?: string | null;
  // NEW: active business projects (marketing, efficiency, etc.)
  activeProjects?: ActiveBusinessProject[];
  // NEW: detailed expense breakdown for last week
  lastExpenseBreakdown?: BusinessExpenseBreakdown | null;
  // NEW: revenue history for market share chart
  weeklyRevenueHistory?: number[];
  // NEW: annual profit tracking for tax refund
  annualProfit?: number;
  annualProfitYear?: number;
  // NEW: pending retention events for player choice
  pendingRetention?: { employeeId: string; type: 'poach' | 'raise' | 'promotion' | 'training' } | null;
  // Recruit system (D&D style charges)
  freeRecruits?: number;        // remaining free recruit attempts (start=3)
  recruitCharges?: number;      // stored paid charges (max 5)
  recruitProgress?: number;     // weeks accrued toward next paid charge (0-5)
  // Business timeline
  timeline?: BusinessTimelineEntry[];
  lastBusinessEventWeek?: number;
  businessEventCooldowns?: Record<string, number>;
}

/** Triggered life event for display */
export interface TriggeredEvent {
  id: string;
  type: 'automatic' | 'choice' | 'opportunity';
  title: string;
  description: string;
  icon: string;
  category: string;
  businessId?: string;
  effects?: { cash?: number; happiness?: number };
  choices?: {
    text: string;
    cost?: number;
    cash?: number;
    happiness?: number;
    happinessDuration?: number;
    investmentId?: string;
    businessCash?: number;
    reputation?: number;
    marketShare?: number;
  }[];
  investmentOutcomes?: Record<string, {
    successChance: number;
    returnMultiplier: number;
    failReturnMultiplier: number;
    weeksToResolve: number;
  }>;
}

export interface GameState {
  playerName: string;
  week: number;
  year: number;
  age: number;
  cash: number;
  inflationMultiplier: number;
  currentHousingId: string;
  houseUpgrades: string[];
  housingHistory: string[];
  currentCarId: string;
  foodLevel: string;
  currentCourseId: string | null;
  courseWeeksCompleted: number;
  completedCourses: CompletedCourse[];
  currentJobId: string | null;
  careerHistory: CareerHistoryEntry[];
  totalWeeksWorked: number;
  stocks: StockState[];
  holdings: StockHolding[];
  loans: ActiveLoan[];
  happiness: number;
  netWorthHistory: number[];
  earningsSinceLastTax: number;
  lastTaxWeek: number;
  totalTaxPaid: number;
  unlockedAchievements: string[];
  statistics: LifetimeStatistics;
  currentHeadline: string;
  initialized: boolean;
  // Life events
  tempHappinessEffects: TempHappinessEffect[];
  pendingInvestments: PendingInvestment[];
  recentEventIds: string[]; // last 10 event IDs to avoid repeats
  // Business
  businesses: OwnedBusiness[];
  // Skills & Knowledge
  skills: Record<string, number>;
  knowledge: Record<string, number>;
  // Career v2
  career: CareerState;
  // Real Estate
  properties: OwnedProperty[];
  // Competitor AI
  competitors: Record<string, BusinessCompetitor[]>; // businessId → competitors
  // Market Sentiment & Events
  activeMarketSentiment: ActiveMarketSentiment | null;
  activeMarketEvents: ActiveMarketEvent[];
  // Realized P/L tracking
  totalRealizedProfitLoss: number;
  // News history (last ~40 headlines)
  newsHistory?: string[];
  // Part-time job flag (mutually exclusive with full career)
  partTimeJob?: boolean;
  adWatchedToday: number;
  adLastWatchDate: string; // YYYY-MM-DD
}

export const INITIAL_GAME_STATE: GameState = {
  playerName: 'Player',
  week: 1,
  year: 1,
  age: 20,
  cash: 10000,
  inflationMultiplier: 1.0,
  currentHousingId: 'cheap_apartment',
  houseUpgrades: [],
  housingHistory: ['cheap_apartment'],
  currentCarId: 'none',
  foodLevel: 'basic',
  currentCourseId: null,
  courseWeeksCompleted: 0,
  completedCourses: [],
  currentJobId: null,
  careerHistory: [],
  totalWeeksWorked: 0,
  stocks: [],
  holdings: [],
  loans: [],
  happiness: 30,
  netWorthHistory: [10000],
  earningsSinceLastTax: 0,
  lastTaxWeek: 0,
  totalTaxPaid: 0,
  unlockedAchievements: [],
  statistics: { ...INITIAL_STATISTICS },
  currentHeadline: 'Welcome to Life & Business Simulator!',
  initialized: true,
  tempHappinessEffects: [],
  pendingInvestments: [],
  recentEventIds: [],
  businesses: [],
  skills: {},
  knowledge: {},
  career: { ...INITIAL_CAREER_STATE },
  properties: [],
  competitors: {},
  activeMarketSentiment: null,
  activeMarketEvents: [],
  totalRealizedProfitLoss: 0,
  newsHistory: [],
  partTimeJob: false,
  adWatchedToday: 0,
  adLastWatchDate: '',
};

/** Player profile — persists prestige points and gems across all games/save slots */
export interface PlayerProfile {
  totalXp: number;
  gems: number;
  prestigePoints: number;
  unlockedPrestige: string[];
}

export const INITIAL_PROFILE: PlayerProfile = {
  totalXp: 0,
  gems: 0,
  prestigePoints: 0,
  unlockedPrestige: [],
};

/** Save slot metadata */
export interface SaveSlotMeta {
  playerName: string;
  week: number;
  year: number;
  age: number;
  cash: number;
  netWorth: number;
  lastSaved: number; // timestamp
}
