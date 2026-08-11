// Web stub — ads not available on web

type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'error';
type Listener = (state: AdState) => void;

let listeners: Listener[] = [];

export function getAdState(): AdState {
  return 'error';
}

export function subscribeAdState(fn: Listener): () => void {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
}

export async function loadRewardedAd(): Promise<boolean> {
  return false;
}

export async function showRewardedAd(_onReward: () => void): Promise<boolean> {
  return false;
}

export async function loadInterstitialAd(): Promise<boolean> { return false; }
export async function showInterstitialAd(_onClosed: () => void): Promise<boolean> { return false; }
