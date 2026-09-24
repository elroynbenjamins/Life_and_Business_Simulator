import {
  INITIAL_CAREER_STATE,
  INITIAL_GAME_STATE,
  INITIAL_RELATIONSHIP_STATE,
  GameState,
  RelationshipChild,
  RelationshipConnection,
} from '../../types/game';
import {
  createFamilyMilestoneEvent,
  getWeddingPersonalityFit,
  processRelationships,
} from '../relationshipEngine';
import { weeklyTick } from '../weeklyTick';

function spouse(overrides: Partial<RelationshipConnection> = {}): RelationshipConnection {
  return {
    id: 'milestone_partner',
    name: 'Alex',
    gender: 'woman',
    age: 35,
    occupationId: 'marketing',
    occupationTitle: 'Marketing Specialist',
    weeklyIncome: 1_200,
    savings: 30_000,
    financialStyle: 'balanced',
    riskTolerance: 'balanced',
    ambition: 'career_minded',
    familyGoal: 'wants_children',
    visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
    stage: 'married',
    connection: 90,
    relationship: 90,
    dates: 8,
    weeksKnown: 120,
    marriedWeek: 1,
    isCohabiting: true,
    householdSplit: 'proportional',
    employmentStatus: 'employed',
    unemploymentWeeks: 0,
    careerLevel: 2,
    careerProgressWeeks: 0,
    lastEmployedWeeklyIncome: 1_200,
    lastCareerEventWeek: 1,
    careerSystemVersion: 2,
    ...overrides,
  };
}

function child(age: number, gw: number, overrides: Partial<RelationshipChild> = {}): RelationshipChild {
  return {
    id: 'milestone_child',
    name: 'Jamie',
    gender: 'girl',
    birthGlobalWeek: gw - age * 20,
    age,
    educationFund: 0,
    status: age >= 18 ? 'independent' : 'dependent',
    parentRelationship: 80,
    lastParentInteractionWeek: gw,
    personality: {
      ambition: 'driven',
      financialStyle: 'balanced',
      riskTolerance: 'risk_taking',
      independence: 'independent',
      resilience: 'resilient',
    },
    adultStatus: 'employed',
    debt: 0,
    failureCount: 0,
    businessValue: 0,
    lastAdultEventYear: 0,
    descendants: [],
    childrenCount: 0,
    otherParentId: 'milestone_partner',
    ...overrides,
  };
}

describe('family milestone events', () => {
  afterEach(() => jest.restoreAllMocks());

  test('wedding fit meaningfully follows partner personality', () => {
    const frugal = spouse({ financialStyle: 'frugal', riskTolerance: 'cautious', ambition: 'driven' });
    const luxury = spouse({ financialStyle: 'luxury', riskTolerance: 'risk_taking', ambition: 'relaxed' });

    expect(getWeddingPersonalityFit(frugal, 'courthouse').relationshipBonus)
      .toBeGreaterThan(getWeddingPersonalityFit(frugal, 'luxury').relationshipBonus);
    expect(getWeddingPersonalityFit(luxury, 'luxury').relationshipBonus)
      .toBeGreaterThan(getWeddingPersonalityFit(luxury, 'courthouse').relationshipBonus);
  });

  test('creates a one-time 10-year marriage anniversary when it becomes due', () => {
    const year = 11;
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        partnerId: 'milestone_partner',
        activeConnections: [spouse({ marriedWeek: 1 })],
        celebratedMilestones: [],
      },
    };
    const event = createFamilyMilestoneEvent(state, state.relationshipState.activeConnections[0], []);
    expect(event?.title).toBe('10-Year Anniversary');
    expect(event?.milestoneKey).toBe('marriage_milestone_partner_10y');
    expect(event?.choices.some((choice) => (choice.travelWeeks ?? 0) > 0)).toBe(true);

    const celebrated = {
      ...state,
      relationshipState: {
        ...state.relationshipState,
        celebratedMilestones: ['marriage_milestone_partner_10y'],
      },
    };
    expect(createFamilyMilestoneEvent(celebrated, celebrated.relationshipState.activeConnections[0], [])).toBeNull();
  });

  test('uses only the highest reached child milestone instead of replaying childhood milestones', () => {
    const year = 21;
    const gw = (year - 1) * 20 + 1;
    const olderChild = child(18, gw);
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [olderChild],
        celebratedMilestones: [],
      },
    };

    const event = createFamilyMilestoneEvent(state, null, [olderChild]);
    expect(event?.title).toBe('Jamie Turns 18');
    expect(event?.milestoneKey).toBe('child_milestone_child_18y');
  });

  test('active couple travel pauses both salary and partner contribution and counts down', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const currentPartner = spouse({ marriedWeek: 1, lastCareerEventWeek: 45 });
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year: 3,
      week: 5,
      currentJobId: 'cashier',
      career: { ...INITIAL_CAREER_STATE },
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: currentPartner.id,
        activeConnections: [currentPartner],
        personalActionWeek: 45,
        lastRelationshipEventWeek: 45,
        coupleTripWeeksRemaining: 2,
      },
    };

    const relationship = processRelationships(state);
    expect(relationship.partnerContribution).toBe(0);
    expect(relationship.state.coupleTripWeeksRemaining).toBe(1);

    const tick = weeklyTick(state);
    expect(tick.summary.salaryEarned).toBe(0);
    expect(tick.summary.partnerContribution).toBe(0);
    expect(tick.newState.relationshipState.coupleTripWeeksRemaining).toBe(1);
  });
});
