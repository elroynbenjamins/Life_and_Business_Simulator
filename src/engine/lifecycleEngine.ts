import { GameState, LifecycleState } from '../types/game';

export interface LifecycleResult {
  lifecycle: LifecycleState;
  diedThisWeek: boolean;
}

export function annualDeathChance(age: number): number {
  if (age < 60) return 0;
  if (age < 70) return 0.002;
  if (age < 80) return 0.007;
  if (age < 90) return 0.02;
  if (age < 100) return 0.05;
  if (age < 110) return 0.12;
  if (age < 120) return 0.30;
  if (age < 125) return 0.65;
  return 1;
}

export function processLifecycle(state: GameState, previousAge: number): LifecycleResult {
  const lifecycle = state.lifecycle ?? {
    isDead: false,
    deathAge: null,
    deathWeek: null,
    deathYear: null,
    causeOfDeath: null,
  };
  if (lifecycle.isDead || state.age <= previousAge) return { lifecycle, diedThisWeek: false };

  const chance = annualDeathChance(state.age);
  if (chance <= 0 || Math.random() >= chance) return { lifecycle, diedThisWeek: false };

  const causes = state.age >= 100
    ? ['natural causes', 'age-related illness']
    : ['natural causes', 'a sudden illness', 'age-related complications'];
  const cause = causes[Math.floor(Math.random() * causes.length)];

  return {
    lifecycle: {
      isDead: true,
      deathAge: state.age,
      deathWeek: state.week,
      deathYear: state.year,
      causeOfDeath: cause,
    },
    diedThisWeek: true,
  };
}
