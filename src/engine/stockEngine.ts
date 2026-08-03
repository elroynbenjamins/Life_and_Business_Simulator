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
    const isCommodity = data?.type === 'commodity';
    const sectorEffect = sectorEffects?.[sector] ?? 0;

    // Commodities are more volatile
    const volatility = isCommodity ? 0.14 : 0.10;
    const baseChange = (Math.random() - 0.5) * volatility;
    let totalChange = Math.max(-0.10, Math.min(0.10, baseChange + sectorEffect));

    let newPrice = (stock?.currentPrice ?? 100) * (1 + totalChange);
    newPrice = Math.max(1, Math.round(newPrice * 100) / 100);

    const history = [...(stock?.priceHistory ?? [])];
    history.push(newPrice);
    if (history.length > 20) history.shift();

    return {
      ...stock,
      currentPrice: newPrice,
      priceHistory: history,
    };
  });
}
