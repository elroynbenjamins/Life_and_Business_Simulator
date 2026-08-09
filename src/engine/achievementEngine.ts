import { GameState } from '../types/game';
import achievementsData from '../data/achievements.json';
import jobsData from '../data/jobs.json';
import coursesData from '../data/courses.json';
import housingData from '../data/housing.json';
// house upgrades removed
import { getPortfolioValue } from './financeEngine';

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

  const allCourseIds = (coursesData ?? []).map((c) => c?.id);
  const allCoursesDone = allCourseIds.length > 0 && allCourseIds.every((cid) =>
    (state?.completedCourses ?? []).some((cc) => cc?.courseId === cid)
  );
  check('all_courses', allCoursesDone);

  // Career
  check('earn_10k_week', weeklySalary >= 10000);

  const hasLvl2Job = (state?.careerHistory ?? []).some((ch) => {
    const jd = (jobsData ?? []).find((j) => j?.id === ch?.jobId);
    return (jd?.level ?? 0) >= 2;
  });
  // Also check career v2 position level
  const hasCareerLvl2 = (state?.career?.positionLevel ?? 0) >= 2;
  check('first_promotion', hasLvl2Job || hasCareerLvl2);

  const hasLvl3Job = (state?.careerHistory ?? []).some((ch) => {
    const jd = (jobsData ?? []).find((j) => j?.id === ch?.jobId);
    return (jd?.level ?? 0) >= 3;
  });
  const hasCareerLvl3 = (state?.career?.positionLevel ?? 0) >= 3;
  check('max_level_job', hasLvl3Job || hasCareerLvl3);

  // Career level 7 (C-Suite)
  check('career_level_7', (state?.career?.positionLevel ?? 0) >= 7);

  // Happiness
  check('happiness_80', (state?.happiness ?? 0) >= 80);
  check('happiness_90', (state?.happiness ?? 0) >= 90);

  // Loans
  const everHadLoan = (state?.statistics?.loansTaken ?? 0) > 0;
  check('debt_free_after_loan', everHadLoan && (state?.loans ?? []).length === 0);
  check('three_loans', (state?.loans ?? []).length >= 3);

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

  // Portfolio value tiers
  const portfolioValue = getPortfolioValue(state?.stocks ?? [], state?.holdings ?? []);
  check('portfolio_100k', portfolioValue >= 100000);
  check('portfolio_250k', portfolioValue >= 250000);
  check('portfolio_500k', portfolioValue >= 500000);
  check('portfolio_1m', portfolioValue >= 1000000);

  // Stock profit 25% on any position
  const hasStock25 = (state?.holdings ?? []).some((h) => {
    const stock = (state?.stocks ?? []).find((s) => s?.ticker === h?.ticker);
    if (!stock || (h?.shares ?? 0) <= 0) return false;
    const gl = ((stock.currentPrice ?? 0) - (h.avgBuyPrice ?? 0)) / (h.avgBuyPrice || 1);
    return gl >= 0.25;
  });
  check('stock_profit_25', hasStock25);

  // Business empire
  check('own_5_businesses', (state?.businesses?.length ?? 0) >= 5);

  // Property mogul
  check('own_5_properties', (state?.properties?.length ?? 0) >= 5);

  // Realized profit
  check('realized_profit_100k', (state?.totalRealizedProfitLoss ?? 0) >= 100000);

  // New achievements
  check('multi_business_3', (state?.businesses?.length ?? 0) >= 3);
  check('legendary_hire', (state?.businesses ?? []).some((b) => (b.employees ?? []).some((e) => e.tier === 'legendary')));
  check('survive_20_years', (state?.year ?? 0) >= 20);
  check('complete_all_courses', allCourseIds.length > 0 && allCourseIds.every((cid) => (state?.completedCourses ?? []).some((cc) => cc.courseId === cid)));

  return newlyUnlocked;
}
