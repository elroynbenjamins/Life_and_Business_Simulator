import { PeriodReport } from '../types/game';

export const MAX_ANNUAL_REPORTS = 10;
export const MAX_PINNED_ACHIEVEMENT_GOALS = 3;

export function appendAnnualReport(history: PeriodReport[] = [], report: PeriodReport): PeriodReport[] {
  return [report, ...history.filter((item) => item.toWeek !== report.toWeek)].slice(0, MAX_ANNUAL_REPORTS);
}

export function togglePinnedAchievementGoal(
  current: string[] = [],
  achievementId: string,
): { goals: string[]; changed: boolean } {
  if (current.includes(achievementId)) {
    return {
      goals: current.filter((id) => id !== achievementId),
      changed: true,
    };
  }
  if (current.length >= MAX_PINNED_ACHIEVEMENT_GOALS) {
    return { goals: current, changed: false };
  }
  return { goals: [...current, achievementId], changed: true };
}

export function pruneCompletedAchievementGoals(
  goals: string[] = [],
  unlockedAchievementIds: string[] = [],
): string[] {
  const unlocked = new Set(unlockedAchievementIds);
  return goals.filter((id) => !unlocked.has(id)).slice(0, MAX_PINNED_ACHIEVEMENT_GOALS);
}
