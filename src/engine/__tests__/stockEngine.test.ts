import { getLatestStockChanges, mergeStocks, processDividends, processStocks } from '../stockEngine';
import { GameState, INITIAL_GAME_STATE } from '../../types/game';
import marketSectorEvents from '../../data/market_sector_events.json';
import stocksData from '../../data/stocks.json';

describe('stockEngine market reporting and type events', () => {
  test('calculates the latest percentage change from price history', () => {
    expect(getLatestStockChanges([
      { ticker: 'UP', currentPrice: 110, priceHistory: [90, 100, 110] },
      { ticker: 'DOWN', currentPrice: 45, priceHistory: [50, 45] },
      { ticker: 'NEW', currentPrice: 20, priceHistory: [20] },
    ])).toEqual([
      { ticker: 'UP', change: 10 },
      { ticker: 'DOWN', change: -10 },
    ]);
  });

  test('restricts a stock-sector event to regular stocks and leaves same-sector ETFs unchanged', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      stocks: [
        { ticker: 'MCRS', currentPrice: 100, priceHistory: [100] },
        { ticker: 'TCHE', currentPrice: 100, priceHistory: [100] },
      ],
      activeMarketEvents: [{
        id: 'test_tech_stock',
        title: 'Test event',
        effects: { Tech: 0.1 },
        assetTypes: ['stock'],
        weeksRemaining: 1,
      }],
    };

    const result = processStocks(state, { headline: 'Quiet week', effects: {} });
    expect(result.stocks.find((stock) => stock.ticker === 'MCRS')?.currentPrice).toBe(100.97);
    expect(result.stocks.find((stock) => stock.ticker === 'TCHE')?.currentPrice).toBe(100.49);
    random.mockRestore();
  });

  test('has two positive and two negative events for every stock and commodity sector', () => {
    const sectorTargets = new Map(
      (stocksData as any[])
        .filter((stock) => stock.type === 'stock' || stock.type === 'commodity')
        .map((stock) => [stock.sector, stock.type]),
    );

    expect(sectorTargets.size).toBe(18);
    for (const [sector, assetType] of sectorTargets) {
      const events = (marketSectorEvents as any[]).filter((event) =>
        Object.prototype.hasOwnProperty.call(event.effects, sector)
        && event.assetTypes?.includes(assetType),
      );
      expect(events.filter((event) => event.effects[sector] > 0)).toHaveLength(2);
      expect(events.filter((event) => event.effects[sector] < 0)).toHaveLength(2);
    }

    expect((marketSectorEvents as any[]).some((event) => event.assetTypes?.includes('etf'))).toBe(false);
  });

  test('merges all three new cryptocurrencies into existing saves', () => {
    const merged = mergeStocks([{ ticker: 'MCRS', currentPrice: 312, priceHistory: [312] }]);
    const tickers = new Set(merged.map((asset) => asset.ticker));

    expect(tickers.has('AURX')).toBe(true);
    expect(tickers.has('NEXA')).toBe(true);
    expect(tickers.has('MOJO')).toBe(true);
  });

  test('NEXA pays its configured annual staking reward', () => {
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      stocks: [{ ticker: 'NEXA', currentPrice: 100, priceHistory: [100] }],
      holdings: [{ ticker: 'NEXA', shares: 10, avgBuyPrice: 80 }],
    };

    expect(processDividends(state, 20)).toBe(40);
    expect(processDividends(state, 19)).toBe(0);
  });

  test('AURX absorbs less of a broad market crash than utility crypto', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const aurx = processStocks({
      ...INITIAL_GAME_STATE,
      stocks: [{ ticker: 'AURX', currentPrice: 100, priceHistory: [100] }],
    }, { headline: 'Quiet week', effects: {} }, -0.10);

    const nexa = processStocks({
      ...INITIAL_GAME_STATE,
      stocks: [{ ticker: 'NEXA', currentPrice: 100, priceHistory: [100] }],
    }, { headline: 'Quiet week', effects: {} }, -0.10);

    expect(aurx.stocks[0].currentPrice).toBeGreaterThan(nexa.stocks[0].currentPrice);
    random.mockRestore();
  });

  test('MOJO carries strong short-term momentum in both directions', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const rising = processStocks({
      ...INITIAL_GAME_STATE,
      stocks: [{ ticker: 'MOJO', currentPrice: 5, priceHistory: [4, 5] }],
    }, { headline: 'Quiet week', effects: {} });

    const falling = processStocks({
      ...INITIAL_GAME_STATE,
      stocks: [{ ticker: 'MOJO', currentPrice: 5, priceHistory: [6, 5] }],
    }, { headline: 'Quiet week', effects: {} });

    expect(rising.stocks[0].currentPrice).toBeGreaterThan(5);
    expect(falling.stocks[0].currentPrice).toBeLessThan(5);
    expect(rising.stocks[0].currentPrice).toBeGreaterThan(falling.stocks[0].currentPrice);
    random.mockRestore();
  });

  test('includes crypto-only adoption, regulation and speculation events', () => {
    const cryptoEvents = (marketSectorEvents as any[]).filter((event) => event.assetTypes?.includes('crypto'));

    expect(cryptoEvents.length).toBeGreaterThanOrEqual(5);
    expect(cryptoEvents.some((event) => (event.effects?.crypto ?? 0) > 0)).toBe(true);
    expect(cryptoEvents.some((event) => (event.effects?.crypto ?? 0) < 0)).toBe(true);
    expect(cryptoEvents.some((event) => (event.effects?.['Crypto Utility'] ?? 0) > 0)).toBe(true);
    expect(cryptoEvents.some((event) => (event.effects?.['Crypto Speculative'] ?? 0) > 0)).toBe(true);
  });
});
