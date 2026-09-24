import { getHoldingReservePolicyPreview, getHoldingReserveTarget } from '../holdingCompanyEngine';

describe('holding reserve policy preview', () => {
  const holding = {
    id: 'holding-1',
    name: 'Example Holding',
    cashReserve: 5_000_000,
    reserveTargetWeeks: 4,
  } as any;

  const businesses = [
    { id: 'a', holdingCompanyId: 'holding-1', lastWeekExpenses: 250_000 },
    { id: 'b', holdingCompanyId: 'holding-1', lastWeekExpenses: 150_000 },
    { id: 'c', holdingCompanyId: 'other', lastWeekExpenses: 900_000 },
  ] as any[];

  test('shows protected cash and owner-distribution headroom for a higher reserve policy', () => {
    const preview = getHoldingReservePolicyPreview(holding, businesses, 8);

    expect(preview.weeklyOperatingExpenses).toBe(400_000);
    expect(preview.currentTarget).toBe(1_600_000);
    expect(preview.nextTarget).toBe(3_200_000);
    expect(preview.currentAvailableDistributionCash).toBe(3_400_000);
    expect(preview.nextAvailableDistributionCash).toBe(1_800_000);
    expect(preview.distributionHeadroomDelta).toBe(-1_600_000);
  });

  test('turning the reserve target off releases the protected amount for owner distributions', () => {
    const preview = getHoldingReservePolicyPreview(holding, businesses, 0);

    expect(preview.nextTarget).toBe(0);
    expect(preview.nextAvailableDistributionCash).toBe(5_000_000);
    expect(preview.distributionHeadroomDelta).toBe(1_600_000);
  });

  test('headroom never becomes negative when the reserve target exceeds current cash', () => {
    const preview = getHoldingReservePolicyPreview(
      { ...holding, cashReserve: 1_000_000 } as any,
      businesses,
      12,
    );

    expect(preview.nextTarget).toBe(4_800_000);
    expect(preview.nextAvailableDistributionCash).toBe(0);
  });

  test('uses the same rounding basis as the live reserve target calculation', () => {
    const fractionalBusinesses = [
      { id: 'a', holdingCompanyId: 'holding-1', lastWeekExpenses: 100.4 },
      { id: 'b', holdingCompanyId: 'holding-1', lastWeekExpenses: 100.4 },
    ] as any[];
    const preview = getHoldingReservePolicyPreview(holding, fractionalBusinesses, 8);
    const liveTarget = getHoldingReserveTarget(
      { ...holding, reserveTargetWeeks: 8 } as any,
      fractionalBusinesses,
    );

    expect(preview.nextTarget).toBe(liveTarget);
  });
});
