jest.mock('../adPrivacyManager', () => ({
  canRequestAds: jest.fn(async () => true),
}));

jest.mock('react-native-google-mobile-ads', () => {
  const createdAds: any[] = [];

  const makeAd = () => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    const ad = {
      addAdEventListener: jest.fn((event: string, callback: (...args: any[]) => void) => {
        const callbacks = listeners.get(event) ?? new Set();
        callbacks.add(callback);
        listeners.set(event, callbacks);
        return () => callbacks.delete(callback);
      }),
      load: jest.fn(),
      show: jest.fn(async () => undefined),
      emit: (event: string, ...args: any[]) => {
        for (const callback of [...(listeners.get(event) ?? [])]) callback(...args);
      },
    };
    createdAds.push(ad);
    return ad;
  };

  return {
    __createdAds: createdAds,
    RewardedAdEventType: {
      LOADED: 'rewarded_loaded',
      EARNED_REWARD: 'earned_reward',
    },
    AdEventType: {
      LOADED: 'loaded',
      ERROR: 'error',
      CLOSED: 'closed',
    },
    RewardedAd: {
      createForAdRequest: jest.fn(() => makeAd()),
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => makeAd()),
    },
  };
});

async function flushNativeModuleLoad() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
  await Promise.resolve();
}

function getHarness() {
  const manager = require('../adManager') as typeof import('../adManager');
  const ads = require('react-native-google-mobile-ads') as {
    __createdAds: Array<{
      emit: (event: string, ...args: any[]) => void;
      load: jest.Mock;
      show: jest.Mock;
    }>;
    RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
    AdEventType: { ERROR: string; CLOSED: string };
    RewardedAd: { createForAdRequest: jest.Mock };
  };
  return { manager, ads };
}

describe('rewarded ad responsiveness', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('rejects a second load while another rewarded placement is loading', async () => {
    const { manager, ads } = getHarness();

    const firstLoad = manager.loadRewardedAd('education');
    expect(manager.getAdState()).toBe('loading');

    await expect(manager.loadRewardedAd('gems')).resolves.toBe(false);
    await flushNativeModuleLoad();

    expect(ads.RewardedAd.createForAdRequest).toHaveBeenCalledTimes(1);
    expect(ads.__createdAds).toHaveLength(1);

    ads.__createdAds[0].emit(ads.RewardedAdEventType.LOADED);
    await expect(firstLoad).resolves.toBe(true);
    expect(manager.getAdState()).toBe('ready');
  });

  test('a failed load releases the single-flight lock so the player can retry', async () => {
    const { manager, ads } = getHarness();

    const firstLoad = manager.loadRewardedAd('education');
    await flushNativeModuleLoad();
    ads.__createdAds[0].emit(ads.AdEventType.ERROR);
    await expect(firstLoad).resolves.toBe(false);
    expect(manager.getAdState()).toBe('error');

    const retry = manager.loadRewardedAd('education');
    await flushNativeModuleLoad();
    expect(ads.__createdAds).toHaveLength(2);
    ads.__createdAds[1].emit(ads.RewardedAdEventType.LOADED);
    await expect(retry).resolves.toBe(true);
    expect(manager.getAdState()).toBe('ready');
  });

  test('grants a reward once and returns to idle when the ad closes', async () => {
    const { manager, ads } = getHarness();

    const load = manager.loadRewardedAd('education');
    await flushNativeModuleLoad();
    ads.__createdAds[0].emit(ads.RewardedAdEventType.LOADED);
    await expect(load).resolves.toBe(true);

    const reward = jest.fn();
    const shown = manager.showRewardedAd(reward);
    expect(manager.getAdState()).toBe('showing');

    ads.__createdAds[0].emit(ads.RewardedAdEventType.EARNED_REWARD);
    ads.__createdAds[0].emit(ads.RewardedAdEventType.EARNED_REWARD);
    expect(reward).toHaveBeenCalledTimes(1);

    ads.__createdAds[0].emit(ads.AdEventType.CLOSED);
    await expect(shown).resolves.toBe(true);
    expect(manager.getAdState()).toBe('idle');
  });

  test('load timeout resolves and does not leave the manager permanently busy', async () => {
    jest.useFakeTimers();
    const { manager, ads } = getHarness();

    const timedOut = manager.loadRewardedAd('education');
    await jest.advanceTimersByTimeAsync(0);
    expect(ads.__createdAds).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(15000);
    await expect(timedOut).resolves.toBe(false);
    expect(manager.getAdState()).toBe('error');

    const retry = manager.loadRewardedAd('gems');
    await jest.advanceTimersByTimeAsync(0);
    expect(ads.__createdAds).toHaveLength(2);
    ads.__createdAds[1].emit(ads.RewardedAdEventType.LOADED);
    await expect(retry).resolves.toBe(true);
  });
});
