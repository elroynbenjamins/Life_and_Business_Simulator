import { GameState, StockState, StockHolding } from '../types/game';
import housingData from '../data/housing.json';
import jobsData from '../data/jobs.json';
import carsData from '../data/cars.json';
import foodData from '../data/food.json';
import coursesData from '../data/courses.json';

export function getWeeklySalary(state: GameState): number {
  if (!state?.currentJobId) return 0;
  const job = (jobsData ?? []).find((j) => j?.id === state.currentJobId);
  return job?.weeklySalary ?? 0;
}

export function getWeeklyRent(state: GameState): number {
  const housing = (housingData ?? []).find((h) => h?.id === state?.currentHousingId);
  return housing?.weeklyRent ?? 150;
}

export function getWeeklyCarCost(state: GameState): number {
  const car = (carsData ?? []).find((c) => c?.id === state?.currentCarId);
  return car?.weeklyCost ?? 0;
}

export function getWeeklyFoodCost(state: GameState): number {
  const food = (foodData ?? []).find((f) => f?.id === state?.foodLevel);
  return food?.weeklyCost ?? 50;
}

export function getWeeklyCourseCost(state: GameState): number {
  if (!state?.currentCourseId) return 0;
  const course = (coursesData ?? []).find((c) => c?.id === state.currentCourseId);
  return course?.weeklyCost ?? 0;
}

export function getWeeklyLoanPayments(state: GameState): number {
  return (state?.loans ?? []).reduce((total, loan) => total + (loan?.weeklyPayment ?? 0), 0);
}

export function getTotalWeeklyExpenses(state: GameState): number {
  return getWeeklyRent(state) + getWeeklyCarCost(state) + getWeeklyFoodCost(state) + getWeeklyCourseCost(state) + getWeeklyLoanPayments(state);
}

export function getPortfolioValue(stocks: StockState[], holdings: StockHolding[]): number {
  return (holdings ?? []).reduce((total, h) => {
    const stock = (stocks ?? []).find((s) => s?.ticker === h?.ticker);
    return total + (h?.shares ?? 0) * (stock?.currentPrice ?? 0);
  }, 0);
}

export function getNetWorth(state: GameState): number {
  const portfolioValue = getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  const loanDebt = (state?.loans ?? []).reduce((t, l) => t + (l?.remainingAmount ?? 0), 0);
  return (state?.cash ?? 0) + portfolioValue - loanDebt;
}

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
