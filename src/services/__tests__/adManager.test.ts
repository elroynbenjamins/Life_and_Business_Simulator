type MockAd = {
  addAdEventListener: jest.Mock;
  load: jest.Mock;
  show: jest.Mock;
  emit: (event: string, ...args: any[]) => void;
};

type AdsMock = {
  __createdAds: MockAd[];
  RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
  AdEventType: { LOADED: string; ERROR: string; CLOSED: string };
  RewardedAd: { createForAdRequest: jest.Mock };
  InterstitialAd: { createForAdRequest: jest.Mock };
};

function buildAdsMock(): AdsMock {
  const createdAds: MockAd[] = [];

  const makeAd = (): MockAd => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    const ad: MockAd = {
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
}

async function flushNativeModuleLoad() {
  // Babel/Jest lowers the dynamic native-module import through microtasks.
  // Keep this timer-free so it is reliable with both real and fake timers.
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

let mockAdsModule: AdsMock;

function getHarness() {
  const manager = require('../adManager') as typeof import('../adManager');
  return { manager, ads: mockAdsModule };
}

describe('rewarded ad responsiveness', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useRealTimers();
    mockAdsModule = buildAdsMock();

    // Register fresh mocks after each reset so the dynamic import inside
    // adManager and this test share one exact native-module instance.
    jest.doMock('../adPrivacyManager', () => ({
      canRequestAds: jest.fn(async () => true),
    }));
    jest.doMock('react-native-google-mobile-ads', () => mockAdsModule);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.dontMock('../adPrivacyManager');
    jest.dontMock('react-native-google-mobile-ads');
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
    expect(ads.__createdAds).toHaveLength(1);

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
    expect(ads.__createdAds).toHaveLength(1);

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
    await flushNativeModuleLoad();
    expect(ads.__createdAds).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(15000);
    await expect(timedOut).resolves.toBe(false);
    expect(manager.getAdState()).toBe('error');

    const retry = manager.loadRewardedAd('gems');
    await flushNativeModuleLoad();
    expect(ads.__createdAds).toHaveLength(2);

    ads.__createdAds[1].emit(ads.RewardedAdEventType.LOADED);
    await expect(retry).resolves.toBe(true);
  });
});
