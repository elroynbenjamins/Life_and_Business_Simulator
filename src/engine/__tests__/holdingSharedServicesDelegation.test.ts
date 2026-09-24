import {
  applyDelegatedBusinessRoutine,
  createBusiness,
  getEffectiveDelegationPolicyConfig,
  getHoldingSynergyProfile,
} from '../businessEngine';
import {
  EMPTY_HOLDING_SHARED_SERVICES,
  getHoldingAvailableDistributionCash,
  getHoldingManagementFeeForWeek,
  getHoldingReserveTarget,
  getHoldingSharedServiceEffects,
  normalizeHoldingReserveTargetWeeks,
  getHoldingSharedServiceUpgradeCost,
} from '../holdingCompanyEngine';
import { HoldingCompany, OwnedBusiness } from '../../types/game';

function makeHolding(overrides: Partial<HoldingCompany> = {}): HoldingCompany {
  return {
    id: 'holding_test',
    name: 'Test Holdings',
    createdGlobalWeek: 1,
    founderGeneration: 1,
    generationsOwned: 1,
    controllerName: 'Player',
    controllerPersonId: null,
    cashReserve: 50_000_000,
    totalCapitalDeployed: 0,
    executiveChildId: null,
    executiveChildName: null,
    executivePerformance: 50,
    designatedSuccessorChildId: null,
    designatedSuccessorChildName: null,
    sharedServices: { ...EMPTY_HOLDING_SHARED_SERVICES },
    ...overrides,
  };
}

function makeManagedBusiness(): OwnedBusiness {
  const business = createBusiness('coffee_shop', 'Managed Coffee', 1, 2, 1)!;
  return {
    ...business,
    holdingCompanyId: 'holding_test',
    balance: 500_000,
    lastWeekExpenses: 10_000,
    delegationPolicy: 'growth',
    delegatedManagerEmployeeId: 'manager_1',
    delegatedManagerName: 'Morgan',
    lastDelegationReviewWeek: 0,
    employees: [
      {
        id: 'manager_1',
        roleId: 'manager',
        name: 'Morgan',
        skill: 75,
        morale: 75,
        experience: 80,
        potential: 80,
        age: 34,
        weeksEmployed: 50,
        weeklySalary: 720,
        inTrainingId: null,
        trainingWeeksRemaining: 0,
        tier: 'common',
        buffs: [],
      },
      {
        id: 'worker_1',
        roleId: 'worker',
        name: 'Alex',
        skill: 55,
        morale: 70,
        experience: 30,
        potential: 65,
        age: 28,
        weeksEmployed: 25,
        weeklySalary: 260,
        inTrainingId: null,
        trainingWeeksRemaining: 0,
        tier: 'common',
        buffs: [],
      },
      {
        id: 'worker_2',
        roleId: 'worker',
        name: 'Sam',
        skill: 50,
        morale: 72,
        experience: 20,
        potential: 60,
        age: 26,
        weeksEmployed: 20,
        weeklySalary: 260,
        inTrainingId: null,
        trainingWeeksRemaining: 0,
        tier: 'common',
        buffs: [],
      },
    ],
  };
}

describe('holding shared services and delegated management', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('management fee requires profit and respects protected cash plus profit cap', () => {
    const holding = makeHolding({ managementFeeRate: 0.03 });
    expect(getHoldingManagementFeeForWeek(holding, 100_000, 1_000_000, 80_000, 950_000)).toBe(3_000);
    expect(getHoldingManagementFeeForWeek(holding, 100_000, 951_000, 80_000, 950_000)).toBe(1_000);
    expect(getHoldingManagementFeeForWeek(holding, 100_000, 900_000, 80_000, 950_000)).toBe(0);
    expect(getHoldingManagementFeeForWeek(holding, 100_000, 1_000_000, 95_000, 0)).toBe(1_750);
    expect(getHoldingManagementFeeForWeek(holding, 100_000, 1_000_000, 100_000, 0)).toBe(0);
    expect(getHoldingManagementFeeForWeek(holding, 100_000, 1_000_000, 110_000, 0)).toBe(0);
  });

  test('holding reserve defaults to a four-week group contingency buffer', () => {
    expect(normalizeHoldingReserveTargetWeeks(undefined)).toBe(4);
    expect(normalizeHoldingReserveTargetWeeks(null)).toBe(4);
  });

  test('holding reserve target protects owner distributions without locking strategic capital', () => {
    const holding = makeHolding({ cashReserve: 500_000, reserveTargetWeeks: 8 });
    const first = makeManagedBusiness();
    first.lastWeekExpenses = 20_000;
    const second = { ...makeManagedBusiness(), id: 'managed-2', lastWeekExpenses: 10_000 };

    expect(getHoldingReserveTarget(holding, [first, second])).toBe(240_000);
    expect(getHoldingAvailableDistributionCash(holding, [first, second])).toBe(260_000);

    const disabled = { ...holding, reserveTargetWeeks: 0 };
    expect(getHoldingAvailableDistributionCash(disabled, [first, second])).toBe(500_000);
  });

  test('shared-service upgrade costs double by level and use inflation', () => {
    const holding = makeHolding();
    expect(getHoldingSharedServiceUpgradeCost(holding, 'marketing', 1)).toBe(2_000_000);

    const levelOne = makeHolding({ sharedServices: { ...EMPTY_HOLDING_SHARED_SERVICES, marketing: 1 } });
    expect(getHoldingSharedServiceUpgradeCost(levelOne, 'marketing', 1)).toBe(4_000_000);
    expect(getHoldingSharedServiceUpgradeCost(levelOne, 'marketing', 1.5)).toBe(6_000_000);
  });

  test('fully developed shared services stay within modest portfolio caps', () => {
    const holding = makeHolding({
      sharedServices: { finance: 3, hr: 3, procurement: 3, marketing: 3, it: 3 },
    });
    const effects = getHoldingSharedServiceEffects(holding);

    expect(effects.revenueBonus).toBeCloseTo(0.033);
    expect(effects.expenseReduction).toBeCloseTo(0.042);
    expect(effects.crisisReduction).toBeCloseTo(0.06);
    expect(effects.revenueBonus).toBeLessThanOrEqual(0.04);
    expect(effects.expenseReduction).toBeLessThanOrEqual(0.05);
    expect(effects.crisisReduction).toBeLessThanOrEqual(0.08);
  });

  test('shared services benefit even a single subsidiary without inventing organic synergies', () => {
    const business = {
      ...makeManagedBusiness(),
      delegationPolicy: 'manual' as const,
    };
    const holding = makeHolding({
      sharedServices: { ...EMPTY_HOLDING_SHARED_SERVICES, marketing: 3, procurement: 2 },
    });
    const profile = getHoldingSynergyProfile(business, [business], [holding]);

    expect(profile.sameIndustrySiblings).toBe(0);
    expect(profile.relatedIndustrySiblings).toBe(0);
    expect(profile.serviceRevenueBonus).toBeCloseTo(0.015);
    expect(profile.serviceExpenseReduction).toBeCloseTo(0.012);
    expect(profile.revenueBonus).toBeCloseTo(0.015);
    expect(profile.expenseReduction).toBeCloseTo(0.012);
  });

  test('organic holding synergies scale down after mixed or failed acquisition integration', () => {
    const holding = makeHolding();
    const sibling = { ...makeManagedBusiness(), id: 'sibling', delegationPolicy: 'manual' as const };
    const base = { ...makeManagedBusiness(), id: 'acquired', delegationPolicy: 'manual' as const };

    const withOutcome = (outcome: 'success' | 'mixed' | 'failed') => ({
      ...base,
      acquisition: {
        integrationStrategy: 'integrate',
        integrationOutcome: outcome,
        integrationWeeksRemaining: 0,
      } as any,
    });

    const successBusiness = withOutcome('success');
    const mixedBusiness = withOutcome('mixed');
    const failedBusiness = withOutcome('failed');

    const success = getHoldingSynergyProfile(successBusiness, [successBusiness, sibling], [holding]);
    const mixed = getHoldingSynergyProfile(mixedBusiness, [mixedBusiness, sibling], [holding]);
    const failed = getHoldingSynergyProfile(failedBusiness, [failedBusiness, sibling], [holding]);

    expect(success.revenueBonus).toBeGreaterThan(mixed.revenueBonus);
    expect(mixed.revenueBonus).toBeGreaterThan(failed.revenueBonus);
    expect(success.expenseReduction).toBeGreaterThan(mixed.expenseReduction);
    expect(mixed.expenseReduction).toBeGreaterThan(failed.expenseReduction);
  });

  test('Follow Strategy delegation inherits the company strategic focus', () => {
    const growth = makeManagedBusiness();
    growth.delegationPolicy = 'balanced';
    growth.strategicFocus = 'growth';
    const growthConfig = getEffectiveDelegationPolicyConfig(growth, 'balanced');

    const margin = makeManagedBusiness();
    margin.delegationPolicy = 'balanced';
    margin.strategicFocus = 'margin';
    const marginConfig = getEffectiveDelegationPolicyConfig(margin, 'balanced');

    expect(growthConfig.advertising).toBe('aggressive');
    expect(growthConfig.targetStaffRatio).toBeGreaterThan(marginConfig.targetStaffRatio);
    expect(marginConfig.pricing).toBe('premium');
    expect(marginConfig.reserveWeeks).toBeGreaterThan(growthConfig.reserveWeeks);
  });

  test('growth delegation reviews every four weeks and can hire toward its staffing target', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const business = makeManagedBusiness();

    const reviewed = applyDelegatedBusinessRoutine(business, 1, 5, 2);
    expect(reviewed.pricingStrategy).toBe('standard');
    expect(reviewed.advertisingLevel).toBe('aggressive');
    expect(reviewed.employees.length).toBe(4);
    expect(reviewed.freeRecruits).toBe(2);
    expect(reviewed.lastDelegationReviewWeek).toBe(25);
    expect(reviewed.lastDelegationSummary).toContain('hired');

    const tooSoon = applyDelegatedBusinessRoutine(reviewed, 1, 7, 2);
    expect(tooSoon.employees).toHaveLength(4);
    expect(tooSoon.lastDelegationReviewWeek).toBe(25);
  });

  test('delegation protects low reserves and never resolves a player crisis', () => {
    const lowCash = {
      ...makeManagedBusiness(),
      balance: 1_000,
      pendingDecision: {
        id: 'crisis_1',
        kind: 'crisis' as const,
        title: 'Supply shock',
        description: 'A major supplier failed.',
        icon: '⚠️',
        createdGlobalWeek: 25,
        deadlineGlobalWeek: 29,
        defaultChoiceId: 'wait',
        choices: [],
      },
    };

    const paused = applyDelegatedBusinessRoutine(lowCash, 1, 6, 2);
    expect(paused.pendingDecision?.id).toBe('crisis_1');
    expect(paused.lastDelegationSummary).toContain('crisis');
    expect(paused.employees).toHaveLength(lowCash.employees.length);

    const noCrisis = { ...lowCash, pendingDecision: null };
    const reviewed = applyDelegatedBusinessRoutine(noCrisis, 1, 6, 2);
    expect(reviewed.advertisingLevel).toBe('basic');
    expect(reviewed.lastDelegationSummary).toContain('protected cash reserves');
  });

  test('delegation becomes more defensive in recession and more active in boom', () => {
    const recessionBusiness = makeManagedBusiness();
    recessionBusiness.balance = 200_000;
    const recession = applyDelegatedBusinessRoutine(recessionBusiness, 1, 5, 2, 'recession');

    const boomBusiness = makeManagedBusiness();
    boomBusiness.balance = 200_000;
    const boom = applyDelegatedBusinessRoutine(boomBusiness, 1, 5, 2, 'boom');

    expect(recession.advertisingLevel).toBe('moderate');
    expect(recession.pricingStrategy).toBe('budget');
    expect(recession.lastDelegationSummary).toContain('recession');
    expect(boom.advertisingLevel).toBe('aggressive');
    expect(boom.lastDelegationSummary).toContain('strong demand');
  });

  test('delegation pauses cleanly when the appointed manager is no longer available', () => {
    const business = {
      ...makeManagedBusiness(),
      employees: makeManagedBusiness().employees.filter((employee) => employee.id !== 'manager_1'),
    };

    const result = applyDelegatedBusinessRoutine(business, 1, 5, 2);
    expect(result.lastDelegationSummary).toContain('manager is unavailable');
    expect(result.lastDelegationReviewWeek).toBe(0);
  });
});
