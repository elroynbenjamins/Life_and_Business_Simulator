import { getHoldingManagementFeePolicyPreview } from '../holdingCompanyEngine';

describe('holding management fee policy preview', () => {
  const holding = {
    id: 'holding-1',
    name: 'Example Holding',
    managementFeeRate: 0.01,
  } as any;

  const businesses = [
    {
      id: 'healthy',
      holdingCompanyId: 'holding-1',
      lastWeekRevenue: 200_000,
      lastWeekExpenses: 100_000,
      balance: 2_000_000,
    },
    {
      id: 'low-profit',
      holdingCompanyId: 'holding-1',
      lastWeekRevenue: 1_000_000,
      lastWeekExpenses: 990_000,
      balance: 20_000_000,
    },
    {
      id: 'reserve-bound',
      holdingCompanyId: 'holding-1',
      lastWeekRevenue: 500_000,
      lastWeekExpenses: 300_000,
      balance: 2_400_000,
    },
    {
      id: 'minority-owned',
      holdingCompanyId: 'holding-1',
      lastWeekRevenue: 600_000,
      lastWeekExpenses: 300_000,
      balance: 8_000_000,
      ownership: [
        { ownerId: 'player', ownerType: 'player', ownerName: 'You', percent: 80, votingPercent: 80 },
        { ownerId: 'investor', ownerType: 'investor', ownerName: 'Investor', percent: 20, votingPercent: 20 },
      ],
    },
  ] as any[];

  test('estimates the next fee policy using latest reported subsidiary results', () => {
    const preview = getHoldingManagementFeePolicyPreview(holding, businesses, 1, 0.03);

    expect(preview.subsidiaryCount).toBe(4);
    expect(preview.next.eligibleCount).toBe(3);
    expect(preview.next.excludedMinorityCount).toBe(1);
    expect(preview.next.grossRevenueFee).toBe(51_000);
    expect(preview.next.afterProfitCapFee).toBe(24_500);
    expect(preview.next.estimatedFee).toBe(9_500);
    expect(preview.next.profitCapReduction).toBe(26_500);
    expect(preview.next.reserveProtectionReduction).toBe(15_000);
    expect(preview.next.profitLimitedCount).toBe(1);
    expect(preview.next.reserveLimitedCount).toBe(1);
  });

  test('compares current and next expected fee income', () => {
    const preview = getHoldingManagementFeePolicyPreview(holding, businesses, 1, 0.03);

    expect(preview.current.estimatedFee).toBe(5_500);
    expect(preview.next.estimatedFee).toBe(9_500);
    expect(preview.estimatedFeeDelta).toBe(4_000);
  });

  test('zero fee policy estimates no extraction while retaining eligibility context', () => {
    const preview = getHoldingManagementFeePolicyPreview(holding, businesses, 1, 0);

    expect(preview.next.estimatedFee).toBe(0);
    expect(preview.next.grossRevenueFee).toBe(0);
    expect(preview.next.eligibleCount).toBe(3);
    expect(preview.next.excludedMinorityCount).toBe(1);
  });
});
