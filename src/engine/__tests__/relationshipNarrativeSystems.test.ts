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
  createWorkFamilyConflictEvent,
  getChildNaturalLifePath,
  processRelationships,
} from '../relationshipEngine';

function partner(overrides: Partial<RelationshipConnection> = {}): RelationshipConnection {
  return {
    id: 'story_partner',
    name: 'Alex',
    gender: 'woman',
    age: 34,
    occupationId: 'marketing',
    occupationTitle: 'Marketing Specialist',
    weeklyIncome: 1200,
    savings: 25000,
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
    lastEmployedWeeklyIncome: 1200,
    lastCareerEventWeek: 1,
    careerSystemVersion: 2,
    ...overrides,
  };
}

function child(age: number, gw: number, overrides: Partial<RelationshipChild> = {}): RelationshipChild {
  return {
    id: 'story_child',
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
    otherParentId: 'story_partner',
    ...overrides,
  };
}

describe('relationship narrative systems', () => {
  afterEach(() => jest.restoreAllMocks());

  test('child personality produces a stable natural life direction', () => {
    const gw = 101;
    const entrepreneurial = child(5, gw);
    expect(getChildNaturalLifePath(entrepreneurial)).toBe('entrepreneurial');

    const academic = child(5, gw, {
      personality: {
        ambition: 'career_minded',
        financialStyle: 'frugal',
        riskTolerance: 'cautious',
        independence: 'close',
        resilience: 'balanced',
      },
    });
    expect(getChildNaturalLifePath(academic)).toBe('academic');
  });

  test('child milestone choices now shape development and life path', () => {
    const year = 11;
    const gw = (year - 1) * 20 + 1;
    const currentChild = child(10, gw);
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [currentChild],
        celebratedMilestones: ['child_story_child_5y'],
      },
    };

    const event = createFamilyMilestoneEvent(state, null, [currentChild]);
    expect(event?.title).toBe('Jamie Turns 10');
    expect(event?.choices.some((choice) => (choice.childDevelopment ?? 0) > 0)).toBe(true);
    expect(event?.choices.some((choice) => !!choice.childLifePath)).toBe(true);
    expect(event?.choices.some((choice) => choice.memoryTag === 'supported_child_path')).toBe(true);
  });

  test('an entrepreneurial child path can pay off at adult launch', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const year = 19;
    const gw = (year - 1) * 20 + 1;
    const currentChild = child(18, gw, {
      age: 17,
      status: 'dependent',
      lifePath: 'entrepreneurial',
      developmentScore: 30,
      educationFund: 12000,
    });
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [currentChild],
        celebratedMilestones: ['child_story_child_5y', 'child_story_child_10y', 'child_story_child_16y'],
      },
    };

    const result = processRelationships(state);
    const launched = result.state.children[0];
    expect(launched.status).toBe('independent');
    expect(launched.lifePath).toBe('entrepreneurial');
    expect(launched.adultStatus).toBe('entrepreneur');
    expect(launched.occupationTitle).toBe('Young Entrepreneur');
    expect(launched.businessValue).toBeGreaterThan(0);
  });

  test('repeated career-first memories make later work-family conflicts harsher', () => {
    const currentPartner = partner();
    const baseState: GameState = {
      ...INITIAL_GAME_STATE,
      year: 8,
      week: 1,
      career: {
        ...INITIAL_CAREER_STATE,
        companyId: 'career_company',
        careerPathId: 'marketing',
        positionLevel: 3,
        performance: 70,
      },
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        partnerId: currentPartner.id,
        activeConnections: [currentPartner],
      },
    };

    const firstConflict = createWorkFamilyConflictEvent(baseState, currentPartner, []);
    const repeatedConflict = createWorkFamilyConflictEvent({
      ...baseState,
      relationshipState: {
        ...baseState.relationshipState,
        memories: [
          {
            id: 'm1',
            tag: 'career_first',
            label: 'Put work first',
            sentiment: 'mixed',
            globalWeek: 80,
            partnerId: currentPartner.id,
          },
          {
            id: 'm2',
            tag: 'career_first',
            label: 'Put work first again',
            sentiment: 'negative',
            globalWeek: 120,
            partnerId: currentPartner.id,
          },
        ],
      },
    }, currentPartner, []);

    const firstWorkChoice = firstConflict?.choices.find((choice) => choice.memoryTag === 'career_first');
    const repeatedWorkChoice = repeatedConflict?.choices.find((choice) => choice.memoryTag === 'career_first');
    expect(firstWorkChoice?.careerPerformanceDelta).toBeGreaterThan(0);
    expect((repeatedWorkChoice?.relationship ?? 0)).toBeLessThan(firstWorkChoice?.relationship ?? 0);
    expect(repeatedConflict?.description).toContain('pattern');
  });

  test('former-partner memories do not affect a new relationship', () => {
    const currentPartner = partner({ id: 'new_partner', name: 'Morgan' });
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year: 8,
      week: 1,
      career: {
        ...INITIAL_CAREER_STATE,
        companyId: 'career_company',
        careerPathId: 'marketing',
        positionLevel: 3,
        performance: 70,
      },
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        partnerId: currentPartner.id,
        activeConnections: [currentPartner],
        memories: [
          {
            id: 'former-memory',
            tag: 'career_first',
            label: 'Old relationship work conflict',
            sentiment: 'negative',
            globalWeek: 80,
            partnerId: 'former_partner',
          },
        ],
      },
    };

    const conflict = createWorkFamilyConflictEvent(state, currentPartner, []);
    expect(conflict?.description).not.toContain('pattern');
    const workChoice = conflict?.choices.find((choice) => choice.memoryTag === 'career_first');
    expect(workChoice?.relationship).toBe(-6);
  });

  test('family-first conflict choices trade career performance for relationship gains', () => {
    const currentPartner = partner({ ambition: 'relaxed' });
    const state: GameState = {
      ...INITIAL_GAME_STATE,
      year: 6,
      week: 1,
      career: {
        ...INITIAL_CAREER_STATE,
        companyId: 'career_company',
        careerPathId: 'sales',
        positionLevel: 2,
        performance: 65,
      },
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        partnerId: currentPartner.id,
        activeConnections: [currentPartner],
      },
    };

    const conflict = createWorkFamilyConflictEvent(state, currentPartner, []);
    const familyChoice = conflict?.choices.find((choice) => choice.memoryTag === 'showed_up_for_family');
    const workChoice = conflict?.choices.find((choice) => choice.memoryTag === 'career_first');

    expect(familyChoice?.relationship).toBeGreaterThan(0);
    expect(familyChoice?.careerPerformanceDelta).toBeLessThan(0);
    expect(workChoice?.relationship).toBeLessThan(0);
    expect(workChoice?.careerPerformanceDelta).toBeGreaterThan(0);
  });
});
