import { GameState, StockState, StockHolding, NewsEvent, ActiveMarketSentiment, ActiveMarketEvent, MarketCompanyEvent } from '../types/game';
import stocksData from '../data/stocks.json';
import marketSentimentData from '../data/market_sentiment.json';
import marketEventsData from '../data/market_events.json';
import marketSectorEventsData from '../data/market_sector_events.json';
import marketCompanyEventsData from '../data/market_company_events.json';

const EMERGING_POOL_SIZE = 8;
const INITIAL_EMERGING_LISTINGS = 3;
const MAX_ACTIVE_EMERGING = 5;
const IPO_CHANCE_PER_YEAR = 0.65;

function stockDefinitions() {
  return (stocksData ?? []) as any[];
}

function coreStockDefinitions() {
  return stockDefinitions().filter((stock) => stock.marketRole !== 'emerging');
}

function emergingStockDefinitions() {
  return stockDefinitions().filter((stock) => stock.type === 'stock' && stock.marketRole === 'emerging');
}

function roundPrice(value: number): number {
  return Math.max(0.01, Math.round(value * 100) / 100);
}

function createListedState(definition: any, listedWeek: number, emerging = false, quality?: number): StockState {
  return {
    ticker: definition?.ticker ?? '',
    currentPrice: definition?.startPrice ?? 100,
    priceHistory: [definition?.startPrice ?? 100],
    marketStatus: 'listed',
    listedWeek,
    companyStage: emerging ? 'emerging' : 'established',
    companyQuality: emerging ? Math.max(0.08, Math.min(0.95, quality ?? 0.5)) : undefined,
  };
}

function weightedEmergingPick(
  candidates: any[],
  randomValue = Math.random(),
): any | null {
  if (candidates.length === 0) return null;
  const totalWeight = candidates.reduce((sum, item) => sum + Math.max(0.05, Number(item.ipoWeight ?? 1)), 0);
  let cursor = Math.max(0, Math.min(0.999999, randomValue)) * totalWeight;
  for (const item of candidates) {
    cursor -= Math.max(0.05, Number(item.ipoWeight ?? 1));
    if (cursor <= 0) return item;
  }
  return candidates[candidates.length - 1] ?? null;
}

export function initializeMarketCompanyPool(randomFn: () => number = Math.random): string[] {
  const remaining = [...emergingStockDefinitions()];
  const selected: string[] = [];
  while (remaining.length > 0 && selected.length < Math.min(EMERGING_POOL_SIZE, remaining.length)) {
    const picked = weightedEmergingPick(remaining, randomFn());
    if (!picked) break;
    selected.push(picked.ticker);
    const index = remaining.findIndex((item) => item.ticker === picked.ticker);
    if (index >= 0) remaining.splice(index, 1);
  }
  return selected;
}

/**
 * Initialize the stable market plus a small, save-specific set of young public companies.
 */
export function initializeStocks(
  marketCompanyPool: string[] = initializeMarketCompanyPool(),
  randomFn: () => number = Math.random,
): StockState[] {
  const core = coreStockDefinitions().map((definition) => createListedState(definition, 1, false));
  const initialEmerging = marketCompanyPool
    .slice(0, INITIAL_EMERGING_LISTINGS)
    .map((ticker) => emergingStockDefinitions().find((definition) => definition.ticker === ticker))
    .filter(Boolean)
    .map((definition) => createListedState(definition, 1, true, 0.12 + randomFn() * 0.78));
  return [...core, ...initialEmerging];
}

/**
 * Old saves keep every already-listed equity they knew about. New emerging definitions
 * are not auto-injected: their appearance is controlled by each save's marketCompanyPool.
 */
export function mergeStocks(existing: StockState[], globalWeek = 1): StockState[] {
  const normalized = (existing ?? []).map((stock) => {
    const definition = stockDefinitions().find((item) => item.ticker === stock.ticker);
    const emerging = definition?.marketRole === 'emerging';
    return {
      ...stock,
      marketStatus: stock.marketStatus ?? 'listed',
      listedWeek: stock.listedWeek ?? 1,
      companyStage: stock.companyStage ?? (emerging ? 'mature' : 'established'),
      companyQuality: emerging ? (stock.companyQuality ?? 0.65) : stock.companyQuality,
    } as StockState;
  });

  const tickers = new Set(normalized.map((stock) => stock.ticker));
  const missingCore = coreStockDefinitions()
    .filter((definition) => !tickers.has(definition.ticker))
    .map((definition) => createListedState(definition, Math.max(1, globalWeek), false));
  return [...normalized, ...missingCore];
}

export function getLegacyMarketCompanyPool(): string[] {
  return emergingStockDefinitions().map((definition) => definition.ticker);
}

export interface MarketCompanyLifecycleResult {
  stocks: StockState[];
  holdings: StockHolding[];
  settlementCash: number;
  realizedProfitLoss: number;
  events: MarketCompanyEvent[];
}

/**
 * Young public companies can IPO, mature into established listings, or fail and delist.
 * Only companies selected in marketCompanyPool can ever appear in that save.
 */
export function processMarketCompanyLifecycle(
  state: GameState,
  globalWeek: number,
  randomFn: () => number = Math.random,
): MarketCompanyLifecycleResult {
  let stocks = [...(state.stocks ?? [])];
  let holdings = [...(state.holdings ?? [])];
  let settlementCash = 0;
  let realizedProfitLoss = 0;
  const events: MarketCompanyEvent[] = [];

  const pool = state.marketCompanyPool ?? [];
  const usedTickers = new Set(stocks.map((stock) => stock.ticker));
  const activeYoung = stocks.filter((stock) => {
    const definition = stockDefinitions().find((item) => item.ticker === stock.ticker);
    return definition?.marketRole === 'emerging'
      && stock.marketStatus !== 'delisted'
      && stock.companyStage !== 'mature'
      && stock.companyStage !== 'failed';
  }).length;

  const annualListingWindow = globalWeek > 1 && (globalWeek - 1) % 20 === 0;
  if (annualListingWindow && activeYoung < MAX_ACTIVE_EMERGING && randomFn() < IPO_CHANCE_PER_YEAR) {
    const candidates = pool
      .filter((ticker) => !usedTickers.has(ticker))
      .map((ticker) => emergingStockDefinitions().find((definition) => definition.ticker === ticker))
      .filter(Boolean);
    const picked = weightedEmergingPick(candidates, randomFn());
    if (picked) {
      const quality = 0.10 + randomFn() * 0.84;
      stocks.push(createListedState(picked, globalWeek, true, quality));
      events.push({
        ticker: picked.ticker,
        company: picked.company,
        kind: 'ipo',
        description: `${picked.company} (${picked.ticker}) entered the public market. Young listings can grow quickly, stagnate, or fail.`,
      });
    }
  }

  stocks = stocks.map((stock) => {
    const definition = stockDefinitions().find((item) => item.ticker === stock.ticker);
    if (!definition || definition.marketRole !== 'emerging' || stock.marketStatus === 'delisted') return stock;

    const age = Math.max(0, globalWeek - (stock.listedWeek ?? globalWeek));
    const quality = Math.max(0.08, Math.min(0.95, stock.companyQuality ?? 0.5));
    const priceRatio = (stock.currentPrice ?? definition.startPrice) / Math.max(0.01, definition.startPrice ?? 1);
    let stage = stock.companyStage ?? 'emerging';

    if (stage === 'emerging' && age >= 24 && priceRatio >= 1.12) stage = 'growth';

    const matures = stage !== 'mature'
      && stage !== 'failed'
      && stage !== 'distressed'
      && (
        (age >= 60 && (priceRatio >= 1.15 || quality >= 0.68))
        || (age >= 80 && priceRatio >= 0.70)
      );
    if (matures) {
      events.push({
        ticker: definition.ticker,
        company: definition.company,
        kind: 'matured',
        description: `${definition.company} survived its risky early years and is now treated as an established listing.`,
      });
      return { ...stock, companyStage: 'mature' as const };
    }

    if (age < 12 || stage === 'mature' || stage === 'failed') {
      return stage === stock.companyStage ? stock : { ...stock, companyStage: stage };
    }

    let failureChance = quality < 0.25 ? 0.022
      : quality < 0.40 ? 0.012
        : quality < 0.55 ? 0.005
          : 0.0015;
    if (priceRatio < 0.50) failureChance += 0.012;
    if (priceRatio < 0.25) failureChance += 0.025;
    if (stage === 'distressed') failureChance += priceRatio < 0.40 ? 0.10 : 0.055;
    if (age > 50) failureChance *= 0.70;

    if (stage === 'distressed') {
      const recoveryChance = Math.max(0.03, Math.min(0.22, Number(definition.recoveryChance ?? 0.08) + quality * 0.08 + (priceRatio > 0.65 ? 0.05 : 0)));
      if (randomFn() < recoveryChance) {
        const recoveryPrice = roundPrice((stock.currentPrice ?? definition.startPrice ?? 1) * (1.08 + randomFn() * 0.18));
        events.push({
          ticker: definition.ticker,
          company: definition.company,
          kind: 'recovery',
          description: `${definition.company} secured financing and returned from distress. Dividends may resume if the company has a payout policy.`,
          impactPercent: ((recoveryPrice / Math.max(0.01, stock.currentPrice ?? recoveryPrice)) - 1) * 100,
        });
        const history = [...(stock.priceHistory ?? []), recoveryPrice].slice(-20);
        return {
          ...stock,
          currentPrice: recoveryPrice,
          priceHistory: history,
          companyStage: priceRatio >= 1.05 ? 'growth' as const : 'emerging' as const,
          companyQuality: Math.min(0.95, quality + 0.08),
        };
      }
    }

    if (randomFn() >= failureChance) {
      return stage === stock.companyStage ? stock : { ...stock, companyStage: stage };
    }

    if (stage !== 'distressed') {
      events.push({
        ticker: definition.ticker,
        company: definition.company,
        kind: 'distressed',
        description: `${definition.company} issued a severe profit warning and entered distress. Dividends are suspended and failure risk is elevated.`,
        impactPercent: -Math.max(8, Math.min(35, (1 - Math.max(0.01, priceRatio)) * 25)),
      });
      const distressPrice = roundPrice((stock.currentPrice ?? definition.startPrice ?? 1) * 0.82);
      const history = [...(stock.priceHistory ?? []), distressPrice].slice(-20);
      return {
        ...stock,
        currentPrice: distressPrice,
        priceHistory: history,
        companyStage: 'distressed' as const,
        companyQuality: Math.max(0.05, quality - 0.08),
      };
    }

    const recoveryPrice = roundPrice((definition.startPrice ?? stock.currentPrice ?? 1) * (0.02 + randomFn() * 0.03));
    const holding = holdings.find((item) => item.ticker === stock.ticker);
    let companySettlement = 0;
    let companyRealized = 0;
    if (holding && holding.shares > 0) {
      companySettlement = holding.shares * recoveryPrice;
      const costBasis = holding.shares * holding.avgBuyPrice;
      companyRealized = companySettlement - costBasis;
      settlementCash += companySettlement;
      realizedProfitLoss += companyRealized;
      holdings = holdings.filter((item) => item.ticker !== stock.ticker);
    }

    events.push({
      ticker: definition.ticker,
      company: definition.company,
      kind: 'delisted',
      description: `${definition.company} failed during its early public years and was delisted after distress.`,
      settlementCash: companySettlement,
      realizedProfitLoss: companyRealized,
    });

    const history = [...(stock.priceHistory ?? []), recoveryPrice].slice(-20);
    return {
      ...stock,
      currentPrice: recoveryPrice,
      priceHistory: history,
      marketStatus: 'delisted' as const,
      delistedWeek: globalWeek,
      delistingReason: 'failure' as const,
      companyStage: 'failed' as const,
    };
  });

  return { stocks, holdings, settlementCash, realizedProfitLoss, events };
}

const COMPANY_EVENT_CHANCE_PER_WEEK = 0.05;
const PUBLIC_MA_CHANCE_PER_WEEK = 0.004;
const COMPANY_EVENT_COOLDOWN_WEEKS = 14;

function replaceLatestHistoryPrice(stock: StockState, nextPrice: number): StockState {
  const price = roundPrice(nextPrice);
  const history = [...(stock.priceHistory ?? [])];
  if (history.length === 0) history.push(price);
  else history[history.length - 1] = price;
  return { ...stock, currentPrice: price, priceHistory: history.slice(-20) };
}

function weightedCompanyEventPick(events: any[], stock: StockState, randomValue: number): any | null {
  if (events.length === 0) return null;
  const quality = Math.max(0.08, Math.min(0.95, stock.companyQuality ?? 0.5));
  const weights = events.map((event) => {
    const directionFactor = event.positive
      ? 0.75 + quality * 0.65
      : 1.20 - quality * 0.45;
    return Math.max(0.05, Number(event.weight ?? 1) * directionFactor);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.max(0, Math.min(0.999999, randomValue)) * total;
  for (let index = 0; index < events.length; index++) {
    cursor -= weights[index];
    if (cursor <= 0) return events[index];
  }
  return events[events.length - 1] ?? null;
}

export interface PublicCompanyEventResult {
  stocks: StockState[];
  holdings: StockHolding[];
  settlementCash: number;
  realizedProfitLoss: number;
  events: MarketCompanyEvent[];
}

/**
 * One-off company stories plus rare public-company acquisitions.
 * Existing multi-week company effects tick here after processStocks used them.
 */
export function processPublicCompanyEvents(
  state: GameState,
  globalWeek: number,
  randomFn: () => number = Math.random,
): PublicCompanyEventResult {
  let stocks = (state.stocks ?? []).map((stock) => {
    const active = stock.activeCompanyEvent;
    if (!active) return stock;
    return {
      ...stock,
      activeCompanyEvent: active.weeksRemaining <= 1
        ? null
        : { ...active, weeksRemaining: active.weeksRemaining - 1 },
    };
  });
  let holdings = [...(state.holdings ?? [])];
  let settlementCash = 0;
  let realizedProfitLoss = 0;
  const events: MarketCompanyEvent[] = [];

  const listedStocks = () => stocks.filter((stock) => {
    const definition = stockDefinitions().find((item) => item.ticker === stock.ticker);
    return definition?.type === 'stock' && stock.marketStatus !== 'delisted';
  });

  // Rare acquisition: established/mature public companies can absorb a younger listing.
  const acquisitionTargets = listedStocks().filter((stock) => {
    const definition = stockDefinitions().find((item) => item.ticker === stock.ticker);
    const age = Math.max(0, globalWeek - (stock.listedWeek ?? globalWeek));
    return definition?.marketRole === 'emerging'
      && age >= 12
      && stock.companyStage !== 'failed';
  });

  if (globalWeek > 20 && acquisitionTargets.length > 0 && randomFn() < PUBLIC_MA_CHANCE_PER_WEEK) {
    const target = acquisitionTargets[Math.floor(randomFn() * acquisitionTargets.length)] ?? acquisitionTargets[0];
    const targetDefinition = stockDefinitions().find((item) => item.ticker === target.ticker);
    const allAcquirers = listedStocks().filter((stock) => stock.ticker !== target.ticker && (
      stock.companyStage === 'established'
      || stock.companyStage === 'mature'
      || stockDefinitions().find((item) => item.ticker === stock.ticker)?.marketRole !== 'emerging'
    ));
    const sameSector = allAcquirers.filter((stock) =>
      stockDefinitions().find((item) => item.ticker === stock.ticker)?.sector === targetDefinition?.sector
    );
    const acquirerPool = sameSector.length > 0 ? sameSector : allAcquirers;

    if (targetDefinition && acquirerPool.length > 0) {
      const acquirer = acquirerPool[Math.floor(randomFn() * acquirerPool.length)] ?? acquirerPool[0];
      const acquirerDefinition = stockDefinitions().find((item) => item.ticker === acquirer.ticker);
      const premium = 0.18 + randomFn() * 0.17;
      const offerPrice = roundPrice((target.currentPrice ?? targetDefinition.startPrice ?? 1) * (1 + premium));
      const holding = holdings.find((item) => item.ticker === target.ticker);
      let companySettlement = 0;
      let companyRealized = 0;
      if (holding && holding.shares > 0) {
        companySettlement = holding.shares * offerPrice;
        const costBasis = holding.shares * holding.avgBuyPrice;
        companyRealized = companySettlement - costBasis;
        settlementCash += companySettlement;
        realizedProfitLoss += companyRealized;
        holdings = holdings.filter((item) => item.ticker !== target.ticker);
      }

      const acquirerReaction = -0.02 + randomFn() * 0.07;
      stocks = stocks.map((stock) => {
        if (stock.ticker === target.ticker) {
          return {
            ...replaceLatestHistoryPrice(stock, offerPrice),
            marketStatus: 'delisted' as const,
            delistedWeek: globalWeek,
            delistingReason: 'acquisition' as const,
            acquiredByTicker: acquirer.ticker,
            activeCompanyEvent: null,
          };
        }
        if (stock.ticker === acquirer.ticker) {
          return {
            ...replaceLatestHistoryPrice(stock, (stock.currentPrice ?? 1) * (1 + acquirerReaction)),
            lastCompanyEventWeek: globalWeek,
            activeCompanyEvent: {
              id: 'acquisition_integration',
              title: 'Acquisition Integration',
              weeklyEffect: -0.001 + randomFn() * 0.004,
              weeksRemaining: 4,
            },
          };
        }
        return stock;
      });

      events.push({
        ticker: target.ticker,
        company: targetDefinition.company,
        kind: 'acquired',
        title: `${acquirerDefinition?.company ?? acquirer.ticker} Acquires ${targetDefinition.company}`,
        description: `${acquirerDefinition?.company ?? acquirer.ticker} agreed to acquire ${targetDefinition.company} at a ${Math.round(premium * 100)}% premium. The target ticker will leave the market.`,
        settlementCash: companySettlement,
        realizedProfitLoss: companyRealized,
        impactPercent: premium * 100,
        acquirerTicker: acquirer.ticker,
        acquirerCompany: acquirerDefinition?.company ?? acquirer.ticker,
      });

      return { stocks, holdings, settlementCash, realizedProfitLoss, events };
    }
  }

  if (randomFn() >= COMPANY_EVENT_CHANCE_PER_WEEK) {
    return { stocks, holdings, settlementCash, realizedProfitLoss, events };
  }

  const eligibleStocks = listedStocks().filter((stock) =>
    globalWeek - (stock.lastCompanyEventWeek ?? -100) >= COMPANY_EVENT_COOLDOWN_WEEKS
    && !stock.activeCompanyEvent
  );
  if (eligibleStocks.length === 0) return { stocks, holdings, settlementCash, realizedProfitLoss, events };

  const pickedStock = eligibleStocks[Math.floor(randomFn() * eligibleStocks.length)] ?? eligibleStocks[0];
  const definition = stockDefinitions().find((item) => item.ticker === pickedStock.ticker);
  if (!definition) return { stocks, holdings, settlementCash, realizedProfitLoss, events };

  const previousEventIds = new Set(pickedStock.companyEventHistory ?? []);
  const eligibleEvents = (marketCompanyEventsData as any[]).filter((event) =>
    (!event.sectors?.length || event.sectors.includes(definition.sector))
    && !previousEventIds.has(event.id)
  );
  const pickedEvent = weightedCompanyEventPick(eligibleEvents, pickedStock, randomFn());
  if (!pickedEvent) return { stocks, holdings, settlementCash, realizedProfitLoss, events };

  const variance = 0.85 + randomFn() * 0.30;
  const impact = Number(pickedEvent.priceImpact ?? 0) * variance;
  stocks = stocks.map((stock) => {
    if (stock.ticker !== pickedStock.ticker) return stock;
    return {
      ...replaceLatestHistoryPrice(stock, (stock.currentPrice ?? definition.startPrice ?? 1) * (1 + impact)),
      lastCompanyEventWeek: globalWeek,
      companyEventHistory: [...(stock.companyEventHistory ?? []), pickedEvent.id].slice(-12),
      activeCompanyEvent: Math.abs(Number(pickedEvent.weeklyEffect ?? 0)) > 0
        ? {
            id: pickedEvent.id,
            title: pickedEvent.title,
            weeklyEffect: Number(pickedEvent.weeklyEffect ?? 0),
            weeksRemaining: Math.max(1, Number(pickedEvent.durationWeeks ?? 1)),
          }
        : null,
      dividendYieldOverride: Number(pickedEvent.dividendYield ?? 0) > 0
        ? Math.max(stock.dividendYieldOverride ?? 0, Number(pickedEvent.dividendYield))
        : stock.dividendYieldOverride,
    };
  });

  events.push({
    ticker: definition.ticker,
    company: definition.company,
    kind: 'company_event',
    title: pickedEvent.title,
    description: `${definition.company}: ${pickedEvent.description}`,
    impactPercent: impact * 100,
  });

  return { stocks, holdings, settlementCash, realizedProfitLoss, events };
}

/** Percentage changes from the two most recent saved prices. */
export function getLatestStockChanges(stocks: StockState[]): { ticker: string; change: number }[] {
  return (stocks ?? []).flatMap((stock) => {
    if (stock.marketStatus === 'delisted') return [];
    const history = stock?.priceHistory ?? [];
    if (history.length < 2) return [];
    const previousPrice = history[history.length - 2] ?? 0;
    const currentPrice = history[history.length - 1] ?? stock?.currentPrice ?? 0;
    if (previousPrice <= 0) return [];
    return [{
      ticker: stock?.ticker ?? '',
      change: ((currentPrice - previousPrice) / previousPrice) * 100,
    }];
  });
}

/**
 * Roll for a yearly market sentiment event (every 20 weeks).
 */
export function rollMarketSentiment(
  globalWeek: number,
  current: ActiveMarketSentiment | null
): ActiveMarketSentiment | null {
  // Tick existing
  if (current && (current.weeksRemaining ?? 0) > 1) {
    return { ...current, weeksRemaining: current.weeksRemaining - 1 };
  }
  // Roll new one every 20 weeks
  if (globalWeek > 0 && globalWeek % 20 === 0) {
    const events = marketSentimentData as any[];
    if (events.length === 0) return null;
    const picked = events[Math.floor(Math.random() * events.length)];
    return {
      id: picked.id,
      name: picked.name,
      effects: picked.effects ?? {},
      volatilityMultiplier: picked.volatilityMultiplier ?? 1.0,
      weeksRemaining: picked.durationWeeks ?? 20,
    };
  }
  return current?.weeksRemaining === 1 ? null : (current ?? null);
}

/**
 * Roll for random market events (historical, 5% chance per week).
 */
export function rollMarketEvent(
  activeEvents: ActiveMarketEvent[]
): { updatedEvents: ActiveMarketEvent[]; newEvent: ActiveMarketEvent | null } {
  // Tick existing
  const updated = activeEvents
    .map((e) => ({ ...e, weeksRemaining: e.weeksRemaining - 1 }))
    .filter((e) => e.weeksRemaining > 0);

  // 5% chance of new event
  let newEvent: ActiveMarketEvent | null = null;
  if (Math.random() < 0.05) {
    const events = [...(marketEventsData as any[]), ...(marketSectorEventsData as any[])];
    const activeIds = new Set(updated.map((e) => e.id));
    const eligible = events.filter((e) => !activeIds.has(e.id));
    if (eligible.length > 0) {
      const picked = eligible[Math.floor(Math.random() * eligible.length)];
      newEvent = {
        id: picked.id,
        title: picked.title,
        effects: picked.effects ?? {},
        assetTypes: picked.assetTypes,
        weeksRemaining: picked.durationWeeks ?? 8,
      };
      updated.push(newEvent);
    }
  }

  return { updatedEvents: updated, newEvent };
}

/**
 * Calculate combined market effects from sentiment + active events.
 */
function getCombinedMarketEffects(
  sentiment: ActiveMarketSentiment | null,
  events: ActiveMarketEvent[],
  assetType: string
): { sectorEffects: Record<string, number>; volatilityMult: number } {
  const sectorEffects: Record<string, number> = {};
  let volatilityMult = 1.0;

  if (sentiment) {
    for (const [sector, val] of Object.entries(sentiment.effects)) {
      sectorEffects[sector] = (sectorEffects[sector] ?? 0) + (val as number) * 0.05; // per-week fraction
    }
    volatilityMult = sentiment.volatilityMultiplier ?? 1.0;
  }

  for (const event of events) {
    if ((event.assetTypes?.length ?? 0) > 0 && !event.assetTypes?.includes(assetType as 'stock' | 'commodity' | 'etf' | 'crypto')) continue;
    for (const [sector, val] of Object.entries(event.effects)) {
      sectorEffects[sector] = (sectorEffects[sector] ?? 0) + (val as number) * 0.05;
    }
  }

  return { sectorEffects, volatilityMult };
}

export function getCryptoRiskProfile(metadata: any) {
  if (metadata?.type !== 'crypto') return null;
  const style = metadata.cryptoStyle as 'reserve' | 'utility' | 'speculative' | undefined;
  const volatilityAdjustment = style === 'reserve' ? 0.85 : style === 'speculative' ? 1.15 : 1;
  const baseVolatility = Math.max(0, Number(metadata.baseVolatility ?? 0));
  const defaultMomentumCap = style === 'speculative' ? 0.07 : style === 'utility' ? 0.025 : 0.012;
  const defaultMinWeeklyChange = style === 'reserve' ? -0.18 : style === 'utility' ? -0.25 : -0.35;
  const defaultMaxWeeklyChange = style === 'reserve' ? 0.18 : style === 'utility' ? 0.28 : 0.40;
  const minWeeklyChange = Number.isFinite(Number(metadata.minWeeklyChange))
    ? Math.max(-0.50, Math.min(0, Number(metadata.minWeeklyChange)))
    : defaultMinWeeklyChange;
  const maxWeeklyChange = Number.isFinite(Number(metadata.maxWeeklyChange))
    ? Math.max(0, Math.min(0.50, Number(metadata.maxWeeklyChange)))
    : defaultMaxWeeklyChange;
  const maniaChance = style === 'speculative' ? Math.max(0, Number(metadata.maniaChance ?? 0)) : 0;
  const maniaMinMove = style === 'speculative' ? Math.max(0, Number(metadata.maniaMinMove ?? 0.08)) : 0;
  const maniaMaxMove = style === 'speculative'
    ? Math.max(maniaMinMove, Number(metadata.maniaMaxMove ?? 0.20))
    : 0;

  return {
    style,
    label: style === 'reserve' ? 'Moderate' : style === 'utility' ? 'High' : 'Very High',
    volatilityAdjustment,
    ordinaryRandomMovePct: baseVolatility * volatilityAdjustment * 0.5 * 100,
    momentumCap: Math.max(0, Number(metadata.momentumCap ?? defaultMomentumCap)),
    maniaChance,
    maniaMinMove,
    maniaMaxMove,
    minWeeklyChange,
    maxWeeklyChange,
  };
}

/**
 * Process annual investment distributions (every 20 weeks).
 * Stocks/ETFs can pay dividends; selected crypto can pay staking rewards.
 */
export function processDividends(
  state: GameState,
  globalWeek: number
): number {
  if (globalWeek <= 0 || globalWeek % 20 !== 0) return 0;

  let totalDividend = 0;
  for (const holding of state?.holdings ?? []) {
    const sd = (stocksData ?? []).find((s) => s?.ticker === holding?.ticker);
    if (!sd) continue;
    const stock = (state?.stocks ?? []).find((s) => s?.ticker === holding?.ticker);
    if (stock?.marketStatus === 'delisted') continue;
    if (stock?.companyStage === 'distressed') continue;
    const price = stock?.currentPrice ?? sd.startPrice;
    // Use each asset's configured annual dividend/staking yield, with fallbacks.
    const metadata = sd as any;
    let rate = Number(stock?.dividendYieldOverride ?? metadata.stakingYield ?? metadata.dividendYield ?? 0);
    if (rate <= 0 && sd.sector === 'Banking') rate = 0.025;
    else if (rate <= 0 && sd.sector === 'Finance') rate = 0.015;
    else if (rate <= 0 && sd.type === 'etf') rate = 0.01;
    if (rate > 0) {
      totalDividend += Math.round((holding?.shares ?? 0) * price * rate);
    }
  }
  return totalDividend;
}

/**
 * Step 4: Stock Market Simulation
 * Updates all stock prices based on news sector effects + market sentiment + random volatility.
 */
export function processStocks(
  state: GameState,
  news: NewsEvent,
  macroShock = 0,
  cryptoDownsideReduction = 0,
): { stocks: StockState[]; stockChanges: { ticker: string; change: number }[] } {
  const newsEffects = news?.effects ?? {};
  const inflationDrift = ((state?.inflationMultiplier ?? 1) - 1) * 0.0005;
  // Market history belongs to the world, not the current player's lifetime.
  const elapsedWeeks = Math.max(0, ((state.year ?? 1) - 1) * 20 + (state.week ?? 1) - 1);

  const newStocks = (state?.stocks ?? []).map((stock) => {
    if (stock.marketStatus === 'delisted') return stock;
    const data = (stocksData ?? []).find((s) => s?.ticker === stock?.ticker);
    const metadata = (data ?? {}) as any;
    const sector = data?.sector ?? '';
    const assetType = data?.type ?? 'stock';
    const isCommodity = data?.type === 'commodity';
    const isEtf = data?.type === 'etf';
    const isCrypto = data?.type === 'crypto';
    const cryptoStyle = metadata.cryptoStyle as 'reserve' | 'utility' | 'speculative' | undefined;
    const cryptoRisk = isCrypto ? getCryptoRiskProfile(metadata) : null;

    const { sectorEffects: marketEffects, volatilityMult } = getCombinedMarketEffects(
      state?.activeMarketSentiment ?? null,
      state?.activeMarketEvents ?? [],
      assetType
    );
    const newsEffect = newsEffects?.[sector] ?? 0;
    const marketEffect = (marketEffects?.[sector] ?? 0) + (marketEffects?.[assetType] ?? 0) + (marketEffects?.All ?? 0);

    // Crypto gets its own volatility profile. AurumX is deliberately the
    // defensive coin; MojoCoin is allowed much wider weekly swings.
    const configuredVolatility = Number(metadata.baseVolatility ?? 0);
    const isYoungEmerging = metadata.marketRole === 'emerging'
      && stock.companyStage !== 'mature'
      && stock.companyStage !== 'failed';
    const emergingVolatility = Number(metadata.emergingVolatility ?? 0.13);
    const baseVolatility = isYoungEmerging
      ? emergingVolatility
      : isCrypto && configuredVolatility > 0
        ? configuredVolatility
        : isEtf ? 0.025 : isCommodity ? 0.08 : 0.06;
    const cryptoVolatilityAdjustment = cryptoRisk?.volatilityAdjustment ?? 1;
    const volatility = baseVolatility * volatilityMult * cryptoVolatilityAdjustment;
    const baseChange = (Math.random() - 0.5) * volatility;

    // Per-asset trend lines keep the three crypto assets structurally distinct
    // without guaranteeing returns.
    const annualTrend = Number(metadata.annualTrend ?? (isEtf ? 0.018 : isCommodity ? 0.006 : 0.015));
    const weeklyGrowthDrift = Math.pow(1 + annualTrend, 1 / 20) - 1;
    const trendPrice = (data?.startPrice ?? stock.currentPrice ?? 100) * Math.pow(1 + annualTrend, elapsedWeeks / 20);
    const trendGap = trendPrice / Math.max(isCrypto ? 0.01 : 1, stock.currentPrice ?? 1) - 1;
    const reversionCap = cryptoStyle === 'speculative' ? 0.012 : isCrypto ? 0.007 : 0.004;
    const meanReversion = Math.max(-reversionCap, Math.min(reversionCap, trendGap * 0.02));

    let emergingDrift = 0;
    let emergingMomentum = 0;
    if (isYoungEmerging) {
      const quality = Math.max(0.08, Math.min(0.95, stock.companyQuality ?? 0.5));
      emergingDrift = (quality - 0.48) * 0.014
        + (stock.companyStage === 'growth' ? 0.002 : 0)
        - (stock.companyStage === 'distressed' ? 0.018 : 0);
      const emergingHistory = stock.priceHistory ?? [];
      if (emergingHistory.length >= 2) {
        const last = emergingHistory[emergingHistory.length - 1] ?? stock.currentPrice ?? 0;
        const previous = emergingHistory[emergingHistory.length - 2] ?? last;
        if (previous > 0) {
          const previousMove = (last - previous) / previous;
          emergingMomentum = Math.max(-0.025, Math.min(0.025, previousMove * 0.14));
        }
      }
    }

    // Crypto-specific mechanics.
    const history = stock?.priceHistory ?? [];
    let momentumEffect = 0;
    if (isCrypto && history.length >= 2) {
      const last = history[history.length - 1] ?? stock.currentPrice ?? 0;
      const previous = history[history.length - 2] ?? last;
      if (previous > 0) {
        const previousMove = (last - previous) / previous;
        const factor = Number(metadata.momentumFactor ?? 0);
        const defaultCap = cryptoStyle === 'speculative' ? 0.07 : cryptoStyle === 'utility' ? 0.025 : 0.012;
        const cap = cryptoRisk?.momentumCap ?? defaultCap;
        momentumEffect = Math.max(-cap, Math.min(cap, previousMove * factor));
      }
    }

    const techSensitivity = cryptoStyle === 'utility' ? Number(metadata.techSensitivity ?? 0) : 0;
    const techEffect = techSensitivity * ((newsEffects?.Tech ?? 0) + (marketEffects?.Tech ?? 0));

    const inflationSensitivity = cryptoStyle === 'reserve' ? Number(metadata.inflationSensitivity ?? 0) : 0;
    const reserveInflationEffect = Math.max(0, (state?.inflationMultiplier ?? 1) - 1) * inflationSensitivity;
    const scarcityDrift = cryptoStyle === 'reserve'
      ? Math.min(0.0006, Math.floor(elapsedWeeks / 80) * 0.00015)
      : 0;

    let maniaEffect = 0;
    if (cryptoStyle === 'speculative' && Math.random() < (cryptoRisk?.maniaChance ?? 0)) {
      const direction = Math.random() < 0.55 ? 1 : -1;
      const maniaMin = cryptoRisk?.maniaMinMove ?? 0.08;
      const maniaMax = cryptoRisk?.maniaMaxMove ?? 0.20;
      maniaEffect = direction * (maniaMin + Math.random() * (maniaMax - maniaMin));
    }

    const effectiveMacroShock = macroShock * Number(metadata.macroShockMultiplier ?? 1);
    const rawChange = baseChange
      + newsEffect
      + marketEffect
      + inflationDrift
      + weeklyGrowthDrift
      + meanReversion
      + emergingDrift
      + emergingMomentum
      + (stock.activeCompanyEvent?.weeklyEffect ?? 0)
      + momentumEffect
      + techEffect
      + reserveInflationEffect
      + scarcityDrift
      + maniaEffect
      + effectiveMacroShock;

    const protectedRawChange = isCrypto && rawChange < 0
      ? rawChange * (1 - Math.max(0, Math.min(0.5, cryptoDownsideReduction)))
      : rawChange;

    const defaultMinChange = isYoungEmerging ? (effectiveMacroShock < 0 ? -0.32 : -0.20)
      : cryptoStyle === 'reserve' ? -0.18
        : cryptoStyle === 'utility' ? -0.25
          : cryptoStyle === 'speculative' ? -0.35
            : effectiveMacroShock < 0 ? -0.30 : -0.08;
    const defaultMaxChange = isYoungEmerging ? 0.24
      : cryptoStyle === 'reserve' ? 0.18
        : cryptoStyle === 'utility' ? 0.28
          : cryptoStyle === 'speculative' ? 0.40
            : 0.10;
    const minChange = cryptoRisk?.minWeeklyChange ?? defaultMinChange;
    const maxChange = cryptoRisk?.maxWeeklyChange ?? defaultMaxChange;
    const totalChange = Math.max(minChange, Math.min(maxChange, protectedRawChange));

    let newPrice = (stock?.currentPrice ?? 100) * (1 + totalChange);
    newPrice = Math.max(isCrypto ? 0.01 : 1, Math.round(newPrice * 100) / 100);

    const nextHistory = [...history, newPrice];
    if (nextHistory.length > 20) nextHistory.shift();

    return { ...stock, currentPrice: newPrice, priceHistory: nextHistory };
  });

  const stockChanges = newStocks.flatMap((ns) => {
    if (ns.marketStatus === 'delisted') return [];
    const old = (state?.stocks ?? []).find((s) => s?.ticker === ns?.ticker);
    const oldPrice = old?.currentPrice ?? ns?.currentPrice;
    return [{
      ticker: ns?.ticker ?? '',
      change: oldPrice > 0 ? ((ns?.currentPrice ?? 0) - oldPrice) / oldPrice * 100 : 0,
    }];
  });

  return { stocks: newStocks, stockChanges };
}
