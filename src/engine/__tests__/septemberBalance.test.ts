import { INITIAL_GAME_STATE, INITIAL_PROFILE } from '../../types/game';
import { processCareerTick } from '../careerEngine';
import { canUseCareerAsset } from '../careerRequirements';
import { calculateTax } from '../financeEngine';
import { getPrestigeBonuses, getPrestigeEffects, unlockPrestige } from '../prestigeEngine';
import { createProperty, processProperties } from '../propertyEngine';
import { createBusiness, processBusinessWeek } from '../businessEngine';

describe('September gameplay regressions', () => {
  afterEach(() => jest.restoreAllMocks());
  test('an unfinished advanced course cannot unlock level 3', () => {
    const state = { ...INITIAL_GAME_STATE, currentCarId: 'sedan', currentHousingId: 'studio_apartment',
      currentCourseId: 'software_dev_advanced', courseWeeksCompleted: 3,
      completedCourses: [{ courseId: 'software_development', name: 'Software', completedWeek: 1 }],
      career: { ...INITIAL_GAME_STATE.career, companyId: 'career_employer', careerPathId: 'technology', positionLevel: 2, promotionProgress: 100, lastPerformanceEventWeek: 100, lastRaiseWeek: 100 } };
    expect(processCareerTick(state, 100).updatedCareer.positionLevel).toBe(2);
    expect(processCareerTick(state, 100).promotionBlockedReason).toContain('Advanced');
    state.completedCourses.push({ courseId: 'software_dev_advanced', name: 'Advanced', completedWeek: 100 });
    expect(processCareerTick(state, 100).updatedCareer.positionLevel).toBe(3);
  });
  test.each([1, 2, 3, 4, 5, 6, 7])('enforces career asset floors for level %i', level => {
    const state = { ...INITIAL_GAME_STATE, career: { ...INITIAL_GAME_STATE.career, companyId: 'career_employer', positionLevel: level } };
    const houses = ['cheap_apartment', 'studio_apartment', 'small_house', 'family_house', 'luxury_villa'];
    const required = level >= 7 ? 4 : level >= 6 ? 3 : level >= 5 ? 2 : level >= 3 ? 1 : 0;
    expect(canUseCareerAsset(state, 'housing', houses[required])).toBe(true);
    if (required) expect(canUseCareerAsset(state, 'housing', houses[required - 1])).toBe(false);
    expect(canUseCareerAsset(state, 'car', 'none')).toBe(false);
    expect(canUseCareerAsset(state, 'car', level >= 5 ? 'suv' : level >= 3 ? 'sedan' : 'used_car')).toBe(true);
  });
  test.each([[1, 600], [2, 600], [3, 400], [4, 200], [5, 0]])('level %i tax relief equals %i on 20k earnings', (level, relief) => {
    expect(calculateTax(20000, 1, level)).toBe(calculateTax(20000) - relief);
  });
  test('final rental tier costs PP plus 5 gems and rent uses the highest tier', () => {
    const ids = ['skill_growth', 'skill_growth_2', 'skill_growth_3', 'skill_growth_4'];
    const profile = { ...INITIAL_PROFILE, prestigePoints: 500, gems: 4, unlockedPrestige: ids };
    expect(unlockPrestige(profile, 'skill_growth_5')).toBeNull();
    const unlocked = unlockPrestige({ ...profile, gems: 5 }, 'skill_growth_5')!;
    expect(unlocked.gems).toBe(0);
    expect(unlocked.prestigePoints).toBe(365);
    const effects = getPrestigeEffects(unlocked);
    expect(effects.property_income).toBe(0.1);
    expect(effects.skill_growth).toBeUndefined();
    const property = { ...createProperty('studio', 1, 1, 1)!, weeklyIncome: 100, weeklyMaintenance: 0, isRentedOut: true };
    expect(processProperties([property], 2, effects.property_income).totalIncome).toBe(220);
  });
  test('expanded prestige tiers use the current gem costs', () => {
    const bonuses = getPrestigeBonuses();
    for (const bonus of bonuses) {
      const hasChild = bonuses.some(other => (Array.isArray(other.requires) ? other.requires : [other.requires]).includes(bonus.id));
      if (bonus.tier === 3) expect(bonus.gemCost).toBe(10);
      else if (bonus.tier === 4) expect(bonus.gemCost).toBe(25);
      else expect(bonus.gemCost ?? 0).toBe(hasChild ? 0 : 5);
    }
  });
  function staffedBusiness() {
    const business = createBusiness('coffee_shop', null, 1, 1, 1)!;
    business.employees = Array.from({ length: 3 }, (_, i) => ({ id: String(i), name: 'Worker', roleId: 'worker', weeklySalary: 400, skill: 50, potential: 80, morale: 60, age: 25, experience: 0, weeksEmployed: 0 }));
    business.balance = 50000;
    return business;
  }
  test('startup support ends after business week 75, not player week 75', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const business = staffedBusiness();
    business.foundedYear = 8;
    business.foundedWeek = 1;
    const supported = processBusinessWeek(business, 1, 16, 11);
    const expired = processBusinessWeek({ ...business, foundedWeek: 0 }, 1, 16, 11);
    expect(supported.updatedBusiness.lastExpenseBreakdown?.salaries).toBe(1140);
    expect(expired.updatedBusiness.lastExpenseBreakdown?.salaries).toBe(1200);
    expect(supported.weeklyRevenue).toBe(Math.round(expired.weeklyRevenue * 1.03));
  });
  test('competition changes balance and profit history consistently', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const business = staffedBusiness();
    const result = processBusinessWeek(business, 1, 2, 1, { competitorRevenueMultipliers: { [business.id]: 0.7 } });
    expect(result.updatedBusiness.balance - business.balance).toBe(result.weeklyProfit - result.playerDividend + result.taxRefund);
    expect(result.updatedBusiness.weeklyProfitHistory?.slice(-1)[0]).toBe(result.weeklyProfit);
    expect(result.updatedBusiness.weeklyRevenueHistory?.slice(-1)[0]).toBe(result.weeklyRevenue);
  });
});
