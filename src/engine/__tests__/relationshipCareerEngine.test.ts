import {
  PARTNER_CAREER_SYSTEM_VERSION,
  getPartnerCareerStartingLevel,
  normalizePartnerCareerConnection,
  processRelationships,
} from '../relationshipEngine';
import {
  INITIAL_GAME_STATE,
  INITIAL_RELATIONSHIP_STATE,
  RelationshipConnection,
} from '../../types/game';

function partner(overrides: Partial<RelationshipConnection> = {}): RelationshipConnection {
  return {
    id: 'partner_test',
    name: 'Alex',
    gender: 'woman',
    age: 40,
    occupationId: 'engineer',
    occupationTitle: 'Engineer',
    weeklyIncome: 1_200,
    savings: 20_000,
    financialStyle: 'balanced',
    riskTolerance: 'balanced',
    ambition: 'career_minded',
    familyGoal: 'unsure',
    visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
    stage: 'married',
    connection: 90,
    relationship: 90,
    dates: 8,
    weeksKnown: 30,
    employmentStatus: 'employed',
    unemploymentWeeks: 0,
    careerLevel: 1,
    lastCareerEventWeek: 20,
    ...overrides,
  };
}

describe('partner career progression', () => {
  test('starting seniority reflects age and ambition instead of always being level one', () => {
    expect(getPartnerCareerStartingLevel(22, 'relaxed')).toBe(1);
    expect(getPartnerCareerStartingLevel(30, 'career_minded')).toBe(2);
    expect(getPartnerCareerStartingLevel(40, 'driven')).toBe(5);
  });

  test('legacy level-one partners migrate upward without reducing existing progress', () => {
    const migrated = normalizePartnerCareerConnection(partner({
      age: 40,
      ambition: 'driven',
      careerLevel: 1,
      careerSystemVersion: undefined,
    }), 41);

    expect(migrated.careerLevel).toBe(5);
    expect(migrated.careerSystemVersion).toBe(PARTNER_CAREER_SYSTEM_VERSION);

    const alreadySenior = normalizePartnerCareerConnection(partner({
      age: 32,
      careerLevel: 6,
      careerSystemVersion: undefined,
    }), 41);
    expect(alreadySenior.careerLevel).toBe(6);
  });

  test('married partner career level survives weekly relationship processing', () => {
    const currentPartner = partner({
      careerLevel: 4,
      careerProgressWeeks: 7,
      careerSystemVersion: PARTNER_CAREER_SYSTEM_VERSION,
      lastCareerEventWeek: 30,
    });
    const state = {
      ...INITIAL_GAME_STATE,
      year: 2,
      week: 2,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        activeConnections: [currentPartner],
        partnerId: currentPartner.id,
      },
    };

    const result = processRelationships(state);
    const updated = result.state.activeConnections[0];

    expect(updated.stage).toBe('married');
    expect(updated.careerLevel).toBe(4);
    expect(updated.careerProgressWeeks).toBeGreaterThan(7);
  });

  test('long career stagnation guarantees eventual promotion at the next career check', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const currentPartner = partner({
      age: 34,
      careerLevel: 2,
      careerProgressWeeks: 50,
      careerSystemVersion: PARTNER_CAREER_SYSTEM_VERSION,
      lastCareerEventWeek: 31,
    });
    const state = {
      ...INITIAL_GAME_STATE,
      year: 3,
      week: 2,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        activeConnections: [currentPartner],
        partnerId: currentPartner.id,
      },
    };

    const result = processRelationships(state);
    const updated = result.state.activeConnections[0];

    expect(updated.careerLevel).toBe(3);
    expect(updated.careerProgressWeeks).toBe(0);
    expect(result.partnerCareerEvent).toContain('promotion');

    random.mockRestore();
  });
});
