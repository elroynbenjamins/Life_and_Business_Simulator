import { BusinessEmployee, EmployeeTier, OwnedBusiness } from '../types/game';
import businessTypesData from '../data/business_types.json';
import employeeRolesData from '../data/employee_roles.json';
import { createBusiness, processBusinessWeek } from './businessEngine';
import { createInitialCompetitors, processCompetitors } from './competitorEngine';

export type EmployeeQuality = 'low' | 'average' | 'high' | 'random';
export type UpgradeLoadout = 'none' | 'first' | 'all';

export interface BusinessSimulationScenario {
  businessTypeId: string;
  weeks: number;
  seed: number;
  employeeQuality: EmployeeQuality;
  employeeCount?: number;
  upgrades: UpgradeLoadout | string[];
  reputation?: number;
  startingBalance?: number;
  pricing?: OwnedBusiness['pricingStrategy'];
  advertising?: OwnedBusiness['advertisingLevel'];
  prestigeBusinessCostReduction?: number;
  competition?: boolean;
}

export interface BusinessSimulationResult {
  scenario: BusinessSimulationScenario;
  endingBusiness: OwnedBusiness;
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  medianWeeklyProfit: number;
  profitMargin: number;
  profitableWeekRate: number;
  lowestBalance: number;
  endingBalance: number;
  endingValuation: number;
  endingReputation: number;
  firstBreakEvenWeek: number | null;
}

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function createSimulationEmployees(count: number, quality: EmployeeQuality): BusinessEmployee[] {
  const qualityRange: Record<Exclude<EmployeeQuality, 'random'>, [number, number, EmployeeTier]> = {
    low: [25, 45, 'common'], average: [48, 68, 'rare'], high: [72, 92, 'epic'],
  };
  return Array.from({ length: count }, (_, index) => {
    const selected = quality === 'random' ? (['low', 'average', 'high'] as const)[Math.floor(Math.random() * 3)] : quality;
    const [minimum, maximum, tier] = qualityRange[selected];
    const role: any = (employeeRolesData as any[])[index % (employeeRolesData as any[]).length];
    const skill = Math.round(minimum + Math.random() * (maximum - minimum));
    return {
      id: `sim_employee_${index}`, name: `Simulation Employee ${index + 1}`, roleId: role.id,
      weeklySalary: Math.round(role.baseSalary * (0.9 + skill / 250)), skill, potential: Math.min(100, skill + 20),
      morale: Math.round(60 + Math.random() * 25), experience: Math.round(Math.random() * 100), weeksEmployed: 0,
      age: 22 + index * 3, tier, buffs: [], inTrainingId: null, trainingWeeksRemaining: 0,
    } as BusinessEmployee;
  });
}

/** Runs synchronously with a seeded RNG and always restores the game's RNG afterwards. */
export function simulateBusinessScenario(scenario: BusinessSimulationScenario): BusinessSimulationResult {
  const originalRandom = Math.random;
  Math.random = seededRandom(scenario.seed);
  try {
    const type: any = (businessTypesData as any[]).find((item) => item.id === scenario.businessTypeId);
    if (!type) throw new Error(`Unknown business type: ${scenario.businessTypeId}`);
    let business = createBusiness(type.id, `Simulation ${type.name}`, 1, 1, 1);
    if (!business) throw new Error(`Unable to create business: ${type.id}`);
    const upgradeIds = Array.isArray(scenario.upgrades) ? scenario.upgrades : scenario.upgrades === 'all' ? [...(type.upgrades ?? [])] : scenario.upgrades === 'first' ? (type.upgrades ?? []).slice(0, 1) : [];
    business = {
      ...business,
      balance: scenario.startingBalance ?? type.startupCost,
      reputation: scenario.reputation ?? 25,
      pricingStrategy: scenario.pricing ?? 'standard', advertisingLevel: scenario.advertising ?? 'none',
      purchasedUpgrades: upgradeIds,
      id: `simulation_${type.id}_${scenario.seed}`,
      employees: createSimulationEmployees(scenario.employeeCount ?? 3, scenario.employeeQuality),
    };
    let rivals = { [business.id]: createInitialCompetitors(business, 1) };

    const profits: number[] = [];
    let totalRevenue = 0, totalExpenses = 0, cumulativeProfit = 0;
    let lowestBalance = business.balance, firstBreakEvenWeek: number | null = null;
    for (let index = 0; index < scenario.weeks; index++) {
      const globalWeek = index + 2;
      const week = ((globalWeek - 1) % 20) + 1;
      const year = Math.floor((globalWeek - 1) / 20) + 1;
      const competition = scenario.competition ? processCompetitors([business], rivals, globalWeek) : null;
      if (competition) rivals = competition.updatedCompetitors;
      const tick = processBusinessWeek(business, 1, week, year, { businessCostReduction: scenario.prestigeBusinessCostReduction ?? 0, competitorRevenueMultipliers: competition?.competitorRevenueMultipliers });
      business = tick.updatedBusiness;
      profits.push(tick.weeklyProfit);
      totalRevenue += tick.weeklyRevenue;
      totalExpenses += tick.weeklyExpenses;
      cumulativeProfit += tick.weeklyProfit;
      lowestBalance = Math.min(lowestBalance, business.balance);
      if (firstBreakEvenWeek === null && cumulativeProfit >= 0) firstBreakEvenWeek = index + 1;
    }
    return {
      scenario, endingBusiness: business, totalRevenue, totalExpenses, totalProfit: cumulativeProfit,
      medianWeeklyProfit: median(profits), profitMargin: totalRevenue > 0 ? cumulativeProfit / totalRevenue : 0,
      profitableWeekRate: profits.filter((profit) => profit > 0).length / Math.max(1, profits.length),
      lowestBalance, endingBalance: business.balance, endingValuation: business.valuation, endingReputation: business.reputation, firstBreakEvenWeek,
    };
  } finally {
    Math.random = originalRandom;
  }
}

/** Representative matrix for balance audits without an exponential combination explosion. */
export function runBusinessBalanceMatrix(weeks = 60, seeds: number[] = [11, 29, 47]): BusinessSimulationResult[] {
  const results: BusinessSimulationResult[] = [];
  for (const type of businessTypesData as any[]) {
    for (const employeeQuality of ['low', 'average', 'high', 'random'] as EmployeeQuality[]) {
      for (const upgrades of ['none', 'first', 'all'] as UpgradeLoadout[]) {
        for (const prestigeBusinessCostReduction of [0, 0.075]) {
          for (const seed of seeds) results.push(simulateBusinessScenario({ businessTypeId: type.id, weeks, seed, employeeQuality, upgrades, prestigeBusinessCostReduction }));
        }
      }
    }
  }
  return results;
}
