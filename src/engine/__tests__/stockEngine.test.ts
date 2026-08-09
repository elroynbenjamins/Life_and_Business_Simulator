import { getLatestStockChanges, processStocks } from '../stockEngine';
import { GameState, INITIAL_GAME_STATE } from '../../types/game';

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

  test.each([
    ['stock', 'MCRS', 100.5],
    ['commodity', 'GOLD', 100.5],
    ['etf', 'GLBL', 100.6],
  ])('applies %s market events directly to matching assets', (assetType, ticker, expectedPrice) => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      stocks: [
        { ticker: 'MCRS', currentPrice: 100, priceHistory: [100] },
        { ticker: 'GOLD', currentPrice: 100, priceHistory: [100] },
        { ticker: 'GLBL', currentPrice: 100, priceHistory: [100] },
      ],
      activeMarketEvents: [{
        id: `test_${assetType}`,
        title: 'Test event',
        effects: { [assetType]: 0.1 },
        weeksRemaining: 1,
      }],
    };

    const result = processStocks(state, { headline: 'Quiet week', effects: {} });
    expect(result.stocks.find((stock) => stock.ticker === ticker)?.currentPrice).toBe(expectedPrice);
    random.mockRestore();
  });
});
