import { GameState, StockState, StockHolding } from '../types/game';
import housingData from '../data/housing.json';
import jobsData from '../data/jobs.json';

export function getWeeklySalary(state: GameState): number {
  if (!state?.currentJobId) return 0;
  const job = (jobsData ?? []).find((j) => j?.id === state.currentJobId);
  return job?.weeklySalary ?? 0;
}

export function getWeeklyRent(state: GameState): number {
  const housing = (housingData ?? []).find((h) => h?.id === state?.currentHousingId);
  return housing?.weeklyRent ?? 150;
}

export function getPortfolioValue(stocks: StockState[], holdings: StockHolding[]): number {
  return (holdings ?? []).reduce((total, h) => {
    const stock = (stocks ?? []).find((s) => s?.ticker === h?.ticker);
    return total + (h?.shares ?? 0) * (stock?.currentPrice ?? 0);
  }, 0);
}

export function getNetWorth(state: GameState): number {
  const portfolioValue = getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  return (state?.cash ?? 0) + portfolioValue;
}
