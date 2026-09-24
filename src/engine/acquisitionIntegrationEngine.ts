import {
  AcquisitionIntegrationOutcome,
  AcquisitionIntegrationStrategy,
} from '../types/game';

export type ActiveAcquisitionIntegrationStrategy = Exclude<AcquisitionIntegrationStrategy, 'pending'>;
export type ResolvedAcquisitionIntegrationOutcome = Exclude<AcquisitionIntegrationOutcome, 'pending'>;

export interface AcquisitionIntegrationOutcomeProbabilities {
  success: number;
  mixed: number;
  failed: number;
}

export interface AcquisitionIntegrationOutcomeEffect {
  revenueBonus: number;
  expenseReduction: number;
  reputationDelta: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function getAcquisitionIntegrationOutcomeProbabilities(
  strategy: ActiveAcquisitionIntegrationStrategy,
  successChance: number,
): AcquisitionIntegrationOutcomeProbabilities {
  if (strategy === 'independent') {
    return { success: 1, mixed: 0, failed: 0 };
  }

  const success = clamp01(successChance);
  const unresolved = Math.max(0, 1 - success);
  // Standard integration usually lands in a workable middle state when it
  // misses the success target; aggressive turnaround has a larger failure tail.
  const mixedShareOfMiss = strategy === 'integrate' ? 0.70 : 0.45;
  const mixed = unresolved * mixedShareOfMiss;
  const failed = Math.max(0, unresolved - mixed);

  return { success, mixed, failed };
}

export function resolveAcquisitionIntegrationOutcome(
  strategy: ActiveAcquisitionIntegrationStrategy,
  successChance: number,
  roll: number,
): ResolvedAcquisitionIntegrationOutcome {
  const probabilities = getAcquisitionIntegrationOutcomeProbabilities(strategy, successChance);
  const normalizedRoll = Math.max(0, Math.min(0.999999, roll));
  if (normalizedRoll < probabilities.success) return 'success';
  if (normalizedRoll < probabilities.success + probabilities.mixed) return 'mixed';
  return 'failed';
}

export function getAcquisitionIntegrationHoldingSynergyFactor(
  strategy: AcquisitionIntegrationStrategy,
  outcome: AcquisitionIntegrationOutcome,
): number {
  if (strategy === 'pending') return 0.25;
  if (strategy === 'independent') return 0.50;
  if (outcome === 'pending') return 0.60;
  if (outcome === 'failed') return 0.65;
  if (outcome === 'mixed') return 0.85;
  return 1;
}

export function getAcquisitionIntegrationOutcomeEffect(
  strategy: ActiveAcquisitionIntegrationStrategy,
  outcome: ResolvedAcquisitionIntegrationOutcome,
): AcquisitionIntegrationOutcomeEffect {
  if (strategy === 'independent') {
    return { revenueBonus: 0, expenseReduction: 0, reputationDelta: 0 };
  }

  if (strategy === 'integrate') {
    if (outcome === 'success') {
      return { revenueBonus: 0.015, expenseReduction: 0.02, reputationDelta: 2 };
    }
    if (outcome === 'mixed') {
      return { revenueBonus: 0.005, expenseReduction: 0.01, reputationDelta: 0 };
    }
    return { revenueBonus: 0, expenseReduction: -0.005, reputationDelta: -2 };
  }

  if (outcome === 'success') {
    return { revenueBonus: 0.04, expenseReduction: 0.04, reputationDelta: 4 };
  }
  if (outcome === 'mixed') {
    return { revenueBonus: 0.015, expenseReduction: 0.015, reputationDelta: -1 };
  }
  return { revenueBonus: -0.02, expenseReduction: -0.02, reputationDelta: -5 };
}
