import { GameState, WeekSummary, ActiveLoan } from '../types/game';
import { updateStockPrices } from './stockEngine';
import { generateNewsEvent } from './newsEngine';
import { getWeeklySalary, getWeeklyRent, getWeeklyCarCost, getWeeklyFoodCost, getWeeklyCourseCost, getNetWorth, calculateTax } from './financeEngine';
import { calculateHappiness } from './happinessEngine';
import { checkAchievements } from './achievementEngine';
import coursesData from '../data/courses.json';

export function weeklyTick(state: GameState): { newState: GameState; summary: WeekSummary } {
  const news = generateNewsEvent();
  const salary = getWeeklySalary(state);
  const rent = getWeeklyRent(state);
  const carCost = getWeeklyCarCost(state);
  const foodCost = getWeeklyFoodCost(state);
  const courseCost = getWeeklyCourseCost(state);

  // Process loan payments
  let loanPayments = 0;
  let newLoans: ActiveLoan[] = [];
  for (const loan of state?.loans ?? []) {
    const payment = loan?.weeklyPayment ?? 0;
    loanPayments += payment;
    const remaining = (loan?.remainingAmount ?? 0) - payment;
    const weeksLeft = (loan?.weeksRemaining ?? 1) - 1;
    if (weeksLeft > 0 && remaining > 0) {
      newLoans.push({ ...loan, remainingAmount: Math.max(0, remaining), weeksRemaining: weeksLeft });
    }
  }

  const totalExpenses = rent + carCost + foodCost + courseCost + loanPayments;
  let newCash = (state?.cash ?? 0) + salary - totalExpenses;

  let newWeek = (state?.week ?? 0) + 1;
  let newYear = state?.year ?? 1;
  let newAge = state?.age ?? 22;
  if (newWeek > 52) {
    newWeek = 1;
    newYear += 1;
    newAge += 1;
  }

  // Track work experience
  let newTotalWeeksWorked = state?.totalWeeksWorked ?? 0;
  if (state?.currentJobId) {
    newTotalWeeksWorked += 1;
  }

  // Track earnings for tax
  let newEarningsSinceLastTax = (state?.earningsSinceLastTax ?? 0) + salary;

  // Tax every 20 weeks
  const isTaxWeek = newWeek % 20 === 0 && newWeek > 0;
  let taxAmount = 0;
  let newTotalTaxPaid = state?.totalTaxPaid ?? 0;
  if (isTaxWeek) {
    taxAmount = calculateTax(newEarningsSinceLastTax);
    newCash -= taxAmount;
    newTotalTaxPaid += taxAmount;
    newEarningsSinceLastTax = 0;
  }

  // Update stocks
  const newStocks = updateStockPrices(state?.stocks ?? [], news?.effects ?? {});
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
      newCompletedCourses.push({ courseId: newCourseId, name: courseName, completedWeek: newWeek });
      courseProgress = `${courseName} completed!`;
      newCourseId = null;
      newCourseWeeks = 0;
    } else {
      courseProgress = `${courseName}: Week ${newCourseWeeks}/${duration}`;
    }
  }

  // Build temp state
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
    loans: newLoans,
    totalWeeksWorked: newTotalWeeksWorked,
    earningsSinceLastTax: newEarningsSinceLastTax,
    totalTaxPaid: newTotalTaxPaid,
    initialized: true,
  };

  // Calculate happiness
  const happiness = calculateHappiness(tempState);
  tempState.happiness = happiness;

  // Check achievements
  const nw = getNetWorth(tempState);
  const newAchievements = checkAchievements(tempState, nw, salary);
  tempState.unlockedAchievements = [...(tempState?.unlockedAchievements ?? []), ...newAchievements];

  // Net worth history
  const netWorthHist = [...(state?.netWorthHistory ?? [])];
  netWorthHist.push(nw);
  if (netWorthHist.length > 52) netWorthHist.shift();
  tempState.netWorthHistory = netWorthHist;

  const summary: WeekSummary = {
    salaryEarned: salary,
    rentPaid: rent,
    foodCost,
    carCost,
    courseCost,
    loanPayments,
    stockChanges,
    courseProgress,
    headline: news?.headline ?? '',
    newWeek,
    happiness,
    newAchievements,
    isTaxWeek,
    taxAmount,
    earningsForTaxPeriod: isTaxWeek ? (state?.earningsSinceLastTax ?? 0) + salary : 0,
  };

  return { newState: tempState, summary };
}
