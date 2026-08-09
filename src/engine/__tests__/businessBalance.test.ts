import { calculateValuation, computeMarketShare, createBusiness } from '../businessEngine';
import { createInitialCompetitors } from '../competitorEngine';
import { OwnedBusiness } from '../../types/game';

describe('business balancing', () => {
  test.each([
    [0, 7],
    [50, 11],
    [100, 15],
  ])('uses a %i reputation revenue multiple of %i', (reputation, multiple) => {
    const business = {
      reputation,
      lastWeekRevenue: 10_000,
      balance: 2_500,
    } as OwnedBusiness;

    expect(calculateValuation(business)).toBe(10_000 * multiple + 2_500);
  });

  test('creates three competitors and gives a new business 10% market share', () => {
    const business = createBusiness('coffee_shop', null, 1, 1, 1);
    expect(business).not.toBeNull();

    const competitors = createInitialCompetitors(business!, 1);
    const share = computeMarketShare(business!, competitors.map((competitor) => competitor.strength));

    expect(competitors).toHaveLength(3);
    expect(share.player).toBe(10);
    expect(share.competitors).toEqual([30, 30, 30]);
  });

  test('applies market-share modifiers without changing the total market', () => {
    const business = {
      reputation: 50,
      valuation: 0,
      employees: [],
      marketShareModifier: 5,
    } as OwnedBusiness;

    const share = computeMarketShare(business, [150, 150, 150]);
    const total = share.player + share.competitors.reduce((sum, value) => sum + value, 0);

    expect(total).toBeCloseTo(100, 1);
  });
});
