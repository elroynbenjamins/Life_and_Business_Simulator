import { getHoldingSubsidiaryAttentionAction, getHoldingSubsidiaryHealthSnapshot } from '../holdingCompanyEngine';

describe('holding subsidiary health snapshot', () => {
  test('marks a profitable well-funded subsidiary as stable', () => {
    const snapshot = getHoldingSubsidiaryHealthSnapshot({
      id: 'stable',
      balance: 2_000_000,
      lastWeekProfit: 100_000,
      lastWeekExpenses: 100_000,
      businessLoans: [],
    } as any, 1);

    expect(snapshot.attention).toBe('stable');
    expect(snapshot.attentionReasons).toEqual([]);
    expect(snapshot.protectedCashGap).toBe(0);
    expect(snapshot.protectedCashCoverage).toBe(1);
  });

  test('surfaces losses and a partial protected-cash gap as watch items', () => {
    const snapshot = getHoldingSubsidiaryHealthSnapshot({
      id: 'watch',
      balance: 600_000,
      lastWeekProfit: -20_000,
      lastWeekExpenses: 100_000,
      businessLoans: [],
    } as any, 1);

    expect(snapshot.attention).toBe('watch');
    expect(snapshot.attentionReasons).toContain('Weekly loss');
    expect(snapshot.attentionReasons.some((reason) => reason.startsWith('Reserve gap'))).toBe(true);
    expect(snapshot.protectedCashGap).toBeGreaterThan(0);
    expect(snapshot.protectedCashCoverage).toBeGreaterThanOrEqual(0.5);
  });

  test('marks major reserve shortfalls and pending integration as critical', () => {
    const snapshot = getHoldingSubsidiaryHealthSnapshot({
      id: 'critical',
      balance: 100_000,
      lastWeekProfit: 10_000,
      lastWeekExpenses: 100_000,
      acquisition: { integrationStrategy: 'pending' },
      businessLoans: [],
    } as any, 1);

    expect(snapshot.attention).toBe('critical');
    expect(snapshot.attentionReasons).toContain('Integration decision');
    expect(snapshot.protectedCashCoverage).toBeLessThan(0.5);
  });

  test('includes debt principal, coverage and leverage in the compact snapshot', () => {
    const snapshot = getHoldingSubsidiaryHealthSnapshot({
      id: 'debt',
      valuation: 2_000_000,
      balance: 2_000_000,
      lastWeekProfit: 100_000,
      lastWeekExpenses: 100_000,
      lastExpenseBreakdown: { loanInterest: 5_000 },
      businessLoans: [{
        id: 'loan',
        amount: 500_000,
        remainingAmount: 550_000,
        weeklyPayment: 55_000,
        weeksRemaining: 10,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    } as any, 1);

    expect(snapshot.debtPrincipal).toBe(500_000);
    expect(snapshot.weeklyDebtService).toBe(55_000);
    expect(snapshot.debtServiceCoverage).toBeCloseTo(105_000 / 55_000);
    expect(snapshot.debtToValue).toBeCloseTo(0.25);
    expect(snapshot.materialDebt).toBe(false);
  });

  test('marks low debt coverage or high leverage as material debt', () => {
    const lowCoverage = getHoldingSubsidiaryHealthSnapshot({
      id: 'coverage',
      valuation: 5_000_000,
      balance: 2_000_000,
      lastWeekProfit: 20_000,
      lastWeekExpenses: 100_000,
      lastExpenseBreakdown: { loanInterest: 5_000 },
      businessLoans: [{
        id: 'loan',
        amount: 500_000,
        remainingAmount: 550_000,
        weeklyPayment: 55_000,
        weeksRemaining: 10,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    } as any, 1);
    const highLeverage = getHoldingSubsidiaryHealthSnapshot({
      id: 'leverage',
      valuation: 1_000_000,
      balance: 2_000_000,
      lastWeekProfit: 200_000,
      lastWeekExpenses: 100_000,
      businessLoans: [{
        id: 'loan',
        amount: 400_000,
        remainingAmount: 440_000,
        weeklyPayment: 22_000,
        weeksRemaining: 20,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    } as any, 1);

    expect(lowCoverage.materialDebt).toBe(true);
    expect(lowCoverage.attention).toBe('critical');
    expect(highLeverage.materialDebt).toBe(true);
    expect(highLeverage.attention).toBe('watch');
  });

  test('routes pending integration and decisions to business overview', () => {
    expect(getHoldingSubsidiaryAttentionAction({
      id: 'integration',
      balance: 2_000_000,
      lastWeekProfit: 100_000,
      lastWeekExpenses: 100_000,
      acquisition: { integrationStrategy: 'pending' },
    } as any, 1)).toMatchObject({ kind: 'business_overview', focus: 'integration', label: 'Choose integration' });

    expect(getHoldingSubsidiaryAttentionAction({
      id: 'decision',
      balance: 2_000_000,
      lastWeekProfit: 100_000,
      lastWeekExpenses: 100_000,
      pendingDecision: { id: 'decision-1' },
    } as any, 1)).toMatchObject({ kind: 'business_overview', focus: 'decision', label: 'Resolve decision' });
  });

  test('routes financial problems to Finance and severe reserve gaps to Holding capital', () => {
    expect(getHoldingSubsidiaryAttentionAction({
      id: 'negative',
      balance: -10_000,
      lastWeekProfit: -20_000,
      lastWeekExpenses: 100_000,
    } as any, 1)).toMatchObject({ kind: 'business_finance', focus: 'cash-management', label: 'Repair cash' });

    expect(getHoldingSubsidiaryAttentionAction({
      id: 'reserve',
      balance: 100_000,
      lastWeekProfit: 10_000,
      lastWeekExpenses: 100_000,
    } as any, 1)).toMatchObject({ kind: 'holding_capital', label: 'Fund reserve' });

    expect(getHoldingSubsidiaryAttentionAction({
      id: 'loss',
      balance: 700_000,
      lastWeekProfit: -20_000,
      lastWeekExpenses: 100_000,
    } as any, 1)).toMatchObject({ kind: 'business_finance', focus: 'budget', label: 'Review loss' });
  });


  test('routes material debt to the Holding debt-paydown comparison', () => {
    expect(getHoldingSubsidiaryAttentionAction({
      id: 'material-debt-action',
      valuation: 1_000_000,
      balance: 2_000_000,
      lastWeekProfit: 200_000,
      lastWeekExpenses: 100_000,
      businessLoans: [{
        id: 'loan',
        amount: 400_000,
        remainingAmount: 440_000,
        weeklyPayment: 22_000,
        weeksRemaining: 20,
        interestRate: 0.10,
        purpose: 'operating',
      }],
    } as any, 1)).toMatchObject({
      kind: 'holding_capital',
      focus: 'debt',
      label: 'Review debt',
    });
  });
  test('returns no action for a stable subsidiary', () => {
    expect(getHoldingSubsidiaryAttentionAction({
      id: 'stable-action',
      balance: 2_000_000,
      lastWeekProfit: 100_000,
      lastWeekExpenses: 100_000,
    } as any, 1)).toBeNull();
  });
});
