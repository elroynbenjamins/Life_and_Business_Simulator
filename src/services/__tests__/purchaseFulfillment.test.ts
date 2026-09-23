import { INITIAL_PROFILE } from '../../types/game';
import { GEM_PRODUCTS } from '../iapManager';
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

  test('hides retired large packs while honoring pending legacy purchases', () => {
    const availableIds = GEM_PRODUCTS.map((product) => product.id);
    expect(availableIds).not.toContain('gems_1000');
    expect(availableIds).not.toContain('gems_2500');

    const thousand = fulfillPurchase(INITIAL_PROFILE, 'gems_1000', 'transaction-retired-1000');
    const twentyFiveHundred = fulfillPurchase(INITIAL_PROFILE, 'gems_2500', 'transaction-retired-2500');

    expect(thousand.recognized).toBe(true);
    expect(thousand.isConsumable).toBe(true);
    expect(thousand.profile.gems).toBe(1000);
    expect(twentyFiveHundred.recognized).toBe(true);
    expect(twentyFiveHundred.isConsumable).toBe(true);
    expect(twentyFiveHundred.profile.gems).toBe(2500);
  });

  test('does not record or grant unknown products', () => {
    const result = fulfillPurchase(INITIAL_PROFILE, 'unknown_product', 'transaction-3');
    expect(result.recognized).toBe(false);
    expect(result.profile).toBe(INITIAL_PROFILE);
  });
});
