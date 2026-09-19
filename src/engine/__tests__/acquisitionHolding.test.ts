import {
  ACQUISITION_TARGET_COUNT,
  ACQUISITION_UNLOCK_NET_WORTH,
  createAcquiredBusiness,
  createHoldingCompany,
  generateAcquisitionTargets,
  getAcquisitionPrice,
  getHoldingCompanySummary,
} from '../acquisitionEngine';
import { processBusinessWeek } from '../businessEngine';
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
    expect(targets.every((target) => target.diligenceNotes.length > 0)).toBe(true);
  });

  test('applies negotiation prestige to an acquisition price with a safety cap', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];

    expect(getAcquisitionPrice(target, 0.05)).toBe(Math.round(target.askingPrice * 0.95));
    expect(getAcquisitionPrice(target, 0.50)).toBe(Math.round(target.askingPrice * 0.85));
  });

  test('acquired companies enter the normal business simulation with integration risk', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const target = generateAcquisitionTargets(120, 1, 1)[0];
    const state = {
      ...INITIAL_GAME_STATE,
      playerName: 'Elroy',
      week: 8,
      year: 7,
      generation: 2,
      inflationMultiplier: 1,
      familyTree: {
        ...INITIAL_GAME_STATE.familyTree,
        currentPlayerId: 'person:g2',
      },
    };

    const acquired = createAcquiredBusiness(target, state, 'holding_test', target.askingPrice);
    expect(acquired).not.toBeNull();
    expect(acquired?.employees.length).toBeGreaterThanOrEqual(3);
    expect(acquired?.holdingCompanyId).toBe('holding_test');
    expect(acquired?.acquisition?.integrationWeeksRemaining).toBe(target.integrationWeeks);
    expect(acquired?.operatingScaleMultiplier ?? 0).toBeGreaterThan(1);
    expect(acquired?.valuation).toBe(target.estimatedValue);

    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const tick = processBusinessWeek(acquired!, 1, 9, 7);
    expect(tick.updatedBusiness.acquisition?.integrationWeeksRemaining).toBe(target.integrationWeeks - 1);
    expect(tick.updatedBusiness.lastWeekRevenue).toBeGreaterThan(0);
  });

  test('holding summaries aggregate subsidiaries and family-controlled value', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = {
      ...INITIAL_GAME_STATE,
      playerName: 'Elroy',
      year: 9,
      week: 3,
      generation: 3,
    };
    const holding = createHoldingCompany('Benjamins Group', state);
    const target = generateAcquisitionTargets(163, 1, 1)[0];
    const business = createAcquiredBusiness(target, state, holding.id, target.askingPrice)!;

    const summary = getHoldingCompanySummary(holding, [business]);
    expect(summary.subsidiaryCount).toBe(1);
    expect(summary.totalValue).toBe(target.estimatedValue);
    expect(summary.familyControlledPct).toBeCloseTo(100);
    expect(holding.founderGeneration).toBe(3);
    expect(holding.controllerName).toBe('Elroy');
  });
});
