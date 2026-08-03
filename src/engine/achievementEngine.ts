import { GameState } from '../types/game';
import achievementsData from '../data/achievements.json';
import jobsData from '../data/jobs.json';
import coursesData from '../data/courses.json';

export function checkAchievements(state: GameState, netWorth: number, weeklySalary: number): string[] {
  const unlocked = state?.unlockedAchievements ?? [];
  const newlyUnlocked: string[] = [];

  const check = (id: string, condition: boolean) => {
    if (condition && !unlocked.includes(id)) {
      newlyUnlocked.push(id);
    }
  };

  check('first_job', (state?.careerHistory?.length ?? 0) > 0);

  check('first_stock', (state?.holdings?.length ?? 0) > 0);

  check('buy_first_car', (state?.currentCarId ?? 'none') !== 'none');

  const totalShares = (state?.holdings ?? []).reduce((s, h) => s + (h?.shares ?? 0), 0);
  check('own_1000_shares', totalShares >= 1000);

  check('first_100k', netWorth >= 100000);
  check('net_worth_500k', netWorth >= 500000);
  check('first_million', netWorth >= 1000000);

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

  check('earn_10k_week', weeklySalary >= 10000);
  check('happiness_80', (state?.happiness ?? 0) >= 80);

  const hadLoans = (state?.totalTaxPaid ?? 0) > 0 || (state?.loans ?? []).length === 0;
  // More accurate: check if player ever had a loan and now has none
  const everHadLoan = unlocked.includes('debt_free_after_loan') === false;
  check('debt_free_after_loan', everHadLoan && (state?.loans ?? []).length === 0 && (state?.earningsSinceLastTax ?? 0) > 0);

  const hasLvl2Job = (state?.careerHistory ?? []).some((ch) => {
    const jd = (jobsData ?? []).find((j) => j?.id === ch?.jobId);
    return (jd?.level ?? 0) >= 2;
  });
  check('first_promotion', hasLvl2Job);

  const hasLvl3Job = (state?.careerHistory ?? []).some((ch) => {
    const jd = (jobsData ?? []).find((j) => j?.id === ch?.jobId);
    return (jd?.level ?? 0) >= 3;
  });
  check('max_level_job', hasLvl3Job);

  check('luxury_life', (state?.currentCarId === 'luxury_car') && (state?.currentHousingId === 'mansion'));

  return newlyUnlocked;
}
