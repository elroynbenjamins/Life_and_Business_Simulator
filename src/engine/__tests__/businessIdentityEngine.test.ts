import { OwnedBusiness } from '../../types/game';
import {
  BUSINESS_IDENTITY_DEFINITIONS,
  getBusinessIdentityEffects,
  updateBusinessIdentity,
} from '../businessIdentityEngine';

function business(overrides: Partial<OwnedBusiness> = {}): OwnedBusiness {
  return {
    id: 'identity-test',
    typeId: 'coffee_shop',
    name: 'Identity Test Co',
    balance: 100000,
    foundedWeek: 1,
    foundedYear: 1,
    level: 1,
    reputation: 70,
    pricingStrategy: 'premium',
    advertisingLevel: 'none',
    employees: [],
    purchasedUpgrades: [],
    activeEvents: [],
    activeProjects: [],
    weeklyProfitHistory: [],
    weeklyRevenueHistory: [],
    lastWeekRevenue: 10000,
    lastWeekExpenses: 6000,
    lastWeekProfit: 4000,
    valuation: 100000,
    marketShareModifier: 0,
    identityTraits: [],
    identityProgress: {},
    ...overrides,
  } as OwnedBusiness;
}

describe('businessIdentityEngine', () => {
  test('sustained premium positioning earns Premium Brand and the trait persists', () => {
    let current = business();
    const threshold = BUSINESS_IDENTITY_DEFINITIONS.premium_brand.thresholdWeeks;

    for (let week = 1; week <= threshold; week++) {
      current = updateBusinessIdentity(current, week).business;
    }
    expect(current.identityTraits?.some((trait) => trait.id === 'premium_brand')).toBe(true);

    current = {
      ...current,
      pricingStrategy: 'budget',
      strategicFocus: 'balanced',
      reputation: 30,
    };
    const afterChange = updateBusinessIdentity(current, threshold + 1).business;
    expect(afterChange.identityTraits?.some((trait) => trait.id === 'premium_brand')).toBe(true);
  });

  test('persistent leverage can become a descriptive Debt Heavy identity', () => {
    let current = business({
      valuation: 100000,
      businessLoans: [{
        id: 'loan',
        amount: 50000,
        remainingAmount: 50000,
        interestRate: 0.1,
        weeklyPayment: 1000,
        weeksRemaining: 50,
        purpose: 'operating',
      }],
    });
    const threshold = BUSINESS_IDENTITY_DEFINITIONS.debt_heavy.thresholdWeeks;

    for (let week = 1; week <= threshold; week++) {
      current = updateBusinessIdentity(current, week).business;
    }
    expect(current.identityTraits?.some((trait) => trait.id === 'debt_heavy')).toBe(true);
  });

  test('identity economic effects stay deliberately modest', () => {
    const current = business({
      identityTraits: [
        { id: 'premium_brand', earnedGlobalWeek: 20 },
        { id: 'efficient_operator', earnedGlobalWeek: 20 },
        { id: 'innovation_leader', earnedGlobalWeek: 20 },
      ],
    });

    const effects = getBusinessIdentityEffects(current);
    expect(effects.revenueMultiplier).toBeGreaterThan(1);
    expect(effects.revenueMultiplier).toBeLessThan(1.04);
    expect(effects.expenseMultiplier).toBeGreaterThan(0.97);
    expect(effects.expenseMultiplier).toBeLessThan(1);
  });
});
