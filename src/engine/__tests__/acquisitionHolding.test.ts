import {
  ACQUISITION_TARGET_COUNT,
  ACQUISITION_UNLOCK_NET_WORTH,
  applyIntegrationStrategy,
  createAcquiredBusiness,
  createHoldingCompany,
  generateAcquisitionTargets,
  getAcquisitionFinancingQuote,
  getAcquisitionPrice,
  getAcquisitionReturn,
  getHoldingCompanySummary,
} from '../acquisitionEngine';
import { getHoldingSynergyProfile, processBusinessWeek } from '../businessEngine';
import { getNetWorth } from '../financeEngine';
import { INITIAL_GAME_STATE } from '../../types/game';

describe('business acquisitions and holding companies', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('generates a late-game market spanning regional through enterprise targets', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const targets = generateAcquisitionTargets(120, 1);

    expect(ACQUISITION_UNLOCK_NET_WORTH).toBe(10_000_000);
    expect(targets).toHaveLength(ACQUISITION_TARGET_COUNT);
    expect(targets.some((target) => target.tier === 'regional')).toBe(true);
    expect(targets.some((target) => target.tier === 'national')).toBe(true);
    expect(targets.some((target) => target.tier === 'enterprise')).toBe(true);
    expect(Math.min(...targets.map((target) => target.askingPrice))).toBeGreaterThan(5_000_000);
    expect(Math.max(...targets.map((target) => target.askingPrice))).toBeGreaterThan(100_000_000);
  });

  test('supports all-cash, balanced, and leveraged acquisition structures', () => {
    const cash = getAcquisitionFinancingQuote(100_000_000, 'cash', 0);
    const balanced = getAcquisitionFinancingQuote(100_000_000, 'balanced', 0.03);
    const leveraged = getAcquisitionFinancingQuote(100_000_000, 'leveraged', 0);

    expect(cash.cashContribution).toBe(100_000_000);
    expect(cash.debtPrincipal).toBe(0);
    expect(balanced.cashContribution).toBe(60_000_000);
    expect(balanced.debtPrincipal).toBe(40_000_000);
    expect(balanced.interestRate).toBeCloseTo(0.05);
    expect(leveraged.cashContribution).toBe(30_000_000);
    expect(leveraged.debtPrincipal).toBe(70_000_000);
    expect(leveraged.weeklyPayment).toBeGreaterThan(0);
  });

  test('applies negotiation prestige to acquisition price with a safety cap', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];

    expect(getAcquisitionPrice(target, 0.05)).toBe(Math.round(target.askingPrice * 0.95));
    expect(getAcquisitionPrice(target, 0.50)).toBe(Math.round(target.askingPrice * 0.85));
  });

  test('leveraged acquisitions attach debt and wait for an integration decision', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];
    const state = {
      ...INITIAL_GAME_STATE,
      playerName: 'Elroy',
      week: 8,
      year: 7,
      generation: 2,
      inflationMultiplier: 1,
      familyTree: { ...INITIAL_GAME_STATE.familyTree, currentPlayerId: 'person:g2' },
    };

    const acquired = createAcquiredBusiness(target, state, 'holding_test', target.askingPrice, 'leveraged', 0);
    expect(acquired).not.toBeNull();
    expect(acquired?.businessLoans[0]?.purpose).toBe('acquisition');
    expect(acquired?.acquisition?.fundingMode).toBe('leveraged');
    expect(acquired?.acquisition?.integrationStrategy).toBe('pending');

    const before = acquired!.acquisition!.integrationWeeksRemaining;
    randomSpy.mockReturnValue(0.99);
    const waitingTick = processBusinessWeek(acquired!, 1, 9, 7);
    expect(waitingTick.updatedBusiness.acquisition?.integrationWeeksRemaining).toBe(before);
  });

  test('integration strategy resolves into persistent operating effects', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];
    const state = { ...INITIAL_GAME_STATE, week: 8, year: 7, inflationMultiplier: 1 };
    const acquired = createAcquiredBusiness(target, state, null, target.askingPrice, 'cash', 0)!;
    const integrated = applyIntegrationStrategy(acquired, 'turnaround');
    const finalWeek = {
      ...integrated,
      acquisition: { ...integrated.acquisition!, integrationWeeksRemaining: 1, integrationSuccessChance: 0.8 },
    };

    randomSpy.mockReturnValue(0.1);
    const result = processBusinessWeek(finalWeek, 1, 9, 7);
    expect(result.updatedBusiness.acquisition?.integrationOutcome).toBe('success');
    expect(result.updatedBusiness.acquisition?.postIntegrationRevenueBonus).toBeCloseTo(0.04);
    expect(result.updatedBusiness.acquisition?.postIntegrationExpenseReduction).toBeCloseTo(0.04);
  });

  test('holding synergies are capped and reward concentration plus diversification', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = { ...INITIAL_GAME_STATE, playerName: 'Elroy', week: 3, year: 9, generation: 3 };
    const holding = { ...createHoldingCompany('Benjamins Group', state), executivePerformance: 100 };
    const targets = generateAcquisitionTargets(163, 1, 6);
    const businesses = targets.slice(0, 4).map((target, index) => createAcquiredBusiness(
      target,
      state,
      holding.id,
      target.askingPrice,
      'cash',
      0,
    )!).map((business, index) => ({
      ...business,
      acquisition: {
        ...business.acquisition!,
        integrationStrategy: index === 0 ? 'independent' as const : 'integrate' as const,
        integrationOutcome: 'success' as const,
        integrationWeeksRemaining: 0,
      },
    }));

    // Force two companies into the same industry while keeping other industries present.
    businesses[1] = { ...businesses[1], typeId: businesses[0].typeId };
    const synergy = getHoldingSynergyProfile(businesses[0], businesses, [holding]);

    expect(synergy.expenseReduction).toBeGreaterThan(0);
    expect(synergy.expenseReduction).toBeLessThanOrEqual(0.06);
    expect(synergy.crisisReduction).toBeLessThanOrEqual(0.18);
  });

  test('holding cash remains in net worth and summaries include group debt', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = { ...INITIAL_GAME_STATE, playerName: 'Elroy', year: 9, week: 3, generation: 3, cash: 2_000_000 };
    const holding = { ...createHoldingCompany('Benjamins Group', state), cashReserve: 5_000_000 };
    const target = generateAcquisitionTargets(163, 1, 1)[0];
    const business = createAcquiredBusiness(target, state, holding.id, target.askingPrice, 'balanced', 0)!;

    const summary = getHoldingCompanySummary(holding, [business]);
    const returnInfo = getAcquisitionReturn(business);
    const netWorth = getNetWorth({ ...state, holdingCompanies: [holding], businesses: [business] });

    expect(summary.subsidiaryCount).toBe(1);
    expect(summary.totalDebt).toBeGreaterThan(0);
    expect(summary.cashReserve).toBe(5_000_000);
    expect(returnInfo?.investedCapital).toBeGreaterThan(0);
    expect(netWorth).toBeGreaterThan(state.cash);
  });
});
