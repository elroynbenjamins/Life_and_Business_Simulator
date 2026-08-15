import { PlayerProfile } from '../types/game';
import { GEM_PRODUCTS, REMOVE_ADS_PRODUCT_ID } from './iapManager';

const MAX_RECORDED_PURCHASES = 100;

export type FulfillmentResult = {
  profile: PlayerProfile;
  duplicate: boolean;
  recognized: boolean;
  isConsumable: boolean;
  gemsGranted: number;
};

/**
 * Produces one atomic profile update for a store transaction. Keeping the
 * entitlement/currency change and transaction ID in the same saved profile
 * prevents replayed purchase callbacks from granting an item twice.
 */
export function fulfillPurchase(profile: PlayerProfile, productId: string, purchaseId: string): FulfillmentResult {
  const processed = profile.processedPurchaseIds ?? [];
  const isDuplicate = processed.includes(purchaseId);
  const gemPack = GEM_PRODUCTS.find((product) => product.id === productId);
  const isRemoveAds = productId === REMOVE_ADS_PRODUCT_ID;
  const recognized = isRemoveAds || !!gemPack;

  if (isDuplicate || !recognized) {
    return { profile, duplicate: isDuplicate, recognized, isConsumable: !!gemPack, gemsGranted: 0 };
  }

  const processedPurchaseIds = [...processed, purchaseId].slice(-MAX_RECORDED_PURCHASES);
  const updated = isRemoveAds
    ? { ...profile, adsRemoved: true, processedPurchaseIds }
    : { ...profile, gems: (profile.gems ?? 0) + (gemPack?.gems ?? 0), processedPurchaseIds };

  return {
    profile: updated,
    duplicate: false,
    recognized: true,
    isConsumable: !!gemPack,
    gemsGranted: gemPack?.gems ?? 0,
  };
}
