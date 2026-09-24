import {
  getAcquisitionIntegrationHoldingSynergyFactor,
  getAcquisitionIntegrationOutcomeEffect,
  getAcquisitionIntegrationOutcomeProbabilities,
  resolveAcquisitionIntegrationOutcome,
} from '../acquisitionIntegrationEngine';

describe('acquisition integration outcomes', () => {
  test('independent integration is deterministic and has no permanent operating effect', () => {
    expect(getAcquisitionIntegrationOutcomeProbabilities('independent', 0.5)).toEqual({
      success: 1,
      mixed: 0,
      failed: 0,
    });
    expect(resolveAcquisitionIntegrationOutcome('independent', 0.5, 0.999)).toBe('success');
    expect(getAcquisitionIntegrationOutcomeEffect('independent', 'success')).toEqual({
      revenueBonus: 0,
      expenseReduction: 0,
      reputationDelta: 0,
    });
  });

  test('standard integration preserves a small real failure tail', () => {
    const probabilities = getAcquisitionIntegrationOutcomeProbabilities('integrate', 0.82);

    expect(probabilities.success).toBeCloseTo(0.82);
    expect(probabilities.mixed).toBeCloseTo(0.126);
    expect(probabilities.failed).toBeCloseTo(0.054);
    expect(probabilities.success + probabilities.mixed + probabilities.failed).toBeCloseTo(1);

    expect(resolveAcquisitionIntegrationOutcome('integrate', 0.82, 0.50)).toBe('success');
    expect(resolveAcquisitionIntegrationOutcome('integrate', 0.82, 0.90)).toBe('mixed');
    expect(resolveAcquisitionIntegrationOutcome('integrate', 0.82, 0.99)).toBe('failed');
  });

  test('turnaround allocates more of the missed-success probability to failure', () => {
    const probabilities = getAcquisitionIntegrationOutcomeProbabilities('turnaround', 0.60);

    expect(probabilities.success).toBeCloseTo(0.60);
    expect(probabilities.mixed).toBeCloseTo(0.18);
    expect(probabilities.failed).toBeCloseTo(0.22);
    expect(resolveAcquisitionIntegrationOutcome('turnaround', 0.60, 0.70)).toBe('mixed');
    expect(resolveAcquisitionIntegrationOutcome('turnaround', 0.60, 0.90)).toBe('failed');
  });

  test('holding synergy realization follows integration state and outcome', () => {
    expect(getAcquisitionIntegrationHoldingSynergyFactor('pending', 'pending')).toBeCloseTo(0.25);
    expect(getAcquisitionIntegrationHoldingSynergyFactor('independent', 'pending')).toBeCloseTo(0.50);
    expect(getAcquisitionIntegrationHoldingSynergyFactor('integrate', 'pending')).toBeCloseTo(0.60);
    expect(getAcquisitionIntegrationHoldingSynergyFactor('turnaround', 'failed')).toBeCloseTo(0.65);
    expect(getAcquisitionIntegrationHoldingSynergyFactor('integrate', 'mixed')).toBeCloseTo(0.85);
    expect(getAcquisitionIntegrationHoldingSynergyFactor('integrate', 'success')).toBeCloseTo(1);
  });

  test('integration outcome effects match the player-facing economics', () => {
    expect(getAcquisitionIntegrationOutcomeEffect('integrate', 'success')).toEqual({
      revenueBonus: 0.015,
      expenseReduction: 0.02,
      reputationDelta: 2,
    });
    expect(getAcquisitionIntegrationOutcomeEffect('integrate', 'failed')).toEqual({
      revenueBonus: 0,
      expenseReduction: -0.005,
      reputationDelta: -2,
    });
    expect(getAcquisitionIntegrationOutcomeEffect('turnaround', 'success')).toEqual({
      revenueBonus: 0.04,
      expenseReduction: 0.04,
      reputationDelta: 4,
    });
    expect(getAcquisitionIntegrationOutcomeEffect('turnaround', 'failed')).toEqual({
      revenueBonus: -0.02,
      expenseReduction: -0.02,
      reputationDelta: -5,
    });
  });
});
