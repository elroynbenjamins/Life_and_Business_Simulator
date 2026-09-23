import { GameState } from '../types/game';

export type FirstLifeStepId =
  | 'education'
  | 'student_income'
  | 'cash_buffer'
  | 'graduate'
  | 'transport'
  | 'career'
  | 'first_year';

export type FirstLifeRoute = '/tabs/education' | '/tabs/career' | '/tabs/statistics' | '/housing';

export interface FirstLifeStep {
  id: FirstLifeStepId;
  title: string;
  detail: string;
  actionLabel: string;
  route?: FirstLifeRoute;
  complete: boolean;
}

export interface FirstLifeJourney {
  visible: boolean;
  completed: number;
  total: number;
  current: FirstLifeStep | null;
  steps: FirstLifeStep[];
}

export type FirstLifeJourneyState = Pick<
  GameState,
  | 'year'
  | 'week'
  | 'cash'
  | 'currentCourseId'
  | 'completedCourses'
  | 'partTimeJob'
  | 'currentJobId'
  | 'career'
  | 'currentCarId'
  | 'pendingCarDelivery'
>;

export const FIRST_LIFE_CASH_BUFFER = 3000;

function hasFullTimeCareer(state: FirstLifeJourneyState): boolean {
  return Boolean(state.currentJobId || state.career?.companyId);
}

function hasTransport(state: FirstLifeJourneyState): boolean {
  return Boolean(
    (state.currentCarId && state.currentCarId !== 'none')
    || state.pendingCarDelivery?.carId
  );
}

/**
 * Starter guidance is intentionally derived from normal save state.
 * It never grants rewards, blocks actions, or stores tutorial-only progression.
 */
export function getFirstLifeJourney(state: FirstLifeJourneyState): FirstLifeJourney {
  const completedCourses = state.completedCourses ?? [];
  const educationChosen = Boolean(state.currentCourseId) || completedCourses.length > 0;
  const graduated = completedCourses.length > 0;
  const hasIncome = Boolean(state.partTimeJob) || hasFullTimeCareer(state);
  const cashBufferReady = educationChosen && (state.cash ?? 0) >= FIRST_LIFE_CASH_BUFFER;
  const transportReady = hasTransport(state) || hasFullTimeCareer(state);
  const careerStarted = hasFullTimeCareer(state);
  const firstYearComplete = (state.year ?? 1) >= 2;

  const steps: FirstLifeStep[] = [
    {
      id: 'education',
      title: 'Choose your education',
      detail: 'Pick a Basic course that matches the career direction you want to explore first.',
      actionLabel: 'Open Education',
      route: '/tabs/education',
      complete: educationChosen,
    },
    {
      id: 'student_income',
      title: 'Set up student income',
      detail: 'Choose Flexible Part-Time for lighter hours or High-Hours Part-Time for stronger tax-free income and slower education.',
      actionLabel: 'View Work Options',
      route: '/tabs/career',
      complete: hasIncome,
    },
    {
      id: 'cash_buffer',
      title: 'Keep a €3,000 cash buffer',
      detail: (state.cash ?? 0) >= FIRST_LIFE_CASH_BUFFER
        ? 'You have a basic emergency reserve for weekly costs and surprises.'
        : `Build your available cash back to €${FIRST_LIFE_CASH_BUFFER.toLocaleString()} before adding optional spending.`,
      actionLabel: 'Review Cash Flow',
      route: '/tabs/statistics',
      complete: cashBufferReady,
    },
    {
      id: 'graduate',
      title: 'Complete your first course',
      detail: state.currentCourseId
        ? 'Advance weeks until your Basic course finishes and unlocks its matching career path.'
        : 'Complete one Basic course to unlock your first career path.',
      actionLabel: 'Open Education',
      route: '/tabs/education',
      complete: graduated,
    },
    {
      id: 'transport',
      title: 'Prepare career transport',
      detail: state.pendingCarDelivery
        ? 'Your vehicle is ordered and will arrive after you advance one week.'
        : 'Entry-level career positions require a Used Car or better. Vehicle delivery takes one week.',
      actionLabel: 'Open Lifestyle',
      route: '/housing',
      complete: transportReady,
    },
    {
      id: 'career',
      title: 'Start your career',
      detail: 'Apply for the career path unlocked by your completed Basic education once its requirements are ready.',
      actionLabel: 'Open Career',
      route: '/tabs/career',
      complete: careerStarted,
    },
    {
      id: 'first_year',
      title: 'Complete Year 1',
      detail: `Reach the end of Week 20 to receive your first annual financial report. You are currently in Week ${Math.max(1, state.week ?? 1)}.`,
      actionLabel: 'Keep Building',
      complete: firstYearComplete,
    },
  ];

  const completed = steps.filter((step) => step.complete).length;
  const current = steps.find((step) => !step.complete) ?? null;

  return {
    visible: !firstYearComplete,
    completed,
    total: steps.length,
    current,
    steps,
  };
}
