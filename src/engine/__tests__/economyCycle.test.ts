import { INITIAL_GAME_STATE, HoldingCompany } from '../../types/game';
import {
  getAcquisitionCycleValueMultiplier,
  getEconomicCycleEffects,
  getIndustryEconomicCycleMultiplier,
  getPropertyCyclePurchaseMultiplier,
  processEconomy,
} from '../economyEngine';
import { getAcquisitionFinancingQuote } from '../acquisitionEngine';
import {
  EMPTY_HOLDING_SHARED_SERVICES,
  getHoldingManagementFeeForWeek,
} from '../holdingCompanyEngine';
import { createProperty, processProperties } from '../propertyEngine';

function makeHolding(overrides: Partial<HoldingCompany> = {}): HoldingCompany {
  return {
    id: 'holding_cycle_test',
    name: 'Cycle Test Holdings',
    createdGlobalWeek: 1,
    founderGeneration: 1,
    generationsOwned: 1,
    controllerName: 'Player',
    controllerPersonId: null,
    cashReserve: 0,
    totalCapitalDeployed: 0,
    executiveChildId: null,
    executiveChildName: null,
    executivePerformance: 50,
    designatedSuccessorChildId: null,
    designatedSuccessorChildName: null,
    sharedServices: { ...EMPTY_HOLDING_SHARED_SERVICES },
    managementFeeRate: 0.01,
    totalManagementFeesCollected: 0,
    totalDividendsReceived: 0,
    totalOwnerDistributions: 0,
    ...overrides,
  };
}

describe('economic cycles', () => {
  test('recession hurts rate-sensitive sectors more than defensive sectors', () => {
    const healthcare = getIndustryEconomicCycleMultiplier('recession', 'Healthcare');
    const food = getIndustryEconomicCycleMultiplier('recession', 'Food & Beverage');
    const construction = getIndustryEconomicCycleMultiplier('recession', 'Construction');
    const realEstate = getIndustryEconomicCycleMultiplier('recession', 'Real Estate');
    expect(healthcare).toBeGreaterThan(food);
    expect(food).toBeGreaterThan(construction);
    expect(construction).toBeGreaterThanOrEqual(realEstate);
    expect(realEstate).toBeGreaterThanOrEqual(0.72);
  });

  test('boom rewards cyclical sectors more than healthcare', () => {
    expect(getIndustryEconomicCycleMultiplier('boom', 'Construction'))
      .toBeGreaterThan(getIndustryEconomicCycleMultiplier('boom', 'Healthcare'));
    expect(getIndustryEconomicCycleMultiplier('boom', 'Real Estate'))
      .toBeGreaterThan(getIndustryEconomicCycleMultiplier('boom', 'Food & Beverage'));
  });

  test('recession acquisition values are cheaper while boom values are higher', () => {
    expect(getAcquisitionCycleValueMultiplier('recession')).toBeLessThan(1);
    expect(getAcquisitionCycleValueMultiplier('boom')).toBeGreaterThan(1);
    expect(getAcquisitionCycleValueMultiplier('recession'))
      .toBeLessThan(getAcquisitionCycleValueMultiplier('recovery'));
  });

  test('macro rates feed acquisition financing without breaking prestige reductions', () => {
    const boomRate = getEconomicCycleEffects('boom').interestRateModifier;
    const recessionRate = getEconomicCycleEffects('recession').interestRateModifier;
    const boom = getAcquisitionFinancingQuote(100_000_000, 'balanced', 0.02, boomRate);
    const recession = getAcquisitionFinancingQuote(100_000_000, 'balanced', 0.02, recessionRate);
    expect(boom.interestRate).toBeGreaterThan(recession.interestRate);
    expect(boom.weeklyPayment).toBeGreaterThan(recession.weeklyPayment);
  });

  test('property listings and owned values react consistently to the cycle', () => {
    expect(getPropertyCyclePurchaseMultiplier('recession')).toBeLessThan(1);
    expect(getPropertyCyclePurchaseMultiplier('boom')).toBeGreaterThan(1);
    const property = createProperty('studio_invest', 1, 2, 1, getPropertyCyclePurchaseMultiplier('recession'));
    expect(property).not.toBeNull();
    if (!property) return;
    const before = property.currentValue;
    const result = processProperties(
      [{ ...property, isRentedOut: true }], 1, 0,
      getEconomicCycleEffects('recession').propertyValueWeeklyAdjustment,
      getEconomicCycleEffects('recession').propertyIncomeMultiplier,
    );
    expect(result.updatedProperties[0].currentValue).toBeLessThan(before);
  });

  test('cycle advancement uses the advanced year at a year boundary', () => {
    const state = {
      ...INITIAL_GAME_STATE, year: 1, week: 20,
      economicCycle: { phase: 'expansion' as const, weeksRemaining: 1, totalWeeks: 12, startedGlobalWeek: 1 },
    };
    const result = processEconomy(state, 1, 2);
    expect(result.economicCycle.phase).toBe('boom');
    expect(result.economicCycle.startedGlobalWeek).toBe(21);
  });
});

describe('holding management fees', () => {
  test('a profitable subsidiary respects the protected four-week operating buffer', () => {
    const holding = makeHolding({ managementFeeRate: 0.03 });
    // Keep profit positive so the profit guard does not mask the buffer test.
    // Revenue 120,000 - expenses 100,000 allows a 3,600 fee (below the 7,000 profit cap).
    expect(getHoldingManagementFeeForWeek(holding, 120_000, 1_000_000, 100_000)).toBe(3_600);
    expect(getHoldingManagementFeeForWeek(holding, 120_000, 401_000, 100_000)).toBe(1_000);
    expect(getHoldingManagementFeeForWeek(holding, 120_000, 400_000, 100_000)).toBe(0);
    expect(getHoldingManagementFeeForWeek(holding, 120_000, 350_000, 100_000)).toBe(0);
  });

  test.each([100_000, 110_000])('break-even/loss weeks charge no fee even with cash: expenses %i', (expenses) => {
    expect(getHoldingManagementFeeForWeek(makeHolding({ managementFeeRate: 0.03 }), 100_000, 1_000_000, expenses)).toBe(0);
  });

  test('thin profits cap the fee and protected project reserves can reduce it further', () => {
    const holding = makeHolding({ managementFeeRate: 0.03 });
    expect(getHoldingManagementFeeForWeek(holding, 101_000, 1_000_000, 100_000)).toBe(350);
    expect(getHoldingManagementFeeForWeek(holding, 120_000, 1_000_000, 100_000, 999_900)).toBe(100);
  });
});
