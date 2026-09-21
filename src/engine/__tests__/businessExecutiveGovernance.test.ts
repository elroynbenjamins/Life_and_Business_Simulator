import { createBusiness, processBusinessWeek } from '../businessEngine';
import {
  BOARD_GOVERNANCE_UNLOCK_VALUATION,
  BUSINESS_EXECUTIVE_ROLES,
  createDefaultBoardGovernance,
  generateExecutiveSearch,
  getBusinessGovernanceAttentionReason,
  getBusinessGovernanceEffects,
  getExecutiveRoleEligibility,
  hireExecutiveCandidate,
  tickBusinessGovernance,
} from '../businessGovernanceEngine';
import { createBusinessBudgetPlan, getBusinessBudgetReserveTargets } from '../businessBudgetEngine';
import { getProjectFinanceQuote } from '../corporateFinanceEngine';
import { getBusinessInsuranceQuote } from '../businessInsuranceEngine';
import { createDefaultBusinessReinvestmentState, tickBusinessReinvestment } from '../businessReinvestmentEngine';
import { BusinessExecutive, BusinessExecutiveRole, OwnedBusiness } from '../../types/game';

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

function makeBusiness(overrides: Partial<OwnedBusiness> = {}): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Governed Coffee Group', 1, 4, 1)!;
  return {
    ...base,
    valuation: 100_000_000,
    balance: 25_000_000,
    reputation: 90,
    level: 6,
    employees: [employee('A'), employee('B'), employee('C')],
    lastWeekRevenue: 2_000_000,
    lastWeekExpenses: 1_500_000,
    lastWeekProfit: 500_000,
    weeklyProfitHistory: Array(20).fill(500_000),
    reinvestment: createDefaultBusinessReinvestmentState(61),
    insurancePolicies: {
      property: 'standard',
      equipment: 'standard',
      cyber: 'standard',
      liability: 'standard',
    },
    budgetPlan: createBusinessBudgetPlan('balanced', 4),
    budgetReserves: { reinvestment: 0, growth: 0 },
    executives: [],
    pendingExecutiveSearch: null,
    boardGovernance: null,
    ...overrides,
  };
}

function executive(role: BusinessExecutiveRole, performance = 90): BusinessExecutive {
  return {
    id: 'exec_' + role,
    role,
    name: role.toUpperCase(),
    performance,
    weeklySalary: 10_000,
    signingFee: 80_000,
    trait: BUSINESS_EXECUTIVE_ROLES[role].traits[0],
    appointedGlobalWeek: 60,
    tenureWeeks: 20,
    nextReviewGlobalWeek: 200,
  };
}

describe('professional executive and board governance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('executive roles unlock at different company scales and reputation', () => {
    const small = makeBusiness({ valuation: 9_000_000 });
    expect(getExecutiveRoleEligibility(small, 'cfo').allowed).toBe(false);

    const tenMillion = makeBusiness({ valuation: 10_000_000, reputation: 60 });
    expect(getExecutiveRoleEligibility(tenMillion, 'cfo').allowed).toBe(true);
    expect(getExecutiveRoleEligibility(tenMillion, 'coo').allowed).toBe(true);
    expect(getExecutiveRoleEligibility(tenMillion, 'cto').allowed).toBe(false);

    const fiftyMillion = makeBusiness({ valuation: 50_000_000, reputation: 70 });
    expect(getExecutiveRoleEligibility(fiftyMillion, 'general_counsel').allowed).toBe(true);
  });

  test('executive search returns three paid candidates with eight-week signing fees', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const search = generateExecutiveSearch(makeBusiness(), 'cfo', 80)!;

    expect(search.candidates).toHaveLength(3);
    for (const candidate of search.candidates) {
      expect(candidate.performance).toBeGreaterThanOrEqual(55);
      expect(candidate.weeklySalary).toBeGreaterThan(0);
      expect(candidate.signingFee).toBe(candidate.weeklySalary * 8);
      expect(candidate.role).toBe('cfo');
    }

    const hired = hireExecutiveCandidate(search.candidates[0], 80);
    expect(hired.appointedGlobalWeek).toBe(80);
    expect(hired.nextReviewGlobalWeek).toBe(100);
  });

  test('full high-performing C-suite remains within governance effect caps', () => {
    const business = makeBusiness({
      executives: [
        executive('cfo'),
        executive('coo'),
        executive('cto'),
        executive('cmo'),
        executive('general_counsel'),
      ],
      boardGovernance: {
        ...createDefaultBoardGovernance(4, 'risk_committee'),
        confidence: 90,
      },
    });
    const effects = getBusinessGovernanceEffects(business);

    expect(effects.executiveWeeklySalary).toBe(50_000);
    expect(effects.boardWeeklyCost).toBeGreaterThan(0);
    expect(effects.revenueBonus).toBeLessThanOrEqual(0.05);
    expect(effects.expenseReduction).toBeLessThanOrEqual(0.05);
    expect(effects.crisisReduction).toBeLessThanOrEqual(0.08);
    expect(effects.financingRateReduction).toBeLessThanOrEqual(0.0125);
    expect(effects.technologyWearReduction).toBeLessThanOrEqual(0.30);
    expect(effects.cyberPremiumReduction).toBeLessThanOrEqual(0.20);
    expect(effects.liabilityPremiumReduction).toBeLessThanOrEqual(0.20);
  });

  test('CFO improves treasury efficiency and corporate financing terms', () => {
    const plain = makeBusiness();
    const withCfo = makeBusiness({ executives: [executive('cfo', 90)] });

    const plainReserve = getBusinessBudgetReserveTargets(plain, 100_000, 1).operatingReserveTarget;
    const cfoReserve = getBusinessBudgetReserveTargets(withCfo, 100_000, 1).operatingReserveTarget;
    expect(cfoReserve).toBeLessThan(plainReserve);

    const plainQuote = getProjectFinanceQuote(plain, 20_000_000, 0);
    const cfoQuote = getProjectFinanceQuote(withCfo, 20_000_000, 0);
    expect(cfoQuote.interestRate).toBeLessThan(plainQuote.interestRate);
  });

  test('COO and CTO slow physical and technology wear', () => {
    const plain = makeBusiness();
    const governed = makeBusiness({
      executives: [executive('coo', 90), executive('cto', 90)],
    });

    const plainTick = tickBusinessReinvestment(plain, 82);
    const governedTick = tickBusinessReinvestment(governed, 82);

    expect(governedTick.reinvestment.technology.condition)
      .toBeGreaterThan(plainTick.reinvestment.technology.condition);
    expect(governedTick.reinvestment.premises.condition)
      .toBeGreaterThan(plainTick.reinvestment.premises.condition);
    expect(governedTick.reinvestment.equipment.condition)
      .toBeGreaterThan(plainTick.reinvestment.equipment.condition);
  });

  test('CTO, counsel and risk committee reduce cyber and liability premiums', () => {
    const plain = makeBusiness();
    const governed = makeBusiness({
      executives: [executive('cto', 90), executive('general_counsel', 90)],
      boardGovernance: {
        ...createDefaultBoardGovernance(4, 'risk_committee'),
        confidence: 80,
      },
    });

    expect(getBusinessInsuranceQuote(governed, 'cyber', 'standard', 80).weeklyPremium)
      .toBeLessThan(getBusinessInsuranceQuote(plain, 'cyber', 'standard', 80).weeklyPremium);
    expect(getBusinessInsuranceQuote(governed, 'liability', 'standard', 80).weeklyPremium)
      .toBeLessThan(getBusinessInsuranceQuote(plain, 'liability', 'standard', 80).weeklyPremium);
  });

  test('annual board review updates confidence and records a review summary', () => {
    const business = makeBusiness({
      executives: [
        executive('cfo'),
        executive('coo'),
        executive('cto'),
        executive('cmo'),
        executive('general_counsel'),
      ],
      boardGovernance: {
        ...createDefaultBoardGovernance(3, 'balanced_oversight'),
        confidence: 60,
        lastReviewYear: 3,
      },
      budgetPlan: createBusinessBudgetPlan('balanced', 4),
    });
    const tick = tickBusinessGovernance(business, 2_100_000, 550_000, 1, 4);

    expect(tick.boardGovernance?.lastReviewYear).toBe(4);
    expect(tick.boardGovernance?.confidence).toBeGreaterThan(60);
    expect(tick.boardGovernance?.lastReviewSummary).toContain('profitable');
    expect(tick.timelineEntries.some((entry) => entry.title.includes('Board annual review'))).toBe(true);
  });

  test('poor executive can leave at a scheduled review', () => {
    const weak = {
      ...executive('cfo', 30),
      nextReviewGlobalWeek: 80,
    };
    const business = makeBusiness({
      executives: [weak],
      boardGovernance: {
        ...createDefaultBoardGovernance(3, 'founder_led'),
        confidence: 25,
      },
    });
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const tick = tickBusinessGovernance(business, 1_500_000, -100_000, 20, 4);

    expect(tick.executives).toHaveLength(0);
    expect(tick.timelineEntries.some((entry) => entry.title.includes('left the CFO role'))).toBe(true);
  });

  test('executive salary is included in weekly salary expense', () => {
    const plain = makeBusiness();
    const governed = makeBusiness({
      executives: [executive('cfo', 50)],
    });
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const plainWeek = processBusinessWeek(plain, 1, 5, 4);
    const governedWeek = processBusinessWeek(governed, 1, 5, 4);

    expect(
      (governedWeek.updatedBusiness.lastExpenseBreakdown?.salaries ?? 0)
      - (plainWeek.updatedBusiness.lastExpenseBreakdown?.salaries ?? 0)
    ).toBe(10_000);
  });

  test('governance attention flags missing boards and severe executive vacancies at scale', () => {
    const noBoard = makeBusiness({
      valuation: 75_000_000,
      executives: [],
      boardGovernance: null,
    });
    expect(getBusinessGovernanceAttentionReason(noBoard)).toContain('Board governance');

    const boardButVacant = makeBusiness({
      valuation: 75_000_000,
      executives: [],
      boardGovernance: createDefaultBoardGovernance(4, 'balanced_oversight'),
    });
    expect(getBusinessGovernanceAttentionReason(boardButVacant)).toContain('executive positions');
  });

  test('board governance unlock threshold stays at corporate scale', () => {
    expect(BOARD_GOVERNANCE_UNLOCK_VALUATION).toBe(25_000_000);
  });
});
