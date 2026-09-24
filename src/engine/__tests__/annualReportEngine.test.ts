import {
  appendAnnualReport,
  MAX_ANNUAL_REPORTS,
  MAX_PINNED_ACHIEVEMENT_GOALS,
  pruneCompletedAchievementGoals,
  togglePinnedAchievementGoal,
} from '../annualReportEngine';
import { PeriodReport } from '../../types/game';

function report(toWeek: number): PeriodReport {
  return {
    fromWeek: Math.max(1, toWeek - 19),
    toWeek,
    totalIncome: 1000,
    totalExpenses: 500,
    totalTax: 100,
    weeksEmployed: 20,
    weeksUnemployed: 0,
    jobChanges: 0,
    coursesCompleted: 0,
    stocksPurchased: 0,
    loansTaken: 0,
    loansRepaid: 0,
    currentCash: 5000,
    currentNetWorth: 10000,
    currentHappiness: 50,
    achievementsUnlocked: 1,
    totalRealizedProfitLoss: 0,
    totalUnrealizedProfitLoss: 0,
    totalDividends: 0,
  };
}

describe('passive annual reports and pinned goals', () => {
  test('annual history keeps newest first, deduplicates the same year and caps at ten', () => {
    let history: PeriodReport[] = [];
    for (let year = 1; year <= 12; year++) {
      history = appendAnnualReport(history, report(year * 20));
    }

    expect(history).toHaveLength(MAX_ANNUAL_REPORTS);
    expect(history[0].toWeek).toBe(240);
    expect(history[history.length - 1].toWeek).toBe(60);

    const replacement = { ...report(240), currentNetWorth: 999999 };
    history = appendAnnualReport(history, replacement);
    expect(history).toHaveLength(MAX_ANNUAL_REPORTS);
    expect(history[0].currentNetWorth).toBe(999999);
    expect(history.filter((item) => item.toWeek === 240)).toHaveLength(1);
  });

  test('players can pin up to three achievement goals and always unpin', () => {
    let goals: string[] = [];
    for (const id of ['a', 'b', 'c']) {
      const result = togglePinnedAchievementGoal(goals, id);
      expect(result.changed).toBe(true);
      goals = result.goals;
    }

    expect(goals).toHaveLength(MAX_PINNED_ACHIEVEMENT_GOALS);
    expect(togglePinnedAchievementGoal(goals, 'd')).toEqual({ goals, changed: false });

    const removed = togglePinnedAchievementGoal(goals, 'b');
    expect(removed.changed).toBe(true);
    expect(removed.goals).toEqual(['a', 'c']);
  });

  test('completed goals are removed from the active pinned-goal list', () => {
    expect(pruneCompletedAchievementGoals(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
    expect(pruneCompletedAchievementGoals(['a', 'b', 'c', 'd'], [])).toEqual(['a', 'b', 'c']);
  });
});
