import { INITIAL_GAME_STATE } from '../../types/game';
import {
  STUDENT_WORK_OPTIONS,
  averageStudentWorkIncome,
  getStudentStudyDuration,
  getStudentWorkTier,
  rollStudentWorkIncome,
} from '../studentWork';

describe('student work options', () => {
  test('legacy part-time saves map to the flexible tier', () => {
    expect(getStudentWorkTier({ ...INITIAL_GAME_STATE, partTimeJob: true, studentWorkTier: null })).toBe('flexible');
  });

  test('high-hours work pays enough to cover starter living costs with room to save', () => {
    const high = STUDENT_WORK_OPTIONS.high_hours;
    const starterBillsWithUsedCar = 300 + 45 + 50 + 150;
    expect(high.minWeeklyIncome).toBeGreaterThan(starterBillsWithUsedCar);
    expect(averageStudentWorkIncome('high_hours')).toBeGreaterThan(high.minWeeklyIncome);
  });

  test('study trade-offs are 25% for flexible and 60% for high-hours work', () => {
    expect(getStudentStudyDuration(20, 'flexible')).toBe(25);
    expect(getStudentStudyDuration(20, 'high_hours')).toBe(32);
    expect(getStudentStudyDuration(20, null)).toBe(20);
  });

  test('weekly pay stays inside each configured tax-free range', () => {
    expect(rollStudentWorkIncome('flexible', 0)).toBe(275);
    expect(rollStudentWorkIncome('flexible', 0.999999)).toBe(425);
    expect(rollStudentWorkIncome('high_hours', 0)).toBe(650);
    expect(rollStudentWorkIncome('high_hours', 0.999999)).toBe(800);
  });
});
