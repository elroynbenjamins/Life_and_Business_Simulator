import { GameState, WeekSummary, LifetimeStatistics, INITIAL_STATISTICS, INITIAL_CAREER_STATE, TriggeredEvent, TempHappinessEffect, PendingInvestment, AuctionResult, RealEstateAuction } from '../types/game';
import { processEconomy } from './economyEngine';
import { getPlayerFamilyWorkFraction, processRelationships } from './relationshipEngine';
import { processLifecycle } from './lifecycleEngine';
import { syncFamilyTree } from './familyTreeEngine';
import { processNews } from './newsEngine';
import { processStocks, rollMarketSentiment, rollMarketEvent, processDividends } from './stockEngine';
import { processEducation } from './educationEngine';
import { getStudentWorkTier, rollStudentWorkIncome } from './studentWork';
import { processJobs } from './jobEngine';
import { processIncome, processExpenses, processLoans, processTaxes, getNetWorth, getPortfolioValue, isSalaryReduced } from './financeEngine';
import { calculateHappiness } from './happinessEngine';
import { checkAchievements } from './achievementEngine';
// Life events removed
import { calculateValuation, processAllBusinesses } from './businessEngine';
import { processSkillGrowth, applyEducationRewards } from './skillEngine';
import { processCareerTick, getCareerSalary, recordCareerLevel } from './careerEngine';
import { processProperties } from './propertyEngine';
import { auctionToProperty, ensureAuctions } from './auctionEngine';
import { processCompetitors } from './competitorEngine';
import jobsData from '../data/jobs.json';
import housingData from '../data/housing.json';

/**
 * Deterministic weekly tick pipeline with all systems.
 * Aging: every 20 weeks = 1 year.
 */
export function weeklyTick(state: GameState, prestigeEffects: Record<string, number> = {}): { newState: GameState; summary: WeekSummary } {
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
  const studentWorkTier = getStudentWorkTier(state);
  const partTimeActive = !!studentWorkTier && !state?.currentJobId && !state?.career?.companyId;

  // ---------- Step 2: Economy (Inflation) ----------
  const economy = processEconomy(state, newWeek);
  const stateWithInflation: GameState = {
    ...(state ?? ({} as GameState)),
    inflationMultiplier: economy.inflationMultiplier,
    week: newWeek,
    year: newYear,
    age: newAge,
    lastMacroCrashWeek: economy.crashStarted ? globalWeek : (state?.lastMacroCrashWeek ?? 0),
    activeMacroCrash: economy.activeMacroCrash,
  };

  // Purchased vehicles arrive after this week's progression has completed.
  if (state.pendingCarDelivery) {
    const weeksRemaining = state.pendingCarDelivery.weeksRemaining - 1;
    stateWithInflation.pendingCarDelivery = weeksRemaining <= 0
      ? null
      : { ...state.pendingCarDelivery, weeksRemaining };
    if (weeksRemaining <= 0) stateWithInflation.currentCarId = state.pendingCarDelivery.carId;
  }

  // ---------- Step 2.5: Market Sentiment & Events ----------
  const newSentiment = rollMarketSentiment(globalWeek, state?.activeMarketSentiment ?? null);
  const { updatedEvents: newMarketEvents, newEvent: newMarketEvent } = rollMarketEvent(state?.activeMarketEvents ?? []);
  stateWithInflation.activeMarketSentiment = newSentiment;
  stateWithInflation.activeMarketEvents = newMarketEvents;

  // ---------- Step 3: News ----------
  const news = processNews();

  // ---------- Step 4: Stocks ----------
  const stockResult = processStocks(
    stateWithInflation,
    news,
    economy.crashEvent?.stockShock ?? 0,
    prestigeEffects.crypto_downside_reduction ?? 0,
  );

  // ---------- Step 4.5: Dividends ----------
  const baseDividendIncome = processDividends({ ...stateWithInflation, stocks: stockResult.stocks }, globalWeek);
  const dividendIncome = Math.round(baseDividendIncome * (1 + (prestigeEffects.dividend_boost ?? 0)));

  // ---------- Step 5: Education ----------
  const edu = processEducation(stateWithInflation, newWeek, partTimeActive ? studentWorkTier : null);

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
  const careerTick = processCareerTick({ ...stateWithInflation, completedCourses: edu.completedCourses, skills: updatedSkills, knowledge: updatedKnowledge }, globalWeek);

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

  // ---------- Step 7.5: Personal Life ----------
  const coupleTripActive = (stateWithInflation.relationshipState?.coupleTripWeeksRemaining ?? 0) > 0;
  const relationshipTick = processRelationships(stateWithInflation);

  // ---------- Step 8: Income ----------
  const familyWorkState: GameState = {
    ...stateWithInflation,
    relationshipState: relationshipTick.state,
  };
  const playerFamilyWorkFraction = getPlayerFamilyWorkFraction(familyWorkState);
  const legacyIncome = processIncome(stateWithInflation);
  const hasCareerV2 = !!careerTick.updatedCareer.companyId;
  const fullTimeSalary = hasCareerV2 ? careerTick.salary : legacyIncome.salary;
  const salary = coupleTripActive ? 0 : Math.round(fullTimeSalary * playerFamilyWorkFraction);
  const salaryReduced = coupleTripActive || isSalaryReduced(stateWithInflation) || playerFamilyWorkFraction < 1;

  // ---------- Step 9: Expenses ----------
  const expenses = processExpenses(stateWithInflation);

  // ---------- Step 10: Loans ----------
  const loanResult = processLoans(stateWithInflation);

  // ---------- Step 11: Taxes ----------
  const taxes = processTaxes({ ...stateWithInflation, career: careerTick.updatedCareer }, salary, globalWeek);

  // ---------- Step 11.5: Part-Time Income ----------
  const partTimeIncome = partTimeActive && !coupleTripActive ? rollStudentWorkIncome(studentWorkTier) : 0;

  // ---------- Step 11.6: Mature fixed-term bank deposits ----------
  let bankDepositMaturityIncome = 0;
  const updatedBankDeposits = (state.bankDeposits ?? []).flatMap((deposit) => {
    const weeksRemaining = (deposit.weeksRemaining ?? 1) - 1;
    if (weeksRemaining <= 0) {
      bankDepositMaturityIncome += Math.round(deposit.amount * (1 + deposit.interestRate));
      return [];
    }
    return [{ ...deposit, weeksRemaining }];
  });

  // ---------- Step 12: Cash Settlement ----------
  const totalExpenses = expenses.rent + expenses.utilityCost + expenses.carCost + expenses.foodCost + expenses.courseCost + loanResult.totalPaid + relationshipTick.householdExtraCost + relationshipTick.familyCost + relationshipTick.obligationCost;
  let newCash = (state?.cash ?? 0)
    + salary
    + partTimeIncome
    + dividendIncome
    + bankDepositMaturityIncome
    + relationshipTick.partnerContribution
    + relationshipTick.partnerInheritance
    - totalExpenses
    - taxes.taxAmount;

  // ---------- Step 12.3: Property Income ----------
  const propResult = processProperties(state?.properties ?? [], economy.inflationMultiplier, prestigeEffects.property_income ?? 0);
  const propertyNetIncome = propResult.totalIncome - propResult.totalMaintenance;
  newCash += propertyNetIncome;

  // ---------- Step 12.4: Real-estate auctions ----------
  const auctionResults: AuctionResult[] = [];
  const auctionProperties = [...propResult.updatedProperties];
  const openAuctions: RealEstateAuction[] = [];
  for (const existing of state.activeAuctions ?? []) {
    let auction = existing;
    // AI bidders can still react between player visits, but do not jump straight to their maximum.
    if (globalWeek < auction.auctionEndWeek && auction.playerIsHighestBidder && Math.random() < 0.35) {
      const counter = auction.aiBidders.find((bidder) => bidder.active && bidder.maxBid >= auction.currentBid + auction.minimumBidIncrease);
      if (counter) {
        auction = {
          ...auction,
          currentBid: Math.min(counter.maxBid, auction.currentBid + auction.minimumBidIncrease),
          playerIsHighestBidder: false,
        };
      }
    }
    if (globalWeek < auction.auctionEndWeek) {
      openAuctions.push(auction);
      continue;
    }
    const won = auction.playerIsHighestBidder && auction.playerHighestBid > 0 && newCash >= auction.currentBid;
    if (won) {
      newCash -= auction.currentBid;
      auctionProperties.push(auctionToProperty(auction, newWeek, newYear));
    }
    if (auction.playerHighestBid > 0) {
      auctionResults.push({
        auctionId: auction.id,
        propertyName: auction.propertyName,
        won,
        winningBid: auction.currentBid,
        playerBid: auction.playerHighestBid,
        estimatedMarketValue: auction.marketValue,
        reason: won ? undefined : auction.playerIsHighestBidder ? 'insufficient_cash' : 'outbid',
      });
    }
  }
  const activeAuctions = ensureAuctions(openAuctions, globalWeek, economy.inflationMultiplier, getNetWorth(stateWithInflation));

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
  const bizResult = processAllBusinesses(state?.businesses ?? [], economy.inflationMultiplier, newWeek, newYear, {
    businessCostReduction: prestigeEffects.business_cost_reduction ?? 0,
    competitorRevenueMultipliers: compResult.competitorRevenueMultipliers,
    businessCrisisReduction: prestigeEffects.business_crisis_reduction ?? 0,
  }, state?.holdingCompanies ?? []);
  const adjustedBizProfit = bizResult.totalProfit;
  const adjustedBusinesses = bizResult.updatedBusinesses;
  newCash += bizResult.totalDividend;

  const childDividendMap = new Map<string, number>();
  const currentChildIds = new Set((relationshipTick.state.children ?? []).map((child) => child.id));
  let familyTrustDistribution = 0;
  let familyTreeAfterBusiness = state.familyTree;
  for (const distribution of bizResult.ownershipDistributions ?? []) {
    if (distribution.ownerType === 'child') {
      if (currentChildIds.has(distribution.ownerId)) {
        childDividendMap.set(
          distribution.ownerId,
          (childDividendMap.get(distribution.ownerId) ?? 0) + (distribution.amount ?? 0),
        );
      } else {
        const treePersonId = `person:${distribution.ownerId}`;
        familyTreeAfterBusiness = {
          ...(familyTreeAfterBusiness ?? { currentPlayerId: null, people: [] }),
          people: (familyTreeAfterBusiness?.people ?? []).map((person) =>
            person.id === treePersonId
              ? { ...person, liquidWealth: (person.liquidWealth ?? 0) + (distribution.amount ?? 0) }
              : person
          ),
        };
      }
    } else if (distribution.ownerType === 'family_trust') {
      familyTrustDistribution += distribution.amount ?? 0;
    }
  }
  const relationshipStateAfterBusiness = {
    ...relationshipTick.state,
    children: (relationshipTick.state.children ?? []).map((child) => ({
      ...child,
      savings: (child.savings ?? 0) + (childDividendMap.get(child.id) ?? 0),
    })),
    familyTrustCash: (relationshipTick.state.familyTrustCash ?? 0) + familyTrustDistribution,
  };

  // ---------- Step 12.7: Tick Temp Happiness Effects ----------
  const updatedTempEffects: TempHappinessEffect[] = [];
  for (const eff of state?.tempHappinessEffects ?? []) {
    if ((eff.weeksRemaining ?? 0) > 1) {
      updatedTempEffects.push({ ...eff, weeksRemaining: (eff.weeksRemaining ?? 1) - 1 });
    }
  }
  if (relationshipTick.partnerDiedName) {
    updatedTempEffects.push({
      amount: -20,
      weeksRemaining: 6,
      source: 'Bereavement',
    });
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
    currentCarId: stateWithInflation.currentCarId,
    pendingCarDelivery: stateWithInflation.pendingCarDelivery,
    stocks: stockResult.stocks,
    currentCourseId: edu.currentCourseId,
    courseWeeksCompleted: edu.courseWeeksCompleted,
    completedCourses: edu.completedCourses,
    totalWeeksWorked: jobs.totalWeeksWorked,
    loans: loanResult.loans,
    bankDeposits: updatedBankDeposits,
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
    careerHistory: recordCareerLevel(state.careerHistory ?? [], careerTick.updatedCareer, newWeek),
    properties: auctionProperties,
    activeAuctions,
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
    studentWorkTier: partTimeActive ? studentWorkTier : null,
    relationshipState: relationshipStateAfterBusiness,
    familyTree: familyTreeAfterBusiness,
    lifecycle: state?.lifecycle,
    lastMacroCrashWeek: economy.crashStarted ? globalWeek : (state?.lastMacroCrashWeek ?? 0),
    activeMacroCrash: economy.activeMacroCrash,
  };

  const happiness = calculateHappiness(tempState);
  tempState.happiness = happiness;

  // ---------- Step 13.5: Lifecycle ----------
  // Mortality is checked only when the player ages, never on every weekly advance.
  const lifecycleResult = processLifecycle(tempState, state?.age ?? 20);
  tempState.lifecycle = lifecycleResult.lifecycle;
  if (lifecycleResult.estateSettlement) {
    tempState.relationshipState = {
      ...tempState.relationshipState,
      estateSettlement: lifecycleResult.estateSettlement,
    };
  }
  tempState.familyTree = syncFamilyTree(tempState);

  // ---------- Step 14: Net Worth ----------
  const nw = getNetWorth(tempState);
  const netWorthHist = [...(state?.netWorthHistory ?? [])];
  netWorthHist.push(nw);
  if (netWorthHist.length > 20) netWorthHist.shift();
  tempState.netWorthHistory = netWorthHist;

  // ---------- Step 15: Statistics ----------
  const prevStats: LifetimeStatistics = state?.statistics ?? { ...INITIAL_STATISTICS };
  const livingCosts = expenses.rent + expenses.utilityCost + expenses.carCost + expenses.foodCost + relationshipTick.householdExtraCost + relationshipTick.familyCost;
  const isEmployed = hasCareerV2 || !!state?.currentJobId;
  const stats: LifetimeStatistics = {
    ...INITIAL_STATISTICS,
    ...prevStats,
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
    highestSoldStockProfitPercent: prevStats.highestSoldStockProfitPercent ?? 0,
    highestStockPortfolioValue: Math.max(
      prevStats.highestStockPortfolioValue ?? 0,
      getPortfolioValue(tempState.stocks ?? [], tempState.holdings ?? []),
    ),
  };
  tempState.statistics = stats;

  // ---------- Step 16: Achievements ----------
  const newAchievements = checkAchievements(tempState, nw, salary);
  tempState.unlockedAchievements = [...(tempState?.unlockedAchievements ?? []), ...newAchievements];

  // ---------- Build Summary ----------
  const completedJob = edu.completedCourseData
    ? (jobsData as any[]).find((job) => job.requiredCourse === edu.completedCourseData?.id)
    : null;
  const housingIndex = (housingData as any[]).findIndex((housing) => housing.id === tempState.currentHousingId);
  const studioIndex = (housingData as any[]).findIndex((housing) => housing.id === 'studio_apartment');
  const smallHouseIndex = (housingData as any[]).findIndex((housing) => housing.id === 'small_house');
  const familyHouseIndex = (housingData as any[]).findIndex((housing) => housing.id === 'family_house');
  const luxuryVillaIndex = (housingData as any[]).findIndex((housing) => housing.id === 'luxury_villa');
  const requiredHousing = completedJob?.level >= 7 ? { index: luxuryVillaIndex, name: 'Luxury Villa' }
    : completedJob?.level >= 6 ? { index: familyHouseIndex, name: 'Family House' }
    : completedJob?.level >= 5 ? { index: smallHouseIndex, name: 'Small House' }
    : completedJob?.level >= 3 ? { index: studioIndex, name: 'Studio Apartment' }
      : null;
  const missingRequirements: string[] = [];
  if (completedJob?.requiresCar && tempState.currentCarId === 'none') {
    missingRequirements.push(tempState.pendingCarDelivery ? 'Wait for your vehicle delivery' : 'Buy a vehicle');
  }
  if (requiredHousing && housingIndex < requiredHousing.index) missingRequirements.push(`Move into a ${requiredHousing.name} or better`);

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
    auctionResults,
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
    partnerContribution: relationshipTick.partnerContribution,
    relationshipHouseholdCost: relationshipTick.householdExtraCost,
    familyCost: relationshipTick.familyCost,
    relationshipObligationCost: relationshipTick.obligationCost,
    relationshipEventTitle: relationshipTick.eventTitle,
    childBornName: relationshipTick.childBornName,
    relationshipGoalCompleted: relationshipTick.relationshipGoalCompleted,
    partnerCareerEvent: relationshipTick.partnerCareerEvent,
    partnerDiedName: relationshipTick.partnerDiedName,
    partnerInheritance: relationshipTick.partnerInheritance,
    familyMilestones: relationshipTick.familyMilestones,
    relationshipChange: relationshipTick.relationshipChange,
    relationshipHeadline: relationshipTick.headline,
    crashEvent: economy.crashEvent,
    diedThisWeek: lifecycleResult.diedThisWeek,
    educationCareerReminder: edu.completedCourseData ? {
      courseLevel: edu.completedCourseData.level,
      courseName: edu.completedCourseData.name,
      jobTitle: completedJob?.title ?? 'a matching career',
      missingRequirements,
    } : null,
  };

  return { newState: tempState, summary };
}
