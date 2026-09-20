import { ActiveMacroCrash, GameState } from '../types/game';

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
  crashEvent: { title: string; inflationReduction: number; stockShock: number; isAftershock?: boolean; weeksRemaining?: number; totalWeeks?: number } | null;
  activeMacroCrash: ActiveMacroCrash | null;
  crashStarted: boolean;
}

export function processEconomy(state: GameState, newWeek: number): EconomyResult {
  const currentMultiplier = state?.inflationMultiplier ?? 1.0;

  // Some recessions unfold over several weekly market waves. The total decline
  // is chosen when the recession starts and divided into equal compounded shocks.
  const activeCrash = state?.activeMacroCrash ?? null;
  if (activeCrash && activeCrash.weeksRemaining > 0) {
    const nextWeeksRemaining = activeCrash.weeksRemaining - 1;
    const wave = activeCrash.totalWeeks - activeCrash.weeksRemaining + 1;
    return {
      inflationMultiplier: currentMultiplier,
      inflationEvent: false,
      inflationRate: 0,
      crashEvent: {
        title: `${activeCrash.title} — Wave ${wave}/${activeCrash.totalWeeks}`,
        inflationReduction: 0,
        stockShock: activeCrash.weeklyStockShock,
        isAftershock: true,
        weeksRemaining: nextWeeksRemaining,
        totalWeeks: activeCrash.totalWeeks,
      },
      activeMacroCrash: nextWeeksRemaining > 0 ? { ...activeCrash, weeksRemaining: nextWeeksRemaining } : null,
      crashStarted: false,
    };
  }

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
      const totalStockShock = 0.10 + Math.random() * 0.12;
      const spreadsOverTime = Math.random() < 0.45;
      const totalWeeks = spreadsOverTime ? 3 + Math.floor(Math.random() * 4) : 1;
      const stockShock = Math.pow(1 - totalStockShock, 1 / totalWeeks) - 1;
      const nextActiveCrash: ActiveMacroCrash | null = totalWeeks > 1 ? {
        title: 'Major Economic Recession',
        weeksRemaining: totalWeeks - 1,
        totalWeeks,
        weeklyStockShock: stockShock,
      } : null;
      return {
        inflationMultiplier: correctedMultiplier,
        inflationEvent: false,
        inflationRate: 0,
        crashEvent: {
          title: totalWeeks > 1 ? `Major Economic Recession — Wave 1/${totalWeeks}` : 'Major Economic Recession',
          inflationReduction: actualReduction,
          stockShock,
          weeksRemaining: totalWeeks - 1,
          totalWeeks,
        },
        activeMacroCrash: nextActiveCrash,
        crashStarted: true,
      };
    }

    // Normal annual inflation: 1-5%.
    const rates = [0.01, 0.02, 0.03, 0.04, 0.05];
    const rate = rates[Math.floor(Math.random() * rates.length)];
    const newMultiplier = Math.round((currentMultiplier * (1 + rate)) * 10000) / 10000;
    return { inflationMultiplier: newMultiplier, inflationEvent: true, inflationRate: rate, crashEvent: null, activeMacroCrash: null, crashStarted: false };
  }

  return { inflationMultiplier: currentMultiplier, inflationEvent: false, inflationRate: 0, crashEvent: null, activeMacroCrash: null, crashStarted: false };
}

/**
 * Apply inflation to a base value.
 * Always use: baseValue * inflationMultiplier
 */
export function inflated(baseValue: number, multiplier: number): number {
  return Math.round(baseValue * (multiplier ?? 1));
}
