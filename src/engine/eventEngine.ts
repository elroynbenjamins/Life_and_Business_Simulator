import { GameState } from '../types/game';
import lifeEventsData from '../data/life_events.json';

const EVENT_CHANCE = 0.15; // 15% chance per week

const RARITY_WEIGHTS: Record<string, number> = {
  common: 70,
  uncommon: 20,
  rare: 8,
  legendary: 2,
};

export interface LifeEventData {
  id: string;
  category: string;
  rarity: string;
  type: 'automatic' | 'choice' | 'opportunity';
  title: string;
  description: string;
  icon: string;
  requirements: Record<string, any>;
  effects?: { cash?: number; happiness?: number };
  choices?: {
    text: string;
    cost?: number;
    cash?: number;
    happiness?: number;
    happinessDuration?: number;
    investmentId?: string;
  }[];
  investmentOutcomes?: Record<string, {
    successChance: number;
    returnMultiplier: number;
    failReturnMultiplier: number;
    weeksToResolve: number;
  }>;
}

function meetsRequirements(event: LifeEventData, state: GameState): boolean {
  const req = event.requirements ?? {};
  if (req.ownsCar && (!state.currentCarId || state.currentCarId === 'none')) return false;
  if (req.hasJob && !state.currentJobId) return false;
  if (req.isStudying && !state.currentCourseId) return false;
  if (req.hasHoldings && (state.holdings?.length ?? 0) === 0) return false;
  if (typeof req.minCash === 'number' && (state.cash ?? 0) < req.minCash) return false;
  return true;
}

function pickRarity(): string {
  const roll = Math.random() * 100;
  if (roll < 2) return 'legendary';
  if (roll < 10) return 'rare';
  if (roll < 30) return 'uncommon';
  return 'common';
}

/**
 * Rolls for a random life event this week.
 * Returns null if no event triggered, or a matching event.
 */
export function rollLifeEvent(state: GameState, recentEventIds: string[]): LifeEventData | null {
  // 15% chance of event
  if (Math.random() > EVENT_CHANCE) return null;

  const rarity = pickRarity();

  // Filter eligible events of the rolled rarity
  const eligible = (lifeEventsData as LifeEventData[]).filter(
    (e) =>
      e.rarity === rarity &&
      meetsRequirements(e, state) &&
      !recentEventIds.includes(e.id)
  );

  if (eligible.length === 0) {
    // Fallback: try common events
    const fallback = (lifeEventsData as LifeEventData[]).filter(
      (e) =>
        e.rarity === 'common' &&
        meetsRequirements(e, state) &&
        !recentEventIds.includes(e.id)
    );
    if (fallback.length === 0) return null;
    return fallback[Math.floor(Math.random() * fallback.length)];
  }

  return eligible[Math.floor(Math.random() * eligible.length)];
}

/**
 * Apply automatic event effects to cash.
 * Returns the cash delta.
 */
export function applyAutomaticEventEffects(event: LifeEventData): { cashDelta: number; happinessDelta: number } {
  return {
    cashDelta: event.effects?.cash ?? 0,
    happinessDelta: event.effects?.happiness ?? 0,
  };
}
