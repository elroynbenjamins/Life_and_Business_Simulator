/* Deterministic balance check for the stock engine. Run: node scripts/simulate-stocks.cjs [seed] */
const stocksData = require('../src/data/stocks.json');
const newsEvents = require('../src/data/news_events.json');
const sentiments = require('../src/data/market_sentiment.json');
const events = [...require('../src/data/market_events.json'), ...require('../src/data/market_sector_events.json')];

let seed = Number(process.argv[2] || 42) >>> 0;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const prices = Object.fromEntries(stocksData.map((stock) => [stock.ticker, stock.startPrice]));
let sentiment = null;
let active = [];

function combined(assetType) {
  const effects = {};
  let volatility = 1;
  if (sentiment) {
    for (const [sector, value] of Object.entries(sentiment.effects || {})) effects[sector] = (effects[sector] || 0) + value * .05;
    volatility = sentiment.volatilityMultiplier || 1;
  }
  for (const event of active) {
    if (event.assetTypes?.length && !event.assetTypes.includes(assetType)) continue;
    for (const [sector, value] of Object.entries(event.effects || {})) effects[sector] = (effects[sector] || 0) + value * .05;
  }
  return { effects, volatility };
}

const snapshots = {};
for (let week = 1; week <= 60; week++) {
  if (sentiment?.weeksRemaining > 1) sentiment.weeksRemaining--;
  else sentiment = null;
  if (week % 20 === 0) {
    const picked = sentiments[Math.floor(random() * sentiments.length)];
    sentiment = { ...picked, weeksRemaining: picked.durationWeeks || 20 };
  }
  active = active.map((event) => ({ ...event, weeksRemaining: event.weeksRemaining - 1 })).filter((event) => event.weeksRemaining > 0);
  if (random() < .05) {
    const eligible = events.filter((event) => !active.some((current) => current.id === event.id));
    const picked = eligible[Math.floor(random() * eligible.length)];
    if (picked) active.push({ ...picked, weeksRemaining: picked.durationWeeks || 8 });
  }
  const news = newsEvents[Math.floor(random() * newsEvents.length)] || { effects: {} };
  for (const stock of stocksData) {
    const { effects, volatility } = combined(stock.type || 'stock');
    const baseVolatility = stock.type === 'etf' ? .04 : stock.type === 'commodity' ? .14 : .10;
    const change = Math.max(-.10, Math.min(.12,
      (random() - .5) * baseVolatility * volatility + (news.effects?.[stock.sector] || 0) +
      (effects[stock.sector] || 0) + (effects[stock.type] || 0) + (effects.All || 0) + (stock.type === 'etf' ? .001 : 0)
    ));
    prices[stock.ticker] = Math.max(1, Math.round(prices[stock.ticker] * (1 + change) * 100) / 100);
  }
  if (week % 20 === 0) snapshots[week] = { ...prices };
}

console.log('Ticker\tStart\tW20\tW40\tW60\t60w change');
for (const stock of stocksData) {
  const end = snapshots[60][stock.ticker];
  console.log(`${stock.ticker}\t${stock.startPrice.toFixed(2)}\t${snapshots[20][stock.ticker].toFixed(2)}\t${snapshots[40][stock.ticker].toFixed(2)}\t${end.toFixed(2)}\t${(((end / stock.startPrice) - 1) * 100).toFixed(1)}%`);
}
