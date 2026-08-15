import { INITIAL_PROFILE } from '../../types/game';
import { fulfillPurchase } from '../purchaseFulfillment';

describe('purchase fulfillment', () => {
  test('grants a consumable once and records its transaction', () => {
    const first = fulfillPurchase(INITIAL_PROFILE, 'gems_100', 'transaction-1');
    const replay = fulfillPurchase(first.profile, 'gems_100', 'transaction-1');

    expect(first.profile.gems).toBe(100);
    expect(first.profile.processedPurchaseIds).toContain('transaction-1');
    expect(replay.duplicate).toBe(true);
    expect(replay.profile.gems).toBe(100);
  });

  test('grants the permanent remove-ads entitlement', () => {
    const result = fulfillPurchase(INITIAL_PROFILE, 'remove_ads', 'transaction-2');
    expect(result.profile.adsRemoved).toBe(true);
    expect(result.isConsumable).toBe(false);
  });

  test('does not record or grant unknown products', () => {
    const result = fulfillPurchase(INITIAL_PROFILE, 'unknown_product', 'transaction-3');
    expect(result.recognized).toBe(false);
    expect(result.profile).toBe(INITIAL_PROFILE);
  });
});
