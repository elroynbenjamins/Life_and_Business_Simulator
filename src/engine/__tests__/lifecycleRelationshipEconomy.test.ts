import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE, RelationshipConnection } from '../../types/game';
import { annualDeathChance } from '../lifecycleEngine';
import { getNetWorth } from '../financeEngine';
import { processEconomy } from '../economyEngine';
import { getChildWeeklyCost, getProposalCost, getWeddingCost, processRelationships } from '../relationshipEngine';

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
    expect(result.familyCost).toBe(0);
    expect(result.relationshipChange).toBe(0);
  });
});


describe('expanded relationship progression', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('scales proposal and wedding costs predictably with inflation', () => {
    expect(getProposalCost('simple', 2)).toBe(1500);
    expect(getProposalCost('luxury', 1)).toBe(10000);
    expect(getWeddingCost('courthouse', 1.5)).toBe(1500);
    expect(getWeddingCost('luxury', 1)).toBe(40000);
  });

  it('adds child costs while keeping adult children cost-free', () => {
    const baby = { id: 'c1', name: 'Mila', gender: 'girl' as const, birthGlobalWeek: 1, age: 0, educationFund: 0 };
    const adult = { id: 'c2', name: 'Finn', gender: 'boy' as const, birthGlobalWeek: 1, age: 18, educationFund: 0 };
    const state = { ...INITIAL_GAME_STATE, year: 1, week: 2, inflationMultiplier: 1 };
    const adultState = { ...INITIAL_GAME_STATE, year: 19, week: 2, inflationMultiplier: 1 };
    expect(getChildWeeklyCost(baby, state)).toBeGreaterThan(0);
    expect(getChildWeeklyCost(adult, adultState)).toBe(0);
  });

  it('lets a partner keep and grow independent savings', () => {
    const partner: RelationshipConnection = {
      id: 'partner-saver',
      name: 'Sophie',
      gender: 'woman',
      age: 30,
      occupationId: 'accounting',
      occupationTitle: 'Assistant Accountant',
      weeklyIncome: 1000,
      savings: 10000,
      financialStyle: 'frugal',
      riskTolerance: 'balanced',
      ambition: 'career_minded',
      familyGoal: 'wants_children',
      visibleTraits: ['financialStyle'],
      stage: 'living_together',
      connection: 80,
      relationship: 85,
      dates: 5,
      weeksKnown: 20,
      isCohabiting: true,
      householdSplit: 'equal',
    };
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: partner.id,
        activeConnections: [partner],
        personalActionWeek: 1,
      },
    });
    expect(result.state.activeConnections[0].savings).toBeGreaterThan(10000);
  });

  it('counts relationship settlements as net-worth liabilities', () => {
    const base = { ...INITIAL_GAME_STATE, cash: 20000 };
    const withSettlement = {
      ...base,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        financialObligations: [{
          id: 'settlement-nw',
          type: 'divorce_settlement' as const,
          label: 'Settlement',
          remainingAmount: 10000,
          weeklyPayment: 1000,
          weeksRemaining: 10,
        }],
      },
    };
    expect(getNetWorth(withSettlement)).toBe(getNetWorth(base) - 10000);
  });

  it('processes relationship legal obligations as weekly costs', () => {
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        financialObligations: [{
          id: 'settlement',
          type: 'divorce_settlement',
          label: 'Settlement',
          remainingAmount: 10000,
          weeklyPayment: 1000,
          weeksRemaining: 10,
        }],
      },
    });
    expect(result.obligationCost).toBe(1000);
    expect(result.state.financialObligations[0].remainingAmount).toBe(9000);
    expect(result.state.financialObligations[0].weeksRemaining).toBe(9);
  });

  it('creates a child when a family expansion countdown completes', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.2);
    const partner: RelationshipConnection = {
      id: 'partner',
      name: 'Sophie',
      gender: 'woman',
      age: 30,
      occupationId: 'accounting',
      occupationTitle: 'Assistant Accountant',
      weeklyIncome: 900,
      savings: 10000,
      financialStyle: 'balanced',
      riskTolerance: 'balanced',
      ambition: 'career_minded',
      familyGoal: 'wants_children',
      visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
      stage: 'married',
      connection: 90,
      relationship: 90,
      dates: 8,
      weeksKnown: 30,
      isCohabiting: true,
      householdSplit: 'proportional',
    };
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      relationshipModeEnabled: true,
      week: 10,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: partner.id,
        activeConnections: [partner],
        familyPlan: 'trying',
        familyExpansionWeeksRemaining: 1,
        personalActionWeek: 10,
      },
    });
    expect(result.state.children).toHaveLength(1);
    expect(result.childBornName).toBeTruthy();
    expect(result.familyCost).toBeGreaterThan(0);
  });
});
