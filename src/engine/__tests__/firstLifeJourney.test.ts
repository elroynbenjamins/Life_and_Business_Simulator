import { INITIAL_GAME_STATE } from '../../types/game';
import { FIRST_LIFE_CASH_BUFFER, getFirstLifeJourney } from '../firstLifeJourney';

describe('first life journey', () => {
  test('starts with education as the first guided action', () => {
    const journey = getFirstLifeJourney({ ...INITIAL_GAME_STATE });
    expect(journey.visible).toBe(true);
    expect(journey.completed).toBe(0);
    expect(journey.current?.id).toBe('education');
    expect(journey.current?.route).toBe('/tabs/education');
  });

  test('reacts to the real save state without tutorial-only flags', () => {
    const studying = getFirstLifeJourney({
      ...INITIAL_GAME_STATE,
      currentCourseId: 'retail_basics',
      cash: FIRST_LIFE_CASH_BUFFER - 1,
      partTimeJob: true,
    });
    expect(studying.steps.find((step) => step.id === 'education')?.complete).toBe(true);
    expect(studying.steps.find((step) => step.id === 'student_income')?.complete).toBe(true);
    expect(studying.steps.find((step) => step.id === 'cash_buffer')?.complete).toBe(false);
    expect(studying.current?.id).toBe('cash_buffer');
  });

  test('recognizes graduation, ordered transport and a started career', () => {
    const journey = getFirstLifeJourney({
      ...INITIAL_GAME_STATE,
      cash: 5000,
      completedCourses: [{ courseId: 'retail_basics', name: 'Retail Basics', completedWeek: 13 }],
      partTimeJob: true,
      pendingCarDelivery: { carId: 'used_car', weeksRemaining: 1 },
      career: {
        ...INITIAL_GAME_STATE.career,
        companyId: 'retail_company',
        careerPathId: 'retail',
        positionLevel: 1,
      },
      week: 18,
    });
    expect(journey.steps.find((step) => step.id === 'graduate')?.complete).toBe(true);
    expect(journey.steps.find((step) => step.id === 'transport')?.complete).toBe(true);
    expect(journey.steps.find((step) => step.id === 'career')?.complete).toBe(true);
    expect(journey.current?.id).toBe('first_year');
  });

  test('retires automatically after the first in-game year', () => {
    const journey = getFirstLifeJourney({
      ...INITIAL_GAME_STATE,
      year: 2,
      week: 1,
    });
    expect(journey.visible).toBe(false);
    expect(journey.steps.find((step) => step.id === 'first_year')?.complete).toBe(true);
  });
});
