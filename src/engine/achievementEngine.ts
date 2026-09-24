import { GameState } from '../types/game';
import achievementsData from '../data/achievements.json';
import jobsData from '../data/jobs.json';
import coursesData from '../data/courses.json';
import housingData from '../data/housing.json';
// house upgrades removed
import { getPortfolioValue } from './financeEngine';

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
