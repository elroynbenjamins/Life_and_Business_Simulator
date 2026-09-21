import {
  createBusiness,
  processBusinessWeek,
} from '../businessEngine';
import {
  CORPORATE_WORKFORCE_UNLOCK_VALUATION,
  createCorporateWorkforce,
  getCorporateWorkforceAttentionReason,
  getCorporateWorkforceEffects,
  getCorporateWorkforceWeeklyPayroll,
  getRecommendedCorporateHeadcount,
  getRecommendedDepartmentHeadcounts,
  setCorporateDepartmentTarget,
  tickCorporateWorkforce,
} from '../businessWorkforceEngine';
import { getCorporateCreditProfile } from '../corporateFinanceEngine';
import { getBusinessInsuranceQuote } from '../businessInsuranceEngine';
import { tickBusinessReinvestment } from '../businessReinvestmentEngine';
import { BUSINESS_EXECUTIVE_ROLES } from '../businessGovernanceEngine';
import { createAcquiredBusiness, generateAcquisitionTargets } from '../acquisitionEngine';
import { INITIAL_GAME_STATE, OwnedBusiness } from '../../types/game';

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

function makeCorporateBusiness(overrides: Partial<OwnedBusiness> = {}): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Workforce Coffee Group', 1, 1, 1)!;
  const business: OwnedBusiness = {
    ...base,
    valuation: 100_000_000,
    balance: 20_000_000,
    reputation: 85,
    level: 6,
    foundedYear: 1,
    foundedWeek: 1,
    employees: [employee('A'), employee('B'), employee('C')],
    lastWeekRevenue: 2_000_000,
    lastWeekExpenses: 1_500_000,
    lastWeekProfit: 500_000,
    weeklyProfitHistory: Array(20).fill(500_000),
    ...overrides,
  };
  business.corporateWorkforce = createCorporateWorkforce(business, 81, 1);
  return business;
}

describe('corporate department workforce', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('corporate workforce unlocks at €25M and scales gradually with valuation', () => {
    expect(CORPORATE_WORKFORCE_UNLOCK_VALUATION).toBe(25_000_000);
    expect(getRecommendedCorporateHeadcount(makeCorporateBusiness({ valuation: 24_999_999, corporateWorkforce: null }))).toBe(0);

    const at25 = getRecommendedCorporateHeadcount(makeCorporateBusiness({ valuation: 25_000_000, corporateWorkforce: null }));
    const at100 = getRecommendedCorporateHeadcount(makeCorporateBusiness({ valuation: 100_000_000, corporateWorkforce: null }));
    const at500 = getRecommendedCorporateHeadcount(makeCorporateBusiness({ valuation: 500_000_000, corporateWorkforce: null }));

    expect(at25).toBeGreaterThanOrEqual(85);
    expect(at25).toBeLessThanOrEqual(95);
    expect(at100).toBeGreaterThanOrEqual(145);
    expect(at100).toBeLessThanOrEqual(155);
    expect(at500).toBeGreaterThan(at100);
    expect(at500).toBeLessThan(350);
  });

  test('department mix varies by industry', () => {
    const technology = makeCorporateBusiness({ typeId: 'software_company' });
    const manufacturing = makeCorporateBusiness({ typeId: 'manufacturing_business' });

    const techMix = getRecommendedDepartmentHeadcounts(technology);
    const manufacturingMix = getRecommendedDepartmentHeadcounts(manufacturing);

    expect(techMix.technology).toBeGreaterThan(techMix.finance);
    expect(manufacturingMix.operations).toBeGreaterThan(manufacturingMix.sales);
    expect(manufacturingMix.operations).toBeGreaterThan(techMix.operations);
  });

  test('new workforce starts at recommended staffing and has real payroll', () => {
    const business = makeCorporateBusiness();
    const workforce = business.corporateWorkforce!;
    const recommended = getRecommendedDepartmentHeadcounts(business);

    expect(workforce.departments.operations.headcount).toBe(recommended.operations);
    expect(workforce.departments.sales.headcount).toBe(recommended.sales);
    expect(getCorporateWorkforceWeeklyPayroll(workforce)).toBeGreaterThan(100_000);
    expect(getCorporateWorkforceEffects(business).staffingScore).toBeGreaterThanOrEqual(90);
  });

  test('department targets are constrained to a reasonable planning range', () => {
    const business = makeCorporateBusiness();
    const recommended = getRecommendedDepartmentHeadcounts(business).sales;

    const tooLow = setCorporateDepartmentTarget(business, 'sales', 0, 82, 1)!;
    const tooHigh = setCorporateDepartmentTarget(business, 'sales', 10_000, 82, 1)!;

    expect(tooLow.departments.sales.targetHeadcount).toBe(Math.max(1, Math.floor(recommended * 0.40)));
    expect(tooHigh.departments.sales.targetHeadcount).toBe(Math.ceil(recommended * 1.60));
  });

  test('hiring and layoffs move gradually and carry transition costs', () => {
    const business = makeCorporateBusiness({ balance: 30_000_000, lastWeekExpenses: 1_000_000 });
    const workforce = business.corporateWorkforce!;
    business.corporateWorkforce = setCorporateDepartmentTarget(
      business,
      'sales',
      workforce.departments.sales.headcount + 40,
      82,
      1,
    );

    const before = business.corporateWorkforce!.departments.sales.headcount;
    const hiringTick = tickCorporateWorkforce(business, 83, 1);
    const after = hiringTick.workforce!.departments.sales.headcount;

    expect(after).toBeGreaterThan(before);
    expect(after - before).toBeLessThanOrEqual(Math.max(2, Math.ceil((before + 40) * 0.06)));
    expect(hiringTick.transitionCost).toBeGreaterThan(0);

    const layoffBusiness = {
      ...business,
      corporateWorkforce: setCorporateDepartmentTarget(
        { ...business, corporateWorkforce: hiringTick.workforce },
        'sales',
        Math.max(1, after - 30),
        84,
        1,
      ),
    };
    const moraleBefore = layoffBusiness.corporateWorkforce!.departments.sales.morale;
    const layoffTick = tickCorporateWorkforce(layoffBusiness, 85, 1);

    expect(layoffTick.workforce!.departments.sales.headcount).toBeLessThan(after);
    expect(layoffTick.workforce!.departments.sales.morale).toBeLessThan(moraleBefore);
    expect(layoffTick.transitionCost).toBeGreaterThan(0);
  });

  test('staffing changes wait when the company cannot afford onboarding or severance above its cash buffer', () => {
    const business = makeCorporateBusiness({
      balance: 3_000_000,
      lastWeekExpenses: 1_000_000,
    });
    const current = business.corporateWorkforce!.departments.operations.headcount;
    business.corporateWorkforce = setCorporateDepartmentTarget(
      business,
      'operations',
      current + 30,
      82,
      1,
    );

    const tick = tickCorporateWorkforce(business, 83, 1);

    expect(tick.workforce!.departments.operations.headcount).toBe(current);
    expect(tick.transitionCost).toBe(0);
    expect(tick.workforce!.departments.operations.targetHeadcount).toBeGreaterThan(current);
  });

  test('broad understaffing reduces capacity and increases risk', () => {
    const business = makeCorporateBusiness();
    const recommended = getRecommendedDepartmentHeadcounts(business);
    const workforce = business.corporateWorkforce!;

    for (const id of ['operations', 'sales', 'finance', 'technology', 'support'] as const) {
      workforce.departments[id] = {
        ...workforce.departments[id],
        headcount: Math.max(1, Math.floor(recommended[id] * 0.55)),
        targetHeadcount: Math.max(1, Math.floor(recommended[id] * 0.55)),
      };
    }

    const effects = getCorporateWorkforceEffects({ ...business, corporateWorkforce: workforce });

    expect(effects.staffingScore).toBeLessThan(70);
    expect(effects.revenueBonus).toBeLessThan(0);
    expect(effects.expenseReduction).toBeLessThan(0);
    expect(effects.crisisReduction).toBeLessThan(0);
    expect(getCorporateWorkforceAttentionReason({ ...business, corporateWorkforce: workforce })).toContain('staffed');
  });

  test('matching C-suite executive increases effective department capacity', () => {
    const plain = makeCorporateBusiness();
    const led = makeCorporateBusiness({
      executives: [{
        id: 'exec_cmo',
        role: 'cmo',
        name: 'CMO',
        performance: 90,
        weeklySalary: 10_000,
        signingFee: 80_000,
        trait: BUSINESS_EXECUTIVE_ROLES.cmo.traits[0],
        appointedGlobalWeek: 60,
        tenureWeeks: 20,
        nextReviewGlobalWeek: 100,
      }],
    });
    led.corporateWorkforce = plain.corporateWorkforce;

    expect(getCorporateWorkforceEffects(led).departmentRatios.sales)
      .toBeGreaterThan(getCorporateWorkforceEffects(plain).departmentRatios.sales);
  });

  test('finance understaffing can weaken corporate credit quality', () => {
    const healthy = makeCorporateBusiness();
    const weak = makeCorporateBusiness();
    const recommended = getRecommendedDepartmentHeadcounts(weak);
    weak.corporateWorkforce!.departments.finance = {
      ...weak.corporateWorkforce!.departments.finance,
      headcount: Math.max(1, Math.floor(recommended.finance * 0.45)),
      targetHeadcount: Math.max(1, Math.floor(recommended.finance * 0.45)),
    };

    expect(getCorporateCreditProfile(weak).score).toBeLessThan(getCorporateCreditProfile(healthy).score);
  });

  test('technology and support understaffing increase cyber and liability premium pressure', () => {
    const healthy = makeCorporateBusiness({
      insurancePolicies: {
        property: 'standard',
        equipment: 'standard',
        cyber: 'standard',
        liability: 'standard',
      },
    });
    const weak = makeCorporateBusiness({
      insurancePolicies: healthy.insurancePolicies,
    });
    const recommended = getRecommendedDepartmentHeadcounts(weak);
    weak.corporateWorkforce!.departments.technology.headcount = Math.max(1, Math.floor(recommended.technology * 0.5));
    weak.corporateWorkforce!.departments.support.headcount = Math.max(1, Math.floor(recommended.support * 0.5));

    expect(getBusinessInsuranceQuote(weak, 'cyber', 'standard', 90).weeklyPremium)
      .toBeGreaterThan(getBusinessInsuranceQuote(healthy, 'cyber', 'standard', 90).weeklyPremium);
    expect(getBusinessInsuranceQuote(weak, 'liability', 'standard', 90).weeklyPremium)
      .toBeGreaterThan(getBusinessInsuranceQuote(healthy, 'liability', 'standard', 90).weeklyPremium);
  });

  test('operations and technology understaffing accelerate corresponding infrastructure wear', () => {
    const healthy = makeCorporateBusiness();
    const weak = makeCorporateBusiness();
    const recommended = getRecommendedDepartmentHeadcounts(weak);
    weak.corporateWorkforce!.departments.operations.headcount = Math.max(1, Math.floor(recommended.operations * 0.5));
    weak.corporateWorkforce!.departments.technology.headcount = Math.max(1, Math.floor(recommended.technology * 0.5));

    const healthyTick = tickBusinessReinvestment(healthy, 90);
    const weakTick = tickBusinessReinvestment(weak, 90);

    expect(weakTick.reinvestment.technology.condition).toBeLessThan(healthyTick.reinvestment.technology.condition);
    expect(weakTick.reinvestment.equipment.condition).toBeLessThan(healthyTick.reinvestment.equipment.condition);
  });

  test('weekly salary expense includes corporate department payroll', () => {
    const business = makeCorporateBusiness({
      foundedYear: 1,
      foundedWeek: 1,
      balance: 30_000_000,
    });
    const payroll = getCorporateWorkforceWeeklyPayroll(business.corporateWorkforce);

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = processBusinessWeek(business, 1, 5, 5);

    expect(result.updatedBusiness.lastExpenseBreakdown?.salaries)
      .toBe(900 + payroll);
  });

  test('mature acquisitions are created with their corporate workforce already visible', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const targets = generateAcquisitionTargets(120, 1, 1);
    const target = targets.find((item) => item.estimatedValue >= CORPORATE_WORKFORCE_UNLOCK_VALUATION);
    expect(target).toBeTruthy();

    const acquired = createAcquiredBusiness(
      target!,
      { ...INITIAL_GAME_STATE, week: 8, year: 7, inflationMultiplier: 1 },
    )!;

    expect(acquired.corporateWorkforce).toBeTruthy();
    expect(getCorporateWorkforceWeeklyPayroll(acquired.corporateWorkforce)).toBeGreaterThan(0);
  });
});
