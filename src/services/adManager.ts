import { Platform } from 'react-native';
import { AD_CONFIG, RewardedAdPlacement } from './adConfig';
import { canRequestAds } from './adPrivacyManager';
import { loadGoogleMobileAdsModule } from './nativeAdsModule';

type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'error';
type Listener = (state: AdState) => void;
type Unsubscribe = () => void;

const REWARDED_LOAD_TIMEOUT_MS = 15000;
const REWARDED_SHOW_TIMEOUT_MS = 120000;
const INTERSTITIAL_LOAD_TIMEOUT_MS = 15000;

let adState: AdState = 'idle';
let rewardedAd: any = null;
let rewardedAdEventType: any = null;
let rewardedBaseEventType: any = null;
let listeners: Listener[] = [];
let interstitialAd: any = null;
let interstitialLoading = false;

function setAdState(next: AdState) {
  adState = next;
  listeners.forEach((listener) => listener(adState));
}

function clearRewardedAd(nextState: AdState) {
  rewardedAd = null;
  rewardedAdEventType = null;
  rewardedBaseEventType = null;
  setAdState(nextState);
}

function productionRewardedUnit(placement: RewardedAdPlacement): string {
  if (placement === 'education') return AD_CONFIG.EDUCATION_REWARDED_AD_UNIT_ID_ANDROID;
  if (placement === 'business_project_slot') return AD_CONFIG.BUSINESS_PROJECT_SLOT_REWARDED_AD_UNIT_ID_ANDROID;
  if (placement === 'business_upgrade_slot') return AD_CONFIG.BUSINESS_UPGRADE_SLOT_REWARDED_AD_UNIT_ID_ANDROID;
  if (placement === 'business_company_slot') return AD_CONFIG.BUSINESS_COMPANY_SLOT_REWARDED_AD_UNIT_ID_ANDROID;
  return AD_CONFIG.GEM_REWARDED_AD_UNIT_ID_ANDROID;
}

export function getAdState(): AdState {
  return adState;
}

export function subscribeAdState(fn: Listener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((listener) => listener !== fn); };
}

export async function loadRewardedAd(placement: RewardedAdPlacement): Promise<boolean> {
  // Keep rewarded ads single-flight across every placement. A second screen
  // cannot replace the ad instance while Education/Support/Business is loading.
  if (adState === 'loading' || adState === 'ready' || adState === 'showing') return false;
  setAdState('loading');

  try {
    if (!(await canRequestAds())) {
      clearRewardedAd('error');
      return false;
    }

    const {
      RewardedAd,
      RewardedAdEventType,
      AdEventType,
    } = await loadGoogleMobileAdsModule();

    const adUnitId = AD_CONFIG.USE_TEST_ADS
      ? (Platform.OS === 'ios' ? AD_CONFIG.REWARDED_TEST_AD_UNIT_ID_IOS : AD_CONFIG.REWARDED_TEST_AD_UNIT_ID_ANDROID)
      : (Platform.OS === 'ios' ? AD_CONFIG.REWARDED_TEST_AD_UNIT_ID_IOS : productionRewardedUnit(placement));

    const ad = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let loadSub: Unsubscribe | null = null;
      let errorSub: Unsubscribe | null = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        loadSub?.();
        errorSub?.();
      };

      const settle = (success: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();

        if (success) {
          rewardedAd = ad;
          rewardedAdEventType = RewardedAdEventType;
          rewardedBaseEventType = AdEventType;
          setAdState('ready');
        } else {
          clearRewardedAd('error');
        }
        resolve(success);
      };

      loadSub = ad.addAdEventListener(RewardedAdEventType.LOADED, () => settle(true));
      errorSub = ad.addAdEventListener(AdEventType?.ERROR ?? 'error', () => settle(false));
      timeout = setTimeout(() => settle(false), REWARDED_LOAD_TIMEOUT_MS);

      try {
        ad.load();
      } catch {
        settle(false);
      }
    });
  } catch {
    clearRewardedAd('error');
    return false;
  }
}

export async function showRewardedAd(onReward: () => void): Promise<boolean> {
  if (adState !== 'ready' || !rewardedAd || !rewardedAdEventType) return false;

  const ad = rewardedAd;
  const rewardedEvents = rewardedAdEventType;
  const baseEvents = rewardedBaseEventType;
  setAdState('showing');

  return await new Promise<boolean>(async (resolve) => {
    let settled = false;
    let rewardGranted = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let earnSub: Unsubscribe | null = null;
    let closeSub: Unsubscribe | null = null;
    let errorSub: Unsubscribe | null = null;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      earnSub?.();
      closeSub?.();
      errorSub?.();
    };

    const settle = (earned: boolean, nextState: AdState) => {
      if (settled) return;
      settled = true;
      cleanup();
      clearRewardedAd(nextState);
      resolve(earned);
    };

    earnSub = ad.addAdEventListener(rewardedEvents.EARNED_REWARD, () => {
      if (rewardGranted) return;
      rewardGranted = true;
      try {
        onReward();
      } catch {
        // Reward delivery should never strand the native ad in a busy state.
      }
    });
    closeSub = ad.addAdEventListener(baseEvents?.CLOSED ?? 'closed', () => settle(rewardGranted, 'idle'));
    errorSub = ad.addAdEventListener(baseEvents?.ERROR ?? 'error', () => settle(false, 'error'));
    timeout = setTimeout(() => settle(false, 'error'), REWARDED_SHOW_TIMEOUT_MS);

    try {
      await ad.show();
    } catch {
      settle(false, 'error');
    }
  });
}

export async function loadInterstitialAd(): Promise<boolean> {
  if (interstitialLoading || interstitialAd) return false;
  interstitialLoading = true;

  try {
    if (!(await canRequestAds())) {
      interstitialLoading = false;
      return false;
    }

    const { InterstitialAd, AdEventType } = await loadGoogleMobileAdsModule();
    const unitId = AD_CONFIG.USE_TEST_ADS
      ? (Platform.OS === 'ios' ? AD_CONFIG.INTERSTITIAL_TEST_AD_UNIT_ID_IOS : AD_CONFIG.INTERSTITIAL_TEST_AD_UNIT_ID_ANDROID)
      : (Platform.OS === 'ios' ? AD_CONFIG.INTERSTITIAL_TEST_AD_UNIT_ID_IOS : AD_CONFIG.SCHEDULED_INTERSTITIAL_AD_UNIT_ID_ANDROID);
    const ad = InterstitialAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });

    return await new Promise<boolean>((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let loadedSub: Unsubscribe | null = null;
      let failedSub: Unsubscribe | null = null;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        loadedSub?.();
        failedSub?.();
      };
      const settle = (success: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        interstitialLoading = false;
        interstitialAd = success ? ad : null;
        resolve(success);
      };

      loadedSub = ad.addAdEventListener(AdEventType.LOADED, () => settle(true));
      failedSub = ad.addAdEventListener(AdEventType.ERROR, () => settle(false));
      timeout = setTimeout(() => settle(false), INTERSTITIAL_LOAD_TIMEOUT_MS);

      try {
        ad.load();
      } catch {
        settle(false);
      }
    });
  } catch {
    interstitialLoading = false;
    interstitialAd = null;
    return false;
  }
}

export async function showInterstitialAd(onClosed: () => void): Promise<boolean> {
  if (!interstitialAd) return false;
  const ad = interstitialAd;

  try {
    const { AdEventType } = await loadGoogleMobileAdsModule();
    const closed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      closed();
      if (interstitialAd === ad) interstitialAd = null;
      onClosed();
    });
    await ad.show();
    return true;
  } catch {
    if (interstitialAd === ad) interstitialAd = null;
    return false;
  }
}
