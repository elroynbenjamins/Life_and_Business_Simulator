import { calculateValuation, canStartBusinessExpansion, computeMarketShare, createBusiness, getBusinessLevelForMetrics, getScaledLocationCosts, getStartupRevenueTarget, processBusinessWeek, scaleValuationTargets, startProject } from '../businessEngine';
import { createInitialCompetitors } from '../competitorEngine';
import { OwnedBusiness } from '../../types/game';

describe('business balancing', () => {
  test.each([
    [0, 19165],
    [50, 33053],
    [100, 46940],
  ])('uses the stable run-rate valuation model at %i reputation', (reputation, expected) => {
    const business = {
      reputation,
      weeklyProfitHistory: [1_000, 1_000],
      balance: 2_500,
    } as unknown as OwnedBusiness;

    expect(calculateValuation(business)).toBe(expected);
  });

  test('values a loss-making business at only its available balance', () => {
    const business = { reputation: 100, weeklyProfitHistory: [1_000, -2_000], balance: 12_500 } as OwnedBusiness;
    expect(calculateValuation(business)).toBe(12_500);
  });

  test('scales level valuation targets to the lower valuation model', () => {
    expect(scaleValuationTargets([0, 25_000, 80_000])).toEqual([0, 10_000, 32_000]);
  });

  test('creates three competitors and gives a new business 10% market share', () => {
    const business = createBusiness('coffee_shop', null, 1, 1, 1);
    expect(business).not.toBeNull();

    const competitors = createInitialCompetitors(business!, 1);
    const share = computeMarketShare(business!, competitors.map((competitor) => competitor.strength));

    expect(competitors).toHaveLength(3);
    expect(share.player).toBe(10);
    expect(share.competitors).toEqual([30, 30, 30]);
  });

  test('applies market-share modifiers without changing the total market', () => {
    const business = {
      reputation: 50,
      valuation: 0,
      employees: [],
      marketShareModifier: 5,
    } as unknown as OwnedBusiness;

    const share = computeMarketShare(business, [150, 150, 150]);
    const total = share.player + share.competitors.reduce((sum, value) => sum + value, 0);

    expect(total).toBeCloseTo(100, 0);
  });

  test('requires reputation as well as valuation to scale business levels', () => {
    const thresholds = [0, 25_000, 80_000, 200_000, 500_000, 1_500_000, 5_000_000, 20_000_000];
    expect(getBusinessLevelForMetrics(thresholds, 20_000_000, 25)).toBe(1);
    expect(getBusinessLevelForMetrics(thresholds, 20_000_000, 52)).toBe(4);
    expect(getBusinessLevelForMetrics(thresholds, 20_000_000, 90)).toBe(7);
  });

  test('local marketing always succeeds and scales cost and reputation with level', () => {
    const business = createBusiness('coffee_shop', null, 1, 1, 1)!;
    business.level = 5;
    business.employees = [{ id: 'e1', name: 'Alex', roleId: 'worker', weeklySalary: 300, skill: 20, potential: 50, morale: 50, experience: 0, weeksEmployed: 0 } as any];
    const result = startProject(business, 'local_marketing', 1);
    const project = result.updatedBusiness?.activeProjects?.[0];
    expect(result.success).toBe(true);
    expect(result.cost).toBe(7_125);
    expect(project?.reputationBonus).toBe(3);
  });

  test('three randomized salaries produce both below and above break-even startup revenue targets', () => {
    const salaries = 260 + 400 + 720;
    const breakEven = 1_400 + 300 + salaries;
    expect(getStartupRevenueTarget(1_400, 300, salaries, 0, 0)).toBeLessThan(breakEven);
    expect(getStartupRevenueTarget(1_400, 300, salaries, 0, 1)).toBeGreaterThan(breakEven);
  });

  test('a newly staffed company experiences both profitable and loss-making opening weeks', () => {
    const business = createBusiness('coffee_shop', null, 1, 1, 1)!;
    business.employees = [
      { id: 'e1', name: 'Alex', roleId: 'worker', weeklySalary: 245, skill: 35, potential: 70, morale: 55, experience: 0, weeksEmployed: 0 },
      { id: 'e2', name: 'Sam', roleId: 'skilled_worker', weeklySalary: 430, skill: 52, potential: 75, morale: 55, experience: 0, weeksEmployed: 0 },
      { id: 'e3', name: 'Robin', roleId: 'specialist', weeklySalary: 690, skill: 61, potential: 82, morale: 55, experience: 0, weeksEmployed: 0 },
    ] as any;
    let seed = 1234;
    const random = jest.spyOn(Math, 'random').mockImplementation(() => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
    const profits = Array.from({ length: 40 }, (_, index) => processBusinessWeek(business, 1, (index % 20) + 1, 1 + Math.floor(index / 20), { competitorRevenueMultipliers: { [business.id]: 0.7 } }).weeklyProfit);
    random.mockRestore();
    expect(profits.some((profit) => profit > 0)).toBe(true);
    expect(profits.some((profit) => profit < 0)).toBe(true);
  });

  test('geographic expansion requires both business level and reputation', () => {
    const business = createBusiness('coffee_shop', null, 1, 1, 1)!;
    business.level = 1;
    business.reputation = 29;
    expect(canStartBusinessExpansion(business, 'local_branch')).toBe(false);
    business.reputation = 30;
    expect(canStartBusinessExpansion(business, 'local_branch')).toBe(true);
    expect(getScaledLocationCosts(business, 'local_branch', 1)?.purchaseCost).toBeGreaterThan(0);
  });

  test('completed expansion becomes a persistent revenue-and-cost location', () => {
    const business = createBusiness('coffee_shop', null, 1, 1, 1)!;
    business.level = 1;
    business.reputation = 50;
    business.employees = [
      { id: 'e1', name: 'A', roleId: 'worker', weeklySalary: 260, skill: 55, potential: 80, morale: 70, experience: 0, weeksEmployed: 0 },
      { id: 'e2', name: 'B', roleId: 'skilled_worker', weeklySalary: 400, skill: 55, potential: 80, morale: 70, experience: 0, weeksEmployed: 0 },
      { id: 'e3', name: 'C', roleId: 'supervisor', weeklySalary: 520, skill: 55, potential: 80, morale: 70, experience: 0, weeksEmployed: 0 },
    ] as any;
    business.activeExpansion = { templateId: 'local_branch', weeksRemaining: 1 };
    const result = processBusinessWeek(business, 1, 2, 1);
    expect(result.updatedBusiness.activeExpansion).toBeNull();
    expect(result.updatedBusiness.locations).toHaveLength(1);
    expect(result.updatedBusiness.locations?.[0].revenueBoost).toBe(0.12);
    expect(result.updatedBusiness.locations?.[0].weeklyOperatingCost).toBeGreaterThan(0);
  });
});
