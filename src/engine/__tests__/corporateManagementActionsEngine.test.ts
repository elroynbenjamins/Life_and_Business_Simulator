import { createBusiness } from '../businessEngine';
import { createCorporateWorkforce } from '../businessWorkforceEngine';
import { getCorporateManagementReport } from '../corporateReportingEngine';
import { getCorporateManagementActions } from '../corporateManagementActionsEngine';
import { CorporateKpiHistoryPoint, OwnedBusiness } from '../../types/game';

const departments = {
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
    headcount: 100,
    payroll: 250_000,
    turnover: 0,
    productivityIndex: 100,
    departmentProductivity: { ...departments },
    debtService: 0,
    averageMaintenanceCondition: 90,
    ...overrides,
  };
}

function corporateBusiness(): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Action Group', 1, 1, 1)!;
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

function reportWith(
  business: OwnedBusiness,
  currentOverrides: Partial<CorporateKpiHistoryPoint>,
  previousOverrides: Partial<CorporateKpiHistoryPoint> = {},
) {
  business.corporateKpiHistory = [
    ...Array.from({ length: 5 }, (_, index) => point(16 + index, previousOverrides)),
    ...Array.from({ length: 5 }, (_, index) => point(21 + index, currentOverrides)),
  ];
  const current = business.corporateKpiHistory[business.corporateKpiHistory.length - 1];
  business.lastWeekRevenue = current.revenue;
  business.lastWeekExpenses = current.expenses;
  business.lastWeekProfit = current.profit;
  return getCorporateManagementReport(business, 25, 'quarter', 1)!;
}

describe('corporate management action guidance', () => {
  test('weak productivity with understaffing recommends restoring department capacity', () => {
    const business = corporateBusiness();
    const operations = business.corporateWorkforce!.departments.operations;
    operations.headcount = 1;
    operations.targetHeadcount = 1;

    const report = reportWith(business, {
      productivityIndex: 90,
      departmentProductivity: {
        operations: 80,
        sales: 100,
        finance: 100,
        technology: 100,
        support: 100,
      },
    });
    const actions = getCorporateManagementActions(business, report, 1);

    expect(actions[0].id).toBe('restore-department-capacity');
    expect(actions[0].title).toContain('Operations');
    expect(actions[0].target).toBe('workforce');
  });

  test('high turnover under market pay recommends stronger compensation first', () => {
    const business = corporateBusiness();
    business.corporateWorkforce!.compensationPolicy = 'market';

    const report = reportWith(
      business,
      { turnover: 1 },
      { turnover: 1 },
    );
    const actions = getCorporateManagementActions(business, report, 1);

    expect(report.turnoverStatus).toBe('watch');
    expect(actions.some((item) => item.id === 'raise-compensation-policy')).toBe(true);
  });

  test('poor debt coverage points to the highest-interest loan and cash plan', () => {
    const business = corporateBusiness();
    business.businessLoans = [
      {
        id: 'cheap',
        amount: 5_000_000,
        remainingAmount: 4_000_000,
        weeklyPayment: 100_000,
        weeksRemaining: 40,
        interestRate: 0.06,
        purpose: 'corporate_bond',
      },
      {
        id: 'expensive',
        amount: 3_000_000,
        remainingAmount: 2_500_000,
        weeklyPayment: 200_000,
        weeksRemaining: 20,
        interestRate: 0.115,
        purpose: 'corporate_revolver',
      },
    ];
    business.budgetPlan = {
      profile: 'standard',
      targetReserveWeeks: 6,
      dividendPct: 0.70,
      debtPaydownPct: 0,
      reinvestmentPct: 0.15,
      growthPct: 0.15,
      reviewYear: 2,
    };

    const report = reportWith(business, {
      profit: -50_000,
      expenses: 1_050_000,
      debtService: 300_000,
    });
    const actions = getCorporateManagementActions(business, report, 1);

    const repay = actions.find((item) => item.id === 'repay-high-cost-debt');
    expect(report.debtCoverageStatus).toBe('critical');
    expect(repay?.detail).toContain('11.5%');
    expect(repay?.target).toBe('finance');
    expect(actions.some((item) => item.id === 'increase-debt-paydown-budget')).toBe(true);
  });

  test('maintenance warning recommends the lowest-condition renewal', () => {
    const business = corporateBusiness();
    business.reinvestment = {
      technology: { condition: 70, lastRenewedGlobalWeek: 1 },
      premises: { condition: 62, lastRenewedGlobalWeek: 1 },
      equipment: { condition: 42, lastRenewedGlobalWeek: 1 },
    };

    const report = reportWith(business, {});
    const actions = getCorporateManagementActions(business, report, 1);
    const upkeep = actions.find((item) => item.id === 'renew-lowest-condition-area');

    expect(report.maintenanceStatus).toBe('watch');
    expect(upkeep?.title).toContain('Equipment Renewal');
    expect(upkeep?.detail).toContain('42%');
    expect(upkeep?.target).toBe('maintenance');
  });

  test('high payroll with oversized targets recommends reducing future hiring before cuts', () => {
    const business = corporateBusiness();
    for (const department of Object.values(business.corporateWorkforce!.departments)) {
      department.targetHeadcount = Math.max(department.targetHeadcount, department.headcount * 2);
    }

    const report = reportWith(business, {
      revenue: 1_000_000,
      payroll: 500_000,
    });
    const actions = getCorporateManagementActions(business, report, 1);
    const payroll = actions.find((item) => item.id === 'reduce-excess-hiring-targets');

    expect(report.payrollStatus).toBe('critical');
    expect(payroll?.detail).toContain('recommended');
    expect(payroll?.target).toBe('workforce');
  });

  test('critical action slots prefer distinct management levers', () => {
    const business = corporateBusiness();
    business.corporateWorkforce!.departments.operations.headcount = 1;
    business.corporateWorkforce!.departments.operations.targetHeadcount = 1;
    business.businessLoans = [{
      id: 'expensive',
      amount: 5_000_000,
      remainingAmount: 4_000_000,
      weeklyPayment: 300_000,
      weeksRemaining: 20,
      interestRate: 0.12,
      purpose: 'corporate_revolver',
    }];
    business.reinvestment = {
      technology: { condition: 45, lastRenewedGlobalWeek: 1 },
      premises: { condition: 40, lastRenewedGlobalWeek: 1 },
      equipment: { condition: 35, lastRenewedGlobalWeek: 1 },
    };
    business.budgetPlan = {
      profile: 'standard',
      targetReserveWeeks: 6,
      dividendPct: 0.70,
      debtPaydownPct: 0,
      reinvestmentPct: 0.15,
      growthPct: 0.15,
      reviewYear: 2,
    };

    const report = reportWith(business, {
      productivityIndex: 80,
      departmentProductivity: {
        operations: 75,
        sales: 100,
        finance: 100,
        technology: 100,
        support: 100,
      },
      profit: -100_000,
      expenses: 1_100_000,
      debtService: 300_000,
    });
    const actions = getCorporateManagementActions(business, report, 1);

    expect(actions).toHaveLength(3);
    expect(new Set(actions.map((item) => item.target))).toEqual(
      new Set(['workforce', 'finance', 'maintenance']),
    );
    expect(actions.some((item) => item.id === 'increase-debt-paydown-budget')).toBe(false);
  });

  test('healthy reports do not manufacture management actions', () => {
    const business = corporateBusiness();
    const report = reportWith(business, {});
    const actions = getCorporateManagementActions(business, report, 1);

    expect(report.warnings).toHaveLength(0);
    expect(actions).toHaveLength(0);
  });
});
