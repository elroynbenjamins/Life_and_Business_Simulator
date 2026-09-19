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
  crashEvent: { title: string; inflationReduction: number; stockShock: number } | null;
}

export function processEconomy(state: GameState, newWeek: number): EconomyResult {
  const currentMultiplier = state?.inflationMultiplier ?? 1.0;

  // Inflation triggers every 20 weeks (yearly in our time system)
  const globalWeek = ((state?.year ?? 1) - 1) * 20 + newWeek;
  const isYearEnd = globalWeek > 0 && globalWeek % 20 === 0;

  if (isYearEnd) {
    // Rare macro crash: only becomes possible after meaningful cumulative inflation,
    // has a three-year cooldown, and can never push the price index below 1.00.
    const lastCrashWeek = state?.lastMacroCrashWeek ?? 0;
    const cooldownPassed = globalWeek - lastCrashWeek >= 60;
    const inflationPressure = Math.max(0, currentMultiplier - 1.10);
    const crashChance = Math.min(0.22, 0.06 + inflationPressure * 0.9);
    const shouldCrash = currentMultiplier >= 1.12 && cooldownPassed && Math.random() < crashChance;

    if (shouldCrash) {
      const reductions = [0.04, 0.06, 0.08, 0.10, 0.12];
      const reduction = reductions[Math.floor(Math.random() * reductions.length)];
      const correctedMultiplier = Math.max(1, Math.round((currentMultiplier * (1 - reduction)) * 10000) / 10000);
      const actualReduction = 1 - correctedMultiplier / currentMultiplier;
      const stockShock = -(0.10 + Math.random() * 0.12);
      return {
        inflationMultiplier: correctedMultiplier,
        inflationEvent: false,
        inflationRate: 0,
        crashEvent: {
          title: 'Major Economic Recession',
          inflationReduction: actualReduction,
          stockShock,
        },
      };
    }

    // Normal annual inflation: 1-5%.
    const rates = [0.01, 0.02, 0.03, 0.04, 0.05];
    const rate = rates[Math.floor(Math.random() * rates.length)];
    const newMultiplier = Math.round((currentMultiplier * (1 + rate)) * 10000) / 10000;
    return { inflationMultiplier: newMultiplier, inflationEvent: true, inflationRate: rate, crashEvent: null };
  }

  return { inflationMultiplier: currentMultiplier, inflationEvent: false, inflationRate: 0, crashEvent: null };
}

/**
 * Apply inflation to a base value.
 * Always use: baseValue * inflationMultiplier
 */
export function inflated(baseValue: number, multiplier: number): number {
  return Math.round(baseValue * (multiplier ?? 1));
}
