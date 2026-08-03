import { GameState, WeekSummary } from '../types/game';
import { updateStockPrices } from './stockEngine';
import { generateNewsEvent } from './newsEngine';
import { getWeeklySalary, getWeeklyRent, getNetWorth } from './financeEngine';
import coursesData from '../data/courses.json';

export function weeklyTick(state: GameState): { newState: GameState; summary: WeekSummary } {
  const news = generateNewsEvent();
  const salary = getWeeklySalary(state);
  const rent = getWeeklyRent(state);

  let newCash = (state?.cash ?? 0) + salary - rent;
  let newWeek = (state?.week ?? 0) + 1;
  let newYear = state?.year ?? 1;
  let newAge = state?.age ?? 22;

  if (newWeek > 52) {
    newWeek = 1;
    newYear += 1;
    newAge += 1;
  }

  // Update stocks
  const newStocks = updateStockPrices(state?.stocks ?? [], news?.effects ?? {});

  // Stock changes for summary
  const stockChanges = (newStocks ?? []).map((ns) => {
    const old = (state?.stocks ?? []).find((s) => s?.ticker === ns?.ticker);
    const oldPrice = old?.currentPrice ?? ns?.currentPrice;
    return {
      ticker: ns?.ticker ?? '',
      change: oldPrice > 0 ? ((ns?.currentPrice ?? 0) - oldPrice) / oldPrice * 100 : 0,
    };
  });

  // Course progress
  let courseProgress: string | null = null;
  let newCourseId = state?.currentCourseId ?? null;
  let newCourseWeeks = state?.courseWeeksCompleted ?? 0;
  let newCompletedCourses = [...(state?.completedCourses ?? [])];

  if (newCourseId) {
    newCourseWeeks += 1;
    const courseData = (coursesData ?? []).find((c) => c?.id === newCourseId);
    const duration = courseData?.duration ?? 1;
    const courseName = courseData?.name ?? 'Course';

    if (newCourseWeeks >= duration) {
      newCompletedCourses.push({
        courseId: newCourseId,
        name: courseName,
        completedWeek: newWeek,
      });
      courseProgress = `${courseName} completed!`;
      newCourseId = null;
      newCourseWeeks = 0;
    } else {
      courseProgress = `${courseName}: Week ${newCourseWeeks}/${duration}`;
    }
  }

  // Net worth history
  const tempState: GameState = {
    ...(state ?? {}),
    cash: newCash,
    stocks: newStocks,
    week: newWeek,
    year: newYear,
    age: newAge,
    currentCourseId: newCourseId,
    courseWeeksCompleted: newCourseWeeks,
    completedCourses: newCompletedCourses,
    currentHeadline: news?.headline ?? '',
    initialized: true,
  };
  const nw = getNetWorth(tempState);
  const netWorthHist = [...(state?.netWorthHistory ?? [])];
  netWorthHist.push(nw);
  if (netWorthHist.length > 52) netWorthHist.shift();

  const newState: GameState = {
    ...tempState,
    netWorthHistory: netWorthHist,
  };

  const summary: WeekSummary = {
    salaryEarned: salary,
    rentPaid: rent,
    stockChanges,
    courseProgress,
    headline: news?.headline ?? '',
    newWeek,
  };

  return { newState, summary };
}
