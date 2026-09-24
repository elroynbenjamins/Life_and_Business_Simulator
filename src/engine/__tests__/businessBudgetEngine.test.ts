import {
  applyBusinessBudgetWeek,
  BUSINESS_BUDGET_PRESETS,
  consumeBusinessBudgetReserve,
  createBusinessBudgetPlan,
  getBusinessBudgetReserveTargets,
  isBusinessBudgetReviewDue,
  normalizeBusinessBudgetPlan,
} from '../businessBudgetEngine';
import { createBusiness, processBusinessWeek } from '../businessEngine';
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
  const business = createBusiness('coffee_shop', 'Budget Coffee', 1, 3, 1)!;
  return {
    ...business,
    balance: 1_000_000,
    valuation: 1_000_000,
    reputation: 80,
    level: 4,
    employees: [employee('A'), employee('B'), employee('C')],
    lastWeekRevenue: 100_000,
    lastWeekExpenses: 70_000,
    lastWeekProfit: 30_000,
    weeklyProfitHistory: Array(20).fill(30_000),
    budgetPlan: createBusinessBudgetPlan('balanced', 3),
    budgetReserves: { reinvestment: 0, growth: 0 },
    ...overrides,
  };
}

describe('business budget engine', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('all budget presets allocate no more than 100 percent of profit', () => {
    for (const preset of Object.values(BUSINESS_BUDGET_PRESETS)) {
      const total = preset.dividendPct + preset.debtPaydownPct + preset.reinvestmentPct + preset.growthPct;
      expect(total).toBeLessThanOrEqual(1.0001);
      expect(preset.targetReserveWeeks).toBeGreaterThanOrEqual(6);
    }
  });

  test('legacy standard profile normalizes to balanced instead of duplicating Returns', () => {
    const plan = createBusinessBudgetPlan('standard', 3);
    expect(plan.profile).toBe('balanced');

    const normalized = normalizeBusinessBudgetPlan({
      profile: 'standard',
      targetReserveWeeks: 6,
      dividendPct: 0.70,
      debtPaydownPct: 0,
      reinvestmentPct: 0.15,
      growthPct: 0.15,
      reviewYear: 3,
    });
    expect(normalized.profile).toBe('balanced');
    expect(normalized.dividendPct).toBeCloseTo(0.25);
    expect(normalized.targetReserveWeeks).toBe(8);
  });

  test('operating and earmarked reserves can suppress dividends when liquidity is tight', () => {
    const business = makeBusiness({
      budgetPlan: createBusinessBudgetPlan('balanced', 3),
    });
    const result = applyBusinessBudgetWeek({
      business,
      balanceBeforeBudget: 70_000,
      profit: 100_000,
      totalExpenses: 10_000,
      loans: [],
      currentWeek: 5,
      currentYear: 3,
      inflationMultiplier: 1,
    });

    expect(result.snapshot.operatingReserveTarget).toBe(80_000);
    expect(result.dividendPaid).toBe(0);
    expect(result.reserves.reinvestment).toBe(0);
  });

  test('deleveraging profile makes extra payments against highest-rate debt first', () => {
    const business = makeBusiness({
      budgetPlan: createBusinessBudgetPlan('deleveraging', 3),
      businessLoans: [
        {
          id: 'cheap',
          amount: 100_000,
          remainingAmount: 100_000,
          weeklyPayment: 5_000,
          weeksRemaining: 20,
          interestRate: 0.05,
          purpose: 'operating',
        },
        {
          id: 'expensive',
          amount: 100_000,
          remainingAmount: 100_000,
          weeklyPayment: 5_000,
          weeksRemaining: 20,
          interestRate: 0.12,
          purpose: 'operating',
        },
      ],
    });
    const result = applyBusinessBudgetWeek({
      business,
      balanceBeforeBudget: 1_000_000,
      profit: 100_000,
      totalExpenses: 10_000,
      loans: business.businessLoans,
      currentWeek: 5,
      currentYear: 3,
      inflationMultiplier: 1,
    });

    expect(result.snapshot.extraDebtPaid).toBe(55_000);
    expect(result.loans.find((loan) => loan.id === 'expensive')?.remainingAmount).toBe(45_000);
    expect(result.loans.find((loan) => loan.id === 'cheap')?.remainingAmount).toBe(100_000);
    expect(result.dividendPaid).toBe(10_000);
  });

  test('automatic debt paydown does not raid existing upkeep or growth earmarks', () => {
    const business = makeBusiness({
      budgetPlan: createBusinessBudgetPlan('deleveraging', 3),
      budgetReserves: { reinvestment: 100_000, growth: 100_000 },
      businessLoans: [{
        id: 'loan',
        amount: 100_000,
        remainingAmount: 100_000,
        weeklyPayment: 5_000,
        weeksRemaining: 20,
        interestRate: 0.12,
        purpose: 'operating',
      }],
    });
    const result = applyBusinessBudgetWeek({
      business,
      balanceBeforeBudget: 310_000,
      profit: 100_000,
      totalExpenses: 10_000,
      loans: business.businessLoans,
      currentWeek: 5,
      currentYear: 3,
      inflationMultiplier: 1,
    });

    // 10-week operating reserve = 100k, plus 200k existing earmarks.
    expect(result.snapshot.extraDebtPaid).toBe(10_000);
    expect(result.reserves.reinvestment).toBeGreaterThanOrEqual(100_000);
    expect(result.reserves.growth).toBeGreaterThanOrEqual(100_000);
  });

  test('growth and reinvestment earmarks are labels inside company cash and have bounded targets', () => {
    const business = makeBusiness({ valuation: 10_000_000 });
    const targets = getBusinessBudgetReserveTargets(business, 100_000, 1);

    expect(targets.operatingReserveTarget).toBe(800_000);
    expect(targets.reinvestmentReserveTarget).toBeGreaterThan(0);
    expect(targets.growthReserveTarget).toBe(800_000);

    const consumed = consumeBusinessBudgetReserve(
      { reinvestment: 200_000, growth: 500_000 },
      'growth',
      125_000,
    );
    expect(consumed).toEqual({ reinvestment: 200_000, growth: 375_000 });
  });

  test('budget allocation never erases a negative business cash balance', () => {
    const business = makeBusiness();
    const result = applyBusinessBudgetWeek({
      business,
      balanceBeforeBudget: -25_000,
      profit: -15_000,
      totalExpenses: 20_000,
      loans: [],
      currentWeek: 5,
      currentYear: 3,
      inflationMultiplier: 1,
    });

    expect(result.balance).toBe(-25_000);
    expect(result.dividendPaid).toBe(0);
    expect(result.reserves).toEqual({ reinvestment: 0, growth: 0 });
  });

  test('mature businesses require an annual budget review while young businesses do not', () => {
    const mature = makeBusiness({
      level: 4,
      budgetPlan: createBusinessBudgetPlan('balanced', 3),
    });
    const young = makeBusiness({
      level: 2,
      budgetPlan: createBusinessBudgetPlan('balanced', 3),
    });

    expect(isBusinessBudgetReviewDue(mature, 4)).toBe(true);
    expect(isBusinessBudgetReviewDue(mature, 3)).toBe(false);
    expect(isBusinessBudgetReviewDue(young, 4)).toBe(false);
  });

  test('normalization preserves a valid profile and caps malformed custom percentages', () => {
    const normalized = normalizeBusinessBudgetPlan({
      profile: 'growth',
      targetReserveWeeks: 99,
      dividendPct: 0.8,
      debtPaydownPct: 0.7,
      reinvestmentPct: 0.7,
      growthPct: 0.8,
      reviewYear: 3,
    });

    expect(normalized.profile).toBe('growth');
    expect(normalized.targetReserveWeeks).toBe(20);
    expect(
      normalized.dividendPct
      + normalized.debtPaydownPct
      + normalized.reinvestmentPct
      + normalized.growthPct
    ).toBeCloseTo(1);
  });

  test('weekly business simulation records the selected budget and distribution snapshot', () => {
    const business = makeBusiness({
      budgetPlan: createBusinessBudgetPlan('growth', 3),
      balance: 2_000_000,
    });
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = processBusinessWeek(business, 1, 5, 3);

    expect(result.updatedBusiness.budgetPlan?.profile).toBe('growth');
    expect(result.updatedBusiness.lastBudgetAllocation).toBeTruthy();
    expect(result.updatedBusiness.lastBudgetAllocation?.closingGrowthReserve).toBeGreaterThanOrEqual(0);
    expect(result.updatedBusiness.totalPlayerDistributions).toBeGreaterThanOrEqual(0);
  });
});
