import { GameState } from '../types/game';
import achievementsData from '../data/achievements.json';
import jobsData from '../data/jobs.json';
import coursesData from '../data/courses.json';
import housingData from '../data/housing.json';
// house upgrades removed
import { getNetWorth, getPortfolioValue } from './financeEngine';

export function getAchievementRewardSettlement(
  newlyUnlockedIds: string[],
  rewardedAchievementIds: string[] = [],
): {
  xpGained: number;
  prestigePointsGained: number;
  gemsGained: number;
  rewardedThisCallIds: string[];
  gemRewards: Record<string, number>;
  rewardedAchievementIds: string[];
} {
  const rewardedIds = new Set(rewardedAchievementIds);
  const rewardedThisCallIds: string[] = [];
  const gemRewards: Record<string, number> = {};
  let xpGained = 0;
  let gemsGained = 0;

  for (const id of newlyUnlockedIds) {
    if (rewardedIds.has(id)) continue;
    const achievement = (achievementsData as any[]).find((item) => item?.id === id);
    if (!achievement) continue;

    const xpReward = Math.max(0, Number(achievement.xpReward ?? 0));
    const gemReward = Math.max(0, Number(achievement.gemReward ?? 0));
    xpGained += xpReward;
    gemsGained += gemReward;
    if (gemReward > 0) gemRewards[id] = gemReward;
    rewardedThisCallIds.push(id);
    rewardedIds.add(id);
  }

  return {
    xpGained,
    prestigePointsGained: xpGained,
    gemsGained,
    rewardedThisCallIds,
    gemRewards,
    rewardedAchievementIds: [...rewardedIds],
  };
}

export type AchievementProgressFormat = 'count' | 'currency' | 'weeks' | 'level' | 'percent';

export interface AchievementProgress {
  current: number;
  target: number;
  format: AchievementProgressFormat;
  label?: string;
}

function progress(current: number, target: number, format: AchievementProgressFormat = 'count', label?: string): AchievementProgress {
  return {
    current: Math.max(0, current),
    target: Math.max(1, target),
    format,
    label,
  };
}

export function getAchievementProgress(
  state: GameState,
  achievementId: string,
  weeklySalary = 0,
): AchievementProgress | null {
  const businesses = state.businesses ?? [];
  const properties = state.properties ?? [];
  const holdings = state.holdings ?? [];
  const completedCourses = state.completedCourses ?? [];
  const weeksPlayed = state.statistics?.weeksPlayed ?? 0;
  const netWorth = Math.max(getNetWorth(state), state.statistics?.highestNetWorth ?? 0);
  const portfolioValue = Math.max(
    getPortfolioValue(state.stocks ?? [], holdings),
    state.statistics?.highestStockPortfolioValue ?? 0,
  );
  const realizedProfit = Math.max(0, state.totalRealizedProfitLoss ?? 0);
  const totalShares = holdings.reduce((sum, holding) => sum + Math.max(0, holding.shares ?? 0), 0);
  const uniqueHoldings = holdings.filter((holding) => (holding.shares ?? 0) > 0).length;
  const basicCourseIds = (coursesData ?? []).filter((course) => course?.level === 1).map((course) => course.id);
  const advancedCourseIds = (coursesData ?? []).filter((course) => (course?.level ?? 1) <= 2).map((course) => course.id);
  const expertCourseIds = new Set((coursesData ?? []).filter((course) => (course?.level ?? 0) >= 3).map((course) => course.id));
  const completedCourseIds = new Set(completedCourses.map((course) => course.courseId));
  const basicCoursesCompleted = basicCourseIds.filter((id) => completedCourseIds.has(id)).length;
  const advancedCoursesCompleted = advancedCourseIds.filter((id) => completedCourseIds.has(id)).length;
  const expertCoursesCompleted = completedCourses.filter((course) => expertCourseIds.has(course.courseId)).length;
  const allHousingIds = (housingData ?? []).map((housing) => housing.id);
  const housingVisited = new Set(state.housingHistory ?? []);
  const maxCareerLevel = Math.max(0, state.career?.positionLevel ?? 0);
  const maxBusinessValue = businesses.reduce((max, business) => Math.max(max, business.valuation ?? 0), 0);
  const maxBusinessLevel = businesses.reduce((max, business) => Math.max(max, (business.level ?? 0) + 1), 0);
  const acquiredBusinesses = businesses.filter((business) => !!business.acquisition);
  const totalCorporateCapex = businesses.reduce((sum, business) => sum + (business.completedCorporateCapex?.length ?? 0), 0);
  const maxExecutiveTeam = businesses.reduce((max, business) => Math.max(max, business.executives?.length ?? 0), 0);
  const identityTraits = new Set(businesses.flatMap((business) => (business.identityTraits ?? []).map((trait) => trait.id)));
  const autoStrategyCount = businesses.filter((business) => !!business.autoStrategicDecisions).length;
  const maxHoldingCompanies = (state.holdingCompanies ?? []).reduce((max, holding) => {
    const companyCount = businesses.filter((business) => business.holdingCompanyId === holding.id).length;
    return Math.max(max, companyCount);
  }, 0);
  const maxHoldingServices = (state.holdingCompanies ?? []).reduce((max, holding) => {
    const services = holding.sharedServices ?? {};
    const total = ['finance', 'hr', 'procurement', 'marketing', 'it']
      .reduce((sum, key) => sum + Number((services as any)[key] ?? 0), 0);
    return Math.max(max, total);
  }, 0);
  const maxComprehensiveInsurance = businesses.reduce((max, business) => {
    const policies = business.insurancePolicies ?? {};
    const count = ['property', 'equipment', 'cyber', 'liability']
      .filter((area) => (policies as any)[area] === 'comprehensive').length;
    return Math.max(max, count);
  }, 0);
  const maxReinvestmentCycles = businesses.reduce((max, business) => {
    const reinvestment = business.reinvestment;
    if (!reinvestment) return max;
    const count = [reinvestment.technology, reinvestment.premises, reinvestment.equipment]
      .filter((track) => (track?.lastRenewedGlobalWeek ?? 0) > 0).length;
    return Math.max(max, count);
  }, 0);
  const totalPropertyValue = properties.reduce((sum, property) => sum + Math.max(0, property.currentValue ?? 0), 0);
  const rentedProperties = properties.filter((property) => property.isRentedOut).length;
  const familyTreeCount = state.familyTree?.people?.length ?? 0;
  const maxParentBond = (state.relationshipState?.children ?? []).reduce(
    (max, child) => Math.max(max, child.parentRelationship ?? 0),
    0,
  );
  const maxFamilyBusinessGenerations = businesses.reduce(
    (max, business) => Math.max(max, business.familyBusiness?.generationsOwned ?? 0),
    0,
  );
  const cryptoTickers = new Set(['AURX', 'NEXA', 'MOJO']);
  const cryptoHoldings = holdings.filter((holding) => cryptoTickers.has(holding.ticker) && (holding.shares ?? 0) > 0);
  const cryptoValue = cryptoHoldings.reduce((sum, holding) => {
    const stock = (state.stocks ?? []).find((item) => item.ticker === holding.ticker);
    return sum + (holding.shares ?? 0) * (stock?.currentPrice ?? 0);
  }, 0);
  const mojoHolding = cryptoHoldings.find((holding) => holding.ticker === 'MOJO');
  const mojoPrice = (state.stocks ?? []).find((stock) => stock.ticker === 'MOJO')?.currentPrice ?? 0;
  const mojoGainPct = mojoHolding && (mojoHolding.avgBuyPrice ?? 0) > 0
    ? Math.max(0, ((mojoPrice - mojoHolding.avgBuyPrice) / mojoHolding.avgBuyPrice) * 100)
    : 0;
  const maxStockGainPct = holdings.reduce((max, holding) => {
    const stock = (state.stocks ?? []).find((item) => item.ticker === holding.ticker);
    if (!stock || (holding.avgBuyPrice ?? 0) <= 0) return max;
    return Math.max(max, ((stock.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100);
  }, 0);

  switch (achievementId) {
    case 'first_job': return progress(state.careerHistory?.length ?? 0, 1, 'count', 'job');
    case 'first_promotion': return progress(maxCareerLevel, 2, 'level');
    case 'max_level_job': return progress(maxCareerLevel, 5, 'level');
    case 'career_level_7': return progress(maxCareerLevel, 7, 'level');
    case 'earn_10k_week': return progress(weeklySalary, 10_000, 'currency');
    case 'all_basic_courses': return progress(basicCoursesCompleted, basicCourseIds.length, 'count', 'courses');
    case 'expert_course': return progress(expertCoursesCompleted, 1, 'count', 'Expert course');
    case 'expert_five': return progress(expertCoursesCompleted, 5, 'count', 'Expert courses');
    case 'all_courses': return progress(advancedCoursesCompleted, advancedCourseIds.length, 'count', 'courses');
    case 'complete_all_courses': return progress(completedCourseIds.size, (coursesData ?? []).length, 'count', 'courses');
    case 'first_stock': return progress(uniqueHoldings, 1, 'count', 'asset');
    case 'own_1000_shares': return progress(totalShares, 1000, 'count', 'units');
    case 'diversified': return progress(uniqueHoldings, 10, 'count', 'assets');
    case 'stock_profit_25': return progress(maxStockGainPct, 25, 'percent');
    case 'portfolio_100k': return progress(portfolioValue, 100_000, 'currency');
    case 'portfolio_250k': return progress(portfolioValue, 250_000, 'currency');
    case 'portfolio_500k': return progress(portfolioValue, 500_000, 'currency');
    case 'portfolio_1m': return progress(portfolioValue, 1_000_000, 'currency');
    case 'portfolio_5m': return progress(portfolioValue, 5_000_000, 'currency');
    case 'portfolio_10m': return progress(portfolioValue, 10_000_000, 'currency');
    case 'portfolio_25m': return progress(portfolioValue, 25_000_000, 'currency');
    case 'realized_profit_100k': return progress(realizedProfit, 100_000, 'currency');
    case 'realized_profit_1m': return progress(realizedProfit, 1_000_000, 'currency');
    case 'realized_profit_2_5m': return progress(realizedProfit, 2_500_000, 'currency');
    case 'realized_profit_5m': return progress(realizedProfit, 5_000_000, 'currency');
    case 'dividends_100k': return progress(state.statistics?.totalDividendsReceived ?? 0, 100_000, 'currency');
    case 'crypto_first': return progress(cryptoHoldings.length, 1, 'count', 'crypto');
    case 'crypto_trinity': return progress(cryptoHoldings.length, 3, 'count', 'cryptos');
    case 'crypto_100k': return progress(cryptoValue, 100_000, 'currency');
    case 'mojo_double': return progress(mojoGainPct, 100, 'percent');

    case 'first_100k': return progress(netWorth, 100_000, 'currency');
    case 'net_worth_250k': return progress(netWorth, 250_000, 'currency');
    case 'net_worth_500k': return progress(netWorth, 500_000, 'currency');
    case 'first_million': return progress(netWorth, 1_000_000, 'currency');
    case 'net_worth_5m': return progress(netWorth, 5_000_000, 'currency');
    case 'net_worth_10m': return progress(netWorth, 10_000_000, 'currency');
    case 'cash_100k': return progress(Math.max(state.cash ?? 0, state.statistics?.highestCash ?? 0), 100_000, 'currency');
    case 'tax_payer': return progress(state.statistics?.totalTaxesPaid ?? 0, 50_000, 'currency');
    case 'debt_free_after_loan': return progress((state.statistics?.loansTaken ?? 0) > 0 && (state.loans?.length ?? 0) === 0 ? 1 : 0, 1, 'count');
    case 'three_loans': return progress(state.loans?.length ?? 0, 3, 'count', 'loans');
    case 'first_deposit': return progress(state.bankDeposits?.length ?? 0, 1, 'count', 'deposit');

    case 'buy_first_car': return progress(state.currentCarId && state.currentCarId !== 'none' ? 1 : 0, 1, 'count');
    case 'luxury_life': return progress((state.currentCarId === 'luxury_car' ? 1 : 0) + (state.currentHousingId === 'mansion' ? 1 : 0), 2, 'count', 'luxury assets');
    case 'all_housing': return progress(allHousingIds.filter((id) => housingVisited.has(id)).length, allHousingIds.length, 'count', 'homes');
    case 'survive_52_weeks': return progress(weeksPlayed, 20, 'weeks');
    case 'five_years': return progress(weeksPlayed, 100, 'weeks');
    case 'ten_years': return progress(weeksPlayed, 200, 'weeks');
    case 'survive_20_years': return progress(weeksPlayed, 400, 'weeks');
    case 'twenty_five_years': return progress(weeksPlayed, 500, 'weeks');
    case 'fifty_years': return progress(weeksPlayed, 1000, 'weeks');

    case 'first_business': return progress(businesses.length, 1, 'count', 'business');
    case 'multi_business_3': return progress(businesses.length, 3, 'count', 'businesses');
    case 'own_5_businesses': return progress(businesses.length, 5, 'count', 'businesses');
    case 'business_10': return progress(businesses.length, 10, 'count', 'businesses');
    case 'business_level_5': return progress(maxBusinessLevel, 5, 'level');
    case 'corporate_scale': return progress(maxBusinessValue, 25_000_000, 'currency');
    case 'global_corporation': return progress(maxBusinessValue, 175_000_000, 'currency');
    case 'first_acquisition': return progress(acquiredBusinesses.length, 1, 'count', 'acquisition');
    case 'acquisition_3': return progress(acquiredBusinesses.length, 3, 'count', 'acquisitions');
    case 'integration_success': return progress(acquiredBusinesses.some((business) => business.acquisition?.integrationOutcome === 'success') ? 1 : 0, 1, 'count');
    case 'first_holding': return progress(state.holdingCompanies?.length ?? 0, 1, 'count', 'holding');
    case 'holding_3_companies': return progress(maxHoldingCompanies, 3, 'count', 'companies');
    case 'holding_services_5': return progress(maxHoldingServices, 5, 'count', 'service levels');
    case 'legendary_hire': return progress(businesses.some((business) => (business.employees ?? []).some((employee) => employee.tier === 'legendary')) ? 1 : 0, 1, 'count');
    case 'first_executive': return progress(maxExecutiveTeam, 1, 'count', 'executive');
    case 'executive_team_3': return progress(maxExecutiveTeam, 3, 'count', 'executives');
    case 'board_established': return progress(businesses.some((business) => !!business.boardGovernance) ? 1 : 0, 1, 'count');
    case 'first_corporate_capex': return progress(totalCorporateCapex, 1, 'count', 'project');
    case 'corporate_capex_3': return progress(totalCorporateCapex, 3, 'count', 'projects');
    case 'auto_strategy_3': return progress(autoStrategyCount, 3, 'count', 'businesses');
    case 'identity_trait_first': return progress(identityTraits.size, 1, 'count', 'trait');
    case 'identity_traits_3': return progress(identityTraits.size, 3, 'count', 'traits');
    case 'profitable_exit': return progress((state.soldBusinesses ?? []).filter((sale) => (sale.lifetimeCashResult ?? 0) > 0).length, 1, 'count', 'profitable exit');
    case 'fully_insured': return progress(maxComprehensiveInsurance, 4, 'count', 'coverage areas');
    case 'reinvestment_cycle': return progress(maxReinvestmentCycles, 3, 'count', 'renewal tracks');
    case 'outside_investors': return progress(businesses.some((business) => (business.ownership ?? []).some((stake) => stake.ownerType === 'investor' && (stake.percent ?? 0) > 0)) ? 1 : 0, 1, 'count');
    case 'business_strategy_decision': return progress(businesses.some((business) => (business.timeline ?? []).some((entry) => (entry.title ?? '').startsWith('🧭'))) ? 1 : 0, 1, 'count');
    case 'business_crisis_resolved': return progress(businesses.some((business) => (business.timeline ?? []).some((entry) => (entry.title ?? '').startsWith('⚠️'))) ? 1 : 0, 1, 'count');

    case 'first_property': return progress(properties.length, 1, 'count', 'property');
    case 'own_5_properties': return progress(properties.length, 5, 'count', 'properties');
    case 'auction_winner': return progress(properties.some((property) => property.acquisitionType === 'auction') ? 1 : 0, 1, 'count');
    case 'renovator': return progress(properties.some((property) => property.isRenovated) ? 1 : 0, 1, 'count');
    case 'rental_portfolio_3': return progress(rentedProperties, 3, 'count', 'rentals');
    case 'property_value_1m': return progress(totalPropertyValue, 1_000_000, 'currency');

    case 'relationship_official': return progress(state.relationshipState?.partnerId ? 1 : 0, 1, 'count');
    case 'relationship_married': {
      const partner = state.relationshipState?.partnerId
        ? (state.relationshipState.activeConnections ?? []).find((connection) => connection.id === state.relationshipState.partnerId)
        : null;
      return progress(partner?.stage === 'married' ? 1 : 0, 1, 'count');
    }
    case 'first_child': return progress(state.relationshipState?.children?.length ?? 0, 1, 'count', 'child');
    case 'parent_bond_90': return progress(maxParentBond, 90, 'percent');
    case 'grandparent': return progress((state.relationshipState?.children ?? []).some((child) => (child.descendants?.length ?? 0) > 0) ? 1 : 0, 1, 'count');
    case 'family_tree_10': return progress(familyTreeCount, 10, 'count', 'people');
    case 'family_tree_25': return progress(familyTreeCount, 25, 'count', 'people');
    case 'generation_2': return progress(state.generation ?? 1, 2, 'count', 'generation');
    case 'generation_3': return progress(state.generation ?? 1, 3, 'count', 'generation');
    case 'estate_planner': return progress((state.relationshipState?.estatePlan?.structure ?? 'none') !== 'none' ? 1 : 0, 1, 'count');
    case 'family_trust_established': return progress(state.relationshipState?.estatePlan?.structure === 'family_trust' ? 1 : 0, 1, 'count');
    case 'family_business_first': return progress(maxFamilyBusinessGenerations, 1, 'count', 'generation');
    case 'family_business_gen2': return progress(maxFamilyBusinessGenerations, 2, 'count', 'generations');
    case 'family_business_gen3': return progress(maxFamilyBusinessGenerations, 3, 'count', 'generations');
    case 'family_governance_first': return progress(businesses.some((business) => (business.familyRoles?.length ?? 0) > 0) ? 1 : 0, 1, 'count');
    case 'child_shareholder': return progress(businesses.some((business) => (business.ownership ?? []).some((stake) => stake.ownerType === 'child' && (stake.percent ?? 0) > 0)) ? 1 : 0, 1, 'count');

    default:
      return null;
  }
}

export function checkAchievements(state: GameState, netWorth: number, weeklySalary: number): string[] {
  const unlocked = state?.unlockedAchievements ?? [];
  const newlyUnlocked: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !unlocked.includes(id)) {
      newlyUnlocked.push(id);
    }
  };

  // --- Core achievements ---
  check('first_job', (state?.careerHistory?.length ?? 0) > 0);
  check('first_stock', (state?.holdings?.length ?? 0) > 0);
  check('buy_first_car', (state?.currentCarId ?? 'none') !== 'none');

  const totalShares = (state?.holdings ?? []).reduce((s, h) => s + (h?.shares ?? 0), 0);
  check('own_1000_shares', totalShares >= 1000);

  // Net worth tiers
  check('first_100k', netWorth >= 100000);
  check('net_worth_250k', netWorth >= 250000);
  check('net_worth_500k', netWorth >= 500000);
  check('first_million', netWorth >= 1000000);
  check('net_worth_5m', netWorth >= 5000000);
  check('net_worth_10m', netWorth >= 10000000);

  // Courses
  const basicCourses = (coursesData ?? []).filter((c) => c?.level === 1);
  const allBasicDone = basicCourses.every((c) =>
    (state?.completedCourses ?? []).some((cc) => cc?.courseId === c?.id)
  );
  check('all_basic_courses', allBasicDone);

  const hasExpert = (state?.completedCourses ?? []).some((cc) => {
    const cd = (coursesData ?? []).find((c) => c?.id === cc?.courseId);
    return (cd?.level ?? 0) >= 3;
  });
  check('expert_course', hasExpert);
  const expertCourseCount = (state?.completedCourses ?? []).filter((completed) => {
    const course = (coursesData ?? []).find((item) => item?.id === completed.courseId);
    return (course?.level ?? 0) >= 3;
  }).length;
  check('expert_five', expertCourseCount >= 5);

  const advancedCourseIds = (coursesData ?? []).filter((course) => (course?.level ?? 1) <= 2).map((course) => course?.id);
  const allAdvancedDone = advancedCourseIds.length > 0 && advancedCourseIds.every((courseId) =>
    (state?.completedCourses ?? []).some((completed) => completed?.courseId === courseId)
  );
  check('all_courses', allAdvancedDone);

  const allCourseIds = (coursesData ?? []).map((course) => course?.id);

  // Career
  check('earn_10k_week', weeklySalary >= 10000);

  const hasLvl2Job = (state?.careerHistory ?? []).some((ch) => {
    const jd = (jobsData ?? []).find((j) => j?.id === ch?.jobId);
    return (jd?.level ?? 0) >= 2;
  });
  // Also check career v2 position level
  const hasCareerLvl2 = (state?.career?.positionLevel ?? 0) >= 2;
  check('first_promotion', hasLvl2Job || hasCareerLvl2);

  const hasLvl5Job = (state?.careerHistory ?? []).some((ch) => {
    const jd = (jobsData ?? []).find((j) => j?.id === ch?.jobId);
    return (jd?.level ?? 0) >= 5;
  });
  const hasCareerLvl5 = (state?.career?.positionLevel ?? 0) >= 5;
  check('max_level_job', hasLvl5Job || hasCareerLvl5);

  // Career level 7 (C-Suite)
  check('career_level_7', (state?.career?.positionLevel ?? 0) >= 7);

  // Loans
  const everHadLoan = (state?.statistics?.loansTaken ?? 0) > 0;
  check('debt_free_after_loan', everHadLoan && (state?.loans ?? []).length === 0);
  check('three_loans', (state?.loans ?? []).length >= 3);
  check('first_deposit', (state?.bankDeposits?.length ?? 0) >= 1);

  // Lifestyle
  check('luxury_life', (state?.currentCarId === 'luxury_car') && (state?.currentHousingId === 'mansion'));

  // Housing
  const allHousingIds = (housingData ?? []).map((h) => h?.id);
  const allHousingVisited = allHousingIds.length > 0 && allHousingIds.every((hid) => (state?.housingHistory ?? []).includes(hid));
  check('all_housing', allHousingVisited);

  // Cash
  check('cash_100k', (state?.cash ?? 0) >= 100000);

  // House upgrades
  // house upgrades achievement removed

  // Diversified portfolio
  const uniqueHoldings = (state?.holdings ?? []).filter((h) => (h?.shares ?? 0) > 0).length;
  check('diversified', uniqueHoldings >= 10);

  // Tax
  check('tax_payer', (state?.statistics?.totalTaxesPaid ?? 0) >= 50000);

  // Time-based (20 weeks = 1 year)
  const weeksPlayed = state?.statistics?.weeksPlayed ?? 0;
  check('survive_52_weeks', weeksPlayed >= 20);  // 1 year = 20 weeks
  check('five_years', weeksPlayed >= 100);        // 5 years = 100 weeks
  check('ten_years', weeksPlayed >= 200);          // 10 years = 200 weeks
  check('twenty_five_years', weeksPlayed >= 500);
  check('fifty_years', weeksPlayed >= 1000);

  // Portfolio value tiers
  const portfolioValue = getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  check('portfolio_100k', portfolioValue >= 100000);
  check('portfolio_250k', portfolioValue >= 250000);
  check('portfolio_500k', portfolioValue >= 500000);
  check('portfolio_1m', portfolioValue >= 1000000);
  check('portfolio_5m', portfolioValue >= 5000000);
  check('portfolio_10m', portfolioValue >= 10000000);
  check('portfolio_25m', portfolioValue >= 25000000);

  // Stock profit 25% on any position
  const hasStock25 = (state?.holdings ?? []).some((h) => {
    const stock = (state?.stocks ?? []).find((s) => s?.ticker === h?.ticker);
    if (!stock || (h?.shares ?? 0) <= 0) return false;
    const gl = ((stock.currentPrice ?? 0) - (h.avgBuyPrice ?? 0)) / (h.avgBuyPrice || 1);
    return gl >= 0.25;
  });
  check('stock_profit_25', hasStock25);

  // Business empire and corporate progression
  const businesses = state?.businesses ?? [];
  const acquiredBusinesses = businesses.filter((business) => !!business.acquisition);
  const maxBusinessValue = businesses.reduce((max, business) => Math.max(max, business.valuation ?? 0), 0);
  const totalCorporateCapex = businesses.reduce((total, business) => total + (business.completedCorporateCapex?.length ?? 0), 0);
  const distinctIdentityTraits = new Set(
    businesses.flatMap((business) => (business.identityTraits ?? []).map((trait) => trait.id))
  );
  const maxExecutiveTeam = businesses.reduce((max, business) => Math.max(max, business.executives?.length ?? 0), 0);
  const autoStrategyCount = businesses.filter((business) => !!business.autoStrategicDecisions).length;
  const maxHoldingCompanies = (state.holdingCompanies ?? []).reduce((max, holding) => {
    const count = businesses.filter((business) => business.holdingCompanyId === holding.id).length;
    return Math.max(max, count);
  }, 0);
  const maxHoldingSharedServiceLevels = (state.holdingCompanies ?? []).reduce((max, holding) => {
    const services = holding.sharedServices ?? {};
    const levels = ['finance', 'hr', 'procurement', 'marketing', 'it']
      .reduce((sum, key) => sum + Number((services as any)[key] ?? 0), 0);
    return Math.max(max, levels);
  }, 0);
  const fullyInsuredBusiness = businesses.some((business) => {
    const policies = business.insurancePolicies ?? {};
    return ['property', 'equipment', 'cyber', 'liability']
      .every((area) => (policies as any)[area] === 'comprehensive');
  });
  const completedReinvestmentCycle = businesses.some((business) => {
    const reinvestment = business.reinvestment;
    return !!reinvestment
      && (reinvestment.technology?.lastRenewedGlobalWeek ?? 0) > 0
      && (reinvestment.premises?.lastRenewedGlobalWeek ?? 0) > 0
      && (reinvestment.equipment?.lastRenewedGlobalWeek ?? 0) > 0;
  });

  check('first_business', businesses.length >= 1);
  check('multi_business_3', businesses.length >= 3);
  check('own_5_businesses', businesses.length >= 5);
  check('business_10', businesses.length >= 10);
  check('business_level_5', businesses.some((business) => (business.level ?? 0) >= 4));
  check('corporate_scale', maxBusinessValue >= 25_000_000);
  check('global_corporation', maxBusinessValue >= 175_000_000);
  check('first_acquisition', acquiredBusinesses.length >= 1);
  check('acquisition_3', acquiredBusinesses.length >= 3);
  check('integration_success', acquiredBusinesses.some((business) => business.acquisition?.integrationOutcome === 'success'));
  check('first_holding', (state.holdingCompanies?.length ?? 0) >= 1);
  check('holding_3_companies', maxHoldingCompanies >= 3);
  check('holding_services_5', maxHoldingSharedServiceLevels >= 5);
  check('first_executive', businesses.some((business) => (business.executives?.length ?? 0) >= 1));
  check('executive_team_3', maxExecutiveTeam >= 3);
  check('board_established', businesses.some((business) => !!business.boardGovernance));
  check('first_corporate_capex', totalCorporateCapex >= 1);
  check('corporate_capex_3', totalCorporateCapex >= 3);
  check('auto_strategy_3', autoStrategyCount >= 3);
  check('identity_trait_first', distinctIdentityTraits.size >= 1);
  check('identity_traits_3', distinctIdentityTraits.size >= 3);
  check('profitable_exit', (state.soldBusinesses ?? []).some((sale) => (sale.lifetimeCashResult ?? 0) > 0));
  check('fully_insured', fullyInsuredBusiness);
  check('reinvestment_cycle', completedReinvestmentCycle);

  // Real estate progression
  const properties = state?.properties ?? [];
  const totalPropertyValue = properties.reduce((total, property) => total + (property.currentValue ?? 0), 0);
  const rentedPropertyCount = properties.filter((property) => property.isRentedOut).length;
  check('first_property', properties.length >= 1);
  check('own_5_properties', properties.length >= 5);
  check('auction_winner', properties.some((property) => property.acquisitionType === 'auction'));
  check('renovator', properties.some((property) => property.isRenovated));
  check('rental_portfolio_3', rentedPropertyCount >= 3);
  check('property_value_1m', totalPropertyValue >= 1_000_000);

  // Realized profit
  check('realized_profit_100k', (state?.totalRealizedProfitLoss ?? 0) >= 100000);
  check('realized_profit_1m', (state?.totalRealizedProfitLoss ?? 0) >= 1000000);
  check('realized_profit_2_5m', (state?.totalRealizedProfitLoss ?? 0) >= 2500000);
  check('realized_profit_5m', (state?.totalRealizedProfitLoss ?? 0) >= 5000000);
  check('dividends_100k', (state?.statistics?.totalDividendsReceived ?? 0) >= 100000);

  // Relationships, family and dynasty
  const activePartner = state.relationshipState?.partnerId
    ? (state.relationshipState?.activeConnections ?? []).find((connection) => connection.id === state.relationshipState.partnerId)
    : null;
  check('relationship_official', !!activePartner && activePartner.stage !== 'dating');
  check('relationship_married', activePartner?.stage === 'married');
  check('first_child', (state.relationshipState?.children?.length ?? 0) >= 1);
  check('parent_bond_90', (state.relationshipState?.children ?? []).some((child) => (child.parentRelationship ?? 0) >= 90));
  check('grandparent', (state.relationshipState?.children ?? []).some((child) => (child.descendants?.length ?? 0) > 0));
  check('family_tree_10', (state.familyTree?.people?.length ?? 0) >= 10);
  check('family_tree_25', (state.familyTree?.people?.length ?? 0) >= 25);
  check('generation_2', (state.generation ?? 1) >= 2);
  check('generation_3', (state.generation ?? 1) >= 3);

  const estateStructure = state.relationshipState?.estatePlan?.structure ?? 'none';
  check('estate_planner', estateStructure === 'will' || estateStructure === 'family_trust');
  check('family_trust_established', estateStructure === 'family_trust');

  // Family business, governance and ownership
  check('family_business_first', (state.businesses ?? []).some((business) => business.familyBusiness?.isFamilyBusiness));
  check('family_business_gen2', (state.businesses ?? []).some((business) => (business.familyBusiness?.generationsOwned ?? 0) >= 2));
  check('family_business_gen3', (state.businesses ?? []).some((business) => (business.familyBusiness?.generationsOwned ?? 0) >= 3));
  check('family_governance_first', (state.businesses ?? []).some((business) => (business.familyRoles?.length ?? 0) > 0));
  check('business_strategy_decision', (state.businesses ?? []).some((business) =>
    (business.timeline ?? []).some((entry) => (entry.title ?? '').startsWith('🧭'))
  ));
  check('business_crisis_resolved', (state.businesses ?? []).some((business) =>
    (business.timeline ?? []).some((entry) => (entry.title ?? '').startsWith('⚠️'))
  ));
  check('outside_investors', (state.businesses ?? []).some((business) =>
    (business.ownership ?? []).some((stake) => stake.ownerType === 'investor' && (stake.percent ?? 0) > 0)
  ));
  check('child_shareholder', (state.businesses ?? []).some((business) =>
    (business.ownership ?? []).some((stake) => stake.ownerType === 'child' && (stake.percent ?? 0) > 0)
  ));

  // Cryptocurrency
  const cryptoTickers = new Set(['AURX', 'NEXA', 'MOJO']);
  const cryptoHoldings = (state.holdings ?? []).filter((holding) =>
    cryptoTickers.has(holding.ticker) && (holding.shares ?? 0) > 0
  );
  check('crypto_first', cryptoHoldings.length > 0);
  check('crypto_trinity', ['AURX', 'NEXA', 'MOJO'].every((ticker) =>
    cryptoHoldings.some((holding) => holding.ticker === ticker)
  ));

  const cryptoValue = cryptoHoldings.reduce((sum, holding) => {
    const stock = (state.stocks ?? []).find((item) => item.ticker === holding.ticker);
    return sum + (holding.shares ?? 0) * (stock?.currentPrice ?? 0);
  }, 0);
  check('crypto_100k', cryptoValue >= 100000);

  const mojoHolding = cryptoHoldings.find((holding) => holding.ticker === 'MOJO');
  const mojoPrice = (state.stocks ?? []).find((stock) => stock.ticker === 'MOJO')?.currentPrice ?? 0;
  check('mojo_double', !!mojoHolding && (mojoHolding.avgBuyPrice ?? 0) > 0
    && mojoPrice >= (mojoHolding.avgBuyPrice ?? 0) * 2);

  // Additional long-horizon achievements
  check('legendary_hire', businesses.some((business) => (business.employees ?? []).some((employee) => employee.tier === 'legendary')));
  check('survive_20_years', (state?.statistics?.weeksPlayed ?? 0) >= 400);
  check('complete_all_courses', allCourseIds.length > 0 && allCourseIds.every((courseId) => (state?.completedCourses ?? []).some((completed) => completed.courseId === courseId)));

  return newlyUnlocked;
}
