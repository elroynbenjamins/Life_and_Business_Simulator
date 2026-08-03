export interface CourseData {
  id: string;
  baseId: string;
  name: string;
  level: number;
  duration: number;
  cost: number;
  weeklyCost: number;
  prerequisite: string | null;
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

export interface WeekSummary {
  salaryEarned: number;
  rentPaid: number;
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
}

export interface GameState {
  playerName: string;
  week: number;
  year: number;
  age: number;
  cash: number;
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
  currentHeadline: string;
  initialized: boolean;
}

export const INITIAL_GAME_STATE: GameState = {
  playerName: 'Player',
  week: 1,
  year: 1,
  age: 22,
  cash: 10000,
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
  currentHeadline: 'Welcome to Life & Business Simulator!',
  initialized: true,
};
