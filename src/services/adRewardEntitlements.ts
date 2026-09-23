import { PlayerProfile } from '../types/game';
import { AD_CONFIG } from './adConfig';

export const REMOVE_ADS_DAILY_GEM_REWARD_LIMIT = 1;
export const REMOVE_ADS_DAILY_GEM_REWARD_AMOUNT = 20;
export const REMOVE_ADS_DAILY_SLOT_REWARD_LIMIT = 1;
export const REMOVE_ADS_DAILY_EDUCATION_REWARD_LIMIT = 1;
export const BUSINESS_CAPACITY_AD_UNLOCK_DAILY_LIMIT = 1;

export function getLocalDayKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getGemRewardUsage(profile: PlayerProfile, dayKey = getLocalDayKey()) {
  const limit = profile.adsRemoved ? REMOVE_ADS_DAILY_GEM_REWARD_LIMIT : AD_CONFIG.DAILY_AD_LIMIT;
  const watchedToday = profile.rewardedGemClaimDate === dayKey
    ? Math.max(0, profile.rewardedGemClaimsToday ?? 0)
    : 0;
  const remaining = Math.max(0, limit - watchedToday);
  return { watchedToday, remaining, limit, limitReached: remaining <= 0 };
}

export function getAdFreeSlotRewardUsage(profile: PlayerProfile, dayKey = getLocalDayKey()) {
  const claimedToday = profile.adsRemoved && profile.adFreeSlotRewardClaimDate === dayKey ? 1 : 0;
  const limit = profile.adsRemoved ? REMOVE_ADS_DAILY_SLOT_REWARD_LIMIT : 0;
  const remaining = Math.max(0, limit - claimedToday);
  return {
    claimedToday,
    remaining,
    limit,
    available: profile.adsRemoved && remaining > 0,
  };
}

export function getAdFreeEducationRewardUsage(profile: PlayerProfile, dayKey = getLocalDayKey()) {
  const claimedToday = profile.adsRemoved && profile.adFreeEducationRewardClaimDate === dayKey ? 1 : 0;
  const limit = profile.adsRemoved ? REMOVE_ADS_DAILY_EDUCATION_REWARD_LIMIT : 0;
  const remaining = Math.max(0, limit - claimedToday);
  return {
    claimedToday,
    remaining,
    limit,
    available: profile.adsRemoved && remaining > 0,
  };
}


export function getBusinessCapacityAdUnlockUsage(profile: PlayerProfile, dayKey = getLocalDayKey()) {
  const claimedToday = profile.businessCapacityAdClaimDate === dayKey ? 1 : 0;
  const limit = BUSINESS_CAPACITY_AD_UNLOCK_DAILY_LIMIT;
  const remaining = Math.max(0, limit - claimedToday);
  return {
    claimedToday,
    remaining,
    limit,
    available: remaining > 0,
  };
}
