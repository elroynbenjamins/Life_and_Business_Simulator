import { INITIAL_PROFILE } from '../../types/game';
import {
  getBusinessCapacity,
  getNextBusinessCapacityCost,
  purchaseBusinessCapacity,
  unlockBusinessCapacity,
} from '../businessCapacityEngine';

describe('businessCapacityEngine', () => {
  test('starts with two account-wide company slots', () => {
    expect(getBusinessCapacity({ ...INITIAL_PROFILE })).toBe(2);
    expect(getNextBusinessCapacityCost({ ...INITIAL_PROFILE })).toEqual({
      nextCapacity: 3,
      prestigePoints: 10,
      gems: 10,
    });
  });

  test('uses the requested 10/10, 25/25, then 50/50 permanent cost curve', () => {
    expect(getNextBusinessCapacityCost({ ...INITIAL_PROFILE, businessCapacity: 3 })).toEqual({
      nextCapacity: 4,
      prestigePoints: 25,
      gems: 25,
    });
    expect(getNextBusinessCapacityCost({ ...INITIAL_PROFILE, businessCapacity: 4 })).toEqual({
      nextCapacity: 5,
      prestigePoints: 50,
      gems: 50,
    });
    expect(getNextBusinessCapacityCost({ ...INITIAL_PROFILE, businessCapacity: 9 })).toEqual({
      nextCapacity: 10,
      prestigePoints: 50,
      gems: 50,
    });
    expect(getNextBusinessCapacityCost({ ...INITIAL_PROFILE, businessCapacity: 10 })).toBeNull();
  });

  test('PP and Gems must both be available and are both deducted', () => {
    const profile = {
      ...INITIAL_PROFILE,
      prestigePoints: 10,
      gems: 10,
      businessCapacity: 2,
    };
    const upgraded = purchaseBusinessCapacity(profile);
    expect(upgraded?.businessCapacity).toBe(3);
    expect(upgraded?.prestigePoints).toBe(0);
    expect(upgraded?.gems).toBe(0);

    expect(purchaseBusinessCapacity({ ...profile, prestigePoints: 9 })).toBeNull();
    expect(purchaseBusinessCapacity({ ...profile, gems: 9 })).toBeNull();
  });

  test('rewarded unlocks add exactly one permanent slot and stop at ten', () => {
    const nine = { ...INITIAL_PROFILE, businessCapacity: 9 };
    expect(unlockBusinessCapacity(nine)?.businessCapacity).toBe(10);
    expect(unlockBusinessCapacity({ ...nine, businessCapacity: 10 })).toBeNull();
  });
});
