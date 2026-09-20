import useGameStore from '../../store/gameStore';
import { INITIAL_GAME_STATE, INITIAL_PROFILE, INITIAL_RELATIONSHIP_STATE, GameState } from '../../types/game';
import { weeklyTick } from '../weeklyTick';
import { initializeStocks } from '../stockEngine';
import { getNetWorth } from '../financeEngine';
import { getPrestigeEffects, getPrestigeBonuses } from '../prestigeEngine';
import { createAcquiredBusiness, createHoldingCompany, generateAcquisitionTargets, getAcquisitionFinancingQuote, applyIntegrationStrategy } from '../acquisitionEngine';
import { calculateEstateSettlement, getSuccessionPreview } from '../lifecycleEngine';

jest.mock('../../components/GameDialog', () => ({ showGameDialog: jest.fn() }));
jest.mock('../../utils/storage', () => ({ saveGame: jest.fn(), saveProfile: jest.fn() }));

const simulation = process.env.LONG_SAVE_AUDIT === '1' ? test : test.skip;
function rng(seed: number) {
  let x = seed >>> 0;
  return () => { x += 0x6D2B79F5; let t = x; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const quantile = (values: number[], q = .5) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? Math.round(sorted[Math.floor((sorted.length - 1) * q)] * 100) / 100 : null;
};

simulation('seeded 20/50/100-year real-engine stress report', () => {
  const count = Number(process.env.AUDIT_SEEDS ?? 100);
  const years = [20, 50, 100];
  const report: any[] = [];
  for (const mode of ['investor', 'investor-prestige', 'balanced', 'leveraged'] as const) {
    const snapshots: Record<number, any[]> = { 20: [], 50: [], 100: [] };
    for (let seed = 1; seed <= count; seed++) {
      const spy = jest.spyOn(Math, 'random').mockImplementation(rng(seed));
      const profile = { ...INITIAL_PROFILE, unlockedPrestige: mode === 'investor-prestige' ? getPrestigeBonuses().map(b => b.id) : [] };
      const effects = getPrestigeEffects(profile);
      let state: GameState = JSON.parse(JSON.stringify(INITIAL_GAME_STATE));
      Object.assign(state, { year: 21, age: 40, cash: 24000000, stocks: initializeStocks(), initialized: true, relationshipModeEnabled: true });
      state.holdings = ['GLBL', 'AURX', 'NEXA', 'MOJO'].map(ticker => {
        const price = state.stocks.find(s => s.ticker === ticker)!.currentPrice;
        return { ticker, shares: Math.floor((ticker === 'GLBL' ? 3000000 : 1000000) / price), avgBuyPrice: price };
      });
      state.relationshipState = {
        ...JSON.parse(JSON.stringify(INITIAL_RELATIONSHIP_STATE)),
        children: [{ id: 'initial-heir', name: 'Heir', gender: 'girl', birthGlobalWeek: 1, age: 20, educationFund: 10000, savings: 10000, status: 'independent', parentRelationship: 90, occupationTitle: 'Assistant Accountant', weeklyIncome: 1000, childrenCount: 1,
          descendants: [{ id: 'grandchild', name: 'Grandchild', gender: 'boy', birthGlobalWeek: 401, age: 0 }] }],
        estatePlan: { ...INITIAL_RELATIONSHIP_STATE.estatePlan, structure: 'will', successorId: 'initial-heir' },
      };
      if (mode === 'balanced' || mode === 'leveraged') {
        const holding = createHoldingCompany('Test Group', state);
        const target = generateAcquisitionTargets(401, 1, 1)[0];
        const quote = getAcquisitionFinancingQuote(target.askingPrice, mode, 0);
        const business = applyIntegrationStrategy(createAcquiredBusiness(target, state, holding.id, target.askingPrice, mode, 0)!, 'integrate');
        business.familyBusiness = { ...business.familyBusiness!, isFamilyBusiness: true };
        state.businesses = [business]; state.holdingCompanies = [holding]; state.cash -= quote.cashContribution;
      }
      let ended = false, cashNegative = false, businessNegative = false, crashes = 0, waves = 0, deaths = 0, insolvencies = 0;
      const startPrices = Object.fromEntries(state.stocks.map(s => [s.ticker, s.currentPrice]));
      for (let tick = 1; tick <= 2000; tick++) {
        if (!ended) {
          state = weeklyTick(state, effects).newState;
          cashNegative ||= state.cash < 0;
          businessNegative ||= state.businesses.some(b => b.balance < 0);
          const gw = (state.year - 1) * 20 + state.week;
          if (state.lastMacroCrashWeek === gw) crashes++;
          if (state.activeMacroCrash) waves++;
          if (!Number.isFinite(getNetWorth(state)) || state.stocks.some(s => !Number.isFinite(s.currentPrice) || s.currentPrice <= 0)) insolvencies++;
          if (state.lifecycle.isDead) {
            deaths++;
            const heir = state.relationshipState.children.find(c => getSuccessionPreview(state, c.id)?.willingToSucceed);
            if (!heir) ended = true;
            else {
              // Scripted policy: designate the chosen heir and keep financial assets; finance tax only if needed.
              state.relationshipState.estatePlan.successorId = heir.id;
              state.relationshipState.estateSettlement = calculateEstateSettlement(state);
              const preview = getSuccessionPreview(state, heir.id, 'keep_both', effects.inheritance_tax_reduction ?? 0)!;
              useGameStore.setState({ ...state, profile, activeSlot: 3 });
              useGameStore.getState().continueAsChild(heir.id, preview.taxCashAvailable < preview.inheritanceTax, 'keep_both');
              state = useGameStore.getState();
              if (state.lifecycle.isDead) ended = true;
            }
          }
        }
        if (years.includes(tick / 20)) {
          snapshots[tick / 20].push({ ended, cashNegative, businessNegative, crashes, waves, deaths, invalid: insolvencies,
            generation: state.generation, netWorth: getNetWorth(state), realNetWorth: getNetWorth(state) / state.inflationMultiplier, cash: state.cash,
            inflation: state.inflationMultiplier,
            returns: Object.fromEntries(state.stocks.filter(s => ['GLBL','AURX','NEXA','MOJO'].includes(s.ticker)).map(s => [s.ticker, 100 * (Math.pow(s.currentPrice / startPrices[s.ticker], 1 / (tick / 20)) - 1)])),
          });
        }
      }
      spy.mockRestore();
      if (seed % 10 === 0) console.log('AUDIT_PROGRESS', mode, seed, '/', count);
    }
    for (const yearsElapsed of years) {
      const all = snapshots[yearsElapsed]; const active = all.filter(s => !s.ended);
      report.push({ mode, years: yearsElapsed, runs: count, active: active.length,
        everNegativeCashPct: 100 * all.filter(s => s.cashNegative).length / count,
        everNegativeBusinessPct: 100 * all.filter(s => s.businessNegative).length / count,
        medianGenerations: quantile(all.map(s => s.generation)), medianDeaths: quantile(all.map(s => s.deaths)), invalidStates: all.reduce((n,s) => n+s.invalid,0),
        medianCrashes: quantile(active.map(s => s.crashes)), medianWaveWeeks: quantile(active.map(s => s.waves)),
        medianNetWorth: quantile(active.map(s => s.netWorth)), medianRealNetWorth: quantile(active.map(s => s.realNetWorth)), p10RealNetWorth: quantile(active.map(s => s.realNetWorth), .1), p90RealNetWorth: quantile(active.map(s => s.realNetWorth), .9), medianCash: quantile(active.map(s => s.cash)),
        medianInflation: quantile(active.map(s => s.inflation)),
        priceCAGR: Object.fromEntries(['GLBL','AURX','NEXA','MOJO'].map(t => [t, quantile(active.map(s => s.returns[t]))])),
      });
    }
    console.log('LONG_SAVE_COHORT', JSON.stringify(report.filter(r => r.mode === mode)));
  }
  expect(report).toHaveLength(12);
  expect(report.every(r => r.invalidStates === 0)).toBe(true);
}, 1800000);
