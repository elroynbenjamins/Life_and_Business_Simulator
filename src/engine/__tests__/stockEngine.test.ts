import { getLatestStockChanges, processStocks } from '../stockEngine';
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
    expect(result.stocks.find((stock) => stock.ticker === 'MCRS')?.currentPrice).toBe(100.5);
    expect(result.stocks.find((stock) => stock.ticker === 'TCHE')?.currentPrice).toBe(100.1);
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
});
