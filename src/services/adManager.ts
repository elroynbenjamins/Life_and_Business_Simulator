import { Platform } from 'react-native';
import { RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { AD_CONFIG } from './adConfig';

type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'error';
type Listener = (state: AdState) => void;

let adState: AdState = 'idle';
let rewardedAd: any = null;
let listeners: Listener[] = [];
let rewardCallback: (() => void) | null = null;
let rewardGranted = false;

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
    const earnSub = rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
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
