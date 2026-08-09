import newsEvents from '../data/news_events.json';
import { NewsEvent } from '../types/game';

/**
 * Step 3: News Generation
 * Picks a random news event and returns its sector effects.
 */
export function processNews(): NewsEvent {
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

// Keep backward compat alias
export const generateNewsEvent = processNews;
