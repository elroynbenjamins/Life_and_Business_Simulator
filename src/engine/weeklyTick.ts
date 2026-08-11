import { GameState, WeekSummary, LifetimeStatistics, INITIAL_STATISTICS, INITIAL_CAREER_STATE, TriggeredEvent, TempHappinessEffect, PendingInvestment } from '../types/game';
import { processEconomy } from './economyEngine';
import { processNews } from './newsEngine';
import { processStocks, rollMarketSentiment, rollMarketEvent, processDividends } from './stockEngine';
import { processEducation } from './educationEngine';
import { processJobs } from './jobEngine';
import { processIncome, processExpenses, processLoans, processTaxes, getNetWorth, getPortfolioValue, isSalaryReduced } from './financeEngine';
import { calculateHappiness } from './happinessEngine';
import { checkAchievements } from './achievementEngine';
// Life events removed
import { calculateValuation, processAllBusinesses } from './businessEngine';
import { processSkillGrowth, applyEducationRewards } from './skillEngine';
import { processCareerTick, getCareerSalary } from './careerEngine';
import { processProperties } from './propertyEngine';
import { processCompetitors } from './competitorEngine';

/**
 * Deterministic weekly tick pipeline with all systems.
 * Aging: every 20 weeks = 1 year.
 */
export function weeklyTick(state: GameState): { newState: GameState; summary: WeekSummary } {
  // ---------- Step 1: Advance Clock ----------
  let newWeek = (state?.week ?? 0) + 1;
  let newYear = state?.year ?? 1;
  let newAge = state?.age ?? 20;
  // Every 20 weeks = 1 year
  if (newWeek > 20) {
    newWeek = 1;
    newYear += 1;
    newAge += 1;
  }
  const globalWeek = ((newYear - 1) * 20) + newWeek;
  const partTimeActive = !!state?.partTimeJob && !state?.currentJobId && !state?.career?.companyId;

  // ---------- Step 2: Economy (Inflation) ----------
  const economy = processEconomy(state, newWeek);
  const stateWithInflation: GameState = {
    ...(state ?? ({} as GameState)),
    inflationMultiplier: economy.inflationMultiplier,
    week: newWeek,
    year: newYear,
    age: newAge,
  };

  // ---------- Step 2.5: Market Sentiment & Events ----------
  const newSentiment = rollMarketSentiment(globalWeek, state?.activeMarketSentiment ?? null);
  const { updatedEvents: newMarketEvents, newEvent: newMarketEvent } = rollMarketEvent(state?.activeMarketEvents ?? []);
  stateWithInflation.activeMarketSentiment = newSentiment;
  stateWithInflation.activeMarketEvents = newMarketEvents;

  // ---------- Step 3: News ----------
  const news = processNews();

  // ---------- Step 4: Stocks ----------
  const stockResult = processStocks(stateWithInflation, news);

  // ---------- Step 4.5: Dividends ----------
  const dividendIncome = processDividends({ ...stateWithInflation, stocks: stockResult.stocks }, globalWeek);

  // ---------- Step 5: Education ----------
  const edu = processEducation(stateWithInflation, newWeek, partTimeActive);

  // ---------- Step 5.5: Apply Education Rewards ----------
  let updatedSkills = { ...(state?.skills ?? {}) };
  let updatedKnowledge = { ...(state?.knowledge ?? {}) };
  if (edu.justCompleted && edu.completedCourseData) {
    const rewards = applyEducationRewards(updatedSkills, updatedKnowledge, edu.completedCourseData);
    updatedSkills = rewards.updatedSkills;
    updatedKnowledge = rewards.updatedKnowledge;
  }

  // ---------- Step 6: Jobs (legacy) ----------
  const jobs = processJobs(stateWithInflation);

  // ---------- Step 6.5: Career v2 Processing ----------
  const careerTick = processCareerTick({ ...stateWithInflation, skills: updatedSkills, knowledge: updatedKnowledge }, globalWeek);

  // ---------- Step 6.6: Skill Growth from Work ----------
  let skillGains: Record<string, number> = {};
  if (careerTick.updatedCareer.companyId) {
    const sg = processSkillGrowth(updatedSkills, careerTick.updatedCareer, updatedKnowledge);
    updatedSkills = sg.updatedSkills;
    updatedKnowledge = sg.updatedKnowledge;
    skillGains = sg.gains;
  }

  // ---------- Step 7: Competitor AI ----------
  const compResult = processCompetitors(
    state?.businesses ?? [],
    state?.competitors ?? {},
    globalWeek
  );

  // ---------- Step 8: Income ----------
  const salaryReduced = isSalaryReduced(stateWithInflation);
  const legacyIncome = processIncome(stateWithInflation);
  const hasCareerV2 = !!careerTick.updatedCareer.companyId;
  const salary = hasCareerV2 ? careerTick.salary : legacyIncome.salary;

  // ---------- Step 9: Expenses ----------
  const expenses = processExpenses(stateWithInflation);

  // ---------- Step 10: Loans ----------
  const loanResult = processLoans(stateWithInflation);

  // ---------- Step 11: Taxes ----------
  const taxes = processTaxes(stateWithInflation, salary, globalWeek);

  // ---------- Step 11.5: Part-Time Income ----------
  const partTimeIncome = partTimeActive ? Math.round(100 + Math.random() * 100) : 0;

  // ---------- Step 12: Cash Settlement ----------
  const totalExpenses = expenses.rent + expenses.utilityCost + expenses.carCost + expenses.foodCost + expenses.courseCost + loanResult.totalPaid;
  let newCash = (state?.cash ?? 0) + salary + partTimeIncome + dividendIncome - totalExpenses - taxes.taxAmount;

  // ---------- Step 12.3: Property Income ----------
  const propResult = processProperties(state?.properties ?? [], economy.inflationMultiplier);
  const propertyNetIncome = propResult.totalIncome - propResult.totalMaintenance;
  newCash += propertyNetIncome;

  // Life events removed
  let triggeredEvent: TriggeredEvent | null = null;
  const newRecentEventIds = state?.recentEventIds ?? [];

  // ---------- Step 12.6: Resolve Pending Investments ----------
  let investmentResult: { name: string; invested: number; returned: number; success: boolean } | null = null;
  const updatedInvestments: PendingInvestment[] = [];
  for (const inv of state?.pendingInvestments ?? []) {
    if ((inv.weeksRemaining ?? 1) <= 1) {
      const success = Math.random() < (inv.successChance ?? 0.5);
      const returned = Math.round(inv.amount * (success ? inv.returnMultiplier : inv.failReturnMultiplier));
      newCash += returned;
      investmentResult = {
        name: inv.investmentId,
        invested: inv.amount,
        returned,
        success,
      };
    } else {
      updatedInvestments.push({ ...inv, weeksRemaining: (inv.weeksRemaining ?? 1) - 1 });
    }
  }

  // ---------- Step 12.65: Business Processing ----------
  const bizResult = processAllBusinesses(state?.businesses ?? [], economy.inflationMultiplier, newWeek, newYear);
  triggeredEvent = bizResult.decisionEvent;
  let adjustedBizProfit = bizResult.totalProfit;
  const adjustedBusinesses = bizResult.updatedBusinesses.map((b) => {
    const mult = compResult.competitorRevenueMultipliers[b.id] ?? 1;
    const shareMultiplier = Math.max(0.7, 1 + (b.marketShareModifier ?? 0) / 100);
    const adjustedRevenue = Math.round(b.lastWeekRevenue * mult * shareMultiplier);
    const revenueDifference = b.lastWeekRevenue - adjustedRevenue;
    adjustedBizProfit -= revenueDifference;
    const adjusted = { ...b, lastWeekRevenue: adjustedRevenue, lastWeekProfit: b.lastWeekProfit - revenueDifference };
    return { ...adjusted, valuation: calculateValuation(adjusted) };
  });
  newCash += bizResult.totalDividend;

  // ---------- Step 12.7: Tick Temp Happiness Effects ----------
  const updatedTempEffects: TempHappinessEffect[] = [];
  for (const eff of state?.tempHappinessEffects ?? []) {
    if ((eff.weeksRemaining ?? 0) > 1) {
      updatedTempEffects.push({ ...eff, weeksRemaining: (eff.weeksRemaining ?? 1) - 1 });
    }
  }
  // Life events removed — no event happiness delta

  // ---------- Step 13: Build temp state & Happiness ----------
  const tempState: GameState = {
    ...(state ?? ({} as GameState)),
    week: newWeek,
    year: newYear,
    age: newAge,
    cash: newCash,
    inflationMultiplier: economy.inflationMultiplier,
    stocks: stockResult.stocks,
    currentCourseId: edu.currentCourseId,
    courseWeeksCompleted: edu.courseWeeksCompleted,
    completedCourses: edu.completedCourses,
    totalWeeksWorked: jobs.totalWeeksWorked,
    loans: loanResult.loans,
    earningsSinceLastTax: taxes.newEarningsSinceLastTax,
    totalTaxPaid: (state?.totalTaxPaid ?? 0) + taxes.taxAmount,
    currentHeadline: news.headline,
    initialized: true,
    tempHappinessEffects: updatedTempEffects,
    pendingInvestments: updatedInvestments,
    recentEventIds: newRecentEventIds,
    businesses: adjustedBusinesses,
    skills: updatedSkills,
    knowledge: updatedKnowledge,
    career: careerTick.updatedCareer,
    properties: propResult.updatedProperties,
    competitors: compResult.updatedCompetitors,
    activeMarketSentiment: newSentiment,
    activeMarketEvents: newMarketEvents,
    totalRealizedProfitLoss: state?.totalRealizedProfitLoss ?? 0,
    newsHistory: (() => {
      const prev = state?.newsHistory ?? [];
      const next = [...prev, news.headline];
      return next.length > 40 ? next.slice(next.length - 40) : next;
    })(),
    partTimeJob: partTimeActive,
  };

  const happiness = calculateHappiness(tempState);
  tempState.happiness = happiness;

  // ---------- Step 14: Net Worth ----------
  const nw = getNetWorth(tempState);
  const netWorthHist = [...(state?.netWorthHistory ?? [])];
  netWorthHist.push(nw);
  if (netWorthHist.length > 20) netWorthHist.shift();
  tempState.netWorthHistory = netWorthHist;

  // ---------- Step 15: Statistics ----------
  const prevStats: LifetimeStatistics = state?.statistics ?? { ...INITIAL_STATISTICS };
  const livingCosts = expenses.rent + expenses.utilityCost + expenses.carCost + expenses.foodCost;
  const isEmployed = hasCareerV2 || !!state?.currentJobId;
  const stats: LifetimeStatistics = {
    weeksPlayed: prevStats.weeksPlayed + 1,
    totalSalaryEarned: prevStats.totalSalaryEarned + salary,
    totalTaxesPaid: prevStats.totalTaxesPaid + taxes.taxAmount,
    totalLivingCosts: prevStats.totalLivingCosts + livingCosts,
    highestCash: Math.max(prevStats.highestCash, newCash),
    highestNetWorth: Math.max(prevStats.highestNetWorth, nw),
    largestStockGain: Math.max(prevStats.largestStockGain, ...stockResult.stockChanges.map((sc) => sc.change)),
    largestStockLoss: Math.min(prevStats.largestStockLoss, ...stockResult.stockChanges.map((sc) => sc.change)),
    stocksPurchased: prevStats.stocksPurchased,
    coursesCompleted: prevStats.coursesCompleted + (edu.justCompleted ? 1 : 0),
    jobsWorked: prevStats.jobsWorked,
    weeksEmployed: prevStats.weeksEmployed + (isEmployed ? 1 : 0),
    weeksUnemployed: prevStats.weeksUnemployed + (isEmployed ? 0 : 1),
    loansTaken: prevStats.loansTaken,
    loansRepaid: prevStats.loansRepaid + loanResult.loansRepaid,
    totalRealizedProfitLoss: prevStats.totalRealizedProfitLoss ?? 0,
    totalDividendsReceived: (prevStats.totalDividendsReceived ?? 0) + dividendIncome,
  };
  tempState.statistics = stats;

  // ---------- Step 16: Achievements ----------
  const newAchievements = checkAchievements(tempState, nw, salary);
  tempState.unlockedAchievements = [...(tempState?.unlockedAchievements ?? []), ...newAchievements];

  // ---------- Build Summary ----------
  const summary: WeekSummary = {
    salaryEarned: salary,
    rentPaid: expenses.rent,
    utilityCost: expenses.utilityCost,
    foodCost: expenses.foodCost,
    carCost: expenses.carCost,
    courseCost: expenses.courseCost,
    loanPayments: loanResult.totalPaid,
    stockChanges: stockResult.stockChanges,
    courseProgress: edu.courseProgress,
    headline: news.headline,
    newWeek,
    happiness,
    newAchievements,
    isTaxWeek: taxes.isTaxWeek,
    taxAmount: taxes.taxAmount,
    earningsForTaxPeriod: taxes.earningsForPeriod,
    inflationEvent: economy.inflationEvent,
    inflationRate: economy.inflationRate,
    inflationMultiplier: economy.inflationMultiplier,
    salaryReduced,
    lifeEvent: triggeredEvent,
    investmentResult,
    businessTotalProfit: adjustedBizProfit,
    businessEvents: bizResult.events,
    propertyIncome: propertyNetIncome,
    careerRaise: careerTick.gotRaise,
    careerPromotion: careerTick.promotionTitle,
    promotionBlockedReason: careerTick.promotionBlockedReason,
    skillGains,
    marketSentimentName: newSentiment && globalWeek % 20 === 0 ? newSentiment.name : null,
    marketEventTitle: newMarketEvent?.title ?? null,
    performanceEventResult: careerTick.performanceEvent,
    realizedProfitLoss: 0,
    dividendIncome,
    partTimeIncome,
  };

  return { newState: tempState, summary };
}
