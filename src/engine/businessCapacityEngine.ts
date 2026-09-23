import { PlayerProfile } from '../types/game';

export const BASE_BUSINESS_CAPACITY = 2;
export const MAX_BUSINESS_CAPACITY = 10;

export interface BusinessCapacityCost {
  nextCapacity: number;
  prestigePoints: number;
  gems: number;
}

export function getBusinessCapacity(profile: PlayerProfile): number {
  return Math.max(
    BASE_BUSINESS_CAPACITY,
    Math.min(MAX_BUSINESS_CAPACITY, Math.round(profile.businessCapacity ?? BASE_BUSINESS_CAPACITY)),
  );
}

export function getNextBusinessCapacityCost(profile: PlayerProfile): BusinessCapacityCost | null {
  const current = getBusinessCapacity(profile);
  if (current >= MAX_BUSINESS_CAPACITY) return null;
  const nextCapacity = current + 1;
  if (nextCapacity === 3) return { nextCapacity, prestigePoints: 10, gems: 10 };
  if (nextCapacity === 4) return { nextCapacity, prestigePoints: 25, gems: 25 };
  return { nextCapacity, prestigePoints: 50, gems: 50 };
}

export function canPurchaseBusinessCapacity(profile: PlayerProfile): boolean {
  const cost = getNextBusinessCapacityCost(profile);
  return !!cost
    && (profile.prestigePoints ?? 0) >= cost.prestigePoints
    && (profile.gems ?? 0) >= cost.gems;
}

export function purchaseBusinessCapacity(profile: PlayerProfile): PlayerProfile | null {
  const cost = getNextBusinessCapacityCost(profile);
  if (!cost || !canPurchaseBusinessCapacity(profile)) return null;
  return {
    ...profile,
    businessCapacity: cost.nextCapacity,
    prestigePoints: (profile.prestigePoints ?? 0) - cost.prestigePoints,
    gems: (profile.gems ?? 0) - cost.gems,
  };
}

export function unlockBusinessCapacity(profile: PlayerProfile): PlayerProfile | null {
  const current = getBusinessCapacity(profile);
  if (current >= MAX_BUSINESS_CAPACITY) return null;
  return {
    ...profile,
    businessCapacity: current + 1,
  };
}
