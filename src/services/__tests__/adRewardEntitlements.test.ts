import { INITIAL_PROFILE } from '../../types/game';
import {
  REMOVE_ADS_DAILY_EDUCATION_REWARD_LIMIT,
  REMOVE_ADS_DAILY_GEM_REWARD_LIMIT,
  REMOVE_ADS_DAILY_SLOT_REWARD_LIMIT,
  getAdFreeEducationRewardUsage,
  getAdFreeSlotRewardUsage,
  getGemRewardUsage,
} from '../adRewardEntitlements';
import { AD_CONFIG } from '../adConfig';

describe('rewarded ad account entitlements', () => {
  const today = '2026-09-23';

  test('standard players keep the normal rewarded-ad daily limit', () => {
    const usage = getGemRewardUsage(INITIAL_PROFILE, today);
    expect(usage.limit).toBe(AD_CONFIG.DAILY_AD_LIMIT);
    expect(usage.remaining).toBe(AD_CONFIG.DAILY_AD_LIMIT);
  });

  test('Remove Ads owners receive exactly two ad-free gem claims per day', () => {
    const profile = {
      ...INITIAL_PROFILE,
      adsRemoved: true,
      rewardedGemClaimDate: today,
      rewardedGemClaimsToday: 1,
    };
    const usage = getGemRewardUsage(profile, today);
    expect(REMOVE_ADS_DAILY_GEM_REWARD_LIMIT).toBe(2);
    expect(usage.watchedToday).toBe(1);
    expect(usage.remaining).toBe(1);
    expect(usage.limitReached).toBe(false);

    const exhausted = getGemRewardUsage({ ...profile, rewardedGemClaimsToday: 2 }, today);
    expect(exhausted.remaining).toBe(0);
    expect(exhausted.limitReached).toBe(true);
  });

  test('Remove Ads owners receive one account-wide ad-free business Slot 2 claim per day', () => {
    const available = getAdFreeSlotRewardUsage({ ...INITIAL_PROFILE, adsRemoved: true }, today);
    expect(REMOVE_ADS_DAILY_SLOT_REWARD_LIMIT).toBe(1);
    expect(available.available).toBe(true);
    expect(available.remaining).toBe(1);

    const used = getAdFreeSlotRewardUsage({
      ...INITIAL_PROFILE,
      adsRemoved: true,
      adFreeSlotRewardClaimDate: today,
    }, today);
    expect(used.available).toBe(false);
    expect(used.remaining).toBe(0);
  });

  test('Remove Ads owners receive one account-wide ad-free education completion per day', () => {
    const available = getAdFreeEducationRewardUsage({ ...INITIAL_PROFILE, adsRemoved: true }, today);
    expect(REMOVE_ADS_DAILY_EDUCATION_REWARD_LIMIT).toBe(1);
    expect(available.available).toBe(true);
    expect(available.remaining).toBe(1);

    const used = getAdFreeEducationRewardUsage({
      ...INITIAL_PROFILE,
      adsRemoved: true,
      adFreeEducationRewardClaimDate: today,
    }, today);
    expect(used.available).toBe(false);
    expect(used.remaining).toBe(0);
  });

  test('daily usage resets on the next local day', () => {
    const profile = {
      ...INITIAL_PROFILE,
      adsRemoved: true,
      rewardedGemClaimDate: '2026-09-22',
      rewardedGemClaimsToday: 2,
      adFreeSlotRewardClaimDate: '2026-09-22',
      adFreeEducationRewardClaimDate: '2026-09-22',
    };
    expect(getGemRewardUsage(profile, today).remaining).toBe(2);
    expect(getAdFreeSlotRewardUsage(profile, today).available).toBe(true);
    expect(getAdFreeEducationRewardUsage(profile, today).available).toBe(true);
  });
});
