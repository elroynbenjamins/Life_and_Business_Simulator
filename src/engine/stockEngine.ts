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
    if ((event.assetTypes?.length ?? 0) > 0 && !event.assetTypes?.includes(assetType as 'stock' | 'commodity' | 'etf')) continue;
    for (const [sector, val] of Object.entries(event.effects)) {
      sectorEffects[sector] = (sectorEffects[sector] ?? 0) + (val as number) * 0.05;
    }
  }

  return { sectorEffects, volatilityMult };
}

/**
 * Process bank dividends (yearly, every 20 weeks).
 * Banking stocks pay ~2% annual dividend.
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
    // Use each asset's configured annual yield, with fallbacks for old saves/data.
    let rate = Number(sd.dividendYield ?? 0);
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
  news: NewsEvent
): { stocks: StockState[]; stockChanges: { ticker: string; change: number }[] } {
  const newsEffects = news?.effects ?? {};
  const inflationDrift = ((state?.inflationMultiplier ?? 1) - 1) * 0.0005;
  const elapsedWeeks = Math.max(0, state?.statistics?.weeksPlayed ?? 0);

  const newStocks = (state?.stocks ?? []).map((stock) => {
    const data = (stocksData ?? []).find((s) => s?.ticker === stock?.ticker);
    const sector = data?.sector ?? '';
    const assetType = data?.type ?? 'stock';
    const isCommodity = data?.type === 'commodity';
    const isEtf = data?.type === 'etf';
    const { sectorEffects: marketEffects, volatilityMult } = getCombinedMarketEffects(
      state?.activeMarketSentiment ?? null,
      state?.activeMarketEvents ?? [],
      assetType
    );
    const newsEffect = newsEffects?.[sector] ?? 0;
    const marketEffect = (marketEffects?.[sector] ?? 0) + (marketEffects?.[assetType] ?? 0) + (marketEffects?.All ?? 0);

    // Volatility is deliberately below the old 4/14/10% levels so news remains
    // important without random noise dominating a decade-long playthrough.
    const baseVolatility = isEtf ? 0.025 : isCommodity ? 0.08 : 0.06;
    const volatility = baseVolatility * volatilityMult;
    const baseChange = (Math.random() - 0.5) * volatility;

    // Modest long-term growth plus a soft pull toward a 1.5% yearly trend line.
    // This targets roughly 25-40% median growth over a 13-year playthrough.
    const weeklyGrowthDrift = isEtf ? 0.0009 : isCommodity ? 0.0003 : 0.0007;
    const trendPrice = (data?.startPrice ?? stock.currentPrice ?? 100) * Math.pow(1.015, elapsedWeeks / 20);
    const trendGap = trendPrice / Math.max(1, stock.currentPrice ?? 1) - 1;
    const meanReversion = Math.max(-0.004, Math.min(0.004, trendGap * 0.02));

    // Slightly asymmetric circuit breakers reduce long-run collapse from volatility drag
    // and prevent lifetime gain/loss records from always converging on the same magnitude.
    let totalChange = Math.max(-0.08, Math.min(0.10, baseChange + newsEffect + marketEffect + inflationDrift + weeklyGrowthDrift + meanReversion));

    let newPrice = (stock?.currentPrice ?? 100) * (1 + totalChange);
    newPrice = Math.max(1, Math.round(newPrice * 100) / 100);

    const history = [...(stock?.priceHistory ?? [])];
    history.push(newPrice);
    if (history.length > 20) history.shift();

    return { ...stock, currentPrice: newPrice, priceHistory: history };
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
