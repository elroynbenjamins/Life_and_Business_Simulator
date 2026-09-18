import { GameState, RelationshipCandidate, RelationshipConnection, RelationshipState } from '../types/game';
import namesData from '../data/relationship_names.json';
import occupationsData from '../data/relationship_occupations.json';
import housingData from '../data/housing.json';

const FINANCIAL_STYLES = ['frugal', 'balanced', 'luxury'] as const;
const RISK = ['cautious', 'balanced', 'risk_taking'] as const;
const AMBITION = ['relaxed', 'career_minded', 'driven'] as const;
const FAMILY = ['no_children', 'unsure', 'wants_children'] as const;

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

    const minAge = Math.max(18, relationship.minAge ?? 20);
    const maxAge = Math.max(minAge, relationship.maxAge ?? 35);
    const age = minAge + Math.floor(Math.random() * (maxAge - minAge + 1));
    const occupation = randomOf(occupationsData as any[]);
    const incomeVariation = 0.85 + Math.random() * 0.3;
    const weeklyIncome = Math.round((occupation.baseWeeklyIncome ?? 700) * incomeVariation);
    const savings = Math.max(0, Math.round(weeklyIncome * (2 + Math.random() * 18)));

    candidates.push({
      id: `rel_${globalWeek(state)}_${candidates.length}_${Math.floor(Math.random() * 1_000_000)}`,
      name,
      gender,
      age,
      occupationId: occupation.id,
      occupationTitle: occupation.title,
      weeklyIncome,
      savings,
      financialStyle: randomOf(FINANCIAL_STYLES),
      riskTolerance: randomOf(RISK),
      ambition: randomOf(AMBITION),
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

export function getDateConnectionGain(connection: RelationshipConnection | RelationshipCandidate, kind: 'coffee' | 'dinner' | 'activity'): number {
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

export function calculatePartnerContribution(connection: RelationshipConnection | null, state: GameState): { contribution: number; householdExtraCost: number } {
  if (!connection || !['living_together', 'engaged', 'married'].includes(connection.stage)) {
    return { contribution: 0, householdExtraCost: 0 };
  }

  // Extra food + utility use from a second adult. The partner only contributes
  // toward shared household costs; their remaining income is not player income.
  const housing = (housingData as any[]).find((item) => item.id === state.currentHousingId);
  const rent = Math.round((housing?.weeklyRent ?? 300) * (state.inflationMultiplier ?? 1));
  const extraFood = Math.round(60 * (state.inflationMultiplier ?? 1));
  const extraUtilities = Math.round(rent * 0.05);
  const householdExtraCost = extraFood + extraUtilities;

  const existingSharedCosts = Math.round(rent * 1.15 + 50 * (state.inflationMultiplier ?? 1));
  const sharedTotal = existingSharedCosts + householdExtraCost;
  const playerIncomeEstimate = Math.max(350, state.cash > 0 ? 750 : 350);
  const partnerIncome = Math.max(0, connection.weeklyIncome ?? 0);

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
  };
}

export interface RelationshipWeekResult {
  state: RelationshipState;
  partnerContribution: number;
  householdExtraCost: number;
  relationshipChange: number;
  headline: string | null;
}

export function processRelationships(state: GameState): RelationshipWeekResult {
  const current = state.relationshipState;
  if (!state.relationshipModeEnabled) {
    return { state: current, partnerContribution: 0, householdExtraCost: 0, relationshipChange: 0, headline: null };
  }
  const gw = globalWeek(state);
  if (!current) {
    return { state: state.relationshipState, partnerContribution: 0, householdExtraCost: 0, relationshipChange: 0, headline: null };
  }

  const activeConnections = (current.activeConnections ?? []).map((connection) => ({
    ...connection,
    weeksKnown: (connection.weeksKnown ?? 0) + 1,
  }));

  let weeklyCandidates = current.weeklyCandidates ?? [];
  let candidateRefreshWeek = current.candidateRefreshWeek ?? 0;
  if (current.preferencesSet && candidateRefreshWeek !== gw) {
    weeklyCandidates = generateRelationshipCandidates({ ...state, relationshipState: { ...current, activeConnections } }, 3);
    candidateRefreshWeek = gw;
  }

  const partner = current.partnerId ? activeConnections.find((c) => c.id === current.partnerId) ?? null : null;
  const finances = calculatePartnerContribution(partner, state);

  // Relationships do not decay every week. Only prolonged neglect creates a gentle warning.
  let relationshipChange = 0;
  let headline: string | null = null;
  let adjustedConnections = activeConnections;
  if (partner && gw - (current.personalActionWeek ?? 0) >= 8) {
    relationshipChange = -2;
    headline = `${partner.name} feels you've had little time together lately.`;
    adjustedConnections = activeConnections.map((c) =>
      c.id === partner.id ? { ...c, relationship: Math.max(0, (c.relationship ?? 70) - 2) } : c
    );
  }

  return {
    state: { ...current, activeConnections: adjustedConnections, weeklyCandidates, candidateRefreshWeek },
    partnerContribution: finances.contribution,
    householdExtraCost: finances.householdExtraCost,
    relationshipChange,
    headline,
  };
}
