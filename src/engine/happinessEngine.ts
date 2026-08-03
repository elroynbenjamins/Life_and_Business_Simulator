import { GameState } from '../types/game';
import housingData from '../data/housing.json';
import carsData from '../data/cars.json';
import foodData from '../data/food.json';
import houseUpgradesData from '../data/house_upgrades.json';

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

  // House upgrades bonus
  for (const upgradeId of state?.houseUpgrades ?? []) {
    const upgrade = (houseUpgradesData ?? []).find((u) => u?.id === upgradeId);
    happiness += upgrade?.happiness ?? 0;
  }

  // Employment bonus
  if (state?.currentJobId) {
    happiness += 5;
  } else {
    happiness -= 15;
  }

  // Loan penalty (-3 per active loan)
  happiness -= (state?.loans?.length ?? 0) * 3;

  // Low cash penalty
  if ((state?.cash ?? 0) < 500) {
    happiness -= 10;
  }

  // Net worth bonus (calculated from cash + portfolio elsewhere)
  // We only use cash here as a simple proxy
  if ((state?.cash ?? 0) > 500000) {
    happiness += 5;
  } else if ((state?.cash ?? 0) > 100000) {
    happiness += 3;
  }

  return Math.max(0, Math.min(100, happiness));
}
