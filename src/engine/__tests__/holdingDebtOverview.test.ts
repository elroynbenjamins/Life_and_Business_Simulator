import { getHoldingDebtOverview } from '../holdingCompanyEngine';

describe('holding portfolio debt overview', () => {
  const businesses = [
    {
      id: 'small-debt',
      name: 'Small Debt Co',
      valuation: 5_000_000,
      balance: 2_000_000,
      lastWeekProfit: 150_000,
      lastWeekExpenses: 100_000,
      businessLoans: [{
        id: 'small',
        amount: 250_000,
        remainingAmount: 275_000,
        weeklyPayment: 13_750,
        weeksRemaining: 20,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    },
    {
      id: 'leveraged',
      name: 'Leveraged Co',
      valuation: 1_000_000,
      balance: 2_000_000,
      lastWeekProfit: 200_000,
      lastWeekExpenses: 100_000,
      businessLoans: [{
        id: 'large',
        amount: 400_000,
        remainingAmount: 440_000,
        weeklyPayment: 22_000,
        weeksRemaining: 20,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    },
    {
      id: 'coverage-risk',
      name: 'Coverage Risk Co',
      valuation: 5_000_000,
      balance: 2_000_000,
      lastWeekProfit: 20_000,
      lastWeekExpenses: 100_000,
      lastExpenseBreakdown: { loanInterest: 5_000 },
      businessLoans: [{
        id: 'coverage',
        amount: 500_000,
        remainingAmount: 550_000,
        weeklyPayment: 55_000,
        weeksRemaining: 10,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    },
  ] as any[];

  test('aggregates debt, debt service and material debt count', () => {
    const overview = getHoldingDebtOverview(businesses, 1);

    expect(overview.subsidiaryCount).toBe(3);
    expect(overview.indebtedCount).toBe(3);
    expect(overview.totalDebt).toBe(1_150_000);
    expect(overview.weeklyDebtService).toBe(90_750);
    expect(overview.totalValue).toBe(11_000_000);
    expect(overview.groupDebtToValue).toBeCloseTo(1_150_000 / 11_000_000);
    expect(overview.materialDebtCount).toBe(2);
    expect(overview.groupDebtServiceCoverage).toBeGreaterThan(4);
  });

  test('orders only material debt risks with critical coverage first', () => {
    const overview = getHoldingDebtOverview(businesses, 1);

    expect(overview.topRisks.map((risk) => risk.businessId)).toEqual([
      'coverage-risk',
      'leveraged',
    ]);
    expect(overview.topRisks[0]).toMatchObject({
      businessName: 'Coverage Risk Co',
      debtPrincipal: 500_000,
      weeklyDebtService: 55_000,
      severity: 'critical',
    });
    expect(overview.topRisks[0].debtServiceCoverage).toBeLessThan(1);
    expect(overview.topRisks[1]).toMatchObject({
      businessName: 'Leveraged Co',
      debtPrincipal: 400_000,
      severity: 'watch',
    });
    expect(overview.topRisks[1].debtToValue).toBeCloseTo(0.4);
  });

  test('returns a clean zero-debt overview', () => {
    const overview = getHoldingDebtOverview([{
      id: 'debt-free',
      name: 'Debt Free Co',
      valuation: 2_000_000,
      balance: 1_000_000,
      lastWeekProfit: 100_000,
      lastWeekExpenses: 80_000,
      businessLoans: [],
    } as any], 1);

    expect(overview.totalDebt).toBe(0);
    expect(overview.weeklyDebtService).toBe(0);
    expect(overview.materialDebtCount).toBe(0);
    expect(overview.groupDebtServiceCoverage).toBeNull();
    expect(overview.topRisks).toEqual([]);
  });
});
