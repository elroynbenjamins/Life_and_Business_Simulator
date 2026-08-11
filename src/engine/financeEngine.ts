import { GameState, StockState, StockHolding, ActiveLoan } from '../types/game';
import { inflated } from './economyEngine';
import housingData from '../data/housing.json';
import jobsData from '../data/jobs.json';
import carsData from '../data/cars.json';
import foodData from '../data/food.json';
import coursesData from '../data/courses.json';

/**
 * Step 8: Income Collection
 * Returns total weekly income (salary). Inflation applied to salary.
 * If player is doing an advanced (level 2) or expert (level 3) course,
 * salary is reduced by 20% (study takes 8 hours/week).
 */
export function getWeeklySalary(state: GameState): number {
  if (!state?.currentJobId) return 0;
  const job = (jobsData ?? []).find((j) => j?.id === state.currentJobId);
  let salary = inflated(job?.weeklySalary ?? 0, state?.inflationMultiplier ?? 1);
  // Reduce salary by 20% when doing advanced/expert course
  if (state?.currentCourseId) {
    const course = (coursesData ?? []).find((c) => c?.id === state.currentCourseId);
    if ((course?.level ?? 1) >= 2) {
      salary = Math.round(salary * 0.8);
    }
  }
  return salary;
}

/** Check if salary is currently reduced due to studying */
export function isSalaryReduced(state: GameState): boolean {
  if (!state?.currentJobId || !state?.currentCourseId) return false;
  const course = (coursesData ?? []).find((c) => c?.id === state.currentCourseId);
  return (course?.level ?? 1) >= 2;
}

/**
 * Step 9: Expense helpers. All apply inflation to base values.
 */
export function getWeeklyRent(state: GameState): number {
  const housing = (housingData ?? []).find((h) => h?.id === state?.currentHousingId);
  return inflated(housing?.weeklyRent ?? 150, state?.inflationMultiplier ?? 1);
}

export function getWeeklyUtilityCost(state: GameState): number {
  return Math.round(getWeeklyRent(state) * 0.15);
}

export function getWeeklyCarCost(state: GameState): number {
  const car = (carsData ?? []).find((c) => c?.id === state?.currentCarId);
  return inflated(car?.weeklyCost ?? 0, state?.inflationMultiplier ?? 1);
}

export function getWeeklyFoodCost(state: GameState): number {
  const food = (foodData ?? []).find((f) => f?.id === state?.foodLevel);
  return inflated(food?.weeklyCost ?? 50, state?.inflationMultiplier ?? 1);
}

export function getWeeklyCourseCost(state: GameState): number {
  if (!state?.currentCourseId) return 0;
  const course = (coursesData ?? []).find((c) => c?.id === state.currentCourseId);
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
export function calculateTax(earnings: number): number {
  if (earnings <= 0) return 0;
  let tax = 0;
  if (earnings <= 5000) {
    tax = earnings * 0.15;
  } else if (earnings <= 15000) {
    tax = 5000 * 0.15 + (earnings - 5000) * 0.25;
  } else {
    tax = 5000 * 0.15 + 10000 * 0.25 + (earnings - 15000) * 0.35;
  }
  return Math.round(tax);
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
    taxAmount = calculateTax(earningsSinceLastTax);
    earningsSinceLastTax = 0;
  }
  return { isTaxWeek, taxAmount, earningsForPeriod, newEarningsSinceLastTax: earningsSinceLastTax };
}

/**
 * Portfolio and net worth helpers (no inflation needed — already in current prices).
 */
export function getPortfolioValue(stocks: StockState[], holdings: StockHolding[]): number {
  return (holdings ?? []).reduce((total, h) => {
    const stock = (stocks ?? []).find((s) => s?.ticker === h?.ticker);
    return total + (h?.shares ?? 0) * (stock?.currentPrice ?? 0);
  }, 0);
}

/** Current paper profit/loss for all open positions, based on weighted average purchase prices. */
export function getUnrealizedProfitLoss(stocks: StockState[], holdings: StockHolding[]): number {
  return (holdings ?? []).reduce((total, holding) => {
    const stock = (stocks ?? []).find((candidate) => candidate?.ticker === holding?.ticker);
    if (!stock) return total;
    return total + (holding?.shares ?? 0) * ((stock?.currentPrice ?? 0) - (holding?.avgBuyPrice ?? 0));
  }, 0);
}

export function getNetWorth(state: GameState): number {
  const portfolioValue = getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  const loanDebt = (state?.loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  // Business values
  // Valuation already includes available business cash.
  const businessValue = (state?.businesses ?? []).reduce((t, b) => t + (b?.valuation ?? 0), 0);
  const businessLoanDebt = (state?.businesses ?? []).reduce((t, b) => {
    return t + (b?.businessLoans ?? []).reduce((lt, l) => lt + (l?.remainingAmount ?? 0), 0);
  }, 0);
  // Property values
  const propertyValue = (state?.properties ?? []).reduce((t, p) => t + (p?.currentValue ?? 0), 0);
  return (state?.cash ?? 0) + portfolioValue + businessValue + propertyValue - loanDebt - businessLoanDebt;
}
