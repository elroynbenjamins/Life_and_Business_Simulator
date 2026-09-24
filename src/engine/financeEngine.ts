import { GameState, StockState, StockHolding, ActiveLoan } from '../types/game';
import { getPlayerOwnershipPct } from './businessEngine';
import { getBusinessDebtPrincipal } from './businessDebtEngine';
import { inflated } from './economyEngine';
import housingData from '../data/housing.json';
import jobsData from '../data/jobs.json';
import carsData from '../data/cars.json';
import coursesData from '../data/courses.json';
import { FULL_TIME_BASE_SALARY_INCREASE } from '../constants/balance';

// Static game data never changes at runtime. Index it once instead of scanning the
// JSON arrays several times during every weekly tick and screen render.
const jobsById = new Map((jobsData ?? []).map((job) => [job.id, job]));
const housingById = new Map((housingData ?? []).map((housing) => [housing.id, housing]));
const carsById = new Map((carsData ?? []).map((car) => [car.id, car]));
const coursesById = new Map((coursesData ?? []).map((course) => [course.id, course]));

/**
 * Step 8: Income Collection
 * Returns total weekly income (salary). Inflation applied to salary.
 * If player is doing an advanced (level 2) or expert (level 3) course,
 * salary is reduced by 20% (study takes 8 hours/week).
 */
export function getWeeklySalary(state: GameState): number {
  if (!state?.currentJobId) return 0;
  const job = jobsById.get(state.currentJobId);
  let salary = inflated((job?.weeklySalary ?? 0) + FULL_TIME_BASE_SALARY_INCREASE, state?.inflationMultiplier ?? 1);
  const level = job?.level ?? 0;
  salary = Math.round(salary * (level >= 1 && level <= 2 ? 1.03 : level === 3 ? 1.02 : level === 4 ? 1.01 : 1));
  // Reduce salary by 20% when doing advanced/expert course
  if (state?.currentCourseId) {
    const course = coursesById.get(state.currentCourseId);
    if ((course?.level ?? 1) >= 2) {
      salary = Math.round(salary * 0.8);
    }
  }
  return salary;
}

/** Check if salary is currently reduced due to studying */
export function isSalaryReduced(state: GameState): boolean {
  if (!state?.currentJobId || !state?.currentCourseId) return false;
  const course = coursesById.get(state.currentCourseId);
  return (course?.level ?? 1) >= 2;
}

/**
 * Step 9: Expense helpers. All apply inflation to base values.
 */
export function getWeeklyRent(state: GameState): number {
  const housing = state?.currentHousingId ? housingById.get(state.currentHousingId) : undefined;
  return inflated(housing?.weeklyRent ?? 150, state?.inflationMultiplier ?? 1);
}

export function getWeeklyUtilityCost(state: GameState): number {
  return Math.round(getWeeklyRent(state) * 0.15);
}

export function getWeeklyCarCost(state: GameState): number {
  const car = state?.currentCarId ? carsById.get(state.currentCarId) : undefined;
  return inflated(car?.weeklyCost ?? 0, state?.inflationMultiplier ?? 1);
}

export function getWeeklyFoodCost(state: GameState): number {
  const legacyJob = state?.currentJobId ? jobsById.get(state.currentJobId) : undefined;
  const jobLevel = state?.career?.companyId
    ? Math.max(1, state.career.positionLevel ?? 1)
    : Math.max(1, legacyJob?.level ?? 1);
  return inflated(50 + (jobLevel - 1) * 25, state?.inflationMultiplier ?? 1);
}

export function getWeeklyCourseCost(state: GameState): number {
  if (!state?.currentCourseId) return 0;
  const course = coursesById.get(state.currentCourseId);
  return inflated(course?.weeklyCost ?? 0, state?.inflationMultiplier ?? 1);
}

export function getWeeklyLoanPayments(state: GameState): number {
  return (state?.loans ?? []).reduce((total, loan) => total + (loan?.weeklyPayment ?? 0), 0);
}

export function getTotalWeeklyExpenses(state: GameState): number {
  return getWeeklyRent(state) + getWeeklyUtilityCost(state) + getWeeklyCarCost(state) + getWeeklyFoodCost(state) + getWeeklyCourseCost(state) + getWeeklyLoanPayments(state);
}

/**
 * Collect income for the week.
 */
export interface IncomeResult {
  salary: number;
}
export function processIncome(state: GameState): IncomeResult {
  return { salary: getWeeklySalary(state) };
}

/**
 * Collect expenses for the week.
 */
export interface ExpenseResult {
  rent: number;
  utilityCost: number;
  carCost: number;
  foodCost: number;
  courseCost: number;
  loanPayments: number;
  totalExpenses: number;
}
export function processExpenses(state: GameState): ExpenseResult {
  const rent = getWeeklyRent(state);
  const utilityCost = getWeeklyUtilityCost(state);
  const carCost = getWeeklyCarCost(state);
  const foodCost = getWeeklyFoodCost(state);
  const courseCost = getWeeklyCourseCost(state);
  const loanPayments = getWeeklyLoanPayments(state);
  return {
    rent, utilityCost, carCost, foodCost, courseCost, loanPayments,
    totalExpenses: rent + utilityCost + carCost + foodCost + courseCost + loanPayments,
  };
}

/**
 * Step 10: Loan Processing
 */
export function processLoans(state: GameState): { loans: ActiveLoan[]; totalPaid: number; loansRepaid: number } {
  let totalPaid = 0;
  let loansRepaid = 0;
  const newLoans: ActiveLoan[] = [];
  for (const loan of state?.loans ?? []) {
    const payment = loan?.weeklyPayment ?? 0;
    totalPaid += payment;
    const remaining = (loan?.remainingAmount ?? 0) - payment;
    const weeksLeft = (loan?.weeksRemaining ?? 1) - 1;
    if (weeksLeft > 0 && remaining > 0) {
      newLoans.push({ ...loan, remainingAmount: Math.max(0, remaining), weeksRemaining: weeksLeft });
    } else {
      loansRepaid += 1;
    }
  }
  return { loans: newLoans, totalPaid, loansRepaid };
}

/**
 * Step 11: Tax calculation
 */
export function calculateTax(earnings: number, inflationMultiplier = 1, jobLevel = 0): number {
  if (earnings <= 0) return 0;
  const lowerThreshold = 5000 * Math.max(1, inflationMultiplier);
  const upperThreshold = 15000 * Math.max(1, inflationMultiplier);
  let tax = 0;
  if (earnings <= lowerThreshold) {
    tax = earnings * 0.15;
  } else if (earnings <= upperThreshold) {
    tax = lowerThreshold * 0.15 + (earnings - lowerThreshold) * 0.25;
  } else {
    tax = lowerThreshold * 0.15 + (upperThreshold - lowerThreshold) * 0.25 + (earnings - upperThreshold) * 0.35;
  }
  const reduction = jobLevel >= 1 && jobLevel <= 2 ? 0.03 : jobLevel === 3 ? 0.02 : jobLevel === 4 ? 0.01 : 0;
  return Math.round(Math.max(0, tax - earnings * reduction));
}

export interface TaxResult {
  isTaxWeek: boolean;
  taxAmount: number;
  earningsForPeriod: number;
  newEarningsSinceLastTax: number;
}
export function processTaxes(state: GameState, salary: number, currentWeek: number): TaxResult {
  let earningsSinceLastTax = (state?.earningsSinceLastTax ?? 0) + salary;
  const isTaxWeek = currentWeek % 20 === 0 && currentWeek > 0;
  let taxAmount = 0;
  let earningsForPeriod = 0;
  if (isTaxWeek) {
    earningsForPeriod = earningsSinceLastTax;
    const jobLevel = state.career?.companyId ? state.career.positionLevel : jobsById.get(state.currentJobId ?? '')?.level ?? 0;
    taxAmount = calculateTax(earningsSinceLastTax, state?.inflationMultiplier ?? 1, jobLevel);
    earningsSinceLastTax = 0;
  }
  return { isTaxWeek, taxAmount, earningsForPeriod, newEarningsSinceLastTax: earningsSinceLastTax };
}

/**
 * Portfolio and net worth helpers (no inflation needed — already in current prices).
 */
export function getPortfolioValue(stocks: StockState[], holdings: StockHolding[]): number {
  const pricesByTicker = new Map((stocks ?? []).map((stock) => [stock?.ticker, stock?.currentPrice ?? 0]));
  return (holdings ?? []).reduce((total, h) => {
    return total + (h?.shares ?? 0) * (pricesByTicker.get(h?.ticker) ?? 0);
  }, 0);
}

/** Current paper profit/loss for all open positions, based on weighted average purchase prices. */
export function getUnrealizedProfitLoss(stocks: StockState[], holdings: StockHolding[]): number {
  const pricesByTicker = new Map((stocks ?? []).map((stock) => [stock?.ticker, stock?.currentPrice ?? 0]));
  return (holdings ?? []).reduce((total, holding) => {
    const price = pricesByTicker.get(holding?.ticker);
    if (price === undefined) return total;
    return total + (holding?.shares ?? 0) * (price - (holding?.avgBuyPrice ?? 0));
  }, 0);
}

export function getNetWorth(state: GameState): number {
  const portfolioValue = getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  const loanDebt = (state?.loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  const lockedDeposits = (state?.bankDeposits ?? []).reduce((total, deposit) => total + (deposit?.amount ?? 0), 0);
  // Business values
  // Valuation already includes available business cash.
  const businessValue = (state?.businesses ?? []).reduce((t, b) => t + (b?.valuation ?? 0) * (getPlayerOwnershipPct(b) / 100), 0);
  const businessLoanDebt = (state?.businesses ?? []).reduce((t, b) => {
    return t + getBusinessDebtPrincipal(b) * (getPlayerOwnershipPct(b) / 100);
  }, 0);
  // Cash parked inside holding companies remains part of the player's net worth.
  const holdingCash = (state?.holdingCompanies ?? []).reduce((total, holding) => total + Math.max(0, holding?.cashReserve ?? 0), 0);
  // Property values
  const propertyValue = (state?.properties ?? []).reduce((t, p) => t + (p?.currentValue ?? 0), 0);
  // Relationship/legal obligations are real liabilities once incurred.
  const relationshipDebt = (state?.relationshipState?.financialObligations ?? [])
    .reduce((total, obligation) => total + (obligation?.remainingAmount ?? 0), 0);
  return (state?.cash ?? 0) + holdingCash + lockedDeposits + portfolioValue + businessValue + propertyValue - loanDebt - businessLoanDebt - relationshipDebt;
}
