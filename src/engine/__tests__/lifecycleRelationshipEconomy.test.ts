import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE, RelationshipConnection } from '../../types/game';
import { annualDeathChance } from '../lifecycleEngine';
import { processEconomy } from '../economyEngine';
import { processRelationships } from '../relationshipEngine';

describe('lifecycle and macro systems', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not introduce mortality before older age', () => {
    expect(annualDeathChance(59)).toBe(0);
    expect(annualDeathChance(60)).toBeGreaterThan(0);
    expect(annualDeathChance(90)).toBeGreaterThan(annualDeathChance(70));
    expect(annualDeathChance(125)).toBe(1);
  });

  it('can apply a deflationary crash only after inflation has accumulated', () => {
    const random = jest.spyOn(Math, 'random');
    random.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0);

    const state = {
      ...INITIAL_GAME_STATE,
      year: 10,
      week: 19,
      inflationMultiplier: 1.4,
      lastMacroCrashWeek: 0,
    };

    const result = processEconomy(state, 20);
    expect(result.crashEvent).not.toBeNull();
    expect(result.inflationMultiplier).toBeLessThan(1.4);
    expect(result.inflationMultiplier).toBeGreaterThanOrEqual(1);
    expect(result.crashEvent?.stockShock).toBeLessThan(0);
  });
});

describe('optional relationship mode', () => {
  it('creates no household effects when Personal Life is disabled', () => {
    const partner: RelationshipConnection = {
      id: 'partner',
      name: 'Sophie',
      gender: 'woman',
      age: 30,
      occupationId: 'accounting',
      occupationTitle: 'Assistant Accountant',
      weeklyIncome: 900,
      savings: 10000,
      financialStyle: 'frugal',
      riskTolerance: 'cautious',
      ambition: 'career_minded',
      familyGoal: 'wants_children',
      visibleTraits: ['financialStyle'],
      stage: 'living_together',
      connection: 80,
      relationship: 85,
      dates: 5,
      weeksKnown: 20,
      householdSplit: 'equal',
    };

    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      relationshipModeEnabled: false,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: partner.id,
        activeConnections: [partner],
      },
    });

    expect(result.partnerContribution).toBe(0);
    expect(result.householdExtraCost).toBe(0);
    expect(result.relationshipChange).toBe(0);
  });
});
