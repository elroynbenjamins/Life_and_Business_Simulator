import { GameState, INITIAL_GAME_STATE, INITIAL_CAREER_STATE, INITIAL_RELATIONSHIP_STATE, RelationshipConnection } from '../../types/game';
import { calculatePartnerContribution, getChildCostBreakdown, getChildWeeklyCost, processRelationships } from '../relationshipEngine';
import { calculateTax, getWeeklyRent, getWeeklyUtilityCost, getWeeklyFoodCost, getWeeklyCarCost } from '../financeEngine';
import { getCareerSalary } from '../careerEngine';
import paths from '../../data/career_paths.json';
import { weeklyTick } from '../weeklyTick';

const partner: RelationshipConnection = {
  id: 'partner', name: 'Partner', gender: 'woman', age: 30, occupationId: 'accounting', occupationTitle: 'Accountant',
  weeklyIncome: 900, savings: 10000, financialStyle: 'balanced', riskTolerance: 'balanced', ambition: 'career_minded',
  familyGoal: 'wants_children', visibleTraits: [], stage: 'married', connection: 90, relationship: 90, dates: 10,
  weeksKnown: 40, householdSplit: 'equal', isCohabiting: true,
};
function fixture(ages: number[] = [], inflation = 1): GameState {
  return { ...INITIAL_GAME_STATE, year: 31, week: 10, age: 40, relationshipModeEnabled: true, inflationMultiplier: inflation,
    relationshipState: { ...INITIAL_RELATIONSHIP_STATE, partnerId: partner.id, activeConnections: [{ ...partner }],
      children: ages.map((age, i) => ({ id: String(i), name: `Child ${i}`, age, gender: 'girl', birthGlobalWeek: 610 - age * 20, educationFund: 0 })) } };
}
function budget(state: GameState, companion: RelationshipConnection | null) {
  const salary = getCareerSalary(state.career, state.inflationMultiplier);
  const family = calculatePartnerContribution(companion, state);
  const fixed = getWeeklyRent(state) + getWeeklyUtilityCost(state) + getWeeklyFoodCost(state) + getWeeklyCarCost(state)
    + family.familyCost + family.householdExtraCost;
  return { salary, fixed, contribution: family.contribution, surplus: salary - calculateTax(salary * 20, state.inflationMultiplier, state.career.positionLevel) / 20 + family.contribution - fixed };
}
describe('household costs and balance', () => {
  afterEach(() => jest.restoreAllMocks());
  test.each([
    [0, [153, 305, 458]], [2, [153, 305, 458]], [3, [139, 277, 415]], [5, [139, 277, 415]],
    [6, [130, 260, 390]], [11, [130, 260, 390]], [12, [165, 330, 495]], [15, [165, 330, 495]],
    [16, [190, 380, 570]], [17, [190, 380, 570]], [18, [0, 0, 0]], [30, [0, 0, 0]],
  ])('child age %i costs correctly with family-work childcare and inflation', (age, expectedByInflation) => {
    for (const inflation of [1, 2, 3]) {
      const state = fixture([age], inflation);
      const breakdown = getChildCostBreakdown(state.relationshipState.children[0], state);
      expect(breakdown.total).toBe(expectedByInflation[inflation - 1]);
      expect(breakdown.food + breakdown.careSchool + breakdown.clothingHealth + breakdown.transportActivities + breakdown.utilities).toBe(breakdown.total);
    }
  });
  test('birthdays change the cost band using the world clock, not stale saved age', () => {
    const state = fixture([2]);
    state.relationshipState.children[0].birthGlobalWeek -= 19;
    expect(getChildWeeklyCost(state.relationshipState.children[0], state)).toBe(153);
    expect(getChildWeeklyCost(state.relationshipState.children[0], { ...state, week: 11 })).toBe(139);
  });
  test('costs persist for a single parent but are disabled with relationship mode', () => {
    const state = fixture([1, 7, 16]);
    const family = calculatePartnerContribution(null, state);
    expect(family.grossFamilyCost).toBe(473);
    expect(family.familySupport).toBeGreaterThan(0);
    expect(family.familyCost).toBeLessThan(473);
    expect(calculatePartnerContribution(partner, { ...state, relationshipModeEnabled: false })).toMatchObject({ contribution: 0, familyCost: 0, householdExtraCost: 0, obligationCost: 0 });
  });
  test('means-tested childcare support helps low-income households but phases out', () => {
    const lowIncome = fixture([1]);
    lowIncome.currentJobId = null;
    lowIncome.partTimeJob = true;
    lowIncome.relationshipState.partnerId = null;
    lowIncome.relationshipState.activeConnections = [];
    const supported = calculatePartnerContribution(null, lowIncome);
    expect(supported.grossFamilyCost).toBe(175);
    expect(supported.familySupport).toBeGreaterThanOrEqual(55);
    expect(supported.familyCost).toBeLessThan(125);

    const highIncome = fixture([1]);
    highIncome.relationshipState.activeConnections = [{ ...partner, weeklyIncome: 2500 }];
    const phasedOut = calculatePartnerContribution({ ...partner, weeklyIncome: 2500 }, highIncome);
    expect(phasedOut.grossFamilyCost).toBe(153);
    expect(phasedOut.familySupport).toBe(0);
    expect(phasedOut.familyCost).toBe(153);
  });
  test('temporary reduced family spending lowers recurring child costs and expires', () => {
    const state = fixture([1]);
    const reduced = {
      ...state,
      relationshipState: {
        ...state.relationshipState,
        familySpendingMode: 'reduced' as const,
        familySpendingWeeksRemaining: 2,
      },
    };
    expect(getChildWeeklyCost(reduced.relationshipState.children[0], reduced)).toBe(125);
    const first = processRelationships(reduced);
    expect(first.state.familySpendingMode).toBe('reduced');
    expect(first.state.familySpendingWeeksRemaining).toBe(1);
    const second = processRelationships({ ...reduced, week: 11, relationshipState: first.state });
    expect(second.state.familySpendingMode).toBe('normal');
    expect(second.state.familySpendingWeeksRemaining).toBe(0);
  });
  test('a full 18-year childhood charges the correct age bands and survives save/load', () => {
    let state = fixture([0]);
    let lifetimeCost = 0;
    for (let elapsed = 0; elapsed < 360; elapsed++) {
      const worldWeek = 610 + elapsed;
      state = JSON.parse(JSON.stringify({ ...state, year: Math.floor((worldWeek - 1) / 20) + 1, week: (worldWeek - 1) % 20 + 1 }));
      lifetimeCost += getChildWeeklyCost(state.relationshipState.children[0], state);
    }
    expect(lifetimeCost).toBe(53920);
    expect(getChildWeeklyCost(state.relationshipState.children[0], { ...state, week: state.week + 1 })).toBe(0);
  });
  test('weekly engine debits child expenses exactly once and reports them', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = fixture([1, 7, 16]);
    state.relationshipState.partnerId = null;
    state.relationshipState.activeConnections = [];
    const family = weeklyTick(state);
    const single = weeklyTick({ ...state, relationshipState: { ...state.relationshipState, children: [] } });
    const expected = calculatePartnerContribution(null, state).familyCost;
    expect(family.summary.familyCost).toBe(expected);
    expect(single.newState.cash - family.newState.cash).toBe(expected);
  });
  test('an uneventful partner career check cannot reroll again next week', () => {
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const state = fixture();
    const first = processRelationships(state);
    const employed = first.state.activeConnections.find(p => p.id === partner.id)!;
    expect(employed.lastCareerEventWeek).toBe(610);
    random.mockReturnValue(0.1);
    const next = processRelationships({ ...state, week: 11, relationshipState: first.state });
    expect(next.state.activeConnections.find(p => p.id === partner.id)!.weeklyIncome).toBe(employed.weeklyIncome);
  });
  test('career/family matrix preserves cost sharing bounds and inflation scaling', () => {
    let scenarios = 0;
    const rows: any[] = [];
    for (const path of paths) for (const position of path.positions) for (const raises of [0, 5])
      for (const ages of [[], [1], [7, 16], [1, 7, 16]]) for (const partnerPay of [null, 0, 450, 900, 2500])
        for (const split of ['equal', 'proportional', 'player_pays_most'] as const) {
          const state = fixture(ages);
          const level = position.level;
          state.career = { ...INITIAL_CAREER_STATE, companyId: 'career_employer', careerPathId: path.id, positionLevel: level, performanceRaisesAtLevel: raises };
          state.currentHousingId = level >= 7 ? 'luxury_villa' : level >= 6 ? 'family_house' : level >= 5 ? 'small_house' : level >= 3 ? 'studio_apartment' : 'cheap_apartment';
          state.currentCarId = level >= 5 ? 'suv' : level >= 3 ? 'sedan' : 'used_car';
          const companion = partnerPay === null ? null : { ...partner, weeklyIncome: partnerPay, householdSplit: split };
          const result = budget(state, companion);
          expect(result.salary).toBeGreaterThan(0);
          expect(result.contribution).toBeGreaterThanOrEqual(0);
          expect(result.contribution).toBeLessThanOrEqual(Math.ceil((partnerPay ?? 0) * 0.55));
          expect(Number.isFinite(result.surplus)).toBe(true);
          for (const inflation of [2, 3]) {
            const inflated = budget({ ...state, inflationMultiplier: inflation }, companion ? { ...companion, weeklyIncome: companion.weeklyIncome * inflation } : null);
            expect(Math.abs(inflated.surplus / inflation - result.surplus)).toBeLessThan(3);
            scenarios++;
          }
          if (raises === 0 && split === 'equal' && (partnerPay === null || partnerPay === 900)) {
            const homes = ['cheap_apartment', 'studio_apartment', 'small_house', 'family_house', 'luxury_villa'];
            const size = 1 + ages.length + Number(!!companion);
            const homeIndex = size <= 1 ? 0 : size <= 2 ? 1 : size <= 3 ? 2 : 3;
            const spacious = budget({ ...state, currentHousingId: homes[Math.max(homeIndex, homes.indexOf(state.currentHousingId))] }, companion);
            rows.push({ level, children: ages.length, partner: partnerPay !== null, ...result, familyHomeSurplus: spacious.surplus });
          }
          scenarios++;
        }
    const median = (values: number[]) => values.sort((a,b) => a-b)[Math.floor(values.length / 2)];
    const report = [];
    for (const level of [1,2,3,4,5,6,7]) for (const children of [0,1,2,3]) for (const hasPartner of [false,true]) {
      const group = rows.filter(row => row.level === level && row.children === children && row.partner === hasPartner);
      if (group.length) report.push({ level, children, partner: hasPartner, salary: median(group.map(r => r.salary)), fixed: median(group.map(r => r.fixed)), surplus: Math.round(median(group.map(r => r.surplus))), minSurplus: Math.round(Math.min(...group.map(r => r.surplus))), familyHomeSurplus: Math.round(median(group.map(r => r.familyHomeSurplus))) });
    }
    console.log('HOUSEHOLD_BALANCE', JSON.stringify({ scenarios, assumptions: 'Minimum job-required home; no debt, investments or course costs. Tax reserved weekly. Partner income 900 where present. Inflation comparisons index both incomes.', report }));
    expect(scenarios).toBeGreaterThan(10000);
  });
});
