import { filterAndSortHoldingSubsidiaries, getHoldingSubsidiaryAttentionSummary } from '../holdingCompanyEngine';

const businesses = [
  {
    id: 'stable-delegated',
    name: 'Stable Co',
    balance: 2_000_000,
    lastWeekProfit: 80_000,
    lastWeekExpenses: 100_000,
    delegationPolicy: 'balanced',
    businessLoans: [],
  },
  {
    id: 'loss-manual',
    name: 'Loss Co',
    balance: 700_000,
    lastWeekProfit: -40_000,
    lastWeekExpenses: 100_000,
    delegationPolicy: 'manual',
    businessLoans: [],
  },
  {
    id: 'critical-debt',
    name: 'Critical Co',
    balance: 100_000,
    lastWeekProfit: 10_000,
    lastWeekExpenses: 100_000,
    acquisition: { integrationStrategy: 'pending' },
    delegationPolicy: 'balanced',
    businessLoans: [{
      id: 'loan',
      amount: 500_000,
      remainingAmount: 550_000,
      weeklyPayment: 55_000,
      weeksRemaining: 10,
      interestRate: 0.10,
      purpose: 'operating',
    }],
  },
] as any[];

describe('holding subsidiary filtering and sorting', () => {
  test('defaults to attention-first ordering', () => {
    const result = filterAndSortHoldingSubsidiaries(businesses, 1);

    expect(result.map((business) => business.id)).toEqual([
      'critical-debt',
      'loss-manual',
      'stable-delegated',
    ]);
  });

  test('filters companies needing attention', () => {
    const result = filterAndSortHoldingSubsidiaries(businesses, 1, 'attention', 'attention');

    expect(result.map((business) => business.id)).toEqual([
      'critical-debt',
      'loss-manual',
    ]);
  });

  test('supports exact critical and watch shortcuts', () => {
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'critical').map((b) => b.id))
      .toEqual(['critical-debt']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'watch').map((b) => b.id))
      .toEqual(['loss-manual']);
  });

  test('summarizes holding attention categories for shortcut chips', () => {
    const summary = getHoldingSubsidiaryAttentionSummary(businesses, 1);

    expect(summary).toMatchObject({
      total: 3,
      critical: 1,
      watch: 1,
      stable: 1,
      attention: 2,
      loss: 1,
      reserve: 2,
      debt: 1,
      manual: 1,
      delegated: 2,
    });
  });

  test('supports loss, reserve, debt, manual and delegated filters', () => {
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'loss').map((b) => b.id))
      .toEqual(['loss-manual']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'reserve').map((b) => b.id))
      .toEqual(['critical-debt', 'loss-manual']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'debt').map((b) => b.id))
      .toEqual(['critical-debt']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'manual').map((b) => b.id))
      .toEqual(['loss-manual']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'delegated').map((b) => b.id))
      .toEqual(['critical-debt', 'stable-delegated']);
  });

  test('supports low-first profit/cash and high-first debt sorting', () => {
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'all', 'profit').map((b) => b.id))
      .toEqual(['loss-manual', 'critical-debt', 'stable-delegated']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'all', 'cash').map((b) => b.id))
      .toEqual(['critical-debt', 'loss-manual', 'stable-delegated']);
    expect(filterAndSortHoldingSubsidiaries(businesses, 1, 'all', 'debt').map((b) => b.id)[0])
      .toBe('critical-debt');
  });
});
