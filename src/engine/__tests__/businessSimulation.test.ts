import { runBusinessBalanceMatrix, simulateBusinessScenario } from '../businessSimulation';
import businessTypesData from '../../data/business_types.json';

describe('business simulation lab', () => {
  const base = { businessTypeId: 'coffee_shop', weeks: 60, seed: 4242, employeeQuality: 'average' as const, upgrades: 'none' as const };

  test('is deterministic for the same scenario and seed', () => {
    const first = simulateBusinessScenario(base);
    const second = simulateBusinessScenario(base);
    expect(second.totalProfit).toBe(first.totalProfit);
    expect(second.endingValuation).toBe(first.endingValuation);
  });

  test('all upgrades improve revenue under otherwise identical conditions', () => {
    const baseline = simulateBusinessScenario(base);
    const upgraded = simulateBusinessScenario({ ...base, upgrades: 'all' });
    expect(upgraded.totalRevenue).toBeGreaterThan(baseline.totalRevenue);
  });

  test('prestige cost reduction lowers comparable operating expenses', () => {
    const baseline = simulateBusinessScenario(base);
    const prestige = simulateBusinessScenario({ ...base, prestigeBusinessCostReduction: 0.075 });
    expect(prestige.totalExpenses).toBeLessThan(baseline.totalExpenses);
  });

  test('reputation materially increases long-run customer demand', () => {
    const lowReputation = simulateBusinessScenario({ ...base, reputation: 20 });
    const highReputation = simulateBusinessScenario({ ...base, reputation: 80 });
    expect(highReputation.totalRevenue).toBeGreaterThan(lowReputation.totalRevenue * 1.2);
  });

  test('can run a representative multi-business matrix', () => {
    const results = runBusinessBalanceMatrix(4, [7]);
    expect(results.length).toBeGreaterThan(100);
    expect(results.every((result) => Number.isFinite(result.totalProfit))).toBe(true);
  });

  test('all business types remain numerically stable over 200 weeks', () => {
    for (const type of businessTypesData) {
      const result = simulateBusinessScenario({ businessTypeId: type.id, weeks: 200, seed: 99, employeeQuality: 'random', upgrades: 'first', prestigeBusinessCostReduction: 0.03 });
      expect(Number.isFinite(result.endingBalance)).toBe(true);
      expect(Number.isFinite(result.endingValuation)).toBe(true);
      expect(result.profitableWeekRate).toBeGreaterThanOrEqual(0);
      expect(result.profitableWeekRate).toBeLessThanOrEqual(1);
    }
  });
});
