import { createBusiness, getAutomaticStrategicDecisionChoice, getPlayerOwnershipPct, processAllBusinesses, processBusinessWeek, STRATEGIC_DECISION_MAX_GAP_WEEKS, STRATEGIC_DECISION_MIN_GAP_WEEKS } from '../businessEngine';
import { getNetWorth } from '../financeEngine';
import { calculateEstateSettlement, getSuccessionPreview } from '../lifecycleEngine';
import { createCorporateWorkforce } from '../businessWorkforceEngine';
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

  test('creates a longer-lived strategic decision on the 12-24 week cadence', () => {
    const business = staffedBusiness();
    business.nextStrategicDecisionWeek = 1;
    business.nextCrisisCheckWeek = 999;
    jest.spyOn(Math, 'random').mockReturnValue(0.6);

    const result = processBusinessWeek(business, 1, 2, 1);
    const decision = result.updatedBusiness.pendingDecision;
    const nextGap = (result.updatedBusiness.nextStrategicDecisionWeek ?? 0) - 2;

    expect(decision).not.toBeNull();
    expect(decision?.kind).toBe('strategy');
    expect(decision?.choices.length).toBeGreaterThanOrEqual(3);
    expect(nextGap).toBeGreaterThanOrEqual(STRATEGIC_DECISION_MIN_GAP_WEEKS);
    expect(nextGap).toBeLessThanOrEqual(STRATEGIC_DECISION_MAX_GAP_WEEKS);
    expect((decision?.deadlineGlobalWeek ?? 0) - (decision?.createdGlobalWeek ?? 0)).toBe(5);
    const meaningfulChoices = (decision?.choices ?? []).filter((choice) => choice.id !== decision?.defaultChoiceId);
    expect(meaningfulChoices.every((choice) => (choice.durationWeeks ?? 0) >= 16)).toBe(true);
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
    expect((result.updatedBusiness.pendingDecision?.deadlineGlobalWeek ?? 0) - (result.updatedBusiness.pendingDecision?.createdGlobalWeek ?? 0)).toBe(3);
  });

  test('spaces corporate HR and strategic reviews by at least 6 weeks', () => {
    const business = staffedBusiness();
    business.valuation = 30_000_000;
    const workforce = createCorporateWorkforce(business, 1, 1);
    expect(workforce).not.toBeNull();
    business.corporateWorkforce = {
      ...workforce!,
      laborMarketPressure: 75,
      nextHrEventWeek: 1,
    };
    business.nextStrategicDecisionWeek = 1;
    business.nextCrisisCheckWeek = 999;

    jest.spyOn(Math, 'random').mockReturnValue(0.4);
    const result = processBusinessWeek(business, 1, 2, 1);

    expect(result.updatedBusiness.pendingDecision?.id.startsWith('hr_')).toBe(true);
    expect((result.updatedBusiness.nextStrategicDecisionWeek ?? 0) - 2).toBeGreaterThanOrEqual(6);
  });

  test('does not open a new strategic review while a prior strategic program is still active', () => {
    const business = staffedBusiness();
    business.nextStrategicDecisionWeek = 1;
    business.nextCrisisCheckWeek = 999;
    business.strategyModifiers = [{
      id: 'strategy_previous:choice',
      title: 'Existing strategic program',
      revenueMultiplier: 1.05,
      expenseMultiplier: 1,
      reputationPerWeek: 0,
      moralePerWeek: 0,
      weeksRemaining: 8,
    }];

    jest.spyOn(Math, 'random').mockReturnValue(0.6);
    const result = processBusinessWeek(business, 1, 2, 1);

    expect(result.updatedBusiness.pendingDecision).toBeNull();
    expect((result.updatedBusiness.nextStrategicDecisionWeek ?? 0) - 2).toBeGreaterThanOrEqual(7);
  });

  test('Auto Strategy resolves routine choices but never crises', () => {
    const automatic = staffedBusiness();
    automatic.autoStrategicDecisions = true;
    automatic.strategicFocus = 'automation';
    automatic.nextStrategicDecisionWeek = 1;
    automatic.nextCrisisCheckWeek = 999;
    jest.spyOn(Math, 'random').mockReturnValue(0.2);

    const strategicResult = processBusinessWeek(automatic, 1, 2, 1);
    expect(strategicResult.updatedBusiness.pendingDecision).toBeNull();
    expect(strategicResult.updatedBusiness.strategyModifiers?.some((modifier) => modifier.title.includes('(Auto)'))).toBe(true);
    expect(strategicResult.updatedBusiness.timeline?.some((entry) => entry.title.startsWith('🧭') && entry.title.includes('(Auto)'))).toBe(true);

    jest.restoreAllMocks();
    const crisis = staffedBusiness();
    crisis.autoStrategicDecisions = true;
    crisis.nextStrategicDecisionWeek = 999;
    crisis.nextCrisisCheckWeek = 1;
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const crisisResult = processBusinessWeek(crisis, 1, 2, 1);
    expect(crisisResult.updatedBusiness.pendingDecision?.kind).toBe('crisis');
  });

  test('automatic choice follows strategic focus while respecting cash safety', () => {
    const business = staffedBusiness();
    business.strategicFocus = 'automation';
    business.balance = 100_000;
    const decision = {
      id: 'auto-test',
      kind: 'strategy' as const,
      title: 'Workforce Strategy',
      description: 'Choose a direction.',
      icon: '👥',
      createdGlobalWeek: 1,
      deadlineGlobalWeek: 6,
      defaultChoiceId: 'no_change',
      choices: [
        { id: 'raise_wages', text: 'Invest in the Team', description: 'People first.', businessCashCost: 3_000, expenseMultiplier: 1.04, moraleDelta: 7, durationWeeks: 20 },
        { id: 'automate', text: 'Accelerate Automation', description: 'Digitize processes.', businessCashCost: 7_000, expenseMultiplier: 0.91, durationWeeks: 24 },
        { id: 'no_change', text: 'No Major Change', description: 'Stay steady.', durationWeeks: 1 },
      ],
    };

    expect(getAutomaticStrategicDecisionChoice(business, decision, 1)?.id).toBe('automate');

    business.balance = 10_000;
    expect(getAutomaticStrategicDecisionChoice(business, decision, 1)?.id).not.toBe('automate');
  });

  test('Auto Strategy becomes defensive with weak liquidity in a recession', () => {
    const business = staffedBusiness();
    business.strategicFocus = 'balanced';
    business.balance = 20_000;
    business.lastWeekExpenses = 10_000;
    const decision = {
      id: 'cycle-auto-test',
      kind: 'strategy' as const,
      title: 'Downturn Strategy',
      description: 'Choose a recession posture.',
      icon: '🌧️',
      createdGlobalWeek: 1,
      deadlineGlobalWeek: 6,
      defaultChoiceId: 'cycle_discipline',
      choices: [
        { id: 'cycle_counter', text: 'Push for Market Share', description: 'Expand while competitors retreat.', businessCashCost: 6_000, revenueMultiplier: 1.05, marketShareDelta: 3, durationWeeks: 20 },
        { id: 'cycle_efficiency', text: 'Tighten Operations', description: 'Cut costs and improve efficiency.', businessCashCost: 2_500, expenseMultiplier: 0.94, durationWeeks: 18 },
        { id: 'cycle_discipline', text: 'Protect Liquidity', description: 'Keep cash available.', durationWeeks: 1 },
      ],
    };

    const selected = getAutomaticStrategicDecisionChoice(business, decision, 1, 'recession');
    expect(selected?.id).not.toBe('cycle_counter');
    expect(['cycle_efficiency', 'cycle_discipline']).toContain(selected?.id);
  });

  test('cash-rich growth Auto Strategy can invest counter-cyclically in a recession', () => {
    const business = staffedBusiness();
    business.strategicFocus = 'growth';
    business.balance = 500_000;
    business.lastWeekExpenses = 10_000;
    const decision = {
      id: 'cycle-growth-test',
      kind: 'strategy' as const,
      title: 'Downturn Strategy',
      description: 'Choose a recession posture.',
      icon: '🌧️',
      createdGlobalWeek: 1,
      deadlineGlobalWeek: 6,
      defaultChoiceId: 'cycle_discipline',
      choices: [
        { id: 'cycle_counter', text: 'Push for Market Share', description: 'Expand sales and market share while competitors retreat.', businessCashCost: 6_000, revenueMultiplier: 1.05, marketShareDelta: 3, durationWeeks: 20 },
        { id: 'cycle_efficiency', text: 'Tighten Operations', description: 'Cut costs and improve efficiency.', businessCashCost: 2_500, expenseMultiplier: 0.94, durationWeeks: 18 },
        { id: 'cycle_discipline', text: 'Protect Liquidity', description: 'Keep cash available.', durationWeeks: 1 },
      ],
    };

    expect(getAutomaticStrategicDecisionChoice(business, decision, 1, 'recession')?.id).toBe('cycle_counter');
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
      amount: 50_000,
      remainingAmount: 44_000,
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
    expect(estate.businessValue + (estate.businessSettlementDebt ?? 0)).toBe(600_000);
    expect(estate.businessSettlementDebt).toBe(24_000);
    expect(estate.businessValue).toBe(estate.netEstate);
    expect(estate.successorName).toBe('Mila');
  });

  test('succession preview never gives a child a negative existing business stake', () => {
    const business = staffedBusiness();
    business.valuation = 50_000;
    business.businessLoans = [{
      id: 'underwater-debt',
      amount: 100_000,
      remainingAmount: 110_000,
      interestRate: 0.10,
      weeklyPayment: 5_500,
      weeksRemaining: 20,
    }] as any;
    business.ownership = [
      { ownerType: 'player', ownerId: 'player', ownerName: 'Player', percent: 60, votingPercent: 60 },
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
    const baseState = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      businesses: [business],
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
      },
    };
    const estateSettlement = calculateEstateSettlement(baseState);
    const state = {
      ...baseState,
      relationshipState: {
        ...baseState.relationshipState,
        estateSettlement,
      },
    };

    const preview = getSuccessionPreview(state, child.id);

    expect(preview?.existingBusinessStakeValue).toBe(0);
  });

  test('ignored crises auto-resolve into their fallback consequence after the deadline', () => {
    const business = staffedBusiness();
    business.pendingDecision = {
      id: 'expired-crisis',
      kind: 'crisis',
      title: 'Major Customer Lost',
      description: 'A major account disappeared.',
      icon: '💼',
      createdGlobalWeek: 1,
      deadlineGlobalWeek: 2,
      defaultChoiceId: 'ride_out',
      choices: [
        { id: 'sales_push', text: 'Launch Sales Push', description: 'Spend to replace the revenue.', businessCashCost: 8_000, revenueMultiplier: 0.98, durationWeeks: 7 },
        { id: 'ride_out', text: 'Ride It Out', description: 'Accept the temporary hit.', revenueMultiplier: 0.82, durationWeeks: 6 },
      ],
    };
    business.nextStrategicDecisionWeek = 999;
    business.nextCrisisCheckWeek = 999;
    jest.spyOn(Math, 'random').mockReturnValue(0.7);

    const result = processBusinessWeek(business, 1, 3, 1);

    expect(result.updatedBusiness.pendingDecision).toBeNull();
    expect(result.updatedBusiness.strategyModifiers?.some((modifier) =>
      modifier.id.includes('expired-crisis:ride_out:auto')
      && modifier.revenueMultiplier === 0.82
    )).toBe(true);
    expect(result.updatedBusiness.timeline?.some((entry) => entry.title.includes('no response'))).toBe(true);
  });

  test('limits the whole portfolio to one newly-created decision in a week', () => {
    const first = staffedBusiness();
    first.id = 'decision-a';
    first.nextStrategicDecisionWeek = 1;
    first.nextCrisisCheckWeek = 999;

    const second = staffedBusiness();
    second.id = 'decision-b';
    second.nextStrategicDecisionWeek = 1;
    second.nextCrisisCheckWeek = 999;

    jest.spyOn(Math, 'random').mockReturnValue(0.6);
    const result = processAllBusinesses([first, second], 1, 2, 1);
    const pending = result.updatedBusinesses.filter((business) => !!business.pendingDecision);

    expect(pending).toHaveLength(1);
    expect(result.updatedBusinesses.some((business) =>
      !business.pendingDecision && (business.nextStrategicDecisionWeek ?? 0) >= 6
    )).toBe(true);
  });
});
