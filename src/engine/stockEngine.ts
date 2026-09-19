import { GameState, StockState, NewsEvent, ActiveMarketSentiment, ActiveMarketEvent } from '../types/game';
import stocksData from '../data/stocks.json';
import marketSentimentData from '../data/market_sentiment.json';
import marketEventsData from '../data/market_events.json';
import marketSectorEventsData from '../data/market_sector_events.json';

/**
 * Initialize stocks at game start.
 */
export function initializeStocks(): StockState[] {
  return (stocksData ?? []).map((s) => ({
    ticker: s?.ticker ?? '',
    currentPrice: s?.startPrice ?? 100,
    priceHistory: [s?.startPrice ?? 100],
  }));
}

/**
 * Merge saved stocks with current stocks.json — adds any new tickers missing from saved state.
 */
export function mergeStocks(existing: StockState[]): StockState[] {
  const tickers = new Set((existing ?? []).map((s) => s?.ticker));
  const missing = (stocksData ?? []).filter((s) => !tickers.has(s?.ticker));
  if (missing.length === 0) return existing;
  const added: StockState[] = missing.map((s) => ({
    ticker: s?.ticker ?? '',
    currentPrice: s?.startPrice ?? 100,
    priceHistory: [s?.startPrice ?? 100],
  }));
  return [...(existing ?? []), ...added];
}

/** Percentage changes from the two most recent saved prices. */
export function getLatestStockChanges(stocks: StockState[]): { ticker: string; change: number }[] {
  return (stocks ?? []).flatMap((stock) => {
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
    const price = stock?.currentPrice ?? sd.startPrice;
    // Use each asset's configured annual dividend/staking yield, with fallbacks.
    const metadata = sd as any;
    let rate = Number(metadata.stakingYield ?? metadata.dividendYield ?? 0);
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
  macroShock = 0
): { stocks: StockState[]; stockChanges: { ticker: string; change: number }[] } {
  const newsEffects = news?.effects ?? {};
  const inflationDrift = ((state?.inflationMultiplier ?? 1) - 1) * 0.0005;
  const elapsedWeeks = Math.max(0, state?.statistics?.weeksPlayed ?? 0);

  const newStocks = (state?.stocks ?? []).map((stock) => {
    const data = (stocksData ?? []).find((s) => s?.ticker === stock?.ticker);
    const metadata = (data ?? {}) as any;
    const sector = data?.sector ?? '';
    const assetType = data?.type ?? 'stock';
    const isCommodity = data?.type === 'commodity';
    const isEtf = data?.type === 'etf';
    const isCrypto = data?.type === 'crypto';
    const cryptoStyle = metadata.cryptoStyle as 'reserve' | 'utility' | 'speculative' | undefined;

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
    const baseVolatility = isCrypto && configuredVolatility > 0
      ? configuredVolatility
      : isEtf ? 0.025 : isCommodity ? 0.08 : 0.06;
    const cryptoVolatilityAdjustment = cryptoStyle === 'reserve' ? 0.85
      : cryptoStyle === 'speculative' ? 1.15 : 1;
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

    // Crypto-specific mechanics.
    const history = stock?.priceHistory ?? [];
    let momentumEffect = 0;
    if (isCrypto && history.length >= 2) {
      const last = history[history.length - 1] ?? stock.currentPrice ?? 0;
      const previous = history[history.length - 2] ?? last;
      if (previous > 0) {
        const previousMove = (last - previous) / previous;
        const factor = Number(metadata.momentumFactor ?? 0);
        const cap = cryptoStyle === 'speculative' ? 0.07 : cryptoStyle === 'utility' ? 0.025 : 0.012;
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
    if (cryptoStyle === 'speculative' && Math.random() < Number(metadata.maniaChance ?? 0)) {
      const direction = Math.random() < 0.55 ? 1 : -1;
      maniaEffect = direction * (0.08 + Math.random() * 0.12);
    }

    const effectiveMacroShock = macroShock * Number(metadata.macroShockMultiplier ?? 1);
    const rawChange = baseChange
      + newsEffect
      + marketEffect
      + inflationDrift
      + weeklyGrowthDrift
      + meanReversion
      + momentumEffect
      + techEffect
      + reserveInflationEffect
      + scarcityDrift
      + maniaEffect
      + effectiveMacroShock;

    const minChange = cryptoStyle === 'reserve' ? -0.18
      : cryptoStyle === 'utility' ? -0.25
        : cryptoStyle === 'speculative' ? -0.35
          : effectiveMacroShock < 0 ? -0.30 : -0.08;
    const maxChange = cryptoStyle === 'reserve' ? 0.18
      : cryptoStyle === 'utility' ? 0.28
        : cryptoStyle === 'speculative' ? 0.40
          : 0.10;
    const totalChange = Math.max(minChange, Math.min(maxChange, rawChange));

    let newPrice = (stock?.currentPrice ?? 100) * (1 + totalChange);
    newPrice = Math.max(isCrypto ? 0.01 : 1, Math.round(newPrice * 100) / 100);

    const nextHistory = [...history, newPrice];
    if (nextHistory.length > 20) nextHistory.shift();

    return { ...stock, currentPrice: newPrice, priceHistory: nextHistory };
  });

  const stockChanges = newStocks.map((ns) => {
    const old = (state?.stocks ?? []).find((s) => s?.ticker === ns?.ticker);
    const oldPrice = old?.currentPrice ?? ns?.currentPrice;
    return {
      ticker: ns?.ticker ?? '',
      change: oldPrice > 0 ? ((ns?.currentPrice ?? 0) - oldPrice) / oldPrice * 100 : 0,
    };
  });

  return { stocks: newStocks, stockChanges };
}
