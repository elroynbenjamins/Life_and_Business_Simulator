import {
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
import { getNetWorth } from './financeEngine';

const FINANCIAL_STYLES = ['frugal', 'balanced', 'luxury'] as const;
const RISK = ['cautious', 'balanced', 'risk_taking'] as const;
const AMBITION = ['relaxed', 'career_minded', 'driven'] as const;
const FAMILY = ['no_children', 'unsure', 'wants_children'] as const;

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

export function getProposalCost(kind: 'simple' | 'classic' | 'luxury', inflationMultiplier = 1): number {
  const base = kind === 'simple' ? 750 : kind === 'classic' ? 3000 : 10000;
  return Math.round(base * inflationMultiplier);
}

export function getWeddingCost(kind: 'courthouse' | 'standard' | 'luxury', inflationMultiplier = 1): number {
  const base = kind === 'courthouse' ? 1000 : kind === 'standard' ? 10000 : 40000;
  return Math.round(base * inflationMultiplier);
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

export function getChildAge(child: RelationshipChild, currentGlobalWeek: number): number {
  return Math.max(0, Math.floor((currentGlobalWeek - child.birthGlobalWeek) / 20));
}

export function getChildWeeklyCost(child: RelationshipChild, state: GameState): number {
  const age = getChildAge(child, globalWeek(state));
  const base = age < 3 ? 130 : age < 12 ? 95 : age < 18 ? 140 : 0;
  return Math.round(base * (state.inflationMultiplier ?? 1));
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

export function calculatePartnerContribution(
  connection: RelationshipConnection | null,
  state: GameState
): { contribution: number; householdExtraCost: number; familyCost: number } {
  const children = state.relationshipState?.children ?? [];
  const familyCost = children.reduce((total, child) => total + getChildWeeklyCost(child, state), 0);

  if (!connection || !(connection.isCohabiting || connection.stage === 'living_together' || connection.stage === 'married')) {
    return { contribution: 0, householdExtraCost: 0, familyCost };
  }

  const housing = (housingData as any[]).find((item) => item.id === state.currentHousingId);
  const rent = Math.round((housing?.weeklyRent ?? 300) * (state.inflationMultiplier ?? 1));
  const extraFood = Math.round(60 * (state.inflationMultiplier ?? 1));
  const extraUtilities = Math.round(rent * 0.05);
  const householdExtraCost = extraFood + extraUtilities;

  const existingSharedCosts = Math.round(rent * 1.15 + 50 * (state.inflationMultiplier ?? 1));
  const sharedTotal = existingSharedCosts + householdExtraCost + familyCost;
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
    familyCost,
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
  return {
    id: `child_${globalWeek(state)}_${Math.floor(Math.random() * 1_000_000)}`,
    name: randomOf(pool),
    gender,
    birthGlobalWeek: globalWeek(state),
    age: 0,
    educationFund: 0,
  };
}

export interface RelationshipWeekResult {
  state: RelationshipState;
  partnerContribution: number;
  householdExtraCost: number;
  familyCost: number;
  relationshipChange: number;
  headline: string | null;
  eventTitle: string | null;
  childBornName: string | null;
}

export function processRelationships(state: GameState): RelationshipWeekResult {
  const current = state.relationshipState;
  if (!state.relationshipModeEnabled) {
    return {
      state: current,
      partnerContribution: 0,
      householdExtraCost: 0,
      familyCost: 0,
      relationshipChange: 0,
      headline: null,
      eventTitle: null,
      childBornName: null,
    };
  }

  const gw = globalWeek(state);
  if (!current) {
    return {
      state: state.relationshipState,
      partnerContribution: 0,
      householdExtraCost: 0,
      familyCost: 0,
      relationshipChange: 0,
      headline: null,
      eventTitle: null,
      childBornName: null,
    };
  }

  const annualProgression = state.week === 1;
  const activeConnections = (current.activeConnections ?? []).map((connection) => {
    let weeklyIncome = connection.weeklyIncome ?? 0;
    let age = connection.age ?? 18;
    if (annualProgression && (connection.weeksKnown ?? 0) > 0) {
      age += 1;
      const raise = connection.ambition === 'driven' ? 0.05 : connection.ambition === 'career_minded' ? 0.03 : 0.01;
      weeklyIncome = Math.round(weeklyIncome * (1 + raise));
    }
    return {
      ...connection,
      age,
      weeklyIncome,
      weeksKnown: (connection.weeksKnown ?? 0) + 1,
    };
  });

  let weeklyCandidates = current.weeklyCandidates ?? [];
  let candidateRefreshWeek = current.candidateRefreshWeek ?? 0;
  if (current.preferencesSet && candidateRefreshWeek !== gw) {
    weeklyCandidates = generateRelationshipCandidates({ ...state, relationshipState: { ...current, activeConnections } }, 3);
    candidateRefreshWeek = gw;
  }

  let children = (current.children ?? []).map((child) => ({ ...child, age: getChildAge(child, gw) }));
  let familyExpansionWeeksRemaining = current.familyExpansionWeeksRemaining ?? 0;
  let childBornName: string | null = null;
  let timeline = [...(current.timeline ?? [])];

  if (familyExpansionWeeksRemaining > 0) {
    familyExpansionWeeksRemaining -= 1;
    if (familyExpansionWeeksRemaining <= 0) {
      const child = createChild(state);
      children = [...children, child];
      childBornName = child.name;
      timeline.push({ week: state.week, year: state.year, title: `${child.name} joined the family` });
    }
  }

  const workingState: GameState = {
    ...state,
    relationshipState: {
      ...current,
      activeConnections,
      weeklyCandidates,
      candidateRefreshWeek,
      children,
      familyExpansionWeeksRemaining,
      timeline,
    },
  };

  const partner = current.partnerId ? activeConnections.find((c) => c.id === current.partnerId) ?? null : null;
  const finances = calculatePartnerContribution(partner, workingState);

  // Partners keep their own money. Their unspent income grows personal savings
  // according to financial style, which can later support shared major expenses.
  const savingsConnections = activeConnections.map((connection) => {
    if (connection.id !== current.partnerId) return connection;
    const rate = connection.financialStyle === 'frugal' ? 0.20 : connection.financialStyle === 'luxury' ? 0.04 : 0.10;
    const disposable = Math.max(0, (connection.weeklyIncome ?? 0) - finances.contribution);
    return { ...connection, savings: Math.round((connection.savings ?? 0) + disposable * rate) };
  });

  let relationshipChange = 0;
  let headline: string | null = childBornName ? `${childBornName} joined your family.` : null;
  let adjustedConnections = savingsConnections;
  if (partner && gw - (current.personalActionWeek ?? 0) >= 8) {
    relationshipChange = -2;
    headline = `${partner.name} feels you've had little time together lately.`;
    adjustedConnections = savingsConnections.map((c) =>
      c.id === partner.id ? { ...c, relationship: Math.max(0, (c.relationship ?? 70) - 2) } : c
    );
  }

  const currentSnapshot = financialSnapshot({ ...workingState, relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections } });
  let pendingEvent = current.pendingEvent ?? null;
  let eventTitle: string | null = null;
  let lastRelationshipEventWeek = current.lastRelationshipEventWeek ?? 0;

  if (
    partner &&
    !pendingEvent &&
    gw - lastRelationshipEventWeek >= 6
  ) {
    const generated = createRelationshipEvent(
      { ...workingState, relationshipState: { ...workingState.relationshipState, activeConnections: adjustedConnections } },
      adjustedConnections.find((c) => c.id === partner.id) ?? partner,
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
      familyExpansionWeeksRemaining,
      timeline,
      pendingEvent,
      lastRelationshipEventWeek,
      recentRelationshipEventIds,
      financialSnapshot: currentSnapshot,
    },
    partnerContribution: finances.contribution,
    householdExtraCost: finances.householdExtraCost,
    familyCost: finances.familyCost,
    relationshipChange,
    headline,
    eventTitle,
    childBornName,
  };
}
