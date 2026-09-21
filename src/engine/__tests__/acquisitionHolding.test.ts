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
  migrateAcquiredBusinessAssets,
} from '../acquisitionEngine';
import { getAllBusinessLocationTemplates, getBusinessType, getHoldingSynergyProfile, processBusinessWeek } from '../businessEngine';
import { getNetWorth } from '../financeEngine';
import { INITIAL_GAME_STATE } from '../../types/game';

describe('business acquisitions and holding companies', () => {
  test('legacy acquisitions persist their reconstructed operating baseline', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(401, 1)[0];
    const business = createAcquiredBusiness(target, INITIAL_GAME_STATE)!;
    for (const key of ['quotedWeeklyRevenue', 'quotedWeeklyProfit', 'quoteInflation', 'referenceStaffCost', 'referenceRevenueCapacity', 'referenceExpenseMultiplier'] as const) {
      delete business.acquisition![key];
    }
    const migrated = processBusinessWeek(business, 2, 2, 21).updatedBusiness;
    const restored = JSON.parse(JSON.stringify(migrated));
    const next = processBusinessWeek(restored, 2.04, 3, 21).updatedBusiness;
    expect(Number.isFinite(next.lastWeekProfit)).toBe(true);
    expect(next.acquisition!.quoteInflation).toBe(2);
    expect(next.acquisition!.quotedWeeklyProfit).toBe(migrated.acquisition!.quotedWeeklyProfit);
    expect(next.acquisition!.referenceRevenueCapacity).toBe(migrated.acquisition!.referenceRevenueCapacity);
  });
  test('operating income matches seller scale and preserves the purchase baseline', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    for (const target of generateAcquisitionTargets(401, 1)) {
      const business = createAcquiredBusiness(target, { ...INITIAL_GAME_STATE, year: 21 })!;
      business.acquisition!.integrationWeeksRemaining = 0;
      business.acquisition!.integrationStrategy = 'integrate';
      business.acquisition!.integrationOutcome = 'success';
      const result = processBusinessWeek(business, 1, 2, 21);
      expect(result.weeklyRevenue / target.weeklyRevenue).toBeGreaterThan(0.7);
      expect(result.weeklyRevenue / target.weeklyRevenue).toBeLessThan(1.3);
      expect(result.weeklyProfit).toBeLessThan(target.weeklyProfit * 2);
      expect(Object.values(result.updatedBusiness.lastExpenseBreakdown!).reduce((sum, amount) => sum + amount, 0)).toBe(result.weeklyExpenses);
      const next = processBusinessWeek(result.updatedBusiness, 1.04, 3, 21);
      expect(next.updatedBusiness.acquisition!.referenceRevenueCapacity).toBe(business.acquisition!.referenceRevenueCapacity);
      expect(next.updatedBusiness.acquisition!.quoteInflation).toBe(1);
    }
  });
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

  test('targets require a control premium instead of spawning below fair value', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const targets = generateAcquisitionTargets(120, 1);

    for (const target of targets) {
      const priceToValue = target.askingPrice / target.estimatedValue;
      expect(priceToValue).toBeGreaterThanOrEqual(1.10);
      expect(priceToValue).toBeLessThanOrEqual(1.30);
    }
  });

  test('acquired companies inherit completed mature upgrades and eligible expansions', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];
    const acquired = createAcquiredBusiness(target, { ...INITIAL_GAME_STATE, week: 8, year: 7, inflationMultiplier: 1 })!;
    const type = getBusinessType(target.typeId)!;
    const templates = getAllBusinessLocationTemplates();

    expect(new Set(acquired.purchasedUpgrades)).toEqual(new Set(type.upgrades ?? []));
    expect(acquired.activeUpgrade ?? null).toBeNull();
    expect(acquired.activeExpansion ?? null).toBeNull();
    expect((acquired.locations ?? []).length).toBeGreaterThan(0);
    for (const location of acquired.locations ?? []) {
      const template = templates.find((item) => item.id === location.templateId);
      expect(template).toBeDefined();
      expect(acquired.level).toBeGreaterThanOrEqual(template.requiredLevel);
      expect(acquired.reputation).toBeGreaterThanOrEqual(template.requiredReputation);
    }
  });

  test('legacy acquired companies are rebased to the mature asset footprint on load', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];
    const acquired = createAcquiredBusiness(target, { ...INITIAL_GAME_STATE, week: 8, year: 7, inflationMultiplier: 1 })!;
    const legacy = {
      ...acquired,
      purchasedUpgrades: [],
      locations: [],
      activeUpgrade: { upgradeId: acquired.purchasedUpgrades[0], weeksRemaining: 1 },
      activeExpansion: { templateId: 'local_branch', weeksRemaining: 1 },
      acquisition: { ...acquired.acquisition!, assetBaselineVersion: 0, referenceRevenueCapacity: 1 },
    };

    const migrated = migrateAcquiredBusinessAssets(legacy, 1, 140);
    const type = getBusinessType(target.typeId)!;

    expect(new Set(migrated.purchasedUpgrades)).toEqual(new Set(type.upgrades ?? []));
    expect(migrated.activeUpgrade ?? null).toBeNull();
    expect(migrated.activeExpansion ?? null).toBeNull();
    expect((migrated.locations ?? []).some((location) => location.templateId === 'local_branch')).toBe(true);
    expect(migrated.acquisition?.referenceRevenueCapacity).toBeGreaterThan(1);
    expect(migrated.acquisition?.assetBaselineVersion).toBe(1);
    expect(migrateAcquiredBusinessAssets(migrated, 1, 160)).toBe(migrated);
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

    const lowPremiumTarget = { ...target, estimatedValue: 100_000_000, askingPrice: 110_000_000 };
    expect(getAcquisitionPrice(lowPremiumTarget, 0.50)).toBe(100_000_000);
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

  test('baseline acquired company does not reach triple-digit return within one game year', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(121, 1, 1)[0];
    let business = createAcquiredBusiness(
      target,
      { ...INITIAL_GAME_STATE, week: 1, year: 7, inflationMultiplier: 1 },
      null,
      target.askingPrice,
      'cash',
      0,
    )!;
    business = applyIntegrationStrategy(business, 'independent');

    const startGlobalWeek = ((7 - 1) * 20) + 1;
    for (let offset = 1; offset <= 20; offset += 1) {
      const globalWeek = startGlobalWeek + offset;
      const year = Math.floor((globalWeek - 1) / 20) + 1;
      const week = ((globalWeek - 1) % 20) + 1;
      business = processBusinessWeek(business, 1, week, year).updatedBusiness;
    }

    const returnInfo = getAcquisitionReturn(business)!;
    expect(returnInfo.returnPct).toBeLessThan(100);
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
