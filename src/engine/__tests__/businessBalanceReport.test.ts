import businessTypesData from '../../data/business_types.json';
import { BusinessSimulationScenario, simulateBusinessScenario } from '../businessSimulation';

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

describe('business balance report', () => {
  test('reports 200-week outcomes across all business types and configurations', () => {
    const configurations: Array<{ name: string; scenario: Omit<BusinessSimulationScenario, 'businessTypeId' | 'seed'> }> = [
      { name: 'Starting', scenario: { weeks: 200, employeeQuality: 'average', upgrades: 'none', prestigeBusinessCostReduction: 0 } },
      { name: 'Developing', scenario: { weeks: 200, employeeQuality: 'random', upgrades: 'first', prestigeBusinessCostReduction: 0.03, reputation: 40, advertising: 'basic' } },
      { name: 'Established', scenario: { weeks: 200, employeeQuality: 'high', upgrades: 'all', prestigeBusinessCostReduction: 0.075, reputation: 65, advertising: 'moderate' } },
    ];
    const seeds = [11, 29, 47, 83, 101];
    const rows: Record<string, string | number>[] = [];
    for (const type of businessTypesData) {
      for (const configuration of configurations) {
        const employeeCount = configuration.name === 'Starting'
          ? 3
          : configuration.name === 'Developing'
            ? Math.max(3, Math.ceil(type.maxEmployees * 0.7))
            : type.maxEmployees;
        const results = seeds.map((seed) => simulateBusinessScenario({ businessTypeId: type.id, seed, employeeCount, ...configuration.scenario }));
        rows.push({
          Business: type.name,
          Scenario: configuration.name,
          'Median weekly P/L': Math.round(median(results.map((result) => result.medianWeeklyProfit))),
          'Profit margin %': +(median(results.map((result) => result.profitMargin)) * 100).toFixed(1),
          'Profitable weeks %': +(median(results.map((result) => result.profitableWeekRate)) * 100).toFixed(1),
          'Ending balance': Math.round(median(results.map((result) => result.endingBalance))),
          'Ending valuation': Math.round(median(results.map((result) => result.endingValuation))),
          'Ending reputation': +median(results.map((result) => result.endingReputation)).toFixed(1),
        });
      }
    }
    if (process.env.BUSINESS_REPORT === '1') console.table(rows);
    expect(rows).toHaveLength(businessTypesData.length * configurations.length);
    expect(rows.every((row) => Object.values(row).every((value) => typeof value === 'string' || Number.isFinite(value)))).toBe(true);
  });
});
