import { GameState } from '../types/game';

/**
 * Step 2: Economy Update
 * Processes yearly inflation every 20 weeks.
 * Random rate: 1-5%. Compounds onto existing multiplier.
 * Display as yearly % (not cumulative).
 */
export interface EconomyResult {
  inflationMultiplier: number;
  inflationEvent: boolean;
  inflationRate: number; // This year's rate as decimal
}

export function processEconomy(state: GameState, newWeek: number): EconomyResult {
  const currentMultiplier = state?.inflationMultiplier ?? 1.0;

  // Inflation triggers every 20 weeks (yearly in our time system)
  const globalWeek = ((state?.year ?? 1) - 1) * 20 + newWeek;
  const isYearEnd = globalWeek > 0 && globalWeek % 20 === 0;

  if (isYearEnd) {
    // Random 1-5%
    const rates = [0.01, 0.02, 0.03, 0.04, 0.05];
    const rate = rates[Math.floor(Math.random() * rates.length)];
    const newMultiplier = Math.round((currentMultiplier * (1 + rate)) * 10000) / 10000;
    return { inflationMultiplier: newMultiplier, inflationEvent: true, inflationRate: rate };
  }

  return { inflationMultiplier: currentMultiplier, inflationEvent: false, inflationRate: 0 };
}

/**
 * Apply inflation to a base value.
 * Always use: baseValue * inflationMultiplier
 */
export function inflated(baseValue: number, multiplier: number): number {
  return Math.round(baseValue * (multiplier ?? 1));
}
