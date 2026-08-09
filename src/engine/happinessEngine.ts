import { GameState } from '../types/game';
import housingData from '../data/housing.json';
import carsData from '../data/cars.json';
import foodData from '../data/food.json';
// house upgrades removed
import coursesData from '../data/courses.json';

export function calculateHappiness(state: GameState): number {
  let happiness = 30; // base

  // Housing bonus
  const housing = (housingData ?? []).find((h) => h?.id === state?.currentHousingId);
  happiness += housing?.happiness ?? 0;

  // Car bonus
  const car = (carsData ?? []).find((c) => c?.id === state?.currentCarId);
  happiness += car?.happiness ?? 0;

  // Food bonus
  const food = (foodData ?? []).find((f) => f?.id === state?.foodLevel);
  happiness += food?.happiness ?? 0;

  // House upgrades removed

  // Employment bonus (career v2 or legacy)
  const hasCareerV2 = !!state?.career?.companyId;
  if (hasCareerV2 || state?.currentJobId) {
    happiness += 5;
    // Company culture bonus
    if (state?.career?.companyId) {
      const companiesData = require('../data/companies.json') as any[];
      const company = (companiesData ?? []).find((c: any) => c?.id === state.career.companyId);
      if (company?.culture) happiness += Math.min(5, Math.floor((company.culture ?? 0) / 2));
    }
    // Performance bonus
    if ((state?.career?.performance ?? 50) >= 75) happiness += 3;
  } else {
    happiness -= 15;
  }

  // Property ownership bonus
  const propCount = state?.properties?.length ?? 0;
  if (propCount > 0) {
    happiness += Math.min(8, propCount * 2);
  }

  // Studying stress: advanced (level 2) or expert (level 3) courses reduce happiness
  if (state?.currentCourseId) {
    const course = (coursesData ?? []).find((c) => c?.id === state.currentCourseId);
    const level = course?.level ?? 1;
    if (level >= 3) {
      happiness -= 12; // expert: high stress
    } else if (level >= 2) {
      happiness -= 8; // advanced: moderate stress
    }
  }

  // Loan penalty (-3 per active loan)
  happiness -= (state?.loans?.length ?? 0) * 3;

  // Low cash penalty
  if ((state?.cash ?? 0) < 500) {
    happiness -= 10;
  }

  // Negative cash extra penalty
  if ((state?.cash ?? 0) < 0) {
    happiness -= 5;
  }

  // Cash reserves bonus (scaled)
  const cash = state?.cash ?? 0;
  if (cash > 500000) {
    happiness += 8;
  } else if (cash > 100000) {
    happiness += 5;
  } else if (cash > 50000) {
    happiness += 3;
  } else if (cash > 10000) {
    happiness += 1;
  }

  // Business ownership bonus
  const bizCount = state?.businesses?.length ?? 0;
  if (bizCount > 0) {
    happiness += Math.min(10, bizCount * 3); // up to +10 for owning businesses
    const anyProfitable = (state?.businesses ?? []).some((b) => (b?.lastWeekProfit ?? 0) > 0);
    if (anyProfitable) happiness += 3;
    const anyLosing = (state?.businesses ?? []).some((b) => (b?.lastWeekProfit ?? 0) < -500);
    if (anyLosing) happiness -= 5;
  }

  // Temporary happiness effects from life events
  for (const effect of state?.tempHappinessEffects ?? []) {
    happiness += effect?.amount ?? 0;
  }

  return Math.max(0, Math.min(100, happiness));
}
