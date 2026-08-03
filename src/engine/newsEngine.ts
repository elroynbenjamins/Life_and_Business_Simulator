import newsEvents from '../data/news_events.json';
import { NewsEvent } from '../types/game';

export function generateNewsEvent(): NewsEvent {
  const events = newsEvents ?? [];
  if (events.length === 0) {
    return { headline: 'A quiet week in the markets.', effects: {} };
  }
  const idx = Math.floor(Math.random() * events.length);
  const event = events[idx];
  const effects: Record<string, number> = {};
  if (event?.effects) {
    for (const [key, val] of Object.entries(event.effects)) {
      if (val !== undefined) effects[key] = val;
    }
  }
  return {
    headline: event?.headline ?? 'No news this week.',
    effects,
  };
}
