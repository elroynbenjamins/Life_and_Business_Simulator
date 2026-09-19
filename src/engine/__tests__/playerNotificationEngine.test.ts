import { INITIAL_CAREER_STATE } from '../../types/game';
import { getEducationAvailabilityNotice, getPromotionAssetNotice } from '../playerNotificationEngine';

describe('player notification indicators', () => {
  test('shows an advanced education when its prerequisite, experience and cost are met', () => {
    const notice = getEducationAvailabilityNotice({
      currentCourseId: null,
      completedCourses: [{ courseId: 'retail_basics', name: 'Retail Basics', completedWeek: 20 }],
      weeksEmployed: 75,
      cash: 100_000,
      inflationMultiplier: 1,
    });
    expect(notice.available).toBe(true);
    expect(notice.level).toBe(2);
  });

  test('does not show education notification while already studying', () => {
    const notice = getEducationAvailabilityNotice({
      currentCourseId: 'retail_advanced',
      completedCourses: [{ courseId: 'retail_basics', name: 'Retail Basics', completedWeek: 20 }],
      weeksEmployed: 75,
      cash: 100_000,
      inflationMultiplier: 1,
    });
    expect(notice.available).toBe(false);
  });

  test('warns when promotion is ready but the required car is missing', () => {
    const notice = getPromotionAssetNotice({
      career: { ...INITIAL_CAREER_STATE, companyId: 'career_employer', careerPathId: 'retail', positionLevel: 2, promotionProgress: 100 },
      completedCourses: [
        { courseId: 'retail_basics', name: 'Retail Basics', completedWeek: 20 },
        { courseId: 'retail_advanced', name: 'Retail Advanced', completedWeek: 90 },
      ],
      currentCarId: 'used_car',
      currentHousingId: 'studio_apartment',
    });
    expect(notice.blocked).toBe(true);
    expect(notice.message).toContain('Sedan');
  });

  test('warns when promotion is ready but the required housing is missing', () => {
    const notice = getPromotionAssetNotice({
      career: { ...INITIAL_CAREER_STATE, companyId: 'career_employer', careerPathId: 'retail', positionLevel: 2, promotionProgress: 100 },
      completedCourses: [
        { courseId: 'retail_basics', name: 'Retail Basics', completedWeek: 20 },
        { courseId: 'retail_advanced', name: 'Retail Advanced', completedWeek: 90 },
      ],
      currentCarId: 'sedan',
      currentHousingId: 'cheap_apartment',
    });
    expect(notice.blocked).toBe(true);
    expect(notice.message).toContain('Studio Apartment');
  });
});
