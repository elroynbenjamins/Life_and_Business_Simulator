import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const REMOVE_ADS_PRODUCT_ID = 'remove_ads';
export const GEM_PRODUCTS = [
  { id: 'gems_100', gems: 100, fallbackPrice: '$0.99' },
  { id: 'gems_250', gems: 250, fallbackPrice: '$2.49' },
  { id: 'gems_500', gems: 500, fallbackPrice: '$4.99' },
  { id: 'gems_1000', gems: 1000, fallbackPrice: '$8.99' },
  { id: 'gems_2500', gems: 2500, fallbackPrice: '$19.99' },
] as const;

export type StoreProduct = { id: string; displayPrice: string };
type PurchaseHandlers = {
  onSuccess: (productId: string, finish: (isConsumable: boolean) => Promise<void>) => void;
  onError: (message: string) => void;
};

let iap: typeof import('expo-iap') | null = null;
let purchaseSub: { remove: () => void } | null = null;
let errorSub: { remove: () => void } | null = null;

export function isNativeStoreAvailable() {
  return Platform.OS !== 'web' && Constants.expoGoConfig == null;
}

export async function connectStore(handlers: PurchaseHandlers): Promise<StoreProduct[]> {
  if (!isNativeStoreAvailable()) return [];
  try {
    iap = await import('expo-iap');
    await iap.initConnection();
    purchaseSub?.remove();
    errorSub?.remove();
    purchaseSub = iap.purchaseUpdatedListener((purchase) => {
      handlers.onSuccess(purchase.productId, (isConsumable) => iap!.finishTransaction({ purchase, isConsumable }));
    });
    errorSub = iap.purchaseErrorListener((error) => handlers.onError(error.message));
    const ids = [REMOVE_ADS_PRODUCT_ID, ...GEM_PRODUCTS.map((product) => product.id)];
    const products = await iap.fetchProducts({ skus: ids, type: 'in-app' });
    return (products ?? []).map((product) => ({ id: product.id, displayPrice: product.displayPrice }));
  } catch {
    handlers.onError('Google Play purchases are unavailable. Install a Play testing build and try again.');
    return [];
  }
}

export async function purchaseProduct(productId: string) {
  if (!iap) throw new Error('The store is not connected.');
  await iap.requestPurchase({
    request: { apple: { sku: productId }, google: { skus: [productId] } },
    type: 'in-app',
  });
}

export async function restoreRemoveAds(): Promise<boolean> {
  if (!iap) return false;
  const purchases = await iap.getAvailablePurchases();
  return purchases.some((purchase) => purchase.productId === REMOVE_ADS_PRODUCT_ID);
}

export async function disconnectStore() {
  purchaseSub?.remove();
  errorSub?.remove();
  purchaseSub = null;
  errorSub = null;
  if (iap) await iap.endConnection();
  iap = null;
}
