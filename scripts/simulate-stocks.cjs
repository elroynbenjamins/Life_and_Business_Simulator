/* Deterministic balance check for the stock engine. Run: node scripts/simulate-stocks.cjs [seed] */
const stocksData = require('../src/data/stocks.json');
const newsEvents = require('../src/data/news_events.json');
const sentiments = require('../src/data/market_sentiment.json');
const events = [...require('../src/data/market_events.json'), ...require('../src/data/market_sector_events.json')];

let seed = Number(process.argv[2] || 42) >>> 0;
const totalWeeks = Math.max(20, Number(process.argv[3] || 60));
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
for (let week = 1; week <= totalWeeks; week++) {
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
    const baseVolatility = stock.type === 'etf' ? .025 : stock.type === 'commodity' ? .08 : .06;
    const growthDrift = stock.type === 'etf' ? .0018 : stock.type === 'commodity' ? .0006 : .0015;
    const trendPrice = stock.startPrice * Math.pow(1.03, (week - 1) / 20);
    const meanReversion = Math.max(-.004, Math.min(.004, ((trendPrice / Math.max(1, prices[stock.ticker])) - 1) * .02));
    const change = Math.max(-.08, Math.min(.10,
      (random() - .5) * baseVolatility * volatility + (news.effects?.[stock.sector] || 0) +
      (effects[stock.sector] || 0) + (effects[stock.type] || 0) + (effects.All || 0) + growthDrift + meanReversion
    ));
    prices[stock.ticker] = Math.max(1, Math.round(prices[stock.ticker] * (1 + change) * 100) / 100);
  }
  if (week === 20 || week === 40 || week === 60 || week === totalWeeks) snapshots[week] = { ...prices };
}

const checkpoints = [...new Set([20, 40, 60, totalWeeks].filter((week) => week <= totalWeeks))];
console.log(['Ticker', 'Start', ...checkpoints.map((week) => `W${week}`), `${totalWeeks}w change`].join('\t'));
for (const stock of stocksData) {
  const end = snapshots[totalWeeks][stock.ticker];
  console.log([stock.ticker, stock.startPrice.toFixed(2), ...checkpoints.map((week) => snapshots[week][stock.ticker].toFixed(2)), `${(((end / stock.startPrice) - 1) * 100).toFixed(1)}%`].join('\t'));
}
