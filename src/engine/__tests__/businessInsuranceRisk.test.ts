import {
  createBusiness,
  makeBusinessCrisis,
  processBusinessWeek,
} from '../businessEngine';
import {
  BUSINESS_INSURANCE_AREAS,
  getBusinessCoverageGaps,
  getBusinessInsuranceLossQuote,
  getBusinessInsuranceQuote,
  getBusinessInsuranceRiskSummary,
  getBusinessInsuranceTotalWeeklyPremium,
  normalizeBusinessInsurancePolicies,
  resolveBusinessInsuranceLoss,
} from '../businessInsuranceEngine';
import { createDefaultBusinessReinvestmentState } from '../businessReinvestmentEngine';
import { makeCorporateScaleCrisis } from '../corporateScaleEngine';
import { OwnedBusiness } from '../../types/game';

function employee(id: string) {
  return {
    id,
    roleId: 'worker',
    name: id,
    skill: 60,
    morale: 75,
    experience: 20,
    potential: 75,
    age: 30,
    weeksEmployed: 20,
    weeklySalary: 260,
    inTrainingId: null,
    trainingWeeksRemaining: 0,
    tier: 'common' as const,
    buffs: [],
  };
}

function makeBusiness(overrides: Partial<OwnedBusiness> = {}): OwnedBusiness {
  const business = createBusiness('coffee_shop', 'Insured Coffee', 1, 3, 1)!;
  return {
    ...business,
    valuation: 1_000_000,
    balance: 2_000_000,
    reputation: 80,
    level: 5,
    employees: [employee('A'), employee('B'), employee('C')],
    lastWeekRevenue: 80_000,
    lastWeekExpenses: 60_000,
    lastWeekProfit: 20_000,
    weeklyProfitHistory: Array(20).fill(20_000),
    reinvestment: createDefaultBusinessReinvestmentState(41),
    insurancePolicies: {
      property: 'none',
      equipment: 'none',
      cyber: 'none',
      liability: 'none',
    },
    insuranceClaims: [],
    ...overrides,
  };
}

describe('business insurance and operational risk', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('normalizes legacy saves to four explicit uninsured policy areas', () => {
    expect(normalizeBusinessInsurancePolicies(undefined)).toEqual({
      property: 'none',
      equipment: 'none',
      cyber: 'none',
      liability: 'none',
    });
    expect(Object.keys(BUSINESS_INSURANCE_AREAS)).toEqual([
      'property',
      'equipment',
      'cyber',
      'liability',
    ]);
  });

  test('premium scales with coverage tier and leaves none at zero', () => {
    const business = makeBusiness();
    const none = getBusinessInsuranceQuote(business, 'property', 'none', 50);
    const basic = getBusinessInsuranceQuote(business, 'property', 'basic', 50);
    const standard = getBusinessInsuranceQuote(business, 'property', 'standard', 50);
    const comprehensive = getBusinessInsuranceQuote(business, 'property', 'comprehensive', 50);

    expect(none.weeklyPremium).toBe(0);
    expect(basic.weeklyPremium).toBeGreaterThan(0);
    expect(standard.weeklyPremium).toBeGreaterThan(basic.weeklyPremium);
    expect(comprehensive.weeklyPremium).toBeGreaterThan(standard.weeklyPremium);
    expect(comprehensive.coveragePct).toBe(0.80);
    expect(comprehensive.deductiblePct).toBe(0.04);
  });

  test('poor underlying condition makes the related insurance more expensive', () => {
    const healthy = makeBusiness({
      insurancePolicies: {
        property: 'standard',
        equipment: 'none',
        cyber: 'none',
        liability: 'none',
      },
    });
    const neglected = {
      ...healthy,
      reinvestment: {
        technology: { condition: 100, lastRenewedGlobalWeek: 41 },
        premises: { condition: 30, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 100, lastRenewedGlobalWeek: 41 },
      },
    };

    expect(getBusinessInsuranceQuote(neglected, 'property', 'standard', 80).weeklyPremium)
      .toBeGreaterThan(getBusinessInsuranceQuote(healthy, 'property', 'standard', 80).weeklyPremium);
  });

  test('recent claims raise premiums without permanently changing the policy tier', () => {
    const business = makeBusiness({
      insurancePolicies: {
        property: 'standard',
        equipment: 'none',
        cyber: 'none',
        liability: 'none',
      },
    });
    const before = getBusinessInsuranceQuote(business, 'property', 'standard', 100).weeklyPremium;
    const afterClaim = getBusinessInsuranceQuote({
      ...business,
      insuranceClaims: [{
        id: 'claim_1',
        area: 'property',
        policyTier: 'standard',
        incidentTitle: 'Premises Damage',
        globalWeek: 90,
        grossLoss: 100_000,
        deductible: 8_000,
        payout: 59_800,
        netLoss: 40_200,
      }],
    }, 'property', 'standard', 100).weeklyPremium;

    expect(afterClaim).toBeGreaterThan(before);
  });

  test('claim math always leaves a deductible/residual loss and never erases the incident', () => {
    expect(getBusinessInsuranceLossQuote('none', 100_000)).toEqual({
      netLoss: 100_000,
      payout: 0,
      deductible: 100_000,
    });
    expect(getBusinessInsuranceLossQuote('standard', 100_000)).toEqual({
      netLoss: 40_200,
      payout: 59_800,
      deductible: 8_000,
    });
    expect(getBusinessInsuranceLossQuote('comprehensive', 100_000)).toEqual({
      netLoss: 23_200,
      payout: 76_800,
      deductible: 4_000,
    });
  });

  test('resolved claims create an auditable claim record', () => {
    const business = makeBusiness();
    const result = resolveBusinessInsuranceLoss(
      business,
      'equipment',
      'standard',
      250_000,
      'Major Equipment Failure',
      100,
    );

    expect(result.payout).toBeGreaterThan(0);
    expect(result.netLoss).toBeGreaterThan(0);
    expect(result.claim?.area).toBe('equipment');
    expect(result.claim?.grossLoss).toBe(250_000);
    expect(result.claim?.netLoss).toBe(result.netLoss);
  });

  test('local operational crisis snapshots the policy that existed when the incident appeared', () => {
    const business = makeBusiness({
      reinvestment: {
        technology: { condition: 100, lastRenewedGlobalWeek: 41 },
        premises: { condition: 30, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 100, lastRenewedGlobalWeek: 41 },
      },
      insurancePolicies: {
        property: 'standard',
        equipment: 'none',
        cyber: 'none',
        liability: 'none',
      },
    });
    jest.spyOn(Math, 'random').mockReturnValue(0.99);

    const incident = makeBusinessCrisis(business, 100);

    expect(incident.title).toBe('Premises Damage');
    expect(incident.insuranceArea).toBe('property');
    expect(incident.insuranceTierAtCreation).toBe('standard');

    const changedLater = {
      ...business,
      insurancePolicies: { ...business.insurancePolicies!, property: 'comprehensive' as const },
    };
    expect(changedLater.insurancePolicies.property).toBe('comprehensive');
    expect(incident.insuranceTierAtCreation).toBe('standard');
  });

  test('corporate cyber and liability incidents snapshot the relevant policies', () => {
    const business = makeBusiness({
      valuation: 100_000_000,
      insurancePolicies: {
        property: 'basic',
        equipment: 'standard',
        cyber: 'comprehensive',
        liability: 'standard',
      },
    });

    jest.spyOn(Math, 'random').mockReturnValue(0);
    const cyber = makeCorporateScaleCrisis(business, 120);
    expect(cyber.title).toBe('Cybersecurity Incident');
    expect(cyber.insuranceArea).toBe('cyber');
    expect(cyber.insuranceTierAtCreation).toBe('comprehensive');

    (Math.random as jest.Mock).mockReturnValue(0.99);
    const recall = makeCorporateScaleCrisis(business, 121);
    expect(recall.title).toBe('Product / Service Recall');
    expect(recall.insuranceArea).toBe('liability');
    expect(recall.insuranceTierAtCreation).toBe('standard');
  });

  test('corporate companies with no cyber or liability cover surface coverage gaps', () => {
    const business = makeBusiness({ valuation: 50_000_000 });
    expect(getBusinessCoverageGaps(business)).toEqual(['cyber', 'liability']);

    const covered = {
      ...business,
      insurancePolicies: {
        property: 'none' as const,
        equipment: 'none' as const,
        cyber: 'standard' as const,
        liability: 'standard' as const,
      },
    };
    expect(getBusinessCoverageGaps(covered)).toEqual([]);
    expect(getBusinessInsuranceRiskSummary(covered).coveredAreas).toBe(2);
  });

  test('explicit policy premiums feed the weekly insurance expense line exactly', () => {
    const insured = makeBusiness({
      insurancePolicies: {
        property: 'standard',
        equipment: 'standard',
        cyber: 'standard',
        liability: 'standard',
      },
    });
    const uninsured = {
      ...insured,
      insurancePolicies: {
        property: 'none' as const,
        equipment: 'none' as const,
        cyber: 'none' as const,
        liability: 'none' as const,
      },
    };
    const premium = getBusinessInsuranceTotalWeeklyPremium(insured, 45);

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const insuredWeek = processBusinessWeek(insured, 1, 5, 3);
    const uninsuredWeek = processBusinessWeek(uninsured, 1, 5, 3);

    expect(
      (insuredWeek.updatedBusiness.lastExpenseBreakdown?.insurance ?? 0)
      - (uninsuredWeek.updatedBusiness.lastExpenseBreakdown?.insurance ?? 0)
    ).toBe(premium);
  });
});
