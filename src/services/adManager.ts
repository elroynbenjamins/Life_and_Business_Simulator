import { Platform } from 'react-native';
import { AD_CONFIG } from './adConfig';

type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'error';
type Listener = (state: AdState) => void;

let adState: AdState = 'idle';
let rewardedAd: any = null;
let rewardedAdEventType: any = null;
let listeners: Listener[] = [];
let rewardCallback: (() => void) | null = null;
let rewardGranted = false;
let interstitialAd: any = null;

function notify() {
  listeners.forEach((l) => l(adState));
}

export function getAdState(): AdState {
  return adState;
}

export function subscribeAdState(fn: Listener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export async function loadRewardedAd(): Promise<boolean> {
  try {
    // This native module is unavailable in Expo Go. Loading it lazily keeps the
    // rest of the app compatible while development/production builds retain AdMob.
    const { RewardedAd, RewardedAdEventType } = await import('react-native-google-mobile-ads');
    rewardedAdEventType = RewardedAdEventType;
    adState = 'loading';
    notify();
    const adUnitId = Platform.OS === 'ios'
      ? AD_CONFIG.REWARDED_AD_UNIT_ID_IOS
      : AD_CONFIG.REWARDED_AD_UNIT_ID_ANDROID;

    rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    return new Promise<boolean>((resolve) => {
      const loadSub = rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        adState = 'ready';
        notify();
        loadSub();
        resolve(true);
      });

      const errorSub = rewardedAd.addAdEventListener('error', () => {
        adState = 'error';
        notify();
        errorSub();
        resolve(false);
      });

      rewardedAd.load();

      setTimeout(() => {
        if (adState === 'loading') {
          adState = 'error';
          notify();
          resolve(false);
        }
      }, 15000);
    });
  } catch {
    adState = 'error';
    notify();
    return false;
  }
}

export async function showRewardedAd(onReward: () => void): Promise<boolean> {
  if (adState !== 'ready' || !rewardedAd) return false;
  rewardGranted = false;
  rewardCallback = onReward;

  try {
    const earnSub = rewardedAd.addAdEventListener(rewardedAdEventType.EARNED_REWARD, () => {
      if (!rewardGranted) {
        rewardGranted = true;
        rewardCallback?.();
      }
      earnSub();
    });

    const closeSub = rewardedAd.addAdEventListener('closed', () => {
      adState = 'idle';
      notify();
      rewardCallback = null;
      rewardedAd = null;
      closeSub();
    });

    adState = 'showing';
    notify();
    await rewardedAd.show();
    return true;
  } catch {
    adState = 'error';
    notify();
    rewardCallback = null;
    return false;
  }
}

export async function loadInterstitialAd(): Promise<boolean> {
  try {
    const { InterstitialAd, AdEventType } = await import('react-native-google-mobile-ads');
    const unitId = Platform.OS === 'ios' ? AD_CONFIG.INTERSTITIAL_AD_UNIT_ID_IOS : AD_CONFIG.INTERSTITIAL_AD_UNIT_ID_ANDROID;
    interstitialAd = InterstitialAd.createForAdRequest(unitId, { requestNonPersonalizedAdsOnly: true });
    return await new Promise<boolean>((resolve) => {
      const loaded = interstitialAd.addAdEventListener(AdEventType.LOADED, () => { loaded(); resolve(true); });
      const failed = interstitialAd.addAdEventListener(AdEventType.ERROR, () => { failed(); resolve(false); });
      interstitialAd.load();
      setTimeout(() => resolve(false), 15000);
    });
  } catch { return false; }
}

export async function showInterstitialAd(onClosed: () => void): Promise<boolean> {
  if (!interstitialAd) return false;
  try {
    const { AdEventType } = await import('react-native-google-mobile-ads');
    const closed = interstitialAd.addAdEventListener(AdEventType.CLOSED, () => { closed(); interstitialAd = null; onClosed(); });
    await interstitialAd.show();
    return true;
  } catch { return false; }
}
