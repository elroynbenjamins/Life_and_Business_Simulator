import {
  calculateValuation,
  createBusiness,
  getBusinessValuationBreakdown,
} from '../businessEngine';
import { OwnedBusiness } from '../../types/game';

function businessWith(overrides: Partial<OwnedBusiness> = {}): OwnedBusiness {
  const base = createBusiness('coffee_shop', 'Valuation Test', 1, 1, 1)!;
  return {
    ...base,
    reputation: 70,
    balance: 0,
    weeklyProfitHistory: [],
    ...overrides,
  };
}

describe('business valuation balance', () => {
  test('retained cash is valued one-for-one rather than receiving a 1.5x premium', () => {
    const business = businessWith({
      balance: 1_000_000,
      weeklyProfitHistory: [],
    });

    const breakdown = getBusinessValuationBreakdown(business);

    expect(breakdown.cashValue).toBe(1_000_000);
    expect(calculateValuation(business)).toBe(1_000_000);
  });

  test('filling operating history no longer creates a near-20x mechanical valuation ramp', () => {
    const young = businessWith({
      weeklyProfitHistory: Array(5).fill(50_000),
    });
    const mature = businessWith({
      weeklyProfitHistory: Array(20).fill(50_000),
    });

    const youngValue = calculateValuation(young);
    const matureValue = calculateValuation(mature);

    expect(matureValue).toBeGreaterThan(youngValue);
    expect(matureValue / youngValue).toBeLessThan(2);
  });

  test('recent deterioration reduces value even when older weeks were strong', () => {
    const stable = businessWith({
      weeklyProfitHistory: Array(20).fill(80_000),
    });
    const weakening = businessWith({
      weeklyProfitHistory: [
        ...Array(14).fill(80_000),
        ...Array(6).fill(-20_000),
      ],
    });

    expect(calculateValuation(weakening)).toBeLessThan(calculateValuation(stable));
  });

  test('sustained losses can pull valuation down to tangible value', () => {
    const profitable = businessWith({
      balance: 500_000,
      weeklyProfitHistory: Array(20).fill(60_000),
    });
    const distressed = businessWith({
      balance: 500_000,
      reputation: 35,
      weeklyProfitHistory: Array(20).fill(-60_000),
    });

    const profitableValue = calculateValuation(profitable);
    const distressedBreakdown = getBusinessValuationBreakdown(distressed);

    expect(distressedBreakdown.distressDiscount).toBeGreaterThan(0);
    expect(distressedBreakdown.valuation).toBe(500_000);
    expect(distressedBreakdown.valuation).toBeLessThan(profitableValue);
  });

  test('deferred maintenance lowers operating valuation', () => {
    const healthy = businessWith({
      weeklyProfitHistory: Array(20).fill(70_000),
      reinvestment: {
        technology: { condition: 100, lastRenewedGlobalWeek: 1 },
        premises: { condition: 100, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 100, lastRenewedGlobalWeek: 1 },
      },
    });
    const neglected = businessWith({
      weeklyProfitHistory: Array(20).fill(70_000),
      reinvestment: {
        technology: { condition: 20, lastRenewedGlobalWeek: 1 },
        premises: { condition: 20, lastRenewedGlobalWeek: 1 },
        equipment: { condition: 20, lastRenewedGlobalWeek: 1 },
      },
    });

    expect(getBusinessValuationBreakdown(neglected).maintenanceDiscount).toBeGreaterThan(0);
    expect(calculateValuation(neglected)).toBeLessThan(calculateValuation(healthy));
  });
});
