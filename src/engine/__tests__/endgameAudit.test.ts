import useGameStore from '../../store/gameStore';
import { INITIAL_GAME_STATE, INITIAL_PROFILE, INITIAL_RELATIONSHIP_STATE } from '../../types/game';
import { calculateEstateSettlement, getSuccessionPreview, getEstateSuccessorId } from '../lifecycleEngine';
import { createAcquiredBusiness, generateAcquisitionTargets } from '../acquisitionEngine';
import { createHoldingCompany } from '../holdingCompanyEngine';
import { getNetWorth } from '../financeEngine';
import { initializeStocks, processStocks } from '../stockEngine';
import { processEconomy } from '../economyEngine';
import { createProperty } from '../propertyEngine';
import { saveGame, loadGame } from '../../utils/storage';

jest.mock('../../components/GameDialog', () => ({ showGameDialog: jest.fn() }));

// Accounting invariants run in the ordinary release regression suite.
const audit = describe;
const child = (id: string, name = id) => ({ id, name, gender: 'girl' as const, birthGlobalWeek: 1, age: 30, educationFund: 0, savings: 10000, parentRelationship: 90 });
function fixture() {
  const state = { ...INITIAL_GAME_STATE, stocks: initializeStocks(), cash: 2000000, year: 31, week: 1, age: 70, relationshipModeEnabled: true,
    relationshipState: { ...INITIAL_RELATIONSHIP_STATE, children: [child('heir')], estatePlan: { ...INITIAL_RELATIONSHIP_STATE.estatePlan, successorId: 'heir', structure: 'will' as const } } };
  const holding = { ...createHoldingCompany('Audit Group', state), cashReserve: 500000 };
  const target = generateAcquisitionTargets(601, 1, 1)[0];
  const business = createAcquiredBusiness(target, state, holding.id, target.askingPrice, 'balanced', 0)!;
  business.familyBusiness = { ...business.familyBusiness!, isFamilyBusiness: true };
  return { ...state, businesses: [business], holdingCompanies: [holding] };
}
function reset(state: any) { useGameStore.setState({ ...state, profile: { ...INITIAL_PROFILE }, activeSlot: 2 }); }
function die(state: any) {
  return { ...state, lifecycle: { ...state.lifecycle, isDead: true }, relationshipState: { ...state.relationshipState, estateSettlement: calculateEstateSettlement(state) } };
}

audit('endgame accounting audit', () => {
  beforeEach(() => jest.spyOn(Math, 'random').mockReturnValue(0.5));
  afterEach(() => jest.restoreAllMocks());

  test('personal cash to holding reserve conserves net worth', () => {
    const state = fixture(); reset(state);
    const before = getNetWorth(state);
    useGameStore.getState().fundHoldingCompany(state.holdingCompanies[0].id, 100000);
    expect(getNetWorth(useGameStore.getState())).toBeCloseTo(before, 2);
    expect(useGameStore.getState().cash).toBe(state.cash - 100000);
  });
  test.each(['capital', 'debt'] as const)('holding allocation (%s) conserves wholly owned equity', purpose => {
    const state = fixture(); reset(state);
    const before = getNetWorth(state);
    useGameStore.getState().allocateHoldingCapital(state.holdingCompanies[0].id, state.businesses[0].id, 100000, purpose);
    expect(getNetWorth(useGameStore.getState())).toBeCloseTo(before, 2);
  });
  test('same-name children cannot both inherit the designated business', () => {
    const state = fixture();
    state.relationshipState.children = [child('heir', 'Alex'), child('other', 'Alex')];
    const dead = die(state);
    expect(getSuccessionPreview(dead, 'heir')!.inheritedBusinessValue).toBeGreaterThan(0);
    expect(getSuccessionPreview(dead, 'other')!.inheritedBusinessValue).toBe(0);
  });
  test('legacy name-only estates resolve only a unique heir or saved designation', () => {
    const state = fixture();
    state.relationshipState.children = [child('heir', 'Alex'), child('other', 'Alex')];
    const dead = die(state);
    delete dead.relationshipState.estateSettlement.successorId;
    expect(getEstateSuccessorId(dead)).toBe('heir');
    dead.relationshipState.estatePlan.successorId = null;
    expect(getEstateSuccessorId(dead)).toBeNull();
    dead.relationshipState.children.pop();
    expect(getEstateSuccessorId(dead)).toBe('heir');
  });
  test('a successor retains pre-owned business shares without being estate successor', () => {
    const state = fixture();
    state.relationshipState.estatePlan.successorId = 'other';
    state.relationshipState.children.push(child('other'));
    state.businesses[0].ownership = [
      { ownerType: 'player', ownerId: 'player', ownerName: 'Parent', percent: 80, votingPercent: 80 },
      { ownerType: 'child', ownerId: 'heir', ownerName: 'heir', percent: 20, votingPercent: 20 },
    ];
    reset(die(state));
    useGameStore.getState().continueAsChild('heir', true);
    expect(useGameStore.getState().businesses.find(b => b.id === state.businesses[0].id)?.ownership?.some(s => s.ownerType === 'player' && s.percent === 20)).toBe(true);
    expect(useGameStore.getState().holdingCompanies[0].cashReserve).toBe(0);
    expect(useGameStore.getState().businesses[0].ownership!.reduce((sum, stake) => sum + stake.percent, 0)).toBe(100);
  });
  test('illiquid estate cannot distribute more than its net estate', () => {
    const state = fixture(); state.cash = 0; state.holdingCompanies[0].cashReserve = 0;
    const dead = die(state); const preview = getSuccessionPreview(dead, 'heir')!;
    expect(preview.inheritedCash + preview.inheritedBusinessValue).toBeLessThanOrEqual(dead.relationshipState.estateSettlement.netEstate);
    reset(dead);
    useGameStore.getState().continueAsChild('heir', true);
    const next = useGameStore.getState();
    expect(next.loans.find(loan => loan.name === 'Unpaid Estate Settlement Costs')?.remainingAmount).toBe(preview.businessSettlementDebt);
    expect(getNetWorth(next)).toBeCloseTo(preview.existingSavings + preview.inheritedBusinessValue + preview.inheritedCash - Math.ceil(preview.inheritanceTax * 1.06), 0);
  });
  test('resetting personal statistics for a child does not reset world market trends', () => {
    const state = fixture();
    state.stocks = state.stocks.map(s => ({ ...s, currentPrice: s.currentPrice * 1.6, priceHistory: [s.currentPrice * 1.6] }));
    state.statistics = { ...state.statistics, weeksPlayed: 600 };
    const news = { effects: {} } as any;
    const before = processStocks(state, news).stocks.find(s => s.ticker === 'GLBL')!.currentPrice;
    const after = processStocks({ ...state, statistics: { ...state.statistics, weeksPlayed: 0 } }, news).stocks.find(s => s.ticker === 'GLBL')!.currentPrice;
    expect(after).toBe(before);
  });
  test('active crash survives succession and persistence without restarting', async () => {
    const state = { ...fixture(), cash: 20000000, activeMacroCrash: { title: 'Audit crash', weeksRemaining: 2, totalWeeks: 3, weeklyStockShock: -.04 } };
    reset(die(state));
    useGameStore.getState().continueAsChild('heir', false);
    const next = useGameStore.getState();
    expect(next.activeMacroCrash).toEqual(state.activeMacroCrash);
    await saveGame(next, 2);
    const restored = (await loadGame(2))!;
    const wave = processEconomy(restored, 2);
    expect(wave.activeMacroCrash?.weeksRemaining).toBe(1);
    expect(wave.crashEvent?.stockShock).toBe(-.04);
    const last = processEconomy({ ...restored, activeMacroCrash: wave.activeMacroCrash }, 3);
    expect(last.activeMacroCrash).toBeNull();
  });
  test.each(['liquidate', 'keep_stocks', 'keep_properties', 'keep_both'] as const)('succession %s cash/share conservation and save round trip', async strategy => {
    const state = fixture();
    state.cash = 20000000;
    state.properties = [createProperty('studio_invest', 1, 31, 1)!];
    state.holdings = [{ ticker: 'MCRS', shares: 100, avgBuyPrice: 100 }];
    const dead = die(state); reset(dead);
    const preview = getSuccessionPreview(dead, 'heir', strategy)!;
    const expected = preview.existingSavings + preview.inheritedCash + preview.inheritedStockValue + preview.inheritedPropertyValue + preview.inheritedBusinessValue - preview.inheritanceTax;
    useGameStore.getState().continueAsChild('heir', false, strategy);
    const next = useGameStore.getState();
    expect(next.generation).toBe(2);
    expect(getNetWorth(next)).toBeCloseTo(expected, 0);
    await saveGame(next, 2);
    const loaded = await loadGame(2);
    expect(loaded?.generation).toBe(2);
    expect(getNetWorth(loaded!)).toBeCloseTo(getNetWorth(next), 2);
  });
});
