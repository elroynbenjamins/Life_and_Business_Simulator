import {
  ChildLifePath,
  ChildPersonality,
  FamilyWorkArrangement,
  GameState,
  RelationshipCandidate,
  RelationshipChild,
  RelationshipConnection,
  RelationshipEvent,
  RelationshipFinancialSnapshot,
  RelationshipState,
} from '../types/game';
import namesData from '../data/relationship_names.json';
import occupationsData from '../data/relationship_occupations.json';
import housingData from '../data/housing.json';
import { getNetWorth, getWeeklySalary, getWeeklyRent, getWeeklyUtilityCost, getWeeklyFoodCost } from './financeEngine';
import { getCareerSalary } from './careerEngine';
import { annualDeathChance } from './lifecycleEngine';

const FINANCIAL_STYLES = ['frugal', 'balanced', 'luxury'] as const;
const RISK = ['cautious', 'balanced', 'risk_taking'] as const;
const AMBITION = ['relaxed', 'career_minded', 'driven'] as const;
const FAMILY = ['no_children', 'unsure', 'wants_children'] as const;

const INDEPENDENCE = ['close', 'balanced', 'independent'] as const;
const RESILIENCE = ['fragile', 'balanced', 'resilient'] as const;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function getChildPersonality(
  childId: string,
  partner?: RelationshipConnection | null,
): ChildPersonality {
  const hash = stableHash(childId);
  const ambition = partner && hash % 3 === 0 ? partner.ambition : AMBITION[hash % AMBITION.length];
  const financialStyle = partner && hash % 4 === 0
    ? partner.financialStyle
    : FINANCIAL_STYLES[Math.floor(hash / 7) % FINANCIAL_STYLES.length];
  const riskTolerance = partner && hash % 5 === 0
    ? partner.riskTolerance
    : RISK[Math.floor(hash / 13) % RISK.length];

  return {
    ambition,
    financialStyle,
    riskTolerance,
    independence: INDEPENDENCE[Math.floor(hash / 17) % INDEPENDENCE.length],
    resilience: RESILIENCE[Math.floor(hash / 23) % RESILIENCE.length],
  };
}

export function getChildFuturePotential(child: RelationshipChild): {
  score: number;
  label: 'Developing' | 'Solid' | 'Strong' | 'Exceptional';
  strengths: string[];
  risks: string[];
} {
  const personality = child.personality ?? getChildPersonality(child.id);
  let score = 38;
  const strengths: string[] = [];
  const risks: string[] = [];

  if (child.educationOutcome === 'elite') { score += 18; strengths.push('Elite education start'); }
  else if (child.educationOutcome === 'strong') { score += 12; strengths.push('Strong education'); }
  else if (child.educationOutcome === 'solid') score += 7;
  else if (child.educationOutcome === 'limited') { score -= 5; risks.push('Limited education start'); }

  const developmentScore = Math.max(0, child.developmentScore ?? 0);
  if (developmentScore >= 30) { score += 8; strengths.push('Strong early development'); }
  else if (developmentScore >= 15) score += 4;
  const lifePath = child.lifePath;
  if (lifePath === 'academic' && ['strong', 'elite'].includes(child.educationOutcome ?? '')) { score += 4; strengths.push('Academic direction'); }
  if (lifePath === 'entrepreneurial') { strengths.push('Entrepreneurial direction'); }
  if (lifePath === 'practical') { score += 2; strengths.push('Practical direction'); }

  if (personality.ambition === 'driven') { score += 12; strengths.push('Driven'); }
  else if (personality.ambition === 'career_minded') score += 7;
  else { score -= 3; }

  if (personality.resilience === 'resilient') { score += 10; strengths.push('Resilient'); }
  else if (personality.resilience === 'fragile') { score -= 8; risks.push('Setbacks hit harder'); }

  if (personality.riskTolerance === 'risk_taking') {
    score += 3;
    risks.push('Higher-risk decisions');
  }
  if ((child.savings ?? 0) >= 100000) { score += 10; strengths.push('Strong savings'); }
  else if ((child.savings ?? 0) >= 25000) score += 5;

  if (child.homeStatus === 'homeowner') score += 4;
  if (child.adultStatus === 'entrepreneur') { score += 8; strengths.push('Entrepreneurial experience'); }
  if (child.adultStatus === 'unemployed') { score -= 10; risks.push('Currently unemployed'); }
  if ((child.debt ?? 0) > Math.max(25000, (child.savings ?? 0))) { score -= 8; risks.push('High personal debt'); }
  if ((child.failureCount ?? 0) >= 2) risks.push('Multiple past setbacks');

  const parentRelationship = child.parentRelationship ?? 75;
  if (parentRelationship >= 85) { score += 4; strengths.push('Strong family bond'); }
  else if (parentRelationship < 40) { score -= 8; risks.push('Weak family bond'); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 82 ? 'Exceptional' : score >= 67 ? 'Strong' : score >= 48 ? 'Solid' : 'Developing';
  return { score, label, strengths: strengths.slice(0, 3), risks: risks.slice(0, 3) };
}

const HOUSING_CAPACITY: Record<string, number> = {
  cheap_apartment: 1,
  studio_apartment: 2,
  small_house: 3,
  family_house: 5,
  luxury_villa: 6,
  mansion: 8,
};

function globalWeek(state: Pick<GameState, 'year' | 'week'>): number {
  return ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
}

function randomOf<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function candidateGender(preference: RelationshipState['preference']): 'woman' | 'man' {
  if (preference === 'women') return 'woman';
  if (preference === 'men') return 'man';
  return Math.random() < 0.5 ? 'woman' : 'man';
}

export function getNormalizedDatingAgeGap(playerAge: number): number {
  if (playerAge < 25) return 4;
  if (playerAge < 40) return 6;
  return 8;
}

export function getNormalizedDatingAgeBounds(playerAge: number): { min: number; max: number } {
  const gap = getNormalizedDatingAgeGap(playerAge);
  return {
    min: Math.max(18, playerAge - gap),
    max: Math.max(18, playerAge + gap),
  };
}

export function isNormalizedAgeMatch(playerAge: number, partnerAge: number): boolean {
  const bounds = getNormalizedDatingAgeBounds(playerAge);
  return partnerAge >= bounds.min && partnerAge <= bounds.max;
}

export function getFamilyFormationProfile(
  playerAge: number,
  partnerAge: number,
  childCount: number,
): { allowedByAge: boolean; baseSuccessChance: number; durationWeeks: number; maxChildren: number } {
  const oldestAge = Math.max(playerAge, partnerAge);
  const youngestAge = Math.min(playerAge, partnerAge);
  const maxChildren = 3;
  const allowedByAge = youngestAge >= 21 && oldestAge <= 42 && childCount < maxChildren;

  const baseSuccessChance = !allowedByAge ? 0
    : oldestAge <= 24 ? 0.25
      : oldestAge <= 29 ? 0.65
        : oldestAge <= 34 ? 0.85
          : oldestAge <= 39 ? 0.60
            : 0.25;

  const childCountMultiplier = childCount === 0 ? 1 : childCount === 1 ? 0.85 : 0.55;
  const durationWeeks = oldestAge <= 34 ? 6 : oldestAge <= 39 ? 8 : 10;

  return {
    allowedByAge,
    baseSuccessChance: baseSuccessChance * childCountMultiplier,
    durationWeeks,
    maxChildren,
  };
}

export const PARTNER_CAREER_SYSTEM_VERSION = 2;
export const PARTNER_CAREER_MAX_LEVEL = 8;
const PARTNER_CAREER_CHECK_WEEKS = 10;

export function getPartnerCareerStartingLevel(
  age: number,
  ambition: RelationshipConnection['ambition'],
): number {
  const careerYears = Math.max(0, Math.floor(age) - 20);
  let level = 1 + Math.floor(careerYears / 6);
  if (ambition === 'driven' && careerYears >= 4) level += 1;
  if (ambition === 'relaxed' && careerYears >= 12) level -= 1;
  return Math.max(1, Math.min(PARTNER_CAREER_MAX_LEVEL, level));
}

function getPartnerOccupationBaseIncome(connection: Pick<RelationshipConnection, 'occupationId' | 'weeklyIncome'>): number {
  const occupation = (occupationsData as any[]).find((item) => item.id === connection.occupationId);
  return Math.max(450, Math.round(occupation?.baseWeeklyIncome ?? connection.weeklyIncome ?? 650));
}

export function normalizePartnerCareerConnection(
  connection: RelationshipConnection,
  gw: number,
): RelationshipConnection {
  const existingLevel = Math.max(1, Math.round(connection.careerLevel ?? 1));
  const inferredLevel = getPartnerCareerStartingLevel(connection.age ?? 20, connection.ambition);
  const careerLevel = connection.careerSystemVersion === PARTNER_CAREER_SYSTEM_VERSION
    ? existingLevel
    : Math.max(existingLevel, inferredLevel);
  const employmentStatus = connection.employmentStatus ?? 'employed';
  const baseIncome = getPartnerOccupationBaseIncome(connection);
  const seniorityIncomeFloor = Math.round(baseIncome * (1 + (careerLevel - 1) * 0.05) * 0.88);
  const currentIncome = Math.max(0, connection.weeklyIncome ?? 0);
  const lastEmployedWeeklyIncome = Math.max(
    connection.lastEmployedWeeklyIncome ?? 0,
    currentIncome,
    seniorityIncomeFloor,
  );

  return {
    ...connection,
    employmentStatus,
    unemploymentWeeks: Math.max(0, connection.unemploymentWeeks ?? 0),
    careerLevel,
    careerProgressWeeks: Math.max(0, connection.careerProgressWeeks ?? 0),
    weeklyIncome: employmentStatus === 'unemployed'
      ? 0
      : Math.max(currentIncome, seniorityIncomeFloor),
    lastEmployedWeeklyIncome,
    lastCareerEventWeek: connection.lastCareerEventWeek && connection.lastCareerEventWeek > 0
      ? connection.lastCareerEventWeek
      : Math.max(1, gw),
    careerSystemVersion: PARTNER_CAREER_SYSTEM_VERSION,
  };
}

function weightedCandidateAge(
  playerAge: number,
  minAge: number,
  maxAge: number,
): number {
  const maxGap = getNormalizedDatingAgeGap(playerAge);
  const coreGap = playerAge < 25 ? 3 : playerAge < 40 ? 4 : 5;
  const useCore = Math.random() < 0.85;
  const chosenGap = useCore
    ? Math.floor(Math.random() * (Math.min(coreGap, maxGap) + 1))
    : Math.min(maxGap, coreGap + 1 + Math.floor(Math.random() * Math.max(1, maxGap - coreGap)));
  const direction = Math.random() < 0.5 ? -1 : 1;
  const rawAge = playerAge + direction * chosenGap;
  return Math.max(minAge, Math.min(maxAge, rawAge));
}

export function generateRelationshipCandidates(state: GameState, count = 3): RelationshipCandidate[] {
  const relationship = state.relationshipState;
  if (!relationship?.preferencesSet) return [];

  const women = (namesData as any).women as string[];
  const men = (namesData as any).men as string[];
  const seen = new Set((relationship.activeConnections ?? []).map((c) => c.name));
  const candidates: RelationshipCandidate[] = [];

  let attempts = 0;
  while (candidates.length < count && attempts < 50) {
    attempts += 1;
    const gender = candidateGender(relationship.preference);
    const pool = gender === 'woman' ? women : men;
    const name = randomOf(pool);
    if (seen.has(name) || candidates.some((c) => c.name === name)) continue;

    const bounds = getNormalizedDatingAgeBounds(state.age ?? 20);
    const preferredMin = (state.age ?? 20) + (relationship.minAgeOffset ?? ((relationship.minAge ?? state.age) - (state.age ?? 20)));
    const preferredMax = (state.age ?? 20) + (relationship.maxAgeOffset ?? ((relationship.maxAge ?? state.age) - (state.age ?? 20)));
    let minAge = Math.max(bounds.min, preferredMin);
    let maxAge = Math.min(bounds.max, preferredMax);
    if (minAge > maxAge) {
      minAge = bounds.min;
      maxAge = bounds.max;
    }
    const age = weightedCandidateAge(state.age ?? 20, minAge, maxAge);
    const occupation = randomOf(occupationsData as any[]);
    const ambition = randomOf(AMBITION);
    const careerLevel = getPartnerCareerStartingLevel(age, ambition);
    const incomeVariation = 0.85 + Math.random() * 0.3;
    const seniorityMultiplier = 1 + (careerLevel - 1) * 0.05;
    const weeklyIncome = Math.round(
      (occupation.baseWeeklyIncome ?? 700) * incomeVariation * seniorityMultiplier
    );
    const savings = Math.max(0, Math.round(weeklyIncome * (2 + Math.random() * 18)));

    candidates.push({
      id: `rel_${globalWeek(state)}_${candidates.length}_${Math.floor(Math.random() * 1_000_000)}`,
      name,
      gender,
      age,
      occupationId: occupation.id,
      occupationTitle: startsEntrepreneur ? 'Young Entrepreneur' : occupation.title,
      weeklyIncome,
      careerLevel,
      savings,
      financialStyle: randomOf(FINANCIAL_STYLES),
      riskTolerance: randomOf(RISK),
      ambition,
      familyGoal: randomOf(FAMILY),
      visibleTraits: [],
    });
  }
  return candidates;
}

export function getDateCost(kind: 'coffee' | 'dinner' | 'activity', inflationMultiplier = 1): number {
  const base = kind === 'coffee' ? 25 : kind === 'dinner' ? 110 : 175;
  return Math.round(base * inflationMultiplier);
}

export function getProposalCost(kind: 'simple' | 'classic' | 'luxury', inflationMultiplier = 1): number {
  const base = kind === 'simple' ? 750 : kind === 'classic' ? 3000 : 10000;
  return Math.round(base * inflationMultiplier);
}

export function getWeddingCost(kind: 'courthouse' | 'standard' | 'luxury', inflationMultiplier = 1): number {
  // Weddings are intended to be a meaningful mid-game money sink rather than a token fee.
  const base = kind === 'courthouse' ? 5000 : kind === 'standard' ? 30000 : 120000;
  return Math.round(base * inflationMultiplier);
}

export function getWeddingPersonalityFit(
  partner: Pick<RelationshipConnection, 'financialStyle' | 'riskTolerance' | 'ambition'>,
  kind: 'courthouse' | 'standard' | 'luxury',
): { relationshipBonus: number; label: 'Great fit' | 'Good fit' | 'Mixed fit'; note: string } {
  let score = kind === 'courthouse' ? 2 : kind === 'standard' ? 4 : 6;

  if (partner.financialStyle === 'frugal') score += kind === 'courthouse' ? 5 : kind === 'standard' ? 1 : -6;
  if (partner.financialStyle === 'balanced') score += kind === 'standard' ? 3 : 0;
  if (partner.financialStyle === 'luxury') score += kind === 'luxury' ? 5 : kind === 'standard' ? 2 : -2;

  if (partner.riskTolerance === 'cautious') score += kind === 'courthouse' ? 2 : kind === 'luxury' ? -2 : 0;
  if (partner.riskTolerance === 'risk_taking') score += kind === 'luxury' ? 2 : 0;

  if (partner.ambition === 'driven') score += kind === 'courthouse' ? 2 : kind === 'luxury' ? -1 : 1;
  if (partner.ambition === 'relaxed') score += kind === 'luxury' ? 1 : 0;

  const relationshipBonus = Math.max(1, Math.min(14, score));
  const label = relationshipBonus >= 9 ? 'Great fit' : relationshipBonus >= 5 ? 'Good fit' : 'Mixed fit';
  const note = partner.financialStyle === 'frugal'
    ? 'They value meaning and financial restraint.'
    : partner.financialStyle === 'luxury'
      ? 'They enjoy a memorable, high-end celebration.'
      : partner.ambition === 'driven'
        ? 'They appreciate a celebration that does not derail long-term plans.'
        : 'They prefer a balanced celebration and shared experience.';

  return { relationshipBonus, label, note };
}

type AnniversaryCelebrationKind = 'intimate' | 'party' | 'trip';
type ChildCelebrationKind = 'family' | 'party' | 'experience';

function anniversaryRelationshipGain(partner: RelationshipConnection, kind: AnniversaryCelebrationKind): number {
  let gain = kind === 'intimate' ? 5 : kind === 'party' ? 7 : 8;
  if (partner.financialStyle === 'frugal') gain += kind === 'intimate' ? 4 : kind === 'party' ? -2 : -1;
  if (partner.financialStyle === 'luxury') gain += kind === 'party' ? 3 : kind === 'trip' ? 3 : -1;
  if (partner.riskTolerance === 'cautious') gain += kind === 'intimate' ? 2 : kind === 'trip' ? -1 : 0;
  if (partner.riskTolerance === 'risk_taking' && kind === 'trip') gain += 3;
  if (partner.ambition === 'driven') gain += kind === 'intimate' ? 2 : kind === 'trip' ? -2 : 0;
  if (partner.ambition === 'relaxed') gain += kind === 'trip' ? 2 : kind === 'party' ? 1 : 0;
  return Math.max(2, Math.min(14, gain));
}

function childCelebrationGain(child: RelationshipChild, kind: ChildCelebrationKind): number {
  const personality = child.personality ?? getChildPersonality(child.id);
  let gain = kind === 'family' ? 4 : kind === 'party' ? 6 : 7;
  if (personality.financialStyle === 'frugal') gain += kind === 'family' ? 3 : kind === 'party' ? -2 : 1;
  if (personality.financialStyle === 'luxury' && kind === 'party') gain += 3;
  if (personality.riskTolerance === 'risk_taking' && kind === 'experience') gain += 3;
  if (personality.riskTolerance === 'cautious' && kind === 'family') gain += 2;
  if (personality.independence === 'independent') gain += kind === 'experience' ? 3 : kind === 'party' ? -1 : 0;
  if (personality.independence === 'close' && kind === 'family') gain += 3;
  if (personality.ambition === 'driven' && kind === 'experience') gain += 2;
  return Math.max(2, Math.min(14, gain));
}

function personalityFitHint(gain: number): string {
  return gain >= 10 ? 'Great personality fit' : gain >= 7 ? 'Good personality fit' : 'Mixed personality fit';
}

export function getChildNaturalLifePath(child: RelationshipChild): ChildLifePath {
  const personality = child.personality ?? getChildPersonality(child.id);
  if (personality.ambition === 'driven' && personality.riskTolerance === 'risk_taking') return 'entrepreneurial';
  if (personality.ambition !== 'relaxed' && personality.riskTolerance === 'cautious') return 'academic';
  if (personality.independence === 'independent' && personality.riskTolerance === 'risk_taking') return 'practical';
  if (personality.ambition === 'relaxed' && personality.financialStyle === 'luxury') return 'creative';
  if (personality.resilience === 'resilient' && personality.riskTolerance === 'risk_taking') return 'athletic';
  const variants: ChildLifePath[] = ['academic', 'creative', 'athletic', 'practical', 'balanced'];
  return variants[stableHash(child.id) % variants.length];
}

function alternateChildLifePath(path: ChildLifePath): ChildLifePath {
  const order: ChildLifePath[] = ['academic', 'creative', 'athletic', 'entrepreneurial', 'practical', 'balanced'];
  return order[(order.indexOf(path) + 1) % order.length];
}

function lifePathLabel(path: ChildLifePath): string {
  if (path === 'entrepreneurial') return 'entrepreneurial';
  return path;
}

function preferredOccupationIdsForLifePath(path: ChildLifePath): string[] {
  if (path === 'academic') return ['researcher', 'teacher', 'accounting', 'developer', 'engineer', 'doctor', 'consultant'];
  if (path === 'creative') return ['designer', 'content_creator', 'marketing'];
  if (path === 'athletic') return ['personal_trainer', 'sports_coach'];
  if (path === 'practical') return ['technician', 'logistics_specialist', 'nurse', 'admin'];
  if (path === 'entrepreneurial') return ['marketing', 'consultant', 'manager', 'accounting'];
  return [];
}

function countMemoryTag(state: GameState, tag: string, partnerId?: string | null): number {
  return (state.relationshipState?.memories ?? []).filter((memory) =>
    memory.tag === tag && (partnerId == null || memory.partnerId === partnerId)
  ).length;
}

export function createWorkFamilyConflictEvent(
  state: GameState,
  partner: RelationshipConnection,
  children: RelationshipChild[],
): RelationshipEvent | null {
  const hasCareerV2 = !!state.career?.companyId;
  const hasCareer = hasCareerV2 || !!state.currentJobId;
  const targetBusiness = [...(state.businesses ?? [])].sort((a, b) => (b.valuation ?? 0) - (a.valuation ?? 0))[0] ?? null;
  if (!hasCareer && !targetBusiness) return null;

  const dependentChildren = children.filter((child) => getChildAge(child, globalWeek(state)) < 18);
  const child = dependentChildren.length > 0
    ? [...dependentChildren].sort((a, b) => getChildAge(b, globalWeek(state)) - getChildAge(a, globalWeek(state)))[0]
    : null;
  const careerFirstCount = countMemoryTag(state, 'career_first', partner.id);
  const familyFirstCount = countMemoryTag(state, 'showed_up_for_family', partner.id);
  const patternNote = careerFirstCount >= 2
    ? ` ${partner.name} points out that choosing work has started to become a pattern.`
    : familyFirstCount >= 2
      ? ` ${partner.name} remembers that you have made room for family before.`
      : '';
  const workContext = hasCareer && targetBusiness
    ? 'your career and business responsibilities'
    : hasCareer
      ? 'an important week at work'
      : `a demanding week at ${targetBusiness?.name ?? 'your business'}`;
  const familyMoment = child
    ? `${child.name} has something important happening at the same time`
    : `${partner.name} has been counting on real time together`;

  const drivenGrace = partner.ambition === 'driven' ? 2 : partner.ambition === 'relaxed' ? -1 : 0;
  const workPenalty = Math.max(-14, -6 - Math.min(6, careerFirstCount * 2) + drivenGrace);
  const familyGain = Math.min(11, 6 + Math.min(3, careerFirstCount));

  return {
    id: child ? 'work_family_conflict_child' : 'work_family_conflict_partner',
    icon: '⚖️',
    title: child ? 'Work or a Family Moment?' : 'Work or Time Together?',
    description: `A clash has come up between ${workContext} and home: ${familyMoment}.${patternNote}`,
    choices: [
      {
        text: child ? `Show up fully for ${child.name}` : `Protect the time with ${partner.name}`,
        relationship: familyGain,
        childId: child?.id,
        childRelationship: child ? 7 : undefined,
        careerPerformanceDelta: hasCareerV2 ? -7 : undefined,
        businessId: targetBusiness?.id,
        businessReputationDelta: targetBusiness ? -1 : undefined,
        businessMoraleDelta: targetBusiness ? -1 : undefined,
        memoryTag: 'showed_up_for_family',
        memoryLabel: child ? `Chose ${child.name}'s important moment over work` : 'Protected family time during a work conflict',
        memorySentiment: 'positive',
        personalityHint: partner.ambition === 'driven' ? 'Family appreciates it; work takes a real hit' : 'Strong family-first fit',
      },
      {
        text: 'Split the difference',
        relationship: 3,
        childId: child?.id,
        childRelationship: child ? 3 : undefined,
        careerPerformanceDelta: hasCareerV2 ? -2 : undefined,
        memoryTag: 'balanced_work_family',
        memoryLabel: 'Tried to balance work and family',
        memorySentiment: 'mixed',
        personalityHint: 'Balanced compromise',
      },
      {
        text: 'Prioritize work',
        relationship: workPenalty,
        childId: child?.id,
        childRelationship: child ? -5 - Math.min(3, careerFirstCount) : undefined,
        careerPerformanceDelta: hasCareerV2 ? 5 : undefined,
        businessId: targetBusiness?.id,
        businessReputationDelta: targetBusiness ? 2 : undefined,
        businessMoraleDelta: targetBusiness ? 1 : undefined,
        memoryTag: 'career_first',
        memoryLabel: child ? `Missed ${child.name}'s important moment for work` : 'Put work ahead of family time',
        memorySentiment: careerFirstCount > 0 ? 'negative' : 'mixed',
        personalityHint: partner.ambition === 'driven' ? 'They understand ambition, but still notice the choice' : 'Likely family strain',
      },
    ],
  };
}

function getMarriageMilestoneEvent(
  state: GameState,
  partner: RelationshipConnection,
  celebrated: string[],
): RelationshipEvent | null {
  if (partner.stage !== 'married' || !partner.marriedWeek) return null;
  const years = Math.floor(Math.max(0, globalWeek(state) - partner.marriedWeek) / 20);
  const milestone = [50, 40, 30, 20, 10, 5].find((value) => years >= value);
  if (!milestone) return null;
  const milestoneKey = `marriage_${partner.id}_${milestone}y`;
  if (celebrated.includes(milestoneKey)) return null;

  const inflation = state.inflationMultiplier ?? 1;
  const scale = 1 + milestone / 10;
  const intimateCost = Math.round(1000 * scale * inflation);
  const partyCost = Math.round(4500 * scale * inflation);
  const tripCost = Math.round(7000 * scale * inflation);
  const tripWeeks = milestone >= 20 ? 2 : 1;
  const intimateWeddingMemory = countMemoryTag(state, 'intimate_wedding', partner.id) > 0;
  const standardWeddingMemory = countMemoryTag(state, 'standard_wedding', partner.id) > 0;
  const luxuryWeddingMemory = countMemoryTag(state, 'luxury_wedding', partner.id) > 0;
  const intimateGain = anniversaryRelationshipGain(partner, 'intimate') + (intimateWeddingMemory ? 2 : 0);
  const partyGain = anniversaryRelationshipGain(partner, 'party') + (standardWeddingMemory || luxuryWeddingMemory ? 2 : 0);
  const tripGain = anniversaryRelationshipGain(partner, 'trip') + (luxuryWeddingMemory ? 1 : 0);
  const weddingEcho = intimateWeddingMemory
    ? ' Your intimate wedding still shapes how you tend to celebrate together.'
    : luxuryWeddingMemory
      ? ' Your wedding set a tradition of making major moments memorable.'
      : standardWeddingMemory
        ? ' You have usually marked major moments with a proper celebration.'
        : '';

  return {
    id: `marriage_anniversary_${milestone}`,
    milestoneKey,
    icon: '💍',
    title: `${milestone}-Year Anniversary`,
    description: `You and ${partner.name} have been married for ${milestone} years. It feels like a moment worth marking in a way that fits the life you built together.${weddingEcho}`,
    choices: [
      {
        text: `Meaningful celebration (€${intimateCost.toLocaleString()})`,
        cost: intimateCost,
        relationship: intimateGain,
        personalityHint: personalityFitHint(intimateGain),
        memoryTag: 'simple_family_tradition',
        memoryLabel: `Marked the ${milestone}-year anniversary meaningfully`,
        memorySentiment: 'positive',
        happiness: 5,
        happinessDuration: 4,
      },
      {
        text: `Host a big anniversary party (€${partyCost.toLocaleString()})`,
        cost: partyCost,
        relationship: partyGain,
        personalityHint: personalityFitHint(partyGain),
        memoryTag: 'big_family_celebration',
        memoryLabel: `Hosted a big ${milestone}-year anniversary party`,
        memorySentiment: 'positive',
        happiness: 9,
        happinessDuration: 5,
      },
      {
        text: `Take an anniversary trip (€${tripCost.toLocaleString()})`,
        cost: tripCost,
        relationship: tripGain,
        personalityHint: personalityFitHint(tripGain),
        memoryTag: 'world_travellers',
        memoryLabel: `Travelled together for the ${milestone}-year anniversary`,
        memorySentiment: 'positive',
        happiness: 11,
        happinessDuration: 6,
        travelWeeks: tripWeeks,
      },
      {
        text: 'Keep it simple at home',
        relationship: partner.financialStyle === 'frugal' ? 3 : partner.financialStyle === 'luxury' ? -1 : 1,
        personalityHint: partner.financialStyle === 'frugal' ? 'Good personality fit' : 'Low-cost celebration',
        memoryTag: 'simple_family_tradition',
        memoryLabel: `Kept the ${milestone}-year anniversary simple`,
        memorySentiment: 'mixed',
      },
    ],
  };
}

function getChildMilestoneEvent(
  state: GameState,
  children: RelationshipChild[],
  celebrated: string[],
): RelationshipEvent | null {
  const ages = [18, 16, 10, 5];
  for (const child of children) {
    const currentAge = getChildAge(child, globalWeek(state));
    const age = ages.find((value) => currentAge >= value);
    if (!age) continue;
    const milestoneKey = `child_${child.id}_${age}y`;
    if (celebrated.includes(milestoneKey)) continue;

    const inflation = state.inflationMultiplier ?? 1;
    const personality = child.personality ?? getChildPersonality(child.id);
    const naturalPath = getChildNaturalLifePath(child);
    const currentPath = child.lifePath ?? naturalPath;
    const alternatePath = alternateChildLifePath(currentPath);
    const milestoneMemory = age >= 16 ? 'child_independence' as const : 'supported_child_path' as const;

    if (age === 18) {
      const fundNextStep = Math.round(15000 * inflation);
      const bigParty = Math.round(20000 * inflation);
      const experience = Math.round(10000 * inflation);
      return {
        id: 'child_milestone_18',
        milestoneKey,
        icon: '🎓',
        title: `${child.name} Turns 18`,
        description: `${child.name} is stepping into adult life after years of choices that shaped a ${lifePathLabel(currentPath)} direction. This is your last major launch decision before they build an independent life.`,
        choices: [
          {
            text: `Fund their next step (€${fundNextStep.toLocaleString()})`,
            cost: fundNextStep,
            childId: child.id,
            childSavings: fundNextStep,
            childRelationship: 9,
            memoryTag: 'child_independence',
            memoryLabel: `Backed ${child.name}'s launch into adult life`,
            memorySentiment: 'positive',
            personalityHint: personality.independence === 'independent' ? 'Great fit for an independent child' : 'Strong practical support',
            happiness: 6,
            happinessDuration: 4,
          },
          {
            text: `Throw a big 18th party (€${bigParty.toLocaleString()})`,
            cost: bigParty,
            childId: child.id,
            childRelationship: personality.financialStyle === 'luxury' ? 10 : 6,
            memoryTag: 'big_family_celebration',
            memoryLabel: `Threw a major 18th birthday for ${child.name}`,
            memorySentiment: 'positive',
            personalityHint: personality.financialStyle === 'luxury' ? 'Great personality fit' : 'Memorable, but expensive',
            happiness: 9,
            happinessDuration: 5,
          },
          {
            text: `Take a special experience together (€${experience.toLocaleString()})`,
            cost: experience,
            childId: child.id,
            childRelationship: personality.riskTolerance === 'risk_taking' || personality.independence === 'independent' ? 10 : 7,
            memoryTag: 'supported_child_path',
            memoryLabel: `Shared a milestone experience with ${child.name}`,
            memorySentiment: 'positive',
            personalityHint: personality.riskTolerance === 'risk_taking' ? 'Great personality fit' : 'Strong shared memory',
            happiness: 8,
            happinessDuration: 5,
          },
          {
            text: 'Keep the milestone simple at home',
            childId: child.id,
            childRelationship: personality.financialStyle === 'frugal' ? 4 : 1,
            memoryTag: 'simple_family_tradition',
            memoryLabel: `Kept ${child.name}'s 18th birthday simple`,
            memorySentiment: 'mixed',
            personalityHint: personality.financialStyle === 'frugal' ? 'Good personality fit' : 'Low-cost celebration',
          },
        ],
      };
    }

    const base = age === 16 ? 9000 : age === 10 ? 4000 : 1500;
    const focusedCost = Math.round(base * inflation);
    const partyCost = Math.round(base * (age === 16 ? 2.2 : 1.8) * inflation);
    const exploreCost = Math.round(base * 0.7 * inflation);
    const title = age === 16 ? `${child.name}'s Sweet Sixteen & Future` : `${child.name} Turns ${age}`;
    const development = age === 16 ? 15 : age === 10 ? 10 : 6;

    return {
      id: `child_milestone_${age}`,
      milestoneKey,
      icon: age === 16 ? '🧭' : '🎂',
      title,
      description: age === 16
        ? `${child.name} is thinking seriously about what comes after school. Their current ${lifePathLabel(currentPath)} direction reflects earlier family choices and their own personality.`
        : `${child.name} is showing a stronger ${lifePathLabel(naturalPath)} streak. This milestone can shape the interests and confidence they carry forward.`,
      choices: [
        {
          text: age === 16
            ? `Back their ${lifePathLabel(currentPath)} plan (€${focusedCost.toLocaleString()})`
            : `Invest in their ${lifePathLabel(currentPath)} interest (€${focusedCost.toLocaleString()})`,
          cost: focusedCost,
          childId: child.id,
          childLifePath: currentPath,
          childDevelopment: development,
          childEducationFund: age === 16 && currentPath === 'academic' ? Math.round(focusedCost * 0.75) : 0,
          childRelationship: 8,
          memoryTag: milestoneMemory,
          memoryLabel: `Supported ${child.name}'s ${lifePathLabel(currentPath)} direction`,
          memorySentiment: 'positive',
          personalityHint: currentPath === naturalPath ? 'Great personality fit' : 'Builds on their existing path',
          happiness: 5,
          happinessDuration: 4,
        },
        {
          text: `Give them a big milestone party (€${partyCost.toLocaleString()})`,
          cost: partyCost,
          childId: child.id,
          childDevelopment: 2,
          childRelationship: personality.financialStyle === 'luxury' ? 10 : personality.independence === 'close' ? 8 : 5,
          memoryTag: 'big_family_celebration',
          memoryLabel: `Threw a big age-${age} celebration for ${child.name}`,
          memorySentiment: 'positive',
          personalityHint: personality.financialStyle === 'luxury' || personality.independence === 'close' ? 'Great personality fit' : 'Celebration over development',
          happiness: 8,
          happinessDuration: 4,
        },
        {
          text: `Let them explore a ${lifePathLabel(alternatePath)} direction (€${exploreCost.toLocaleString()})`,
          cost: exploreCost,
          childId: child.id,
          childLifePath: alternatePath,
          childDevelopment: Math.max(4, development - 3),
          childEducationFund: age === 16 && alternatePath === 'academic' ? Math.round(exploreCost * 0.6) : 0,
          childRelationship: personality.independence === 'independent' ? 9 : 6,
          memoryTag: 'supported_child_path',
          memoryLabel: `Gave ${child.name} room to explore a new direction`,
          memorySentiment: 'positive',
          personalityHint: personality.independence === 'independent' ? 'Great fit for their independence' : 'Encourages exploration',
        },
        {
          text: 'Keep it simple and let them find their own way',
          childId: child.id,
          childDevelopment: 1,
          childRelationship: personality.financialStyle === 'frugal' ? 4 : 2,
          memoryTag: 'simple_family_tradition',
          memoryLabel: `Kept ${child.name}'s age-${age} milestone simple`,
          memorySentiment: 'mixed',
          personalityHint: personality.financialStyle === 'frugal' ? 'Good personality fit' : 'Low-cost, low-pressure option',
        },
      ],
    };
  }
  return null;
}

export function createFamilyMilestoneEvent(
  state: GameState,
  partner: RelationshipConnection | null,
  children: RelationshipChild[],
): RelationshipEvent | null {
  const celebrated = state.relationshipState?.celebratedMilestones ?? [];
  if (partner) {
    const marriage = getMarriageMilestoneEvent(state, partner, celebrated);
    if (marriage) return marriage;
  }
  return getChildMilestoneEvent(state, children, celebrated);
}

export function getDateConnectionGain(
  connection: RelationshipConnection | RelationshipCandidate,
  kind: 'coffee' | 'dinner' | 'activity'
): number {
  let gain = kind === 'coffee' ? 12 : kind === 'dinner' ? 14 : 15;
  if (connection.financialStyle === 'frugal' && kind === 'coffee') gain += 5;
  if (connection.financialStyle === 'frugal' && kind === 'dinner') gain -= 3;
  if (connection.financialStyle === 'luxury' && kind === 'dinner') gain += 4;
  if (connection.financialStyle === 'luxury' && kind === 'coffee') gain -= 2;
  return Math.max(5, gain + Math.floor(Math.random() * 7) - 3);
}

export function revealNextTrait(connection: RelationshipConnection): RelationshipConnection {
  const order: RelationshipConnection['visibleTraits'] = ['financialStyle', 'ambition', 'familyGoal', 'riskTolerance'];
  const next = order.find((key) => !(connection.visibleTraits ?? []).includes(key));
  if (!next) return connection;
  return { ...connection, visibleTraits: [...(connection.visibleTraits ?? []), next] };
}

export const FAMILY_WORK_ARRANGEMENTS: Record<FamilyWorkArrangement, {
  id: FamilyWorkArrangement;
  label: string;
  description: string;
}> = {
  full_time: {
    id: 'full_time',
    label: 'Both Full-time',
    description: 'Both adults stay at 100% salary. Childcare costs remain highest.',
  },
  both_80: {
    id: 'both_80',
    label: 'Both 80%',
    description: 'Both adults work four days. Each receives 80% of normal salary while the youngest child is under 6.',
  },
  partner_80: {
    id: 'partner_80',
    label: 'Partner 80%',
    description: 'You remain full-time while your partner works 80% until the youngest child reaches 6.',
  },
  partner_primary: {
    id: 'partner_primary',
    label: 'Partner Cares More',
    description: 'Your partner works 60% until age 3, then 80% until the youngest child reaches 6.',
  },
};

export interface FamilyWorkArrangementEffects {
  arrangement: FamilyWorkArrangement;
  active: boolean;
  youngestChildAge: number | null;
  playerWorkFraction: number;
  partnerWorkFraction: number;
  childcareMultiplier: number;
}

function getYoungestChildAge(state: GameState): number | null {
  const children = state.relationshipState?.children ?? [];
  if (children.length === 0) return null;
  return children.reduce(
    (youngest, child) => Math.min(youngest, getChildAge(child, globalWeek(state))),
    Number.POSITIVE_INFINITY,
  );
}

export function getFamilyWorkArrangementEffects(state: GameState): FamilyWorkArrangementEffects {
  const arrangement = state.relationshipState?.familyWorkArrangement ?? 'both_80';
  const youngestChildAge = getYoungestChildAge(state);
  const partner = state.relationshipState?.partnerId
    ? (state.relationshipState.activeConnections ?? []).find(
        (connection) => connection.id === state.relationshipState.partnerId,
      ) ?? null
    : null;
  const sharedHousehold = !!partner
    && (partner.isCohabiting || partner.stage === 'living_together' || partner.stage === 'married');
  const active = sharedHousehold && youngestChildAge != null && youngestChildAge < 6;

  if (!active || arrangement === 'full_time') {
    return {
      arrangement,
      active,
      youngestChildAge,
      playerWorkFraction: 1,
      partnerWorkFraction: 1,
      childcareMultiplier: 1,
    };
  }

  if (arrangement === 'partner_80') {
    return {
      arrangement,
      active: true,
      youngestChildAge,
      playerWorkFraction: 1,
      partnerWorkFraction: 0.8,
      childcareMultiplier: 0.82,
    };
  }

  if (arrangement === 'partner_primary') {
    const veryYoung = (youngestChildAge ?? 6) < 3;
    return {
      arrangement,
      active: true,
      youngestChildAge,
      playerWorkFraction: 1,
      partnerWorkFraction: veryYoung ? 0.6 : 0.8,
      childcareMultiplier: veryYoung ? 0.55 : 0.78,
    };
  }

  return {
    arrangement: 'both_80',
    active: true,
    youngestChildAge,
    playerWorkFraction: 0.8,
    partnerWorkFraction: 0.8,
    childcareMultiplier: 0.70,
  };
}

export function getEffectivePartnerWeeklyIncome(
  connection: RelationshipConnection | null,
  state: GameState,
): number {
  if (!connection || connection.employmentStatus === 'unemployed') return 0;
  const effects = getFamilyWorkArrangementEffects(state);
  return Math.max(0, Math.round((connection.weeklyIncome ?? 0) * effects.partnerWorkFraction));
}

export function getPlayerFamilyWorkFraction(state: GameState): number {
  return getFamilyWorkArrangementEffects(state).playerWorkFraction;
}

export function getChildAge(child: RelationshipChild, currentGlobalWeek: number): number {
  return Math.max(0, Math.floor((currentGlobalWeek - child.birthGlobalWeek) / 20));
}

export function getChildWeeklyCost(child: RelationshipChild, state: GameState): number {
  return getChildCostBreakdown(child, state).total;
}

function getFamilySpendingMultiplier(state: GameState): number {
  const relationship = state.relationshipState;
  if (relationship?.familySpendingMode === 'reduced' && (relationship.familySpendingWeeksRemaining ?? 0) > 0) {
    return 0.82;
  }
  return 1;
}

/** Recurring costs only; education funds and one-off family events remain separate. */
export function getChildCostBreakdown(child: RelationshipChild, state: GameState) {
  const age = getChildAge(child, globalWeek(state));
  // Food, care/school, clothes/health, transport/activities, extra utilities.
  const base = age < 3 ? [45, 75, 30, 10, 15]
    : age < 6 ? [45, 55, 25, 15, 15]
    : age < 12 ? [50, 25, 20, 20, 15]
    : age < 16 ? [65, 30, 25, 25, 20]
    : age < 18 ? [75, 35, 30, 30, 20] : [0, 0, 0, 0, 0];
  const multiplier = (state.inflationMultiplier ?? 1) * getFamilySpendingMultiplier(state);
  const workEffects = getFamilyWorkArrangementEffects(state);
  const food = Math.round(base[0] * multiplier);
  const careSchool = Math.round(
    base[1] * multiplier * (age < 6 ? workEffects.childcareMultiplier : 1),
  );
  const clothingHealth = Math.round(base[2] * multiplier);
  const transportActivities = Math.round(base[3] * multiplier);
  const utilities = Math.round(base[4] * multiplier);
  return { food, careSchool, clothingHealth, transportActivities, utilities,
    total: food + careSchool + clothingHealth + transportActivities + utilities };
}

export function getHouseholdSize(state: GameState): number {
  const partner = state.relationshipState?.partnerId
    ? (state.relationshipState?.activeConnections ?? []).find((c) => c.id === state.relationshipState.partnerId)
    : null;
  const partnerAtHome = partner && (partner.isCohabiting || partner.stage === 'living_together' || partner.stage === 'married') ? 1 : 0;
  const dependentChildren = (state.relationshipState?.children ?? []).filter((child) => getChildAge(child, globalWeek(state)) < 18).length;
  return 1 + partnerAtHome + dependentChildren;
}

export function getHousingCapacity(housingId: string): number {
  return HOUSING_CAPACITY[housingId] ?? 1;
}

export function getRelationshipObligationWeeklyCost(state: GameState): number {
  if (!state.relationshipModeEnabled) return 0;
  return (state.relationshipState?.financialObligations ?? []).reduce((total, obligation) => {
    return total + Math.min(obligation.weeklyPayment ?? 0, obligation.remainingAmount ?? 0);
  }, 0);
}

function getPlayerFullTimeEmploymentIncome(state: GameState): number {
  if (state.career?.companyId) return getCareerSalary(state.career, state.inflationMultiplier ?? 1);
  if (state.currentJobId) return getWeeklySalary(state);
  if (state.partTimeJob) return 350;
  return 0;
}

function getPlayerEmploymentIncome(state: GameState): number {
  const fullIncome = getPlayerFullTimeEmploymentIncome(state);
  if (state.partTimeJob && !state.currentJobId && !state.career?.companyId) return fullIncome;
  return Math.round(fullIncome * getPlayerFamilyWorkFraction(state));
}

export function getFamilyWorkIncomePreview(
  state: GameState,
  connection: RelationshipConnection | null,
) {
  const effects = getFamilyWorkArrangementEffects(state);
  const playerFullTimeIncome = getPlayerFullTimeEmploymentIncome(state);
  const playerEffectiveIncome = state.partTimeJob && !state.currentJobId && !state.career?.companyId
    ? playerFullTimeIncome
    : Math.round(playerFullTimeIncome * effects.playerWorkFraction);
  const partnerFullTimeIncome = Math.max(0, connection?.weeklyIncome ?? 0);
  const partnerEffectiveIncome = connection?.employmentStatus === 'unemployed'
    ? 0
    : Math.round(partnerFullTimeIncome * effects.partnerWorkFraction);

  return {
    ...effects,
    playerFullTimeIncome,
    playerEffectiveIncome,
    partnerFullTimeIncome,
    partnerEffectiveIncome,
  };
}

export function getFamilySupportAmount(state: GameState, grossFamilyCost?: number, partnerIncome = 0): number {
  if (!state.relationshipModeEnabled) return 0;
  const dependentChildren = (state.relationshipState?.children ?? []).filter((child) => getChildAge(child, globalWeek(state)) < 18).length;
  if (dependentChildren <= 0) return 0;

  const familyCost = grossFamilyCost ?? (state.relationshipState?.children ?? []).reduce((total, child) => total + getChildWeeklyCost(child, state), 0);
  if (familyCost <= 0) return 0;

  const inflation = state.inflationMultiplier ?? 1;
  const workEffects = getFamilyWorkArrangementEffects(state);
  const effectivePartnerIncome = Math.max(0, Math.round(partnerIncome * workEffects.partnerWorkFraction));
  const householdIncome = getPlayerEmploymentIncome(state) + effectivePartnerIncome;
  const threshold = Math.round((1100 + dependentChildren * 250) * inflation);
  if (householdIncome >= threshold) return 0;

  const gapRatio = Math.min(1, (threshold - householdIncome) / Math.max(1, threshold * 0.5));
  const supportCap = Math.min(familyCost * 0.35, 220 * inflation + dependentChildren * 35 * inflation);
  return Math.max(0, Math.round(supportCap * gapRatio));
}

export function getFamilyPlanningPreview(state: GameState) {
  const previewChild: RelationshipChild = {
    id: 'preview_child',
    name: 'Child',
    gender: 'boy',
    birthGlobalWeek: globalWeek(state),
    age: 0,
    educationFund: 0,
    status: 'dependent',
    occupationTitle: null,
    weeklyIncome: 0,
    parentRelationship: 75,
    lastParentInteractionWeek: globalWeek(state),
    personality: getChildPersonality('preview_child'),
    adultStatus: 'employed',
    debt: 0,
    failureCount: 0,
    businessValue: 0,
    lastAdultEventYear: 0,
    descendants: [],
    childrenCount: 0,
    otherParentId: state.relationshipState?.partnerId ?? null,
  };
  const nextState: GameState = {
    ...state,
    relationshipState: {
      ...state.relationshipState,
      children: [...(state.relationshipState?.children ?? []), previewChild],
    },
  };
  const childCost = getChildWeeklyCost(previewChild, nextState);
  const partner = state.relationshipState?.partnerId
    ? (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState?.partnerId)
    : null;
  const familySupport = getFamilySupportAmount(nextState, childCost, partner?.weeklyIncome ?? 0);
  const householdSizeAfter = getHouseholdSize(nextState);
  const housingCapacity = getHousingCapacity(state.currentHousingId);
  const housing = housingData as Array<{ id: string; name: string }>;
  const recommendedHousing = householdSizeAfter > housingCapacity
    ? housing.find((item) => getHousingCapacity(item.id) >= householdSizeAfter)?.name ?? 'a larger home'
    : null;

  return {
    childCost,
    familySupport,
    netChildCost: Math.max(0, childCost - familySupport),
    householdSizeAfter,
    housingCapacity,
    recommendedHousing,
  };
}

export function calculatePartnerContribution(
  connection: RelationshipConnection | null,
  state: GameState
): { contribution: number; householdExtraCost: number; familyCost: number; obligationCost: number; familySupport: number; grossFamilyCost: number } {
  if (!state.relationshipModeEnabled) {
    return { contribution: 0, householdExtraCost: 0, familyCost: 0, obligationCost: 0, familySupport: 0, grossFamilyCost: 0 };
  }

  const obligationCost = getRelationshipObligationWeeklyCost(state);
  const children = state.relationshipState?.children ?? [];
  const grossFamilyCost = children.reduce((total, child) => total + getChildWeeklyCost(child, state), 0);
  const partnerIncome = getEffectivePartnerWeeklyIncome(connection, state);
  const rawPartnerIncome = Math.max(0, connection?.weeklyIncome ?? 0);
  const familySupport = getFamilySupportAmount(state, grossFamilyCost, rawPartnerIncome);
  const familyCost = Math.max(0, grossFamilyCost - familySupport);

  if (!connection || !(connection.isCohabiting || connection.stage === 'living_together' || connection.stage === 'married')) {
    return { contribution: 0, householdExtraCost: 0, familyCost, obligationCost, familySupport, grossFamilyCost };
  }

  const rent = getWeeklyRent(state);
  const extraFood = Math.round(60 * (state.inflationMultiplier ?? 1));
  const extraUtilities = Math.round(rent * 0.05);
  const householdExtraCost = extraFood + extraUtilities;

  const existingSharedCosts = rent + getWeeklyUtilityCost(state) + getWeeklyFoodCost(state);
  const sharedTotal = existingSharedCosts + householdExtraCost + familyCost;
  const playerEmploymentIncome = getPlayerEmploymentIncome(state);
  const playerIncomeEstimate = Math.max(350, playerEmploymentIncome);

  let contribution: number;
  if (connection.householdSplit === 'player_pays_most') {
    contribution = Math.min(partnerIncome * 0.2, sharedTotal * 0.3);
  } else if (connection.householdSplit === 'proportional') {
    const ratio = partnerIncome / Math.max(1, partnerIncome + playerIncomeEstimate);
    contribution = sharedTotal * ratio;
  } else {
    contribution = sharedTotal * 0.5;
  }

  return {
    contribution: Math.max(0, Math.round(Math.min(contribution, partnerIncome * 0.55))),
    householdExtraCost,
    familyCost,
    obligationCost,
    familySupport,
    grossFamilyCost,
  };
}

function financialSnapshot(state: GameState): RelationshipFinancialSnapshot {
  const personalDebt = (state.loans ?? []).reduce((sum, loan) => sum + (loan.remainingAmount ?? 0), 0);
  const businessValue = (state.businesses ?? []).reduce((sum, business) => sum + (business.valuation ?? 0), 0);
  return {
    globalWeek: globalWeek(state),
    netWorth: getNetWorth(state),
    cash: state.cash ?? 0,
    personalDebt,
    businessValue,
    businessCount: state.businesses?.length ?? 0,
    housingId: state.currentHousingId,
    carId: state.currentCarId,
  };
}

function createRelationshipEvent(
  state: GameState,
  partner: RelationshipConnection,
  previous: RelationshipFinancialSnapshot | null,
  current: RelationshipFinancialSnapshot,
  recentIds: string[],
): RelationshipEvent | null {
  const eligible: RelationshipEvent[] = [];
  const inflation = state.inflationMultiplier ?? 1;

  const householdSize = getHouseholdSize(state);
  const capacity = getHousingCapacity(state.currentHousingId);
  if (householdSize > capacity) {
    eligible.push({
      id: 'crowded_home',
      icon: '🏠',
      title: 'The Home Feels Crowded',
      description: `${partner.name} thinks your current home is becoming too small for the household.`,
      choices: [
        { text: 'Agree to look for a bigger home', relationship: 4, happiness: 2, happinessDuration: 3 },
        { text: 'Make it work for now', relationship: -2 },
        { text: 'Dismiss the concern', relationship: -6, happiness: -2, happinessDuration: 3 },
      ],
    });
  }

  if (
    partner.riskTolerance === 'cautious' &&
    current.personalDebt > Math.max(10000 * inflation, Math.max(1, current.netWorth) * 0.25)
  ) {
    eligible.push({
      id: 'debt_concern',
      icon: '💳',
      title: 'Debt Concern',
      description: `${partner.name} is worried about how much personal debt the household is carrying.`,
      choices: [
        { text: 'Talk through the repayment plan', relationship: 3 },
        { text: 'Promise to reduce risk', relationship: 5, happiness: 1, happinessDuration: 3 },
        { text: 'It is my money', relationship: -7 },
      ],
    });
  }

  if (
    partner.riskTolerance === 'cautious' &&
    current.netWorth > 50000 * inflation &&
    current.cash < current.netWorth * 0.05
  ) {
    eligible.push({
      id: 'liquidity_concern',
      icon: '🏦',
      title: 'Too Little Cash on Hand',
      description: `${partner.name} likes your investments, but worries that almost all of your wealth is tied up.`,
      choices: [
        { text: 'Agree to build a cash buffer', relationship: 4 },
        { text: 'Explain your investment strategy', relationship: 1 },
        { text: 'Ignore the concern', relationship: -4 },
      ],
    });
  }

  if (previous && previous.netWorth > 20000 && current.netWorth < previous.netWorth * 0.82) {
    eligible.push({
      id: 'wealth_loss',
      icon: '📉',
      title: 'A Difficult Financial Week',
      description: `Your household wealth has fallen sharply. ${partner.name} wants to talk about what happened.`,
      choices: [
        { text: 'Review the losses together', relationship: 4, happiness: -1, happinessDuration: 2 },
        { text: 'Stay confident and keep the plan', relationship: partner.riskTolerance === 'risk_taking' ? 3 : -1 },
        { text: 'Avoid the conversation', relationship: -5 },
      ],
    });
  }

  if (
    previous &&
    current.businessValue >= 100000 &&
    current.businessValue > Math.max(previous.businessValue * 1.25, previous.businessValue + 25000)
  ) {
    eligible.push({
      id: 'business_milestone',
      icon: '🏢',
      title: 'Business Milestone',
      description: `${partner.name} wants to celebrate how much your business empire has grown.`,
      choices: [
        { text: `Dinner together (€${Math.round(150 * inflation)})`, cost: Math.round(150 * inflation), relationship: 4, happiness: 4, happinessDuration: 3 },
        { text: `Weekend away (€${Math.round(1200 * inflation)})`, cost: Math.round(1200 * inflation), relationship: 8, happiness: 8, happinessDuration: 4 },
        { text: 'Keep working', relationship: -2 },
      ],
    });
  }

  if (
    previous &&
    ((previous.netWorth < 100000 && current.netWorth >= 100000) ||
      (previous.netWorth < 1000000 && current.netWorth >= 1000000) ||
      (previous.netWorth < 10000000 && current.netWorth >= 10000000))
  ) {
    eligible.push({
      id: 'wealth_milestone',
      icon: '💰',
      title: 'A Wealth Milestone',
      description: `You reached a major net-worth milestone. ${partner.name} suggests marking the occasion.`,
      choices: [
        { text: 'Celebrate modestly', cost: Math.round(200 * inflation), relationship: 4, happiness: 4, happinessDuration: 3 },
        { text: 'Celebrate in style', cost: Math.round(1500 * inflation), relationship: 7, happiness: 7, happinessDuration: 4 },
        { text: 'Reinvest everything', relationship: partner.ambition === 'driven' ? 3 : -1 },
      ],
    });
  }

  if (previous && previous.carId !== current.carId && partner.financialStyle === 'frugal' && current.carId !== 'none') {
    eligible.push({
      id: 'car_spending',
      icon: '🚗',
      title: 'A Question About Spending',
      description: `${partner.name} noticed the new car and wonders whether the household is spending too freely.`,
      choices: [
        { text: 'Explain why the purchase made sense', relationship: 1 },
        { text: 'Agree to discuss major purchases first', relationship: 5 },
        { text: 'My money, my choice', relationship: -6 },
      ],
    });
  }

  if (previous && previous.housingId !== current.housingId && current.housingId !== 'cheap_apartment') {
    eligible.push({
      id: 'new_home',
      icon: '🔑',
      title: 'A New Home Together',
      description: `${partner.name} is excited about the move and wants to make the new place feel like home.`,
      choices: [
        { text: `Buy a few things together (€${Math.round(500 * inflation)})`, cost: Math.round(500 * inflation), relationship: 5, happiness: 4, happinessDuration: 4 },
        { text: 'Enjoy the upgrade without extra spending', relationship: 2 },
      ],
    });
  }

  const dependentChildren = (state.relationshipState?.children ?? []).filter((child) => getChildAge(child, globalWeek(state)) < 18);
  if (dependentChildren.length > 0) {
    const child = randomOf(dependentChildren);
    const age = getChildAge(child, globalWeek(state));
    eligible.push({
      id: 'family_childcare_help',
      icon: '🤝',
      title: 'Family Offers Childcare Help',
      description: `${partner.name}'s family can help with ${child.name} for a while, giving the household some breathing room.`,
      choices: [
        { text: `Accept the help (+€${Math.round(250 * inflation)})`, cash: Math.round(250 * inflation), relationship: 2, childId: child.id, childRelationship: 2 },
        { text: 'Thank them but keep your routine', relationship: 1 },
      ],
    });
    eligible.push({
      id: 'child_activity_choice',
      icon: '🎒',
      title: age < 6 ? 'Early Learning Activity' : 'After-School Opportunity',
      description: `${child.name} has an opportunity that could be good for confidence, but it adds pressure to the weekly budget.`,
      choices: [
        { text: `Pay for it (€${Math.round(320 * inflation)})`, cost: Math.round(320 * inflation), childId: child.id, childRelationship: 6, happiness: 1, happinessDuration: 3 },
        { text: 'Choose a cheaper option', cost: Math.round(80 * inflation), childId: child.id, childRelationship: 2 },
        { text: 'Skip it for now', childId: child.id, childRelationship: -2 },
      ],
    });
    if (state.cash < Math.max(1000 * inflation, getPlayerEmploymentIncome(state) * 1.5)) {
      eligible.push({
        id: 'tight_family_budget',
        icon: '🧾',
        title: 'A Tight Family Budget',
        description: `${partner.name} notices the family budget is getting thin and suggests cutting extras temporarily.`,
        choices: [
          { text: 'Agree to keep things lean', relationship: 2, happiness: -1, happinessDuration: 4 },
          { text: 'Protect family time first', relationship: 4, cost: Math.round(180 * inflation), happiness: 2, happinessDuration: 2 },
          { text: 'Avoid the discussion', relationship: -4 },
        ],
      });
    }
  }

  const tripCooldown = state.relationshipState?.lastCoupleTripWeek ?? 0;
  const tripActive = (state.relationshipState?.coupleTripWeeksRemaining ?? 0) > 0;
  const hasVeryYoungChild = dependentChildren.some((child) => getChildAge(child, globalWeek(state)) < 6);
  const sharedLife = partner.stage === 'married' || partner.stage === 'living_together' || !!partner.isCohabiting;
  if (
    sharedLife &&
    partner.relationship >= 75 &&
    !tripActive &&
    !hasVeryYoungChild &&
    (tripCooldown === 0 || globalWeek(state) - tripCooldown >= 100)
  ) {
    const shortCost = Math.round(12000 * inflation);
    const longCost = Math.round(30000 * inflation);
    const travelHistoryBonus = Math.min(3, countMemoryTag(state, 'world_travellers', partner.id));
    const shortGain = Math.max(4, Math.min(14,
      8 + travelHistoryBonus
      + (partner.financialStyle === 'luxury' ? 2 : partner.financialStyle === 'frugal' ? -1 : 0)
      + (partner.riskTolerance === 'risk_taking' ? 2 : 0)
      + (partner.ambition === 'driven' ? 1 : 0)
    ));
    const longGain = Math.max(3, Math.min(16,
      10 + travelHistoryBonus
      + (partner.financialStyle === 'luxury' ? 3 : partner.financialStyle === 'frugal' ? -2 : 0)
      + (partner.riskTolerance === 'risk_taking' ? 3 : partner.riskTolerance === 'cautious' ? -1 : 0)
      + (partner.ambition === 'relaxed' ? 2 : partner.ambition === 'driven' ? -3 : 0)
    ));
    const deferDelta = partner.financialStyle === 'frugal' || partner.riskTolerance === 'cautious' || partner.ambition === 'driven' ? 1 : -2;

    eligible.push({
      id: 'couple_world_trip',
      icon: '🌍',
      title: 'A World Trip Together',
      description: `${partner.name} brings up taking real time away together. Travel is paid up front, and both of you pause salary income while you are away; investments, property and businesses continue normally.`,
      choices: [
        {
          text: `Take a 2-week world trip (€${shortCost.toLocaleString()}) — no salary for 2 weeks`,
          cost: shortCost,
          relationship: shortGain,
          personalityHint: personalityFitHint(shortGain),
          memoryTag: 'world_travellers',
          memoryLabel: 'Took time away together on a world trip',
          memorySentiment: 'positive',
          happiness: 12,
          happinessDuration: 6,
          travelWeeks: 2,
        },
        {
          text: `Take a 4-week world tour (€${longCost.toLocaleString()}) — no salary for 4 weeks`,
          cost: longCost,
          relationship: longGain,
          personalityHint: personalityFitHint(longGain),
          memoryTag: 'world_travellers',
          memoryLabel: 'Took an extended world tour together',
          memorySentiment: 'positive',
          happiness: 18,
          happinessDuration: 8,
          travelWeeks: 4,
        },
        { text: 'Plan something smaller another time', relationship: deferDelta },
      ],
    });
  }

  if (eligible.length === 0 && Math.random() < 0.10) {
    eligible.push({
      id: 'future_plans',
      icon: '❤️',
      title: 'Talking About the Future',
      description: `${partner.name} wants to spend an evening talking about where your life together is heading.`,
      choices: [
        { text: 'Make time for the conversation', relationship: 4 },
        { text: 'Plan a nice evening', cost: Math.round(100 * inflation), relationship: 6, happiness: 3, happinessDuration: 3 },
        { text: 'Too busy right now', relationship: -3 },
      ],
    });
  }

  const fresh = eligible.filter((event) => !recentIds.includes(event.id));
  if (fresh.length === 0) return null;
  return randomOf(fresh);
}

function createChild(state: GameState): RelationshipChild {
  const gender = Math.random() < 0.5 ? 'girl' : 'boy';
  const pool = gender === 'girl' ? (namesData as any).women as string[] : (namesData as any).men as string[];
  const id = `child_${globalWeek(state)}_${Math.floor(Math.random() * 1_000_000)}`;
  const partner = state.relationshipState?.partnerId
    ? (state.relationshipState?.activeConnections ?? []).find((item) => item.id === state.relationshipState.partnerId) ?? null
    : null;
  return {
    id,
    name: randomOf(pool),
    gender,
    birthGlobalWeek: globalWeek(state),
    age: 0,
    educationFund: 0,
    status: 'dependent',
    occupationTitle: null,
    weeklyIncome: 0,
    parentRelationship: 78,
    lastParentInteractionWeek: globalWeek(state),
    personality: getChildPersonality(id, partner),
    adultStatus: 'employed',
    debt: 0,
    failureCount: 0,
    businessValue: 0,
    lastAdultEventYear: 0,
    descendants: [],
    childrenCount: 0,
    otherParentId: partner?.id ?? null,
  };
}


function sharedGoalProgress(state: GameState): number {
  const goal = state.relationshipState?.sharedGoal;
  if (!goal) return 0;
  if (goal.type === 'cash_buffer') return Math.max(0, state.cash ?? 0);
  if (goal.type === 'net_worth') return Math.max(0, getNetWorth(state));
  if (goal.type === 'better_home') {
    const order = ['cheap_apartment', 'studio_apartment', 'small_house', 'family_house', 'luxury_villa', 'mansion'];
    return Math.max(0, order.indexOf(state.currentHousingId));
  }
  if (goal.type === 'family_fund') {
    return (state.relationshipState?.children ?? []).reduce((sum, child) => sum + (child.educationFund ?? 0), 0);
  }
  return 0;
}

function processPartnerCareer(
  connection: RelationshipConnection,
  gw: number,
): { connection: RelationshipConnection; event: string | null } {
  const normalized = normalizePartnerCareerConnection(connection, gw);
  const lastEvent = normalized.lastCareerEventWeek ?? gw;
  let lastCareerCheckWeek = lastEvent;
  let employmentStatus = normalized.employmentStatus ?? 'employed';
  let unemploymentWeeks = normalized.unemploymentWeeks ?? 0;
  let weeklyIncome = normalized.weeklyIncome ?? 0;
  let lastEmployedWeeklyIncome = Math.max(
    normalized.lastEmployedWeeklyIncome ?? 0,
    weeklyIncome,
    getPartnerOccupationBaseIncome(normalized),
  );
  let careerLevel = normalized.careerLevel ?? 1;
  let careerProgressWeeks = normalized.careerProgressWeeks ?? 0;
  let event: string | null = null;

  if (employmentStatus === 'unemployed') {
    unemploymentWeeks += 1;
    const rehireChance = normalized.ambition === 'driven'
      ? 0.24
      : normalized.ambition === 'career_minded'
        ? 0.18
        : 0.12;
    if (Math.random() < rehireChance) {
      employmentStatus = 'employed';
      lastCareerCheckWeek = gw;
      unemploymentWeeks = 0;
      const base = Math.max(
        lastEmployedWeeklyIncome,
        Math.round(getPartnerOccupationBaseIncome(normalized) * (1 + (careerLevel - 1) * 0.05)),
      );
      weeklyIncome = Math.max(450, Math.round(base * (0.96 + Math.random() * 0.12)));
      lastEmployedWeeklyIncome = weeklyIncome;
      careerProgressWeeks = Math.max(0, Math.floor(careerProgressWeeks * 0.6));
      event = `${normalized.name} found a new job earning about €${weeklyIncome}/week.`;
    }
  } else {
    careerProgressWeeks += 1;
    if (gw - lastEvent >= PARTNER_CAREER_CHECK_WEEKS) {
      lastCareerCheckWeek = gw;
      const basePromotionChance = normalized.ambition === 'driven'
        ? 0.22
        : normalized.ambition === 'career_minded'
          ? 0.15
          : 0.08;
      const stagnationBonus = Math.min(
        0.30,
        Math.max(0, careerProgressWeeks - PARTNER_CAREER_CHECK_WEEKS) / 120,
      );
      const seniorityFactor = Math.max(0.55, 1 - Math.max(0, careerLevel - 1) * 0.055);
      const promotionChance = careerProgressWeeks >= 50
        ? 1
        : Math.min(0.65, (basePromotionChance + stagnationBonus) * seniorityFactor);
      const layoffChance = normalized.ambition === 'driven'
        ? 0.018
        : normalized.ambition === 'career_minded'
          ? 0.024
          : 0.032;
      const roll = Math.random();

      if (roll < layoffChance) {
        employmentStatus = 'unemployed';
        unemploymentWeeks = 0;
        lastEmployedWeeklyIncome = Math.max(lastEmployedWeeklyIncome, weeklyIncome);
        weeklyIncome = 0;
        careerProgressWeeks = Math.max(0, careerProgressWeeks - 5);
        event = `${normalized.name} was laid off. Household income may be tighter for a while.`;
      } else if (roll < layoffChance + promotionChance && careerLevel < PARTNER_CAREER_MAX_LEVEL) {
        careerLevel += 1;
        weeklyIncome = Math.round(Math.max(weeklyIncome, 500) * (1.08 + Math.random() * 0.07));
        lastEmployedWeeklyIncome = weeklyIncome;
        careerProgressWeeks = 0;
        event = `${normalized.name} earned a promotion to career level ${careerLevel} and now makes about €${weeklyIncome}/week.`;
      } else {
        const meritRaise = normalized.ambition === 'driven'
          ? 0.02
          : normalized.ambition === 'career_minded'
            ? 0.012
            : 0.006;
        weeklyIncome = Math.round(weeklyIncome * (1 + meritRaise));
        lastEmployedWeeklyIncome = Math.max(lastEmployedWeeklyIncome, weeklyIncome);
      }
    }
  }

  return {
    connection: {
      ...normalized,
      employmentStatus,
      unemploymentWeeks,
      weeklyIncome,
      lastEmployedWeeklyIncome,
      careerLevel,
      careerProgressWeeks,
      lastCareerEventWeek: lastCareerCheckWeek,
      careerSystemVersion: PARTNER_CAREER_SYSTEM_VERSION,
    },
    event,
  };
}


function launchAdultChild(child: RelationshipChild, state: GameState, gw: number): { child: RelationshipChild; milestone: string } {
  const fund = Math.max(0, child.educationFund ?? 0);
  const personality = child.personality ?? getChildPersonality(child.id);
  const lifePath = child.lifePath ?? getChildNaturalLifePath(child);
  const developmentScore = Math.max(0, child.developmentScore ?? 0);
  const effectiveFund = fund
    + developmentScore * 650
    + (lifePath === 'academic' ? 10000 : 0)
    + (lifePath === 'practical' ? 4000 : 0);
  const outcome: NonNullable<RelationshipChild['educationOutcome']> =
    effectiveFund >= 50000 ? 'elite' : effectiveFund >= 20000 ? 'strong' : effectiveFund >= 5000 ? 'solid' : 'limited';

  const occupations = occupationsData as any[];
  const eligible = outcome === 'elite'
    ? occupations.filter((item) => (item.baseWeeklyIncome ?? 0) >= 1050)
    : outcome === 'strong'
      ? occupations.filter((item) => (item.baseWeeklyIncome ?? 0) >= 850)
      : outcome === 'solid'
        ? occupations.filter((item) => (item.baseWeeklyIncome ?? 0) >= 620)
        : occupations.filter((item) => (item.baseWeeklyIncome ?? 0) <= 820);
  const preferredIds = new Set(preferredOccupationIdsForLifePath(lifePath));
  const pathEligible = preferredIds.size > 0 ? eligible.filter((item) => preferredIds.has(item.id)) : [];
  const fallbackPathPool = preferredIds.size > 0 ? occupations.filter((item) => preferredIds.has(item.id)) : [];
  const occupationPool = pathEligible.length > 0
    ? pathEligible
    : fallbackPathPool.length > 0
      ? fallbackPathPool
      : eligible.length > 0
        ? eligible
        : occupations;
  const occupation = randomOf(occupationPool);
  const educationMultiplier = outcome === 'elite' ? 1.12 : outcome === 'strong' ? 1.05 : outcome === 'solid' ? 0.98 : 0.88;
  const pathMultiplier = lifePath === 'academic' ? 1.08
    : lifePath === 'practical' ? 1.06
      : lifePath === 'entrepreneurial' ? 1.03
        : lifePath === 'creative' ? 0.99
          : lifePath === 'athletic' ? 1.01 : 1;
  const startsEntrepreneur = lifePath === 'entrepreneurial'
    && developmentScore >= 18
    && personality.riskTolerance !== 'cautious';
  const weeklyIncome = startsEntrepreneur
    ? Math.max(700, Math.round(800 * (state.inflationMultiplier ?? 1) * (1 + developmentScore / 100)))
    : Math.max(350, Math.round((occupation.baseWeeklyIncome ?? 650) * educationMultiplier * pathMultiplier));

  return {
    child: {
      ...child,
      age: Math.max(18, child.age ?? 18),
      educationFund: 0,
      status: 'independent',
      occupationTitle: startsEntrepreneur ? 'Young Entrepreneur' : occupation.title,
      weeklyIncome,
      educationOutcome: outcome,
      launchedGlobalWeek: gw,
      savings: Math.round(weeklyIncome * 4),
      homeStatus: 'renting',
      partnerName: null,
      partnerGender: null,
      childrenCount: child.childrenCount ?? 0,
      descendants: child.descendants ?? [],
      parentRelationship: child.parentRelationship ?? 75,
      personality,
      lifePath,
      developmentScore,
      adultStatus: startsEntrepreneur ? 'entrepreneur' : 'employed',
      debt: child.debt ?? 0,
      failureCount: child.failureCount ?? 0,
      businessValue: startsEntrepreneur ? Math.round(20000 * (state.inflationMultiplier ?? 1)) : (child.businessValue ?? 0),
      lastAdultEventYear: state.year,
    },
    milestone: startsEntrepreneur
      ? `${child.name} became independent and launched a first business after following an entrepreneurial path.`
      : `${child.name} became independent and started work as ${occupation.title} after following a ${lifePathLabel(lifePath)} path.`,
  };
}

function progressAdultChild(
  child: RelationshipChild,
  state: GameState,
): { child: RelationshipChild; milestones: string[] } {
  if (child.status !== 'independent' || state.week !== 1) return { child, milestones: [] };

  const milestones: string[] = [];
  const personality = child.personality ?? getChildPersonality(child.id);
  const outcome = child.educationOutcome ?? 'limited';
  let adultStatus = child.adultStatus ?? (child.occupationTitle === 'Entrepreneur' ? 'entrepreneur' : 'employed');
  let occupationTitle = child.occupationTitle ?? 'Employee';
  let weeklyIncome = Math.max(0, child.weeklyIncome ?? 0);
  let savings = Math.max(0, child.savings ?? 0);
  let debt = Math.max(0, child.debt ?? 0);
  let failureCount = child.failureCount ?? 0;
  let businessValue = Math.max(0, child.businessValue ?? 0);
  const operatingFamilyRole = (state.businesses ?? [])
    .flatMap((business) => (business.familyRoles ?? []).map((role) => ({ business, role })))
    .find(({ role }) => role.childId === child.id && role.role !== 'board') ?? null;
  if (operatingFamilyRole) {
    adultStatus = 'employed';
    occupationTitle = `${operatingFamilyRole.business.name} ${operatingFamilyRole.role.role === 'successor' ? 'Successor' : operatingFamilyRole.role.role === 'executive' ? 'Executive' : 'Manager'}`;
    weeklyIncome = Math.max(0, operatingFamilyRole.role.weeklySalary ?? weeklyIncome);
  }
  let homeStatus = child.homeStatus ?? 'renting';
  let partnerName = child.partnerName ?? null;
  let partnerGender = child.partnerGender ?? null;
  let descendants = (child.descendants ?? []).map((descendant) => ({
    ...descendant,
    age: Math.max(0, Math.floor((globalWeek(state) - descendant.birthGlobalWeek) / 20)),
  }));

  const resilienceRecovery = personality.resilience === 'resilient' ? 0.78
    : personality.resilience === 'fragile' ? 0.48 : 0.62;
  const ambitionBonus = personality.ambition === 'driven' ? 0.10
    : personality.ambition === 'career_minded' ? 0.05 : 0;

  if (!operatingFamilyRole) {
    if (adultStatus === 'unemployed') {
      if (Math.random() < Math.min(0.92, resilienceRecovery + ambitionBonus)) {
        const occupation = randomOf(occupationsData as any[]);
        adultStatus = 'employed';
        occupationTitle = occupation.title;
        weeklyIncome = Math.max(400, Math.round((occupation.baseWeeklyIncome ?? 700) * 0.95));
        milestones.push(`${child.name} recovered from a setback and found work as ${occupation.title}.`);
      } else {
        debt += Math.round(2500 * (state.inflationMultiplier ?? 1));
        savings = Math.max(0, savings - Math.round(1500 * (state.inflationMultiplier ?? 1)));
      }
    } else if (adultStatus === 'entrepreneur') {
      const failureChance = 0.08
        + (personality.riskTolerance === 'risk_taking' ? 0.05 : personality.riskTolerance === 'cautious' ? -0.02 : 0)
        + (personality.resilience === 'fragile' ? 0.04 : personality.resilience === 'resilient' ? -0.02 : 0);
      if (Math.random() < Math.max(0.03, failureChance)) {
        adultStatus = 'unemployed';
        occupationTitle = 'Between Ventures';
        weeklyIncome = 0;
        savings = Math.max(0, Math.round(savings * 0.72));
        debt += Math.round(8000 * (state.inflationMultiplier ?? 1));
        businessValue = 0;
        failureCount += 1;
        milestones.push(`${child.name}'s business failed. They are rebuilding after a serious financial setback.`);
      } else {
        const growth = personality.ambition === 'driven' ? 1.16 : 1.10;
        businessValue = Math.max(
          Math.round(25000 * (state.inflationMultiplier ?? 1)),
          Math.round((businessValue || 25000 * (state.inflationMultiplier ?? 1)) * growth),
        );
        weeklyIncome = Math.max(weeklyIncome, Math.round(businessValue * 0.0018));
      }
    } else {
      const layoffChance = 0.055
        + (personality.resilience === 'fragile' ? 0.025 : personality.resilience === 'resilient' ? -0.015 : 0)
        - (personality.ambition === 'driven' ? 0.01 : 0);
      if (Math.random() < Math.max(0.02, layoffChance)) {
        adultStatus = 'unemployed';
        occupationTitle = `Former ${occupationTitle}`;
        weeklyIncome = 0;
        failureCount += 1;
        milestones.push(`${child.name} lost their job and is temporarily unemployed.`);
      } else {
        const raiseRate = outcome === 'elite' ? 0.05 : outcome === 'strong' ? 0.04 : outcome === 'solid' ? 0.03 : 0.02;
        const ambitionMultiplier = personality.ambition === 'driven' ? 1.35
          : personality.ambition === 'career_minded' ? 1.15 : 0.85;
        const pathCareerMultiplier = child.lifePath === 'academic' ? 1.18 : child.lifePath === 'practical' ? 1.10 : 1;
        weeklyIncome = Math.round(Math.max(350, weeklyIncome || 350) * (1 + raiseRate * ambitionMultiplier * pathCareerMultiplier));
      }
    }
  }

  const savingsRate = personality.financialStyle === 'frugal' ? 0.18
    : personality.financialStyle === 'luxury' ? 0.06 : 0.12;
  if (adultStatus !== 'unemployed') {
    savings = Math.round(savings + weeklyIncome * 20 * savingsRate);
  }
  if (debt > 0 && savings > 5000) {
    const repayment = Math.min(debt, Math.round(savings * 0.12));
    debt -= repayment;
    savings -= repayment;
  }

  if (!partnerName && (child.age ?? 18) >= 22) {
    const basePartnerChance = personality.independence === 'independent' ? 0.11
      : personality.independence === 'close' ? 0.22 : 0.17;
    if (Math.random() < basePartnerChance) {
      const women = (namesData as any).women as string[];
      const men = (namesData as any).men as string[];
      partnerGender = Math.random() < 0.5 ? 'woman' : 'man';
      const partnerPool = partnerGender === 'woman' ? women : men;
      partnerName = randomOf(partnerPool.filter((name) => name !== child.name));
      milestones.push(`${child.name} started a serious relationship with ${partnerName}.`);
    }
  }

  if (
    !operatingFamilyRole &&
    adultStatus === 'employed' &&
    occupationTitle !== 'Entrepreneur' &&
    (child.age ?? 18) >= 25 &&
    (child.age ?? 18) <= 50 &&
    savings >= Math.round(25000 * (state.inflationMultiplier ?? 1))
  ) {
    const entrepreneurChance = personality.ambition === 'driven' ? 0.13
      : personality.ambition === 'career_minded' ? 0.08 : 0.03;
    const riskMultiplier = personality.riskTolerance === 'risk_taking' ? 1.5
      : personality.riskTolerance === 'cautious' ? 0.45 : 1;
    if (Math.random() < entrepreneurChance * riskMultiplier) {
      const startupCapital = Math.round(15000 * (state.inflationMultiplier ?? 1));
      savings = Math.max(0, savings - startupCapital);
      adultStatus = 'entrepreneur';
      occupationTitle = 'Entrepreneur';
      businessValue = Math.round(25000 * (state.inflationMultiplier ?? 1));
      weeklyIncome = Math.max(weeklyIncome, Math.round(900 * (state.inflationMultiplier ?? 1)));
      milestones.push(`${child.name} started a small business.`);
    }
  }

  const homeThreshold = Math.round(30000 * (state.inflationMultiplier ?? 1));
  if (homeStatus === 'renting' && savings >= homeThreshold) {
    const buyChance = personality.financialStyle === 'frugal' ? 0.28 : personality.financialStyle === 'luxury' ? 0.13 : 0.20;
    if (Math.random() < buyChance) {
      const downPayment = Math.round(20000 * (state.inflationMultiplier ?? 1));
      savings = Math.max(0, savings - downPayment);
      homeStatus = 'homeowner';
      milestones.push(`${child.name} bought a home.`);
    }
  }
  if (adultStatus === 'unemployed' && homeStatus === 'homeowner' && savings < 5000 && debt > 15000 && Math.random() < 0.18) {
    homeStatus = 'renting';
    debt = Math.max(0, debt - Math.round(5000 * (state.inflationMultiplier ?? 1)));
    milestones.push(`${child.name} had to sell their home after financial difficulties.`);
  }

  if (partnerName && adultStatus === 'unemployed' && Math.random() < 0.06) {
    milestones.push(`${child.name}'s relationship ended during a difficult period.`);
    partnerName = null;
    partnerGender = null;
  }

  if (
    partnerName &&
    (child.age ?? 18) >= 25 &&
    (child.age ?? 18) <= 42 &&
    descendants.length < 2 &&
    Math.random() < 0.12
  ) {
    const gender = Math.random() < 0.5 ? 'girl' as const : 'boy' as const;
    const namePool = gender === 'girl' ? (namesData as any).women as string[] : (namesData as any).men as string[];
    const descendant = {
      id: `grandchild_${child.id}_${state.year}_${descendants.length}`,
      name: randomOf(namePool),
      gender,
      birthGlobalWeek: globalWeek(state),
      age: 0,
    };
    descendants.push(descendant);
    milestones.push(`${child.name} welcomed ${descendant.name}. You are now a grandparent.`);
  }

  return {
    child: {
      ...child,
      weeklyIncome,
      savings,
      debt,
      homeStatus,
      occupationTitle,
      partnerName,
      partnerGender,
      childrenCount: descendants.length,
      descendants,
      personality,
      parentRelationship: child.parentRelationship ?? 75,
      adultStatus,
      failureCount,
      businessValue,
      lastAdultEventYear: state.year,
    },
    milestones,
  };
}

export interface RelationshipWeekResult {
  state: RelationshipState;
  partnerContribution: number;
  householdExtraCost: number;
  familyCost: number;
  obligationCost: number;
  relationshipChange: number;
  headline: string | null;
  eventTitle: string | null;
  childBornName: string | null;
  relationshipGoalCompleted: string | null;
  partnerCareerEvent: string | null;
  partnerDiedName: string | null;
  partnerInheritance: number;
  familyMilestones: string[];
}

export function processRelationships(state: GameState): RelationshipWeekResult {
  const current = state.relationshipState;
  if (!state.relationshipModeEnabled) {
    return {
      state: current,
      partnerContribution: 0,
      householdExtraCost: 0,
      familyCost: 0,
      obligationCost: 0,
      relationshipChange: 0,
      headline: null,
      eventTitle: null,
      childBornName: null,
      relationshipGoalCompleted: null,
      partnerCareerEvent: null,
      partnerDiedName: null,
      partnerInheritance: 0,
      familyMilestones: [],
    };
  }

  const gw = globalWeek(state);
  if (!current) {
    return {
      state: state.relationshipState,
      partnerContribution: 0,
      householdExtraCost: 0,
      familyCost: 0,
      obligationCost: 0,
      relationshipChange: 0,
      headline: null,
      eventTitle: null,
      childBornName: null,
      relationshipGoalCompleted: null,
      partnerCareerEvent: null,
      partnerDiedName: null,
      partnerInheritance: 0,
      familyMilestones: [],
    };
  }

  const annualProgression = state.week === 1;
  const coupleTripActive = (current.coupleTripWeeksRemaining ?? 0) > 0;
  let coupleTripWeeksRemaining = Math.max(0, (current.coupleTripWeeksRemaining ?? 0) - 1);
  let partnerCareerEvent: string | null = null;
  let activeConnections = (current.activeConnections ?? []).map((connection) => {
    let updated: RelationshipConnection = normalizePartnerCareerConnection({
      ...connection,
      age: annualProgression && (connection.weeksKnown ?? 0) > 0 ? (connection.age ?? 18) + 1 : (connection.age ?? 18),
      weeksKnown: (connection.weeksKnown ?? 0) + 1,
    }, gw);

    if (connection.id === current.partnerId) {
      const career = processPartnerCareer(updated, gw);
      updated = career.connection;
      partnerCareerEvent = career.event;
    } else if (annualProgression && updated.employmentStatus !== 'unemployed') {
      const raise = updated.ambition === 'driven' ? 0.05 : updated.ambition === 'career_minded' ? 0.03 : 0.01;
      updated.weeklyIncome = Math.round((updated.weeklyIncome ?? 0) * (1 + raise));
    }
    return updated;
  });

  let partnerDiedName: string | null = null;
  let partnerInheritance = 0;
  let formerPartners = [...(current.formerPartners ?? [])];
  let activePartnerId = current.partnerId;
  let estatePlan = current.estatePlan;

  if (annualProgression && activePartnerId) {
    const partnerCandidate = activeConnections.find((item) => item.id === activePartnerId) ?? null;
    if (partnerCandidate && partnerCandidate.age >= 55 && Math.random() < annualDeathChance(partnerCandidate.age)) {
      partnerDiedName = partnerCandidate.name;
      if (partnerCandidate.stage === 'married') {
        const adminCost = Math.min(
          partnerCandidate.savings ?? 0,
          Math.max(500, Math.round((partnerCandidate.savings ?? 0) * 0.03))
        );
        partnerInheritance = Math.max(0, Math.round((partnerCandidate.savings ?? 0) - adminCost));
      }
      formerPartners.push({ ...partnerCandidate, isCohabiting: false, endedWeek: gw, endedReason: 'death' });
      activeConnections = activeConnections.filter((item) => item.id !== partnerCandidate.id);
      activePartnerId = null;
      partnerCareerEvent = null;
      if (estatePlan.successorId === partnerCandidate.id) {
        estatePlan = { ...estatePlan, successorId: null, updatedGlobalWeek: gw };
      }
    }
  }

  let weeklyCandidates = current.weeklyCandidates ?? [];
  let candidateRefreshWeek = current.candidateRefreshWeek ?? 0;
  if (current.preferencesSet && candidateRefreshWeek !== gw) {
    weeklyCandidates = generateRelationshipCandidates({ ...state, relationshipState: { ...current, activeConnections } }, 3);
    candidateRefreshWeek = gw;
  }

  const familyMilestones: string[] = [];
  let children = (current.children ?? []).map((child) => {
    const age = getChildAge(child, gw);
    const interactionWeek = child.lastParentInteractionWeek ?? child.birthGlobalWeek ?? gw;
    const neglectThreshold = age < 18 ? 40 : 60;
    const neglectPenalty = annualProgression && gw - interactionWeek >= neglectThreshold
      ? (age < 18 ? 3 : 1)
      : 0;
    const agedChild: RelationshipChild = {
      ...child,
      age,
      status: child.status ?? (age >= 18 ? 'independent' : 'dependent'),
      parentRelationship: Math.max(0, (child.parentRelationship ?? 75) - neglectPenalty),
      lastParentInteractionWeek: interactionWeek,
      personality: child.personality ?? getChildPersonality(child.id),
      adultStatus: child.adultStatus ?? (child.occupationTitle === 'Entrepreneur' ? 'entrepreneur' : 'employed'),
      debt: child.debt ?? 0,
      failureCount: child.failureCount ?? 0,
      businessValue: child.businessValue ?? 0,
      descendants: child.descendants ?? [],
      childrenCount: child.childrenCount ?? child.descendants?.length ?? 0,
    };
    if (age >= 18 && child.status !== 'independent') {
      const launched = launchAdultChild(agedChild, state, gw);
      familyMilestones.push(launched.milestone);
      return launched.child;
    }
    if (agedChild.status === 'independent') {
      const progressed = progressAdultChild(agedChild, state);
      familyMilestones.push(...progressed.milestones);
      return progressed.child;
    }
    return agedChild;
  });
  let familyExpansionWeeksRemaining = current.familyExpansionWeeksRemaining ?? 0;
  let childBornName: string | null = null;
  let timeline = [...(current.timeline ?? [])];
  if (partnerDiedName) {
    timeline.push({ week: state.week, year: state.year, title: `${partnerDiedName} passed away` });
  }
  for (const milestone of familyMilestones) {
    timeline.push({ week: state.week, year: state.year, title: milestone });
  }

  if (partnerDiedName) {
    familyExpansionWeeksRemaining = 0;
    coupleTripWeeksRemaining = 0;
  }

  if (familyExpansionWeeksRemaining > 0) {
    familyExpansionWeeksRemaining -= 1;
    if (familyExpansionWeeksRemaining <= 0) {
      const child = createChild(state);
      children = [...children, child];
      childBornName = child.name;
      timeline.push({ week: state.week, year: state.year, title: `${child.name} joined the family` });
    }
  }

  const familySpendingWeeksRemaining = Math.max(0, (current.familySpendingWeeksRemaining ?? 0) - 1);
  const familySpendingMode = familySpendingWeeksRemaining > 0 ? (current.familySpendingMode ?? 'normal') : 'normal';

  let obligationCost = 0;
  const financialObligations = (current.financialObligations ?? []).flatMap((obligation) => {
    const payment = Math.min(obligation.weeklyPayment ?? 0, obligation.remainingAmount ?? 0);
    obligationCost += payment;
    const remainingAmount = Math.max(0, (obligation.remainingAmount ?? 0) - payment);
    const weeksRemaining = Math.max(0, (obligation.weeksRemaining ?? 1) - 1);
    if (remainingAmount <= 0 || weeksRemaining <= 0) return [];
    return [{ ...obligation, remainingAmount, weeksRemaining }];
  });

  const workingState: GameState = {
    ...state,
    relationshipState: {
      ...current,
      activeConnections,
      weeklyCandidates,
      candidateRefreshWeek,
      children,
      financialObligations,
      timeline,
      partnerId: activePartnerId,
      formerPartners,
      estatePlan,
      familyPlan: partnerDiedName ? 'not_discussed' : current.familyPlan,
      familyExpansionWeeksRemaining: partnerDiedName ? 0 : familyExpansionWeeksRemaining,
      familySpendingMode: partnerDiedName ? 'normal' : familySpendingMode,
      familySpendingWeeksRemaining: partnerDiedName ? 0 : familySpendingWeeksRemaining,
      coupleTripWeeksRemaining: partnerDiedName ? 0 : coupleTripWeeksRemaining,
      pendingEvent: partnerDiedName ? null : current.pendingEvent,
      sharedGoal: partnerDiedName ? null : current.sharedGoal,
    },
  };

  const partner = activePartnerId ? activeConnections.find((c) => c.id === activePartnerId) ?? null : null;
  const finances = calculatePartnerContribution(partner, workingState);
  const partnerContribution = coupleTripActive ? 0 : finances.contribution;

  // Partners keep their own money. Their unspent income grows personal savings
  // according to financial style, which can later support shared major expenses.
  const savingsConnections = activeConnections.map((connection) => {
    if (connection.id !== activePartnerId) return connection;
    const rate = connection.financialStyle === 'frugal' ? 0.20 : connection.financialStyle === 'luxury' ? 0.04 : 0.10;
    const effectiveIncome = coupleTripActive ? 0 : getEffectivePartnerWeeklyIncome(connection, workingState);
    const disposable = Math.max(0, effectiveIncome - partnerContribution);
    return { ...connection, savings: Math.round((connection.savings ?? 0) + disposable * rate) };
  });

  let relationshipChange = 0;
  let headline: string | null = partnerDiedName
    ? `${partnerDiedName} passed away.`
    : childBornName
      ? `${childBornName} joined your family.`
      : coupleTripActive && partner
        ? `You and ${partner.name} are traveling together. Salary income is paused this week.`
        : null;
  let adjustedConnections = savingsConnections;
  if (partner && gw - (current.personalActionWeek ?? 0) >= 8) {
    relationshipChange = -2;
    headline = `${partner.name} feels you've had little time together lately.`;
    adjustedConnections = savingsConnections.map((c) =>
      c.id === partner.id ? { ...c, relationship: Math.max(0, (c.relationship ?? 70) - 2) } : c
    );
  }

  const currentPartner = partner ? adjustedConnections.find((c) => c.id === partner.id) ?? partner : null;
  let lastStabilityWarningWeek = current.lastStabilityWarningWeek ?? 0;
  if (currentPartner && currentPartner.relationship < 35 && gw - lastStabilityWarningWeek >= 8 && !current.pendingEvent) {
    headline = `${currentPartner.name} says the relationship is in serious trouble.`;
    lastStabilityWarningWeek = gw;
  }

  let relationshipGoalCompleted: string | null = null;
  let sharedGoal = current.sharedGoal ?? null;
  if (sharedGoal && !sharedGoal.completed) {
    const goalState: GameState = {
      ...workingState,
      relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections, sharedGoal },
    };
    const progress = sharedGoalProgress(goalState);
    if (progress >= sharedGoal.target) {
      const label = sharedGoal.type === 'cash_buffer' ? 'cash buffer'
        : sharedGoal.type === 'net_worth' ? 'net-worth goal'
          : sharedGoal.type === 'better_home' ? 'housing goal'
            : 'family education fund';
      relationshipGoalCompleted = `You completed your shared ${label}.`;
      sharedGoal = { ...sharedGoal, completed: true };
      if (partner) {
        adjustedConnections = adjustedConnections.map((item) =>
          item.id === partner.id ? { ...item, relationship: Math.min(100, (item.relationship ?? 70) + 5) } : item
        );
        relationshipChange += 5;
      }
      timeline.push({ week: state.week, year: state.year, title: relationshipGoalCompleted });
      if (!headline) headline = relationshipGoalCompleted;
    }
  }

  const currentSnapshot = financialSnapshot({ ...workingState, relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections } });
  let pendingEvent = current.pendingEvent ?? null;
  let eventTitle: string | null = null;
  let lastRelationshipEventWeek = current.lastRelationshipEventWeek ?? 0;
  let lastWorkFamilyConflictWeek = current.lastWorkFamilyConflictWeek ?? 0;

  if (!pendingEvent && !coupleTripActive && gw - lastRelationshipEventWeek >= 6) {
    const milestoneEvent = createFamilyMilestoneEvent(
      { ...workingState, relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections, children } },
      currentPartner,
      children,
    );
    if (milestoneEvent) {
      pendingEvent = milestoneEvent;
      eventTitle = milestoneEvent.title;
      lastRelationshipEventWeek = gw;
    }
  }

  if (
    partner &&
    !pendingEvent &&
    !coupleTripActive &&
    annualProgression &&
    gw - lastWorkFamilyConflictWeek >= 40 &&
    Math.random() < 0.55
  ) {
    const conflict = createWorkFamilyConflictEvent(
      { ...workingState, relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections, children } },
      currentPartner ?? partner,
      children,
    );
    if (conflict) {
      pendingEvent = conflict;
      eventTitle = conflict.title;
      lastRelationshipEventWeek = gw;
      lastWorkFamilyConflictWeek = gw;
    }
  }

  if (!pendingEvent && !coupleTripActive && annualProgression && gw - lastRelationshipEventWeek >= 6) {
    const independentChildren = children.filter((child) => child.status === 'independent');
    if (independentChildren.length > 0 && Math.random() < 0.16) {
      const struggling = independentChildren.filter((child) => child.adultStatus === 'unemployed' || (child.debt ?? 0) > (child.savings ?? 0));
      const adultChild = struggling.length > 0 ? randomOf(struggling) : randomOf(independentChildren);
      const baseSupport = Math.round(5000 * (state.inflationMultiplier ?? 1));
      const biggerSupport = Math.round(12000 * (state.inflationMultiplier ?? 1));
      pendingEvent = {
        id: `adult_child_support_${adultChild.id}_${state.year}`,
        icon: '👨‍👩‍👧',
        title: `${adultChild.name} Asks for Help`,
        description: adultChild.homeStatus === 'renting'
          ? `${adultChild.name} is trying to strengthen their finances and asks whether you can help with future housing costs.`
          : `${adultChild.name} wants some extra financial room for the next step in life.`,
        choices: [
          { text: 'Help substantially', cost: biggerSupport, childId: adultChild.id, childSavings: biggerSupport, childRelationship: 7 },
          { text: 'Help a little', cost: baseSupport, childId: adultChild.id, childSavings: baseSupport, childRelationship: 3 },
          { text: 'They need to manage on their own', childId: adultChild.id, childRelationship: -4 },
        ],
      };
      eventTitle = pendingEvent.title;
      lastRelationshipEventWeek = gw;
    }
  }

  if (
    partner &&
    !pendingEvent &&
    !coupleTripActive &&
    gw - lastRelationshipEventWeek >= 6
  ) {
    const eventPartner = adjustedConnections.find((c) => c.id === partner.id) ?? partner;
    const generated = eventPartner.relationship < 35
      ? {
          id: 'relationship_crisis',
          icon: '💔',
          title: 'Relationship at a Crossroads',
          description: `${eventPartner.name} says something has to change if you are going to stay together.`,
          choices: [
            { text: 'Commit to rebuilding things', relationship: 10, happiness: -1, happinessDuration: 2 },
            { text: 'Suggest counseling', relationship: 6, cost: Math.round(600 * (state.inflationMultiplier ?? 1)) },
            { text: 'Avoid the conversation', relationship: -10 },
          ],
        }
      : createRelationshipEvent(
          { ...workingState, relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections } },
          eventPartner,
          current.financialSnapshot ?? null,
          currentSnapshot,
          current.recentRelationshipEventIds ?? [],
        );
    if (generated) {
      pendingEvent = generated;
      eventTitle = generated.title;
      lastRelationshipEventWeek = gw;
    }
  }

  const recentRelationshipEventIds = pendingEvent && pendingEvent.id !== current.pendingEvent?.id
    ? [...(current.recentRelationshipEventIds ?? []), pendingEvent.id].slice(-4)
    : (current.recentRelationshipEventIds ?? []);

  return {
    state: {
      ...current,
      activeConnections: adjustedConnections,
      weeklyCandidates,
      candidateRefreshWeek,
      children,
      financialObligations,
      timeline,
      lastRelationshipEventWeek,
      lastWorkFamilyConflictWeek,
      recentRelationshipEventIds,
      financialSnapshot: currentSnapshot,
      sharedGoal: partnerDiedName ? null : sharedGoal,
      lastStabilityWarningWeek,
      partnerId: activePartnerId,
      formerPartners,
      estatePlan,
      familyPlan: partnerDiedName ? 'not_discussed' : current.familyPlan,
      familyExpansionWeeksRemaining: partnerDiedName ? 0 : familyExpansionWeeksRemaining,
      familySpendingMode: partnerDiedName ? 'normal' : familySpendingMode,
      familySpendingWeeksRemaining: partnerDiedName ? 0 : familySpendingWeeksRemaining,
      coupleTripWeeksRemaining: partnerDiedName ? 0 : coupleTripWeeksRemaining,
      pendingEvent: partnerDiedName ? null : pendingEvent,
    },
    partnerContribution,
    householdExtraCost: finances.householdExtraCost,
    familyCost: finances.familyCost,
    obligationCost,
    relationshipChange,
    headline,
    eventTitle,
    childBornName,
    relationshipGoalCompleted,
    partnerCareerEvent,
    partnerDiedName,
    partnerInheritance,
    familyMilestones,
  };
}
