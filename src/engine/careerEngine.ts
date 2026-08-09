import { GameState, CareerState, INITIAL_CAREER_STATE } from '../types/game';
import careerPathsData from '../data/career_paths.json';
import companiesData from '../data/companies.json';
import { inflated } from './economyEngine';
import { meetsPositionRequirements } from './skillEngine';
import { getPrestigeEffects } from './prestigeEngine';

export interface CareerTickResult {
  updatedCareer: CareerState;
  salary: number;
  gotRaise: boolean;
  promotionTitle: string | null;
  promotionBlockedReason: string | null;
  performanceEvent: { roll: number; needed: number; success: boolean } | null;
}

/** Compute min/max salary for a position (defaults ±20% around baseSalary). */
export function getPositionSalaryRange(position: any): { min: number; max: number } {
  const base = position?.baseSalary ?? 0;
  const min = position?.minSalary ?? Math.round(base * 0.85);
  const max = position?.maxSalary ?? Math.round(base * 1.30);
  return { min, max };
}

/**
 * Get the current weekly salary for a career state (bounded by position min/max).
 */
export function getCareerSalary(career: CareerState, inflationMultiplier: number, profile?: any): number {
  if (!career.companyId || !career.careerPathId || career.positionLevel <= 0) return 0;

  const company = (companiesData as any[]).find((c) => c?.id === career.companyId);
  const path = (careerPathsData as any[]).find((p) => p?.id === career.careerPathId);
  if (!company || !path) return 0;

  const position = (path.positions as any[]).find((p: any) => p?.level === career.positionLevel);
  if (!position) return 0;

  const base = position.baseSalary ?? 0;
  const companySalaryMult = company.salaryMultiplier ?? 1.0;
  const raiseBonus = career.salaryBonus ?? 1.0;
  const { min, max } = getPositionSalaryRange(position);

  // Prestige salary multiplier
  let prestigeMult = 1.0;
  if (profile) {
    const fx = getPrestigeEffects(profile);
    prestigeMult = 1 + (fx.salary_multiplier ?? 0);
  }

  const raw = base * companySalaryMult * raiseBonus * prestigeMult;
  const bounded = Math.max(min, Math.min(max, raw));
  return Math.round(inflated(bounded, inflationMultiplier));
}

/**
 * D20 Performance/Promotion event.
 * Roll 1-20; threshold = 20 - (skillRatio × 13), so 100% req -> need 7, 50% req -> need 13.
 * Progress per success = 10% × company.promotionSpeed.
 */
function rollPerformanceEvent(
  career: CareerState,
  skills: Record<string, number>,
  knowledge: Record<string, number>,
  company: any
): { roll: number; needed: number; success: boolean; progressGain: number } {
  const path = (careerPathsData as any[]).find((p) => p?.id === career.careerPathId);
  if (!path) return { roll: 0, needed: 10, success: false, progressGain: 0 };

  // Look at NEXT position's requirements to gauge readiness
  const nextPos = (path.positions as any[]).find((p: any) => p?.level === (career.positionLevel ?? 1) + 1);
  const currentPos = (path.positions as any[]).find((p: any) => p?.level === (career.positionLevel ?? 1));
  const target = nextPos ?? currentPos;

  let totalRatio = 0;
  let count = 0;
  if (target?.reqSkills) {
    for (const [sk, req] of Object.entries(target.reqSkills)) {
      const need = req as number;
      if (need > 0) {
        totalRatio += Math.min(1, (skills[sk] ?? 0) / need);
        count++;
      }
    }
  }
  if (target?.reqKnowledge) {
    for (const [kn, req] of Object.entries(target.reqKnowledge)) {
      const need = req as number;
      if (need > 0) {
        totalRatio += Math.min(1, (knowledge[kn] ?? 0) / need);
        count++;
      }
    }
  }
  const skillRatio = count > 0 ? totalRatio / count : 1.0;

  // Threshold: 20 - ratio*13  (ratio=1 → need 7, ratio=0.33 → need ~15.7, ratio=0 → need 20)
  const needed = Math.round(20 - skillRatio * 13);
  const roll = Math.floor(Math.random() * 20) + 1;
  const success = roll >= needed;

  const promoSpeed = company?.promotionSpeed ?? 1.0;
  const progressGain = success ? 15 * promoSpeed : (Math.random() < 0.25 ? -2 : 0);

  return { roll, needed, success, progressGain };
}

/**
 * Process career each week: performance growth, D20 events, raises (annual), promotions.
 */
export function processCareerTick(
  state: GameState,
  globalWeek: number
): CareerTickResult {
  const career = state.career ?? { ...INITIAL_CAREER_STATE };
  const updatedCareer = { ...career };
  let gotRaise = false;
  let promotionTitle: string | null = null;
  let promotionBlockedReason: string | null = null;
  let performanceEvent: { roll: number; needed: number; success: boolean } | null = null;

  if (!career.companyId || !career.careerPathId || career.positionLevel <= 0) {
    return { updatedCareer, salary: 0, gotRaise: false, promotionTitle: null, promotionBlockedReason: null, performanceEvent: null };
  }

  const company = (companiesData as any[]).find((c) => c?.id === career.companyId);
  const path = (careerPathsData as any[]).find((p) => p?.id === career.careerPathId);
  if (!company || !path) {
    return { updatedCareer, salary: 0, gotRaise: false, promotionTitle: null, promotionBlockedReason: null, performanceEvent: null };
  }

  updatedCareer.weeksInPosition = (career.weeksInPosition ?? 0) + 1;
  updatedCareer.weeksAtCompany = (career.weeksAtCompany ?? 0) + 1;

  const perfGrowth = 0.2 + (company.culture ?? 3) * 0.05;
  updatedCareer.performance = Math.min(100, (career.performance ?? 50) + perfGrowth);

  updatedCareer.networkingScore = Math.min(100, (career.networkingScore ?? 0) + 0.1);

  // D20 Performance Event every 5 weeks
  const weeksSinceEvent = globalWeek - (career.lastPerformanceEventWeek ?? 0);
  if (weeksSinceEvent >= 5 && career.companyId) {
    const event = rollPerformanceEvent(career, state.skills ?? {}, state.knowledge ?? {}, company);
    updatedCareer.promotionProgress = Math.max(0, Math.min(100, (updatedCareer.promotionProgress ?? 0) + event.progressGain));
    updatedCareer.lastPerformanceEventWeek = globalWeek;
    performanceEvent = { roll: event.roll, needed: event.needed, success: event.success };
  }

  // Annual raise check (~every 20 weeks = 1 year); bounded by max
  const currentPos = (path.positions as any[]).find((p: any) => p?.level === career.positionLevel);
  const { max: posMax } = currentPos ? getPositionSalaryRange(currentPos) : { max: Infinity };
  const baseSalary = currentPos?.baseSalary ?? 0;
  const companyMult = company.salaryMultiplier ?? 1.0;
  const currentAbs = baseSalary * companyMult * (updatedCareer.salaryBonus ?? 1.0);

  const weeksSinceRaise = globalWeek - (career.lastRaiseWeek ?? 0);
  if (weeksSinceRaise >= 20 && (career.performance ?? 50) >= 40 && currentAbs < posMax) {
    const raisePercent = 0.03 + Math.random() * 0.05;
    updatedCareer.salaryBonus = (career.salaryBonus ?? 1.0) * (1 + raisePercent);
    updatedCareer.lastRaiseWeek = globalWeek;
    gotRaise = true;
  }

  // Promotion check: promote at 100% progress (D20 system already gates readiness)
  if ((updatedCareer.promotionProgress ?? 0) >= 100) {
    const positions = path.positions as any[];
    const currentLevel = updatedCareer.positionLevel ?? 1;
    const nextPosition = positions.find((p: any) => p?.level === currentLevel + 1);
    if (nextPosition) {
      const carTiers: Record<string, number> = { none: 0, used_car: 1, sedan: 2, suv: 3, sports_car: 4, luxury_car: 5 };
      const needsSuv = nextPosition.level >= 3;
      const hasRequiredCar = !needsSuv || (carTiers[state.currentCarId ?? 'none'] ?? 0) >= carTiers.suv;
      if (!hasRequiredCar) {
        promotionBlockedReason = `Promotion to ${nextPosition.title} is ready, but you need an SUV or better vehicle.`;
      } else {
      // Preserve current salary unless below new position's minSalary
      const { min: newMin } = getPositionSalaryRange(nextPosition);
      const newBase = nextPosition.baseSalary ?? 0;
      const preservedSalary = Math.max(newMin, currentAbs);
      const newBonus = newBase * companyMult > 0
        ? preservedSalary / (newBase * companyMult)
        : 1.0;
      updatedCareer.positionLevel = nextPosition.level;
      updatedCareer.weeksInPosition = 0;
      updatedCareer.performance = Math.max(50, (career.performance ?? 50) - 10);
      updatedCareer.promotionProgress = 0;
      updatedCareer.salaryBonus = Math.max(1.0, newBonus);
      promotionTitle = nextPosition.title;
      }
    }
  }

  const salary = getCareerSalary(updatedCareer, state.inflationMultiplier ?? 1, (state as any).profile);
  return { updatedCareer, salary, gotRaise, promotionTitle, promotionBlockedReason, performanceEvent };
}

export function getCompaniesForPath(pathId: string): any[] {
  return (companiesData as any[]).filter((c) => (c.careerPaths ?? []).includes(pathId));
}

export function getCareerPath(pathId: string): any | null {
  return (careerPathsData as any[]).find((p) => p?.id === pathId) ?? null;
}

export function getCompany(companyId: string): any | null {
  return (companiesData as any[]).find((c) => c?.id === companyId) ?? null;
}
