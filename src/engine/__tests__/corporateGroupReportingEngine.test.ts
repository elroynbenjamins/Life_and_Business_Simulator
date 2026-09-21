import { createBusiness } from '../businessEngine';
import { createCorporateWorkforce } from '../businessWorkforceEngine';
import { getCorporateGroupManagementReport } from '../corporateGroupReportingEngine';
import { CorporateKpiHistoryPoint, OwnedBusiness } from '../../types/game';

const defaultDepartments = {
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
    headcount: 10,
    payroll: 250_000,
    turnover: 0,
    productivityIndex: 100,
    departmentProductivity: { ...defaultDepartments },
    debtService: 0,
    averageMaintenanceCondition: 90,
    ...overrides,
  };
}

function makeBusiness(
  name: string,
  valuation: number,
  corporate = true,
): OwnedBusiness {
  const base = createBusiness('coffee_shop', name, 1, 1, 1)!;
  const business: OwnedBusiness = {
    ...base,
    valuation,
    reputation: 80,
    level: 6,
    balance: 10_000_000,
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
  if (corporate) business.corporateWorkforce = createCorporateWorkforce(business, 1, 1);
  return business;
}

function setPeriodHistory(
  business: OwnedBusiness,
  previous: Partial<CorporateKpiHistoryPoint>,
  current: Partial<CorporateKpiHistoryPoint>,
) {
  business.corporateKpiHistory = [
    ...Array.from({ length: 5 }, (_, index) => point(16 + index, previous)),
    ...Array.from({ length: 5 }, (_, index) => point(21 + index, current)),
  ];
  const currentPoint = business.corporateKpiHistory[business.corporateKpiHistory.length - 1];
  business.lastWeekRevenue = currentPoint.revenue;
  business.lastWeekExpenses = currentPoint.expenses;
  business.lastWeekProfit = currentPoint.profit;
}

describe('corporate group management reporting', () => {
  test('aggregates corporate companies and exposes partial portfolio coverage', () => {
    const large = makeBusiness('Large Group', 100_000_000);
    setPeriodHistory(
      large,
      { revenue: 1_800_000, headcount: 20, payroll: 400_000, profit: 400_000 },
      { revenue: 2_000_000, headcount: 20, payroll: 400_000, profit: 500_000 },
    );

    const smaller = makeBusiness('Smaller Group', 50_000_000);
    setPeriodHistory(
      smaller,
      { revenue: 1_000_000, headcount: 10, payroll: 300_000, profit: 200_000 },
      { revenue: 1_000_000, headcount: 10, payroll: 300_000, profit: 200_000, turnover: 0.2 },
    );

    const local = makeBusiness('Local Company', 50_000_000, false);

    const report = getCorporateGroupManagementReport(
      [large, smaller, local],
      25,
      'quarter',
      1,
    )!;

    expect(report.companyCount).toBe(3);
    expect(report.reportingCompanyCount).toBe(2);
    expect(report.reportingValueCoverage).toBeCloseTo(0.75, 4);
    expect(report.weeksTracked).toBe(5);
    expect(report.revenuePerEmployee).toBeCloseTo(100_000, 0);
    expect(report.revenuePerEmployeeChangePct).toBeCloseTo(0.0714, 3);
    expect(report.payrollToRevenueRatio).toBeCloseTo(3_500_000 / 15_000_000, 4);
    expect(report.annualizedTurnoverRate).toBeCloseTo(0.1333, 3);
  });

  test('adds structural portfolio warnings for concentration, leverage and losses', () => {
    const dominant = makeBusiness('Dominant', 90_000_000);
    setPeriodHistory(
      dominant,
      { revenue: 2_000_000, headcount: 20, payroll: 400_000, profit: 400_000 },
      { revenue: 9_000_000, headcount: 20, payroll: 500_000, profit: -100_000 },
    );
    dominant.businessLoans = [{
      id: 'dominant-debt',
      amount: 75_000_000,
      remainingAmount: 75_000_000,
      weeklyPayment: 0,
      weeksRemaining: 50,
      interestRate: 0.08,
      purpose: 'corporate_bond',
    }];

    const smallA = makeBusiness('Small A', 5_000_000);
    setPeriodHistory(
      smallA,
      { revenue: 500_000, headcount: 5, payroll: 100_000, profit: 100_000 },
      { revenue: 500_000, headcount: 5, payroll: 100_000, profit: -10_000 },
    );

    const smallB = makeBusiness('Small B', 5_000_000);
    setPeriodHistory(
      smallB,
      { revenue: 500_000, headcount: 5, payroll: 100_000, profit: 100_000 },
      { revenue: 500_000, headcount: 5, payroll: 100_000, profit: 20_000 },
    );

    const report = getCorporateGroupManagementReport(
      [dominant, smallA, smallB],
      25,
      'quarter',
      1,
    )!;
    const ids = report.warnings.map((warning) => warning.id);

    expect(report.valueConcentration).toBeCloseTo(0.90, 4);
    expect(report.revenueConcentration).toBeCloseTo(0.90, 4);
    expect(report.leverageRatio).toBeCloseTo(0.75, 4);
    expect(report.lossMakingCompanies).toBe(2);
    expect(ids).toEqual(expect.arrayContaining([
      'concentration',
      'group-leverage',
      'loss-making-companies',
    ]));
    expect(report.overallStatus).toBe('critical');
  });

  test('does not flag concentration for a deliberate two-company group', () => {
    const first = makeBusiness('First', 90_000_000);
    const second = makeBusiness('Second', 10_000_000);
    setPeriodHistory(first, {}, { revenue: 9_000_000, profit: 500_000 });
    setPeriodHistory(second, {}, { revenue: 1_000_000, profit: 100_000 });

    const report = getCorporateGroupManagementReport(
      [first, second],
      25,
      'quarter',
      1,
    )!;

    expect(report.valueConcentration).toBeCloseTo(0.90, 4);
    expect(report.warnings.some((warning) => warning.id === 'concentration')).toBe(false);
  });

  test('returns no management report before any company has corporate workforce reporting', () => {
    const localA = makeBusiness('Local A', 5_000_000, false);
    const localB = makeBusiness('Local B', 8_000_000, false);

    expect(getCorporateGroupManagementReport(
      [localA, localB],
      25,
      'quarter',
      1,
    )).toBeNull();
  });
});
