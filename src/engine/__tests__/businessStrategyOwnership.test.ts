import { createBusiness, getPlayerOwnershipPct, processBusinessWeek } from '../businessEngine';
import { getNetWorth } from '../financeEngine';
import { calculateEstateSettlement } from '../lifecycleEngine';
import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE, OwnedBusiness } from '../../types/game';

function staffedBusiness(): OwnedBusiness {
  const business = createBusiness('coffee_shop', 'Strategy Coffee', 1, 1, 1)!;
  business.level = 3;
  business.reputation = 45;
  business.balance = 100_000;
  business.nextStrategicDecisionWeek = 999;
  business.nextCrisisCheckWeek = 999;
  business.employees = [
    { id: 'e1', name: 'A', roleId: 'worker', weeklySalary: 50, skill: 90, potential: 90, morale: 65, experience: 20, weeksEmployed: 20 },
    { id: 'e2', name: 'B', roleId: 'skilled_worker', weeklySalary: 50, skill: 90, potential: 90, morale: 65, experience: 20, weeksEmployed: 20 },
    { id: 'e3', name: 'C', roleId: 'supervisor', weeklySalary: 50, skill: 90, potential: 90, morale: 65, experience: 20, weeksEmployed: 20 },
  ] as any;
  return business;
}

describe('business strategy, crises and ownership', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('creates a persistent strategic decision when its 6-12 week timer is due', () => {
    const business = staffedBusiness();
    business.nextStrategicDecisionWeek = 1;
    business.nextCrisisCheckWeek = 999;
    jest.spyOn(Math, 'random').mockReturnValue(0.6);

    const result = processBusinessWeek(business, 1, 2, 1);

    expect(result.updatedBusiness.pendingDecision).not.toBeNull();
    expect(result.updatedBusiness.pendingDecision?.kind).toBe('strategy');
    expect(result.updatedBusiness.pendingDecision?.choices.length).toBeGreaterThanOrEqual(2);
    expect(result.updatedBusiness.nextStrategicDecisionWeek).toBeGreaterThan(2);
  });

  test('can create a business crisis when the crisis check is due', () => {
    const business = staffedBusiness();
    business.nextStrategicDecisionWeek = 999;
    business.nextCrisisCheckWeek = 1;
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const result = processBusinessWeek(business, 1, 2, 1);

    expect(result.updatedBusiness.pendingDecision).not.toBeNull();
    expect(result.updatedBusiness.pendingDecision?.kind).toBe('crisis');
    expect(result.updatedBusiness.pendingDecision?.choices.length).toBe(3);
  });

  test('margin strategy lowers comparable weekly operating expenses', () => {
    const balanced = staffedBusiness();
    balanced.strategicFocus = 'balanced';
    const margin = { ...staffedBusiness(), strategicFocus: 'margin' as const };

    jest.spyOn(Math, 'random').mockReturnValue(0.65);
    const balancedResult = processBusinessWeek(balanced, 1, 2, 1);
    jest.restoreAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.65);
    const marginResult = processBusinessWeek(margin, 1, 2, 1);

    expect(marginResult.weeklyExpenses).toBeLessThan(balancedResult.weeklyExpenses);
  });

  test('business dividends follow the ownership table', () => {
    const business = staffedBusiness();
    business.ownership = [
      { ownerType: 'player', ownerId: 'player', ownerName: 'Player', percent: 60, votingPercent: 60 },
      { ownerType: 'child', ownerId: 'child-1', ownerName: 'Mila', percent: 40, votingPercent: 40 },
    ];
    jest.spyOn(Math, 'random').mockReturnValue(0.75);

    const result = processBusinessWeek(business, 1, 2, 1);
    expect(result.weeklyProfit).toBeGreaterThan(0);

    const playerDistribution = result.ownershipDistributions.find((item) => item.ownerType === 'player');
    const childDistribution = result.ownershipDistributions.find((item) => item.ownerType === 'child');
    expect(playerDistribution?.amount).toBe(result.playerDividend);
    expect(childDistribution?.amount ?? 0).toBeGreaterThan(0);
    expect((playerDistribution?.amount ?? 0) / (childDistribution?.amount ?? 1)).toBeCloseTo(1.5, 1);
  });

  test('family governance salaries are real company expenses', () => {
    const base = staffedBusiness();
    const governed = {
      ...staffedBusiness(),
      familyRoles: [{
        childId: 'child-1',
        childName: 'Mila',
        role: 'executive' as const,
        appointedYear: 1,
        experienceWeeks: 0,
        performance: 50,
        weeklySalary: 1_000,
      }],
    };

    jest.spyOn(Math, 'random').mockReturnValue(0.65);
    const baseResult = processBusinessWeek(base, 1, 2, 1);
    jest.restoreAllMocks();
    jest.spyOn(Math, 'random').mockReturnValue(0.65);
    const governedResult = processBusinessWeek(governed, 1, 2, 1);

    expect(governedResult.weeklyExpenses).toBeGreaterThan(baseResult.weeklyExpenses);
    expect(governedResult.updatedBusiness.lastExpenseBreakdown?.salaries ?? 0)
      .toBe((baseResult.updatedBusiness.lastExpenseBreakdown?.salaries ?? 0) + 1_000);
  });

  test('personal net worth includes only player-owned business equity and debt', () => {
    const business = staffedBusiness();
    business.valuation = 200_000;
    business.businessLoans = [{
      id: 'biz-loan',
      originalAmount: 50_000,
      remainingAmount: 40_000,
      interestRate: 0.1,
      weeklyPayment: 1_000,
      weeksRemaining: 40,
    }] as any;
    business.ownership = [
      { ownerType: 'player', ownerId: 'player', ownerName: 'Player', percent: 60, votingPercent: 60 },
      { ownerType: 'investor', ownerId: 'outside', ownerName: 'Outside', percent: 40, votingPercent: 40 },
    ];

    const state = {
      ...INITIAL_GAME_STATE,
      cash: 10_000,
      businesses: [business],
    };

    // 10k cash + 120k player equity - 24k player share of company debt.
    expect(getNetWorth(state)).toBe(106_000);
    expect(getPlayerOwnershipPct(business)).toBe(60);
  });

  test('estate succession taxes only the deceased player stake in a family business', () => {
    const business = staffedBusiness();
    business.valuation = 1_000_000;
    business.businessLoans = [];
    business.familyBusiness = {
      isFamilyBusiness: true,
      familyName: 'Family Co',
      founderGeneration: 1,
      generationsOwned: 1,
      controllerName: 'Parent',
      controllerPersonId: 'player:g1',
      familyOwnershipPct: 100,
      designatedYear: 1,
    };
    business.ownership = [
      { ownerType: 'player', ownerId: 'player:g1', ownerName: 'Parent', percent: 60, votingPercent: 60 },
      { ownerType: 'child', ownerId: 'adult-child', ownerName: 'Mila', percent: 40, votingPercent: 40 },
    ];

    const child = {
      id: 'adult-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      parentRelationship: 80,
    };

    const state = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      cash: 0,
      businesses: [business],
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        estatePlan: {
          ...INITIAL_RELATIONSHIP_STATE.estatePlan,
          successorId: child.id,
        },
      },
    };

    const estate = calculateEstateSettlement(state);
    expect(estate.businessValue).toBe(600_000);
    expect(estate.successorName).toBe('Mila');
  });
});
