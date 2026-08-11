import { getCareerSalary, processCareerTick } from '../careerEngine';
import { CareerState, INITIAL_GAME_STATE } from '../../types/game';

const career: CareerState = {
  companyId: 'macrosoft',
  careerPathId: 'technology',
  positionLevel: 2,
  performance: 70,
  weeksInPosition: 60,
  weeksAtCompany: 60,
  salaryBonus: 3,
  lastRaiseWeek: 101,
  networkingScore: 20,
  promotionProgress: 100,
  lastPerformanceEventWeek: 101,
};

describe('career salary and promotion requirements', () => {
  test('caps salary at the current position maximum after multipliers', () => {
    // The 30% performance cap is applied to MacroSoft's company-adjusted base.
    expect(getCareerSalary(career, 1)).toBe(3_039);
  });

  test('holds an L3 promotion at 100% until the player owns an SUV', () => {
    const result = processCareerTick({
      ...INITIAL_GAME_STATE,
      currentCarId: 'sedan',
      career,
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(2);
    expect(result.updatedCareer.promotionProgress).toBe(100);
    expect(result.promotionBlockedReason).toContain('SUV');
  });

  test('allows the same promotion with an SUV', () => {
    const result = processCareerTick({
      ...INITIAL_GAME_STATE,
      currentCarId: 'suv',
      currentHousingId: 'studio_apartment',
      career,
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(3);
    expect(result.updatedCareer.promotionProgress).toBe(0);
    expect(result.promotionTitle).toBe('Senior Developer');
  });

  test('holds an L3 promotion until the player has a Studio Apartment', () => {
    const result = processCareerTick({
      ...INITIAL_GAME_STATE,
      currentCarId: 'suv',
      currentHousingId: 'cheap_apartment',
      career,
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(2);
    expect(result.promotionBlockedReason).toContain('Studio Apartment');
  });
});
