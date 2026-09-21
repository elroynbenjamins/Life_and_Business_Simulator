import {
  calculatePartnerContribution,
  getChildCostBreakdown,
  getEffectivePartnerWeeklyIncome,
  getFamilyWorkArrangementEffects,
  getPlayerFamilyWorkFraction,
} from '../relationshipEngine';
import { weeklyTick } from '../weeklyTick';
import {
  INITIAL_CAREER_STATE,
  INITIAL_GAME_STATE,
  INITIAL_RELATIONSHIP_STATE,
  GameState,
  RelationshipChild,
  RelationshipConnection,
} from '../../types/game';

function partner(): RelationshipConnection {
  return {
    id: 'family_partner',
    name: 'Sam',
    gender: 'woman',
    age: 31,
    occupationId: 'engineer',
    occupationTitle: 'Engineer',
    weeklyIncome: 1_200,
    savings: 10_000,
    financialStyle: 'balanced',
    riskTolerance: 'balanced',
    ambition: 'career_minded',
    familyGoal: 'wants_children',
    visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
    stage: 'married',
    connection: 90,
    relationship: 90,
    dates: 6,
    weeksKnown: 30,
    isCohabiting: true,
    householdSplit: 'proportional',
    employmentStatus: 'employed',
    unemploymentWeeks: 0,
    careerLevel: 3,
    careerProgressWeeks: 0,
    lastEmployedWeeklyIncome: 1_200,
    lastCareerEventWeek: 20,
    careerSystemVersion: 2,
  };
}

function child(age: number, currentGlobalWeek: number): RelationshipChild {
  return {
    id: `child_${age}`,
    name: 'Jamie',
    gender: 'girl',
    birthGlobalWeek: currentGlobalWeek - age * 20,
    age,
    educationFund: 0,
    status: age >= 18 ? 'independent' : 'dependent',
    occupationTitle: null,
    weeklyIncome: 0,
    parentRelationship: 80,
    lastParentInteractionWeek: currentGlobalWeek,
    personality: {
      ambition: 'career_minded',
      financialStyle: 'balanced',
      riskTolerance: 'balanced',
      independence: 'balanced',
      resilience: 'balanced',
    },
    adultStatus: 'employed',
    debt: 0,
    failureCount: 0,
    businessValue: 0,
    lastAdultEventYear: 0,
    descendants: [],
    childrenCount: 0,
    otherParentId: 'family_partner',
  };
}

function familyState(
  arrangement: GameState['relationshipState']['familyWorkArrangement'],
  childAge = 0,
): GameState {
  const year = 3;
  const week = 5;
  const gw = (year - 1) * 20 + week;
  const currentPartner = partner();
  return {
    ...INITIAL_GAME_STATE,
    year,
    week,
    age: 32,
    cash: 25_000,
    inflationMultiplier: 1,
    currentJobId: 'cashier',
    currentCourseId: null,
    career: { ...INITIAL_CAREER_STATE },
    relationshipModeEnabled: true,
    relationshipState: {
      ...INITIAL_RELATIONSHIP_STATE,
      preferencesSet: true,
      activeConnections: [currentPartner],
      partnerId: currentPartner.id,
      children: [child(childAge, gw)],
      familyWorkArrangement: arrangement,
    },
  };
}

describe('family work arrangements', () => {
  test('existing saves default to both working 80% with a young child', () => {
    const state = familyState(undefined, 0);
    const effects = getFamilyWorkArrangementEffects(state);

    expect(effects.arrangement).toBe('both_80');
    expect(effects.playerWorkFraction).toBe(0.8);
    expect(effects.partnerWorkFraction).toBe(0.8);
    expect(getPlayerFamilyWorkFraction(state)).toBe(0.8);
    expect(getEffectivePartnerWeeklyIncome(partner(), state)).toBe(960);
  });

  test('both 80% lowers childcare but leaves other child cost categories unchanged', () => {
    const state = familyState('both_80', 0);
    const breakdown = getChildCostBreakdown(state.relationshipState.children[0], state);

    expect(breakdown.food).toBe(45);
    expect(breakdown.careSchool).toBe(53);
    expect(breakdown.clothingHealth).toBe(30);
    expect(breakdown.transportActivities).toBe(10);
    expect(breakdown.utilities).toBe(15);
  });

  test('partner-primary-care moves from 60% to 80% and ends at school age', () => {
    const toddler = getFamilyWorkArrangementEffects(familyState('partner_primary', 2));
    const preschool = getFamilyWorkArrangementEffects(familyState('partner_primary', 3));
    const schoolAge = getFamilyWorkArrangementEffects(familyState('partner_primary', 6));

    expect(toddler.playerWorkFraction).toBe(1);
    expect(toddler.partnerWorkFraction).toBe(0.6);
    expect(toddler.childcareMultiplier).toBe(0.55);

    expect(preschool.partnerWorkFraction).toBe(0.8);
    expect(preschool.childcareMultiplier).toBe(0.78);

    expect(schoolAge.active).toBe(false);
    expect(schoolAge.playerWorkFraction).toBe(1);
    expect(schoolAge.partnerWorkFraction).toBe(1);
  });

  test('full-time arrangement preserves salaries and childcare', () => {
    const state = familyState('full_time', 1);
    const effects = getFamilyWorkArrangementEffects(state);
    const breakdown = getChildCostBreakdown(state.relationshipState.children[0], state);

    expect(effects.playerWorkFraction).toBe(1);
    expect(effects.partnerWorkFraction).toBe(1);
    expect(getEffectivePartnerWeeklyIncome(partner(), state)).toBe(1_200);
    expect(breakdown.careSchool).toBe(75);
  });

  test('partner household contribution uses effective reduced income', () => {
    const fullTimeState = familyState('full_time', 1);
    const reducedState = familyState('partner_80', 1);

    const fullContribution = calculatePartnerContribution(partner(), fullTimeState);
    const reducedContribution = calculatePartnerContribution(partner(), reducedState);

    expect(reducedContribution.contribution).toBeLessThan(fullContribution.contribution);
    expect(getEffectivePartnerWeeklyIncome(partner(), reducedState)).toBe(960);
  });

  test('weekly settlement actually pays the player 80% under both-80 arrangement', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const fullTime = weeklyTick(familyState('full_time', 1)).summary.salaryEarned;
    const reduced = weeklyTick(familyState('both_80', 1)).summary.salaryEarned;

    expect(reduced).toBe(Math.round(fullTime * 0.8));

    random.mockRestore();
  });
});
