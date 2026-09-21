import { createBusiness } from '../businessEngine';
import { createCorporateWorkforce } from '../businessWorkforceEngine';
import {
  appendCorporateKpiSnapshot,
  getCorporateManagementReport,
} from '../corporateReportingEngine';
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
    expenses: 700_000,
    profit: 300_000,
    headcount: 20,
    payroll: 250_000,
    turnover: 0,
    productivityIndex: 100,
    departmentProductivity: { ...departmentProductivity },
    debtService: 0,
    averageMaintenanceCondition: 90,
    ...overrides,
  };
}

function makeCorporateBusiness(): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Reporting Group', 1, 1, 1)!;
  const business: OwnedBusiness = {
    ...base,
    valuation: 100_000_000,
    reputation: 80,
    level: 6,
    balance: 20_000_000,
    lastWeekRevenue: 1_000_000,
    lastWeekExpenses: 700_000,
    lastWeekProfit: 300_000,
    weeklyRevenueHistory: Array(20).fill(1_000_000),
    weeklyProfitHistory: Array(20).fill(300_000),
    reinvestment: {
      technology: { condition: 90, lastRenewedGlobalWeek: 1 },
      premises: { condition: 90, lastRenewedGlobalWeek: 1 },
      equipment: { condition: 90, lastRenewedGlobalWeek: 1 },
    },
  };
  business.corporateWorkforce = createCorporateWorkforce(business, 1, 1);
  return business;
}

describe('corporate management reporting', () => {
  test('quarterly report uses the aligned five-week game quarter', () => {
    const business = makeCorporateBusiness();
    business.corporateKpiHistory = [
      ...Array.from({ length: 5 }, (_, index) => point(16 + index, {
        revenue: 1_200_000,
      })),
      ...Array.from({ length: 5 }, (_, index) => point(21 + index, {
        revenue: 1_000_000,
      })),
    ];
    business.lastWeekRevenue = 1_000_000;
    business.lastWeekExpenses = 700_000;
    business.lastWeekProfit = 300_000;

    const report = getCorporateManagementReport(business, 25, 'quarter', 1)!;

    expect(report.label).toBe('Q1 • Year 2');
    expect(report.startGlobalWeek).toBe(21);
    expect(report.weeksTracked).toBe(5);
    expect(report.expectedWeeks).toBe(5);
    expect(report.revenuePerEmployee).toBeCloseTo(50_000, 0);
    expect(report.revenuePerEmployeeChangePct).toBeCloseTo(-1 / 6, 3);
    expect(report.revenuePerEmployeeStatus).toBe('critical');
    expect(report.warnings.some((warning) => warning.id === 'revenue-per-employee')).toBe(true);
  });

  test('annual report rolls up the current 20-week game year', () => {
    const business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 20 }, (_, index) => point(21 + index, {
      revenue: 2_000_000,
      payroll: 500_000,
      headcount: 25,
      profit: 500_000,
      expenses: 1_500_000,
    }));
    business.lastWeekRevenue = 2_000_000;
    business.lastWeekExpenses = 1_500_000;
    business.lastWeekProfit = 500_000;

    const report = getCorporateManagementReport(business, 40, 'annual', 1)!;

    expect(report.label).toBe('Year 2 YTD');
    expect(report.weeksTracked).toBe(20);
    expect(report.payrollToRevenueRatio).toBeCloseTo(0.25, 4);
    expect(report.annualizedTurnoverRate).toBe(0);
    expect(report.overallStatus).toBe('healthy');
  });

  test('warning thresholds flag payroll, turnover, debt coverage, maintenance and weak departments', () => {
    const business = makeCorporateBusiness();
    business.reinvestment = {
      technology: { condition: 60, lastRenewedGlobalWeek: 1 },
      premises: { condition: 65, lastRenewedGlobalWeek: 1 },
      equipment: { condition: 55, lastRenewedGlobalWeek: 1 },
    };
    business.businessLoans = [{
      id: 'corp_bond',
      amount: 10_000_000,
      remainingAmount: 10_000_000,
      weeklyPayment: 300_000,
      weeksRemaining: 40,
      interestRate: 0.08,
      purpose: 'corporate_bond',
    }];
    business.lastExpenseBreakdown = {
      rent: 0,
      salaries: 0,
      cogs: 0,
      utilities: 0,
      marketing: 0,
      insurance: 0,
      maintenance: 0,
      taxes: 0,
      loanInterest: 300_000,
      misc: 0,
    };
    business.lastWeekRevenue = 1_000_000;
    business.lastWeekExpenses = 1_050_000;
    business.lastWeekProfit = -50_000;

    const weakDepartments = {
      operations: 80,
      sales: 92,
      finance: 96,
      technology: 88,
      support: 97,
    };
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(21 + index, {
      revenue: 1_000_000,
      expenses: 1_050_000,
      profit: -50_000,
      headcount: 20,
      payroll: 480_000,
      turnover: index === 4 ? 1 : 0,
      productivityIndex: 89,
      departmentProductivity: weakDepartments,
      debtService: 300_000,
      averageMaintenanceCondition: 60,
    }));

    const report = getCorporateManagementReport(business, 25, 'quarter', 1)!;
    const warningIds = report.warnings.map((warning) => warning.id);

    expect(report.payrollStatus).toBe('critical');
    expect(report.turnoverStatus).toBe('watch');
    expect(report.debtCoverageStatus).toBe('critical');
    expect(report.maintenanceStatus).toBe('watch');
    expect(report.productivityStatus).toBe('watch');
    expect(warningIds).toEqual(expect.arrayContaining([
      'department-productivity',
      'payroll-ratio',
      'turnover',
      'debt-coverage',
      'maintenance',
    ]));
    expect(report.overallStatus).toBe('critical');
  });

  test('completed corporate investments receive a direct operating ROI estimate', () => {
    const business = makeCorporateBusiness();
    business.completedCorporateCapex = [{
      projectId: 'corporate_hq',
      projectName: 'Corporate Headquarters',
      costPaid: 5_000_000,
      completedGlobalWeek: 10,
    }];
    business.corporateKpiHistory = Array.from({ length: 5 }, (_, index) => point(21 + index, {
      revenue: 2_000_000,
      expenses: 1_000_000,
      profit: 1_000_000,
    }));
    business.lastWeekRevenue = 2_000_000;
    business.lastWeekExpenses = 1_000_000;
    business.lastWeekProfit = 1_000_000;

    const report = getCorporateManagementReport(business, 25, 'quarter', 1)!;

    expect(report.completedProjectCount).toBe(1);
    expect(report.projectAnnualOperatingBenefit).toBe(300_000);
    expect(report.projectOperatingRoi).toBeCloseTo(0.06, 4);
    expect(report.projectRoiStatus).toBe('healthy');
  });

  test('snapshot history replaces the same week and caps at sixty points', () => {
    let business = makeCorporateBusiness();
    business.corporateKpiHistory = Array.from({ length: 60 }, (_, index) => point(index + 1));

    business.lastWeekRevenue = 9_999_999;
    business = appendCorporateKpiSnapshot(business, 60);
    expect(business.corporateKpiHistory).toHaveLength(60);
    expect(business.corporateKpiHistory?.filter((entry) => entry.globalWeek === 60)).toHaveLength(1);
    expect(business.corporateKpiHistory?.find((entry) => entry.globalWeek === 60)?.revenue).toBe(9_999_999);

    business = appendCorporateKpiSnapshot(business, 61);
    expect(business.corporateKpiHistory).toHaveLength(60);
    expect(business.corporateKpiHistory?.[0].globalWeek).toBe(2);
  });
});
