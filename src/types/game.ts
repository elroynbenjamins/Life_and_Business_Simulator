export interface CourseData {
  id: string;
  name: string;
  duration: number;
  cost: number;
}

export interface JobData {
  id: string;
  title: string;
  weeklySalary: number;
  requiredCourse: string;
}

export interface StockData {
  ticker: string;
  company: string;
  sector: string;
  startPrice: number;
}

export interface HousingData {
  id: string;
  name: string;
  weeklyRent: number;
  description: string;
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

export interface WeekSummary {
  salaryEarned: number;
  rentPaid: number;
  stockChanges: { ticker: string; change: number }[];
  courseProgress: string | null;
  headline: string;
  newWeek: number;
}

export interface GameState {
  playerName: string;
  week: number;
  year: number;
  age: number;
  cash: number;
  currentHousingId: string;
  currentJobId: string | null;
  currentCourseId: string | null;
  courseWeeksCompleted: number;
  completedCourses: CompletedCourse[];
  careerHistory: CareerHistoryEntry[];
  stocks: StockState[];
  holdings: StockHolding[];
  netWorthHistory: number[];
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
  currentJobId: null,
  currentCourseId: null,
  courseWeeksCompleted: 0,
  completedCourses: [],
  careerHistory: [],
  stocks: [],
  holdings: [],
  netWorthHistory: [10000],
  currentHeadline: 'Welcome to Life & Business Simulator!',
  initialized: true,
};
