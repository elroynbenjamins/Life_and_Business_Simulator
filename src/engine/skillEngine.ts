import { GameState, CareerState } from '../types/game';
import careerPathsData from '../data/career_paths.json';

/**
 * Get mastery level label for a skill/knowledge value (0-100).
 */
export function getMasteryLevel(value: number): { label: string; stars: number } {
  if (value >= 80) return { label: 'Master', stars: 5 };
  if (value >= 60) return { label: 'Expert', stars: 4 };
  if (value >= 40) return { label: 'Advanced', stars: 3 };
  if (value >= 20) return { label: 'Intermediate', stars: 2 };
  if (value >= 5) return { label: 'Beginner', stars: 1 };
  return { label: 'Novice', stars: 0 };
}

/**
 * Calculate skill growth from working a job this week.
 * Skills grow slowly (+0.1-0.3 per week) based on the career path.
 */
export function processSkillGrowth(
  skills: Record<string, number>,
  career: CareerState,
  knowledge?: Record<string, number>
): { updatedSkills: Record<string, number>; gains: Record<string, number>; updatedKnowledge: Record<string, number>; knowledgeGains: Record<string, number> } {
  const gains: Record<string, number> = {};
  const knowledgeGains: Record<string, number> = {};
  const updatedSkills = { ...skills };
  const updatedKnowledge = { ...(knowledge ?? {}) };

  if (!career.companyId || !career.careerPathId) return { updatedSkills, gains, updatedKnowledge, knowledgeGains };

  const path = (careerPathsData as any[]).find((p) => p?.id === career.careerPathId);
  if (!path) return { updatedSkills, gains, updatedKnowledge, knowledgeGains };

  const position = (path.positions as any[]).find((p: any) => p?.level === career.positionLevel);
  if (!position) return { updatedSkills, gains, updatedKnowledge, knowledgeGains };

  // Grow skills that are required for current and next positions
  const relevantSkills = new Set<string>();
  const relevantKnowledge = new Set<string>();
  for (const pos of path.positions as any[]) {
    for (const sk of Object.keys(pos?.reqSkills ?? {})) relevantSkills.add(sk);
    for (const kn of Object.keys(pos?.reqKnowledge ?? {})) relevantKnowledge.add(kn);
  }

  for (const skillId of relevantSkills) {
    const current = updatedSkills[skillId] ?? 0;
    if (current >= 100) continue;
    const baseGrowth = 0.15 + (career.positionLevel * 0.03);
    const diminishing = 1 - (current / 150);
    const growth = Math.max(0.05, baseGrowth * diminishing);
    const roundedGrowth = Math.round(growth * 100) / 100;
    updatedSkills[skillId] = Math.min(100, current + roundedGrowth);
    if (roundedGrowth > 0) gains[skillId] = roundedGrowth;
  }

  // Knowledge also grows from working (slightly slower than skills)
  for (const knId of relevantKnowledge) {
    const current = updatedKnowledge[knId] ?? 0;
    if (current >= 100) continue;
    const baseGrowth = 0.12 + (career.positionLevel * 0.025);
    const diminishing = 1 - (current / 150);
    const growth = Math.max(0.04, baseGrowth * diminishing);
    const roundedGrowth = Math.round(growth * 100) / 100;
    updatedKnowledge[knId] = Math.min(100, current + roundedGrowth);
    if (roundedGrowth > 0) knowledgeGains[knId] = roundedGrowth;
  }

  return { updatedSkills, gains, updatedKnowledge, knowledgeGains };
}

/**
 * Apply knowledge/skill rewards from completing a course.
 */
export function applyEducationRewards(
  skills: Record<string, number>,
  knowledge: Record<string, number>,
  courseData: { skillRewards?: Record<string, number>; knowledgeRewards?: Record<string, number> }
): { updatedSkills: Record<string, number>; updatedKnowledge: Record<string, number> } {
  const updatedSkills = { ...skills };
  const updatedKnowledge = { ...knowledge };

  if (courseData.skillRewards) {
    for (const [key, val] of Object.entries(courseData.skillRewards)) {
      updatedSkills[key] = Math.min(100, (updatedSkills[key] ?? 0) + val);
    }
  }
  if (courseData.knowledgeRewards) {
    for (const [key, val] of Object.entries(courseData.knowledgeRewards)) {
      updatedKnowledge[key] = Math.min(100, (updatedKnowledge[key] ?? 0) + val);
    }
  }

  return { updatedSkills, updatedKnowledge };
}

/**
 * Check if a player meets the requirements for a career position.
 */
export function meetsPositionRequirements(
  position: { reqKnowledge: Record<string, number>; reqSkills: Record<string, number>; reqWeeks: number },
  knowledge: Record<string, number>,
  skills: Record<string, number>,
  totalWeeksWorked: number
): boolean {
  for (const [key, val] of Object.entries(position.reqKnowledge)) {
    if ((knowledge[key] ?? 0) < val) return false;
  }
  for (const [key, val] of Object.entries(position.reqSkills)) {
    if ((skills[key] ?? 0) < val) return false;
  }
  if (totalWeeksWorked < position.reqWeeks) return false;
  return true;
}
