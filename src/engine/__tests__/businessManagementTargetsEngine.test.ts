import { createBusiness } from '../businessEngine';
import { createCorporateWorkforce } from '../businessWorkforceEngine';
import {
  ensureBusinessManagementTargetPlan,
  getBusinessManagementTargetProgress,
  setBusinessManagementTargetProfile,
} from '../businessManagementTargetsEngine';
import { CorporateKpiHistoryPoint, OwnedBusiness } from '../../types/game';

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

  test('new quarter automatically carries the chosen profile onto a fresh baseline', () => {
    const business = makeCorporateBusiness();
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(16 + index)),
      ...Array.from({ length: 5 }, (_, index) => point(21 + index, {
        revenue: 1_200_000,
        expenses: 900_000,
        profit: 300_000,
        payroll: 330_000,
      })),
    ];
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

    expect(rolled.profile).toBe('deleveraging');
    expect(rolled.year).toBe(2);
    expect(rolled.quarter).toBe(2);
    expect(rolled.periodStartGlobalWeek).toBe(26);
    expect(rolled.baselineWeeklyRevenue).toBe(1_200_000);
    expect(rolled.baselineDebt).toBe(8_000_000);
    expect(rolled.targetWeeklyRevenue).toBe(1_224_000);
    expect(rolled.targetDebtBalance).toBe(6_800_000);
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
});
