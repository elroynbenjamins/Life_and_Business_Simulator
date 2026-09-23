import type { GameState, StudentWorkTier } from '../types/game';

export interface StudentWorkOption {
  id: StudentWorkTier;
  name: string;
  shortName: string;
  minWeeklyIncome: number;
  maxWeeklyIncome: number;
  studyDurationMultiplier: number;
  description: string;
}

export const STUDENT_WORK_OPTIONS: Record<StudentWorkTier, StudentWorkOption> = {
  flexible: {
    id: 'flexible',
    name: 'Flexible Part-Time Job',
    shortName: 'Flexible Part-Time',
    minWeeklyIncome: 275,
    maxWeeklyIncome: 425,
    studyDurationMultiplier: 1.25,
    description: 'Lower hours and flexible shifts. Helps with bills while keeping education relatively quick.',
  },
  high_hours: {
    id: 'high_hours',
    name: 'High-Hours Part-Time Job',
    shortName: 'High-Hours Part-Time',
    minWeeklyIncome: 650,
    maxWeeklyIncome: 800,
    studyDurationMultiplier: 1.60,
    description: 'More weekly shifts and reliable student income. Designed to cover starter living costs and leave room to save, at the cost of much slower study.',
  },
};

export function getStudentWorkTier(state: Pick<GameState, 'partTimeJob' | 'studentWorkTier'>): StudentWorkTier | null {
  if (!state.partTimeJob) return null;
  return state.studentWorkTier === 'high_hours' ? 'high_hours' : 'flexible';
}

export function getStudentWorkOption(tier: StudentWorkTier | null | undefined): StudentWorkOption | null {
  return tier ? STUDENT_WORK_OPTIONS[tier] : null;
}

export function getStudentStudyDuration(baseDuration: number, tier: StudentWorkTier | null | undefined): number {
  const option = getStudentWorkOption(tier);
  return option ? Math.ceil(Math.max(1, baseDuration) * option.studyDurationMultiplier) : Math.max(1, baseDuration);
}

export function rollStudentWorkIncome(tier: StudentWorkTier | null | undefined, randomValue = Math.random()): number {
  const option = getStudentWorkOption(tier);
  if (!option) return 0;
  const clamped = Math.max(0, Math.min(0.999999, randomValue));
  return Math.floor(option.minWeeklyIncome + clamped * (option.maxWeeklyIncome - option.minWeeklyIncome + 1));
}

export function averageStudentWorkIncome(tier: StudentWorkTier | null | undefined): number {
  const option = getStudentWorkOption(tier);
  return option ? Math.round((option.minWeeklyIncome + option.maxWeeklyIncome) / 2) : 0;
}
