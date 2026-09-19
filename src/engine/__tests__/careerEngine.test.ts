import { getCareerSalary, processCareerTick } from '../careerEngine';
import { CareerState, INITIAL_GAME_STATE } from '../../types/game';
import careerPaths from '../../data/career_paths.json';
import courses from '../../data/courses.json';
const qualifiedState = { ...INITIAL_GAME_STATE, completedCourses: courses.map(course => ({ courseId: course.id, name: course.name, completedWeek: 1 })) };

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
  test('every promotion increases the position base salary', () => {
    for (const path of careerPaths) {
      for (let index = 1; index < path.positions.length; index += 1) {
        expect(path.positions[index].baseSalary).toBeGreaterThan(path.positions[index - 1].baseSalary);
      }
    }
  });

  test('caps performance salary raises at five 3% increases per level', () => {
    expect(getCareerSalary(career, 1)).toBe(2_843);
    expect(getCareerSalary({ ...career, performanceRaisesAtLevel: 50 }, 2)).toBe(5_686);
  });

  test('allows an L3 promotion with a Sedan and Studio Apartment', () => {
    const result = processCareerTick({
      ...qualifiedState,
      currentCarId: 'sedan',
      currentHousingId: 'studio_apartment',
      career,
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(3);
    expect(result.updatedCareer.promotionProgress).toBe(0);
  });

  test('holds an L3 promotion when the player only owns a Used Car', () => {
    const result = processCareerTick({
      ...qualifiedState,
      currentCarId: 'used_car',
      currentHousingId: 'studio_apartment',
      career,
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(2);
    expect(result.updatedCareer.promotionProgress).toBe(100);
    expect(result.promotionBlockedReason).toContain('Sedan');
  });

  test('holds an L3 promotion until the player has a Studio Apartment', () => {
    const result = processCareerTick({
      ...qualifiedState,
      currentCarId: 'suv',
      currentHousingId: 'cheap_apartment',
      career,
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(2);
    expect(result.promotionBlockedReason).toContain('Studio Apartment');
  });

  test('holds an L6 promotion until the player has a Family House', () => {
    const result = processCareerTick({
      ...qualifiedState,
      currentCarId: 'suv',
      currentHousingId: 'small_house',
      career: { ...career, careerPathId: 'sales', positionLevel: 5 },
    }, 101);

    expect(result.updatedCareer.positionLevel).toBe(5);
    expect(result.promotionBlockedReason).toContain('Family House');
  });
});
