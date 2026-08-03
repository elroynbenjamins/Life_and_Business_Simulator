import { StockState } from '../types/game';
import stocksData from '../data/stocks.json';

export function initializeStocks(): StockState[] {
  return (stocksData ?? []).map((s) => ({
    ticker: s?.ticker ?? '',
    currentPrice: s?.startPrice ?? 100,
    priceHistory: [s?.startPrice ?? 100],
  }));
}

export function updateStockPrices(
  stocks: StockState[],
  sectorEffects: Record<string, number>
): StockState[] {
  return (stocks ?? []).map((stock) => {
    const data = (stocksData ?? []).find((s) => s?.ticker === stock?.ticker);
    const sector = data?.sector ?? '';
    const sectorEffect = sectorEffects?.[sector] ?? 0;

    // Base volatility: random between -5% and +5%
    const baseChange = (Math.random() - 0.5) * 0.10;
    // Total change capped at ±10%
    let totalChange = Math.max(-0.10, Math.min(0.10, baseChange + sectorEffect));

    let newPrice = (stock?.currentPrice ?? 100) * (1 + totalChange);
    newPrice = Math.max(1, Math.round(newPrice * 100) / 100);

    const history = [...(stock?.priceHistory ?? [])];
    history.push(newPrice);
    if (history.length > 10) history.shift();

    return {
      ...stock,
      currentPrice: newPrice,
      priceHistory: history,
    };
  });
}
