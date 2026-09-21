import {
  createBusiness,
  processBusinessWeek,
} from '../businessEngine';
import {
  CORPORATE_COMPENSATION_POLICIES,
  CORPORATE_TRAINING_POLICIES,
  applyCorporateHrDecisionChoice,
  createCorporateWorkforce,
  getCorporateHrPolicyCooldownWeeks,
  getCorporateWorkforceAttentionReason,
  getCorporateWorkforceWeeklyPayroll,
  getDepartmentWeeklyWage,
  makeCorporateHrDecision,
  setCorporateDepartmentTarget,
  setCorporateHrPolicy,
  tickCorporateWorkforce,
} from '../businessWorkforceEngine';
import { OwnedBusiness } from '../../types/game';

function employee(id: string) {
  return {
    id,
    roleId: 'worker',
    name: id,
    skill: 60,
    morale: 75,
    experience: 50,
    potential: 80,
    age: 30,
    weeksEmployed: 40,
    weeklySalary: 300,
    inTrainingId: null,
    trainingWeeksRemaining: 0,
    tier: 'common' as const,
    buffs: [],
  };
}

function makeBusiness(valuation = 100_000_000): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'HR Coffee Group', 1, 1, 1)!;
  const business: OwnedBusiness = {
    ...base,
    valuation,
    balance: 30_000_000,
    reputation: 85,
    level: 6,
    employees: [employee('A'), employee('B'), employee('C')],
    lastWeekRevenue: 2_000_000,
    lastWeekExpenses: 1_000_000,
    lastWeekProfit: 500_000,
    weeklyProfitHistory: Array(20).fill(500_000),
  };
  business.corporateWorkforce = createCorporateWorkforce(business, 81, 1);
  return business;
}

describe('corporate HR and workforce events', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('compensation policies have a clear wage/retention tradeoff', () => {
    expect(getDepartmentWeeklyWage('operations', 1, 'lean'))
      .toBeLessThan(getDepartmentWeeklyWage('operations', 1, 'market'));
    expect(getDepartmentWeeklyWage('operations', 1, 'market'))
      .toBeLessThan(getDepartmentWeeklyWage('operations', 1, 'competitive'));
    expect(getDepartmentWeeklyWage('operations', 1, 'competitive'))
      .toBeLessThan(getDepartmentWeeklyWage('operations', 1, 'premium'));
    expect(CORPORATE_COMPENSATION_POLICIES.lean.turnoverMultiplier)
      .toBeGreaterThan(CORPORATE_COMPENSATION_POLICIES.premium.turnoverMultiplier);
  });

  test('direct HR policy changes share a six-week cooldown', () => {
    const business = makeBusiness();
    const changed = setCorporateHrPolicy(business, 'compensation', 'competitive', 100, 1)!;
    const changedBusiness = { ...business, corporateWorkforce: changed };

    expect(changed.compensationPolicy).toBe('competitive');
    expect(getCorporateHrPolicyCooldownWeeks(changedBusiness, 102)).toBe(4);
    expect(setCorporateHrPolicy(changedBusiness, 'training', 'academy', 102, 1)).toBeNull();

    const later = setCorporateHrPolicy(changedBusiness, 'training', 'academy', 106, 1);
    expect(later?.trainingPolicy).toBe('academy');
  });

  test('academy training has a visible weekly cost and improves department skill faster', () => {
    const standard = makeBusiness();
    const academy = makeBusiness();
    academy.corporateWorkforce = {
      ...academy.corporateWorkforce!,
      trainingPolicy: 'academy',
    };

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const standardTick = tickCorporateWorkforce(standard, 90, 1);
    const academyTick = tickCorporateWorkforce(academy, 90, 1);

    expect(academyTick.trainingCost).toBe(
      Math.round(academyTick.weeklyPayroll * CORPORATE_TRAINING_POLICIES.academy.payrollCostPct),
    );
    expect(academyTick.trainingCost).toBeGreaterThan(standardTick.trainingCost);
    expect(academyTick.workforce!.departments.operations.averageSkill)
      .toBeGreaterThan(standardTick.workforce!.departments.operations.averageSkill);
  });

  test('tight labor markets plus lean pay slow hiring relative to premium pay', () => {
    const lean = makeBusiness();
    const premium = makeBusiness();
    const leanSales = lean.corporateWorkforce!.departments.sales;
    const premiumSales = premium.corporateWorkforce!.departments.sales;

    lean.corporateWorkforce = setCorporateDepartmentTarget(
      lean,
      'sales',
      leanSales.headcount + 40,
      82,
      1,
    );
    premium.corporateWorkforce = setCorporateDepartmentTarget(
      premium,
      'sales',
      premiumSales.headcount + 40,
      82,
      1,
    );
    lean.corporateWorkforce = {
      ...lean.corporateWorkforce!,
      compensationPolicy: 'lean',
      laborMarketPressure: 80,
    };
    premium.corporateWorkforce = {
      ...premium.corporateWorkforce!,
      compensationPolicy: 'premium',
      laborMarketPressure: 30,
    };

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const leanTick = tickCorporateWorkforce(lean, 83, 1);
    const premiumTick = tickCorporateWorkforce(premium, 83, 1);

    expect(
      premiumTick.workforce!.departments.sales.headcount - premiumSales.headcount,
    ).toBeGreaterThan(
      leanTick.workforce!.departments.sales.headcount - leanSales.headcount,
    );
  });

  test('turnover accumulates from poor pay, weak relations, tight labor and low morale', () => {
    const business = makeBusiness();
    const workforce = business.corporateWorkforce!;
    workforce.compensationPolicy = 'lean';
    workforce.trainingPolicy = 'minimal';
    workforce.employeeRelations = 30;
    workforce.laborMarketPressure = 85;
    workforce.departments.operations = {
      ...workforce.departments.operations,
      morale: 40,
      turnoverAccumulator: 0.99,
    };
    business.corporateWorkforce = workforce;

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const tick = tickCorporateWorkforce(business, 90, 1);

    expect(tick.turnoverCount).toBeGreaterThanOrEqual(1);
    expect(tick.workforce!.recentTurnover).toBe(tick.turnoverCount);
    expect(tick.workforce!.employeeRelations).toBeLessThan(30.2);
  });

  test('large employers receive employee-council negotiations', () => {
    const business = makeBusiness(500_000_000);
    business.corporateWorkforce!.laborMarketPressure = 50;
    business.corporateWorkforce!.employeeRelations = 70;
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const event = makeCorporateHrDecision(business, 100);

    expect(event?.title).toBe('Employee Council Negotiation');
    expect(event?.choices.some((choice) => choice.workforceCompensationPolicy === 'competitive')).toBe(true);
    expect(event?.choices.some((choice) => choice.workforceTrainingPolicy === 'development')).toBe(true);
  });

  test('wage pressure creates persistent compensation choices', () => {
    const business = makeBusiness(100_000_000);
    business.corporateWorkforce!.laborMarketPressure = 70;
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const event = makeCorporateHrDecision(business, 100);

    expect(event?.title).toBe('Wage Pressure');
    expect(event?.choices.some((choice) => choice.workforceCompensationPolicy === 'competitive')).toBe(true);
  });

  test('HR restructuring choices can reduce targets and employee relations together', () => {
    const business = makeBusiness();
    const before = business.corporateWorkforce!;
    const beforeOperations = before.departments.operations.targetHeadcount;
    const choice = {
      id: 'restructure',
      text: 'Targeted Restructuring',
      description: 'Reduce staffing targets.',
      workforceTargetMultiplier: 0.90,
      workforceRelationsDelta: -12,
    };

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const after = applyCorporateHrDecisionChoice(
      business,
      before,
      choice,
      100,
      1,
    );

    expect(after.employeeRelations).toBe(58);
    expect(after.departments.operations.targetHeadcount).toBeLessThan(beforeOperations);
    expect(after.nextHrEventWeek).toBeGreaterThan(100);
  });

  test('poor employee relations surface through Business Empire attention', () => {
    const business = makeBusiness();
    business.corporateWorkforce!.employeeRelations = 40;

    expect(getCorporateWorkforceAttentionReason(business))
      .toContain('Employee relations');
  });

  test('weekly simulation surfaces training and hiring costs as explicit expense lines', () => {
    const business = makeBusiness();
    business.corporateWorkforce = {
      ...business.corporateWorkforce!,
      trainingPolicy: 'academy',
    };
    const sales = business.corporateWorkforce.departments.sales;
    business.corporateWorkforce = setCorporateDepartmentTarget(
      business,
      'sales',
      sales.headcount + 20,
      82,
      1,
    );

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = processBusinessWeek(business, 1, 3, 5);
    const breakdown = result.updatedBusiness.lastExpenseBreakdown!;

    expect(breakdown.workforceTraining).toBeGreaterThan(0);
    expect(breakdown.workforceTransition).toBeGreaterThan(0);
    expect(
      Object.values(breakdown).reduce((sum, amount) => sum + (amount ?? 0), 0),
    ).toBe(result.weeklyExpenses);
  });

  test('corporate HR event is prioritized when its review week arrives', () => {
    const business = makeBusiness();
    business.corporateWorkforce = {
      ...business.corporateWorkforce!,
      laborMarketPressure: 70,
      nextHrEventWeek: 83,
    };
    business.nextStrategicDecisionWeek = 1;
    business.nextCrisisCheckWeek = 1;

    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = processBusinessWeek(business, 1, 3, 5); // global week 83

    expect(result.updatedBusiness.pendingDecision?.title).toBe('Wage Pressure');
    expect(result.updatedBusiness.corporateWorkforce!.nextHrEventWeek).toBeGreaterThan(83);
  });
});
