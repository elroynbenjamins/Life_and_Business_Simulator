import { createBusiness } from '../businessEngine';
import { createCorporateWorkforce } from '../businessWorkforceEngine';
import {
  closeCompletedBusinessManagementQuarter,
  deriveBusinessManagementTargetProfile,
  ensureBusinessManagementTargetPlan,
  getBusinessManagementReviewYears,
  getBusinessManagementTargetProgress,
  setBusinessManagementTargetProfile,
} from '../businessManagementTargetsEngine';
import { BusinessManagementQuarterReview, CorporateKpiHistoryPoint, OwnedBusiness } from '../../types/game';

const departmentProductivity = {
  operations: 100,
  sales: 100,
  finance: 100,
  technology: 100,
  support: 100,
};

function point(
  globalWeek: number,
  overrides: Partial<CorporateKpiHistoryPoint> = {},
): CorporateKpiHistoryPoint {
  return {
    globalWeek,
    revenue: 1_000_000,
    expenses: 800_000,
    profit: 200_000,
    headcount: 100,
    payroll: 300_000,
    turnover: 0,
    productivityIndex: 100,
    departmentProductivity: { ...departmentProductivity },
    debtService: 0,
    averageMaintenanceCondition: 90,
    ...overrides,
  };
}

function quarterReview(
  year: number,
  quarter: number,
  overrides: Partial<BusinessManagementQuarterReview> = {},
): BusinessManagementQuarterReview {
  const start = (year - 1) * 20 + (quarter - 1) * 5 + 1;
  return {
    year,
    quarter,
    periodStartGlobalWeek: start,
    periodEndGlobalWeek: start + 4,
    closedGlobalWeek: start + 5,
    profile: 'balanced',
    weeksTracked: 5,
    averageWeeklyRevenue: 1_000_000 + (quarter - 1) * 100_000,
    profitMargin: 0.20,
    payrollToRevenueRatio: 0.30,
    endingDebtBalance: 10_000_000 - quarter * 500_000,
    averageMaintenanceCondition: 80,
    targetMetCount: 4,
    targetNearCount: 1,
    targetMissedCount: 0,
    targetTotalCount: 5,
    targetResults: [],
    partial: false,
    ...overrides,
  };
}

function makeCorporateBusiness(): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Target Group', 1, 1, 1)!;
  const business: OwnedBusiness = {
    ...base,
    valuation: 100_000_000,
    reputation: 80,
    level: 6,
    balance: 20_000_000,
    lastWeekRevenue: 1_000_000,
    lastWeekExpenses: 800_000,
    lastWeekProfit: 200_000,
    weeklyRevenueHistory: Array(20).fill(1_000_000),
    weeklyProfitHistory: Array(20).fill(200_000),
    businessLoans: [{
      id: 'target-debt',
      amount: 10_000_000,
      remainingAmount: 10_000_000,
      weeklyPayment: 100_000,
      weeksRemaining: 100,
      interestRate: 0.08,
      purpose: 'corporate_bond',
    }],
  };
  business.corporateWorkforce = createCorporateWorkforce(business, 1, 1);
  return business;
}

describe('business management targets', () => {
  test('derives target profiles from the primary management policies', () => {
    const business = makeCorporateBusiness();

    business.strategicFocus = 'growth';
    expect(deriveBusinessManagementTargetProfile(business)).toBe('growth');

    business.strategicFocus = 'automation';
    expect(deriveBusinessManagementTargetProfile(business)).toBe('margin');

    business.budgetPlan = { ...business.budgetPlan!, profile: 'deleveraging' };
    expect(deriveBusinessManagementTargetProfile(business)).toBe('deleveraging');

    business.budgetPlan = { ...business.budgetPlan!, profile: 'resilient' };
    expect(deriveBusinessManagementTargetProfile(business)).toBe('resilient');
  });

  test('balanced profile uses the prior quarter as its operating baseline', () => {
    const business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(16 + index));

    const plan = ensureBusinessManagementTargetPlan(business, 25)!;

    expect(plan.profile).toBe('balanced');
    expect(plan.year).toBe(2);
    expect(plan.quarter).toBe(1);
    expect(plan.periodStartGlobalWeek).toBe(21);
    expect(plan.baselineWeeklyRevenue).toBe(1_000_000);
    expect(plan.baselineProfitMargin).toBeCloseTo(0.20, 4);
    expect(plan.baselinePayrollToRevenueRatio).toBeCloseTo(0.30, 4);
    expect(plan.baselineDebt).toBe(10_000_000);
    expect(plan.targetWeeklyRevenue).toBe(1_050_000);
    expect(plan.targetProfitMargin).toBeCloseTo(0.22, 4);
    expect(plan.maxPayrollToRevenueRatio).toBeCloseTo(0.32, 4);
    expect(plan.targetDebtBalance).toBe(9_500_000);
    expect(plan.minMaintenanceCondition).toBe(75);
  });

  test('changing profile mid-quarter preserves the original baseline', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(16 + index));
    business.managementTargets = ensureBusinessManagementTargetPlan(business, 23)!;

    const original = business.managementTargets;
    business.lastWeekRevenue = 4_000_000;
    business.businessLoans = [{
      ...business.businessLoans[0],
      remainingAmount: 7_000_000,
    }];

    business = setBusinessManagementTargetProfile(business, 'margin', 23);
    const updated = business.managementTargets!;

    expect(updated.profile).toBe('margin');
    expect(updated.baselineWeeklyRevenue).toBe(original.baselineWeeklyRevenue);
    expect(updated.baselineDebt).toBe(original.baselineDebt);
    expect(updated.createdGlobalWeek).toBe(original.createdGlobalWeek);
    expect(updated.targetWeeklyRevenue).toBe(1_030_000);
    expect(updated.targetProfitMargin).toBeCloseTo(0.25, 4);
    expect(updated.maxPayrollToRevenueRatio).toBeCloseTo(0.28, 4);
  });

  test('new quarter realigns targets with Strategic Focus and Cash Plan', () => {
    const business = makeCorporateBusiness();
    business.strategicFocus = 'growth';
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(16 + index)),
      ...Array.from({ length: 5 }, (_, index) => point(21 + index, {
        revenue: 1_200_000,
        expenses: 900_000,
        profit: 300_000,
        payroll: 330_000,
      })),
    ];
    // A manual/legacy override is valid for the current quarter only.
    business.managementTargets = ensureBusinessManagementTargetPlan(
      business,
      25,
      'deleveraging',
    );
    business.businessLoans = [{
      ...business.businessLoans[0],
      remainingAmount: 8_000_000,
    }];

    const rolled = ensureBusinessManagementTargetPlan(business, 26)!;

    expect(rolled.profile).toBe('growth');
    expect(rolled.year).toBe(2);
    expect(rolled.quarter).toBe(2);
    expect(rolled.periodStartGlobalWeek).toBe(26);
    expect(rolled.baselineWeeklyRevenue).toBe(1_200_000);
    expect(rolled.baselineDebt).toBe(8_000_000);
    expect(rolled.targetWeeklyRevenue).toBe(1_344_000);
    expect(rolled.targetDebtBalance).toBe(8_000_000);
  });

  test('debt target uses quarter pace instead of demanding the final balance in week one', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(16 + index));
    business.managementTargets = ensureBusinessManagementTargetPlan(
      business,
      21,
      'deleveraging',
    );
    business.businessLoans = [{
      ...business.businessLoans[0],
      remainingAmount: 9_800_000,
    }];

    const report = {
      weeksTracked: 1,
      periodRevenue: 1_050_000,
      profitMargin: 0.20,
      payrollToRevenueRatio: 0.30,
      averageMaintenanceCondition: 80,
    };
    const weekOne = getBusinessManagementTargetProgress(business, report, 21)!;
    const earlyDebt = weekOne.results.find((result) => result.id === 'debt')!;

    expect(earlyDebt.target).toBe(8_500_000);
    expect(earlyDebt.scheduleBenchmark).toBe(9_700_000);
    expect(earlyDebt.status).toBe('near');

    const finalWeek = getBusinessManagementTargetProgress(business, report, 25)!;
    const lateDebt = finalWeek.results.find((result) => result.id === 'debt')!;
    expect(lateDebt.scheduleBenchmark).toBe(8_500_000);
    expect(lateDebt.status).toBe('missed');
  });

  test('late first-time setup does not demand a full-quarter debt reduction immediately', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(16 + index));
    business.businessLoans = [{
      ...business.businessLoans[0],
      remainingAmount: 10_000_000,
    }];

    business.managementTargets = ensureBusinessManagementTargetPlan(
      business,
      25,
      'deleveraging',
    );

    const progress = getBusinessManagementTargetProgress(
      business,
      {
        weeksTracked: 5,
        periodRevenue: 5_000_000,
        profitMargin: 0.20,
        payrollToRevenueRatio: 0.30,
        averageMaintenanceCondition: 80,
      },
      25,
    )!;
    const debt = progress.results.find((result) => result.id === 'debt')!;

    expect(debt.target).toBe(8_500_000);
    expect(debt.scheduleBenchmark).toBe(10_000_000);
    expect(debt.status).toBe('met');
  });

  test('progress evaluates revenue, margin, payroll, debt and maintenance together', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(16 + index));
    business.managementTargets = ensureBusinessManagementTargetPlan(business, 25, 'balanced');
    business.businessLoans = [{
      ...business.businessLoans[0],
      remainingAmount: 9_400_000,
    }];

    const progress = getBusinessManagementTargetProgress(
      business,
      {
        weeksTracked: 5,
        periodRevenue: 5_500_000,
        profitMargin: 0.23,
        payrollToRevenueRatio: 0.30,
        averageMaintenanceCondition: 82,
      },
      25,
    )!;

    expect(progress.results).toHaveLength(5);
    expect(progress.metCount).toBe(5);
    expect(progress.missedCount).toBe(0);
  });

  test('quarter close freezes Q1 actuals and does not duplicate the review', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(16 + index)),
      ...Array.from({ length: 5 }, (_, index) => point(21 + index, {
        revenue: 1_100_000,
        expenses: 800_000,
        profit: 300_000,
        payroll: 300_000,
        debtBalance: 9_800_000 - index * 100_000,
        averageMaintenanceCondition: 80,
      })),
    ];
    business.managementTargets = ensureBusinessManagementTargetPlan(business, 21, 'balanced');

    business = closeCompletedBusinessManagementQuarter(business, 26);
    const review = business.managementReviewHistory?.[0];

    expect(review).toBeDefined();
    expect(review?.year).toBe(2);
    expect(review?.quarter).toBe(1);
    expect(review?.weeksTracked).toBe(5);
    expect(review?.averageWeeklyRevenue).toBe(1_100_000);
    expect(review?.profitMargin).toBeCloseTo(300_000 / 1_100_000, 4);
    expect(review?.endingDebtBalance).toBe(9_400_000);
    expect(review?.targetMetCount).toBe(5);
    expect(review?.partial).toBe(false);

    business = closeCompletedBusinessManagementQuarter(business, 27);
    expect(business.managementReviewHistory).toHaveLength(1);
  });

  test('late-start target quarters are archived as partial reviews', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(16 + index)),
      ...Array.from({ length: 5 }, (_, index) => point(21 + index, {
        debtBalance: 10_000_000,
      })),
    ];
    business.managementTargets = ensureBusinessManagementTargetPlan(business, 25, 'balanced');

    business = closeCompletedBusinessManagementQuarter(business, 26);

    expect(business.managementReviewHistory?.[0].partial).toBe(true);
  });

  test('annual review summarizes Q1 through Q4 for a completed game year', () => {
    const business = makeCorporateBusiness();
    business.managementReviewHistory = [
      quarterReview(2, 1, { averageWeeklyRevenue: 1_000_000, profitMargin: 0.20, targetMetCount: 4 }),
      quarterReview(2, 2, { averageWeeklyRevenue: 1_100_000, profitMargin: 0.22, targetMetCount: 5 }),
      quarterReview(2, 3, { averageWeeklyRevenue: 1_200_000, profitMargin: 0.24, targetMetCount: 3, targetMissedCount: 1 }),
      quarterReview(2, 4, { averageWeeklyRevenue: 1_300_000, profitMargin: 0.26, endingDebtBalance: 7_500_000, targetMetCount: 5 }),
    ];

    const years = getBusinessManagementReviewYears(business);
    const year = years[0];

    expect(year.year).toBe(2);
    expect(year.complete).toBe(true);
    expect(year.quarterCount).toBe(4);
    expect(year.weeksTracked).toBe(20);
    expect(year.averageWeeklyRevenue).toBe(1_150_000);
    expect(year.endingDebtBalance).toBe(7_500_000);
    expect(year.targetMetCount).toBe(17);
    expect(year.targetTotalCount).toBe(20);
    expect(year.targetHitRate).toBeCloseTo(0.85, 4);
    expect(year.revenueChangePct).toBeCloseTo(0.30, 4);
  });

  test('year-over-year review compares complete years across the same four quarters', () => {
    const business = makeCorporateBusiness();
    business.managementReviewHistory = [
      ...[1, 2, 3, 4].map((quarter) => quarterReview(1, quarter, {
        averageWeeklyRevenue: 1_000_000,
        profitMargin: 0.20,
        payrollToRevenueRatio: 0.30,
        endingDebtBalance: quarter === 4 ? 10_000_000 : 11_000_000,
        averageMaintenanceCondition: 80,
        targetMetCount: 3,
        targetNearCount: 1,
        targetMissedCount: 1,
      })),
      ...[1, 2, 3, 4].map((quarter) => quarterReview(2, quarter, {
        averageWeeklyRevenue: 1_100_000,
        profitMargin: 0.24,
        payrollToRevenueRatio: 0.27,
        endingDebtBalance: quarter === 4 ? 8_000_000 : 9_000_000,
        averageMaintenanceCondition: 85,
        targetMetCount: 4,
        targetNearCount: 1,
        targetMissedCount: 0,
      })),
    ];

    const years = getBusinessManagementReviewYears(business);
    const year2 = years.find((year) => year.year === 2)!;
    const comparison = year2.yearOverYear!;

    expect(comparison.comparisonYear).toBe(1);
    expect(comparison.quartersCompared).toEqual([1, 2, 3, 4]);
    expect(comparison.averageWeeklyRevenueChangePct).toBeCloseTo(0.10, 4);
    expect(comparison.profitMarginChangePctPoints).toBeCloseTo(4, 4);
    expect(comparison.payrollToRevenueChangePctPoints).toBeCloseTo(-3, 4);
    expect(comparison.endingDebtChangePct).toBeCloseTo(-0.20, 4);
    expect(comparison.maintenanceConditionChangePoints).toBeCloseTo(5, 4);
    expect(comparison.targetHitRateChangePctPoints).toBeCloseTo(20, 4);
  });

  test('partial current year compares only matching prior-year quarters', () => {
    const business = makeCorporateBusiness();
    business.managementReviewHistory = [
      quarterReview(2, 1, { averageWeeklyRevenue: 1_000_000 }),
      quarterReview(2, 2, { averageWeeklyRevenue: 1_100_000 }),
      quarterReview(2, 3, { averageWeeklyRevenue: 10_000_000 }),
      quarterReview(2, 4, { averageWeeklyRevenue: 10_000_000 }),
      quarterReview(3, 1, { averageWeeklyRevenue: 2_000_000 }),
      quarterReview(3, 2, { averageWeeklyRevenue: 2_200_000 }),
    ];

    const years = getBusinessManagementReviewYears(business);
    const year3 = years.find((year) => year.year === 3)!;
    const comparison = year3.yearOverYear!;

    expect(year3.complete).toBe(false);
    expect(comparison.comparisonYear).toBe(2);
    expect(comparison.quartersCompared).toEqual([1, 2]);
    expect(comparison.averageWeeklyRevenueChangePct).toBeCloseTo(1.0, 4);
  });

  test('first retained year has no fabricated year-over-year comparison', () => {
    const business = makeCorporateBusiness();
    business.managementReviewHistory = [
      quarterReview(4, 1),
      quarterReview(4, 2),
      quarterReview(4, 3),
      quarterReview(4, 4),
    ];

    const year4 = getBusinessManagementReviewYears(business)[0];

    expect(year4.yearOverYear).toBeNull();
  });

  test('Q4 closes into the old year before Year 2 Q1 begins', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(11 + index)),
      ...Array.from({ length: 5 }, (_, index) => point(16 + index, {
        revenue: 1_250_000,
        profit: 300_000,
        debtBalance: 9_500_000 - index * 100_000,
      })),
    ];
    business.managementTargets = ensureBusinessManagementTargetPlan(business, 16, 'balanced');

    business = closeCompletedBusinessManagementQuarter(business, 21);
    const nextPlan = ensureBusinessManagementTargetPlan(business, 21)!;

    expect(business.managementReviewHistory).toHaveLength(1);
    expect(business.managementReviewHistory?.[0].year).toBe(1);
    expect(business.managementReviewHistory?.[0].quarter).toBe(4);
    expect(nextPlan.year).toBe(2);
    expect(nextPlan.quarter).toBe(1);
    expect(nextPlan.periodStartGlobalWeek).toBe(21);
  });

  test('history retention keeps the latest five game years', () => {
    let business = makeCorporateBusiness();
    business.managementReviewHistory = Array.from({ length: 5 }, (_, yearIndex) =>
      [1, 2, 3, 4].map((quarter) => quarterReview(yearIndex + 1, quarter))
    ).reduce((all, reviews) => all.concat(reviews), [] as BusinessManagementQuarterReview[]);
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(96 + index)),
      ...Array.from({ length: 5 }, (_, index) => point(101 + index, {
        debtBalance: 8_000_000 - index * 100_000,
      })),
    ];
    business.managementTargets = ensureBusinessManagementTargetPlan(business, 101, 'balanced');

    business = closeCompletedBusinessManagementQuarter(business, 106);
    const years = getBusinessManagementReviewYears(business).map((year) => year.year);

    expect(years).toEqual([6, 5, 4, 3, 2]);
    expect(business.managementReviewHistory?.some((review) => review.year === 1)).toBe(false);
    expect(business.managementReviewHistory?.length).toBeLessThanOrEqual(20);
  });
});
