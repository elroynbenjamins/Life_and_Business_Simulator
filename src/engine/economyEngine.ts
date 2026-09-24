import { ActiveMacroCrash, EconomicCyclePhase, EconomicCycleState, GameState } from '../types/game';

export interface EconomyResult {
  inflationMultiplier: number;
  inflationEvent: boolean;
  inflationRate: number;
  crashEvent: { title: string; inflationReduction: number; stockShock: number; isAftershock?: boolean; weeksRemaining?: number; totalWeeks?: number } | null;
  activeMacroCrash: ActiveMacroCrash | null;
  crashStarted: boolean;
  economicCycle: EconomicCycleState;
  businessRevenueMultiplier: number;
  stockDrift: number;
  propertyIncomeMultiplier: number;
  interestRateModifier: number;
}

const CYCLE_ORDER: EconomicCyclePhase[] = ['expansion', 'boom', 'slowdown', 'recession', 'recovery'];

const CYCLE_RANGES: Record<EconomicCyclePhase, [number, number]> = {
  expansion: [12, 20],
  boom: [6, 12],
  slowdown: [8, 14],
  recession: [6, 12],
  recovery: [8, 14],
};

const CYCLE_EFFECTS: Record<EconomicCyclePhase, {
  businessRevenueMultiplier: number;
  stockDrift: number;
  propertyIncomeMultiplier: number;
  interestRateModifier: number;
}> = {
  expansion: { businessRevenueMultiplier: 1.04, stockDrift: 0.004, propertyIncomeMultiplier: 1.02, interestRateModifier: 0.005 },
  boom: { businessRevenueMultiplier: 1.08, stockDrift: 0.008, propertyIncomeMultiplier: 1.05, interestRateModifier: 0.0125 },
  slowdown: { businessRevenueMultiplier: 0.98, stockDrift: -0.002, propertyIncomeMultiplier: 0.99, interestRateModifier: 0.005 },
  recession: { businessRevenueMultiplier: 0.90, stockDrift: -0.010, propertyIncomeMultiplier: 0.94, interestRateModifier: -0.005 },
  recovery: { businessRevenueMultiplier: 1.02, stockDrift: 0.003, propertyIncomeMultiplier: 1.01, interestRateModifier: -0.0025 },
};

function rollCycleDuration(phase: EconomicCyclePhase): number {
  const [min, max] = CYCLE_RANGES[phase];
  return min + Math.floor(Math.random() * (max - min + 1));
}

function advanceEconomicCycle(
  current: EconomicCycleState | null | undefined,
  globalWeek: number,
): EconomicCycleState {
  const fallback: EconomicCycleState = {
    phase: 'expansion',
    weeksRemaining: 12,
    totalWeeks: 12,
    startedGlobalWeek: Math.max(1, globalWeek),
  };
  const active = current ?? fallback;
  if ((active.weeksRemaining ?? 0) > 1) {
    return { ...active, weeksRemaining: active.weeksRemaining - 1 };
  }

  const index = CYCLE_ORDER.indexOf(active.phase);
  const nextPhase = CYCLE_ORDER[(index + 1 + CYCLE_ORDER.length) % CYCLE_ORDER.length];
  const duration = rollCycleDuration(nextPhase);
  return {
    phase: nextPhase,
    weeksRemaining: duration,
    totalWeeks: duration,
    startedGlobalWeek: globalWeek,
  };
}

/**
 * Economy update.
 * 20 weeks = one game year. Inflation remains annual, while the macro cycle moves
 * on a slower multi-week cadence and feeds the rest of the simulation.
 */
export function processEconomy(state: GameState, newWeek: number): EconomyResult {
  const currentMultiplier = state?.inflationMultiplier ?? 1.0;
  const globalWeek = ((state?.year ?? 1) - 1) * 20 + newWeek;
  const economicCycle = advanceEconomicCycle(state?.economicCycle, globalWeek);
  const cycleEffects = CYCLE_EFFECTS[economicCycle.phase];

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
      economicCycle,
      ...cycleEffects,
    };
  }

  const isYearEnd = globalWeek > 0 && globalWeek % 20 === 0;
  if (isYearEnd) {
    const lastCrashWeek = state?.lastMacroCrashWeek ?? 0;
    const cooldownPassed = globalWeek - lastCrashWeek >= 60;
    const inflationPressure = Math.max(0, currentMultiplier - 1.10);
    const cycleCrashPressure = economicCycle.phase === 'slowdown' ? 0.025 : economicCycle.phase === 'recession' ? 0.04 : 0;
    const crashChance = Math.min(0.24, 0.05 + inflationPressure * 0.9 + cycleCrashPressure);
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
        economicCycle: economicCycle.phase === 'recession'
          ? economicCycle
          : { phase: 'recession', weeksRemaining: Math.max(6, totalWeeks + 4), totalWeeks: Math.max(6, totalWeeks + 4), startedGlobalWeek: globalWeek },
        ...CYCLE_EFFECTS.recession,
      };
    }

    const phaseInflationBias = economicCycle.phase === 'boom' ? 0.01 : economicCycle.phase === 'recession' ? -0.005 : 0;
    const rates = [0.01, 0.02, 0.03, 0.04, 0.05];
    const rate = Math.max(0, rates[Math.floor(Math.random() * rates.length)] + phaseInflationBias);
    const newMultiplier = Math.round((currentMultiplier * (1 + rate)) * 10000) / 10000;
    return {
      inflationMultiplier: newMultiplier,
      inflationEvent: true,
      inflationRate: rate,
      crashEvent: null,
      activeMacroCrash: null,
      crashStarted: false,
      economicCycle,
      ...cycleEffects,
    };
  }

  return {
    inflationMultiplier: currentMultiplier,
    inflationEvent: false,
    inflationRate: 0,
    crashEvent: null,
    activeMacroCrash: null,
    crashStarted: false,
    economicCycle,
    ...cycleEffects,
  };
}

export function inflated(baseValue: number, multiplier: number): number {
  return Math.round(baseValue * (multiplier ?? 1));
}

export function getEconomicCycleEffects(phase: EconomicCyclePhase) {
  return CYCLE_EFFECTS[phase];
}
