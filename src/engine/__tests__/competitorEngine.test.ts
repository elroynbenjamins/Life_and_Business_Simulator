import { createBusiness } from '../businessEngine';
import { createInitialCompetitors, processCompetitors } from '../competitorEngine';

describe('persistent rival CEOs', () => {
  test('creates three rivals with durable CEO identities and strategies', () => {
    const business = createBusiness('coffee_shop', 'Test Coffee', 1, 1, 1)!;
    const rivals = createInitialCompetitors(business, 1);
    expect(rivals).toHaveLength(3);
    expect(new Set(rivals.map((rival) => rival.ceoName)).size).toBe(3);
    expect(rivals.every((rival) => !!rival.strategy && !!rival.personality)).toBe(true);
  });

  test('migrates legacy rivals and records a strategic decision after four weeks', () => {
    const business = createBusiness('coffee_shop', 'Test Coffee', 1, 1, 1)!;
    const legacy = [{ id: `comp_${business.id}_1`, name: 'Legacy Rival', strength: 75, enteredWeek: 1 }];
    const processed = processCompetitors([business], { [business.id]: legacy }, 5).updatedCompetitors[business.id];
    expect(processed).toHaveLength(3);
    expect(processed[0].ceoName).toBeTruthy();
    expect(processed[0].decisionHistory?.length).toBeGreaterThan(0);
    expect(processed[0].cash).toBeDefined();
    expect(processed[0].lastDecision).not.toBe('Entered the local market');
  });

  test('rivals expand faster in a boom than in a recession', () => {
    const business = createBusiness('coffee_shop', 'Cycle Coffee', 1, 1, 1)!;
    const initial = createInitialCompetitors(business, 1);

    const boom = processCompetitors([business], { [business.id]: initial }, 2, 'boom')
      .updatedCompetitors[business.id];
    const recession = processCompetitors([business], { [business.id]: initial }, 2, 'recession')
      .updatedCompetitors[business.id];

    const boomStrength = boom.reduce((sum, rival) => sum + rival.strength, 0);
    const recessionStrength = recession.reduce((sum, rival) => sum + rival.strength, 0);
    expect(boomStrength).toBeGreaterThan(recessionStrength);
  });

  test('recession changes due rival decisions into defensive or counter-cyclical actions', () => {
    const business = createBusiness('coffee_shop', 'Cycle Coffee', 1, 1, 1)!;
    const initial = createInitialCompetitors(business, 1).map((rival, index) => ({
      ...rival,
      lastDecisionWeek: 1,
      strategy: index === 0 ? 'cost_leadership' as const : rival.strategy,
    }));

    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const processed = processCompetitors([business], { [business.id]: initial }, 5, 'recession')
      .updatedCompetitors[business.id];

    expect(processed[0].lastDecision).toContain('recession');
    expect(processed[0].cash ?? 0).toBeGreaterThan(initial[0].cash ?? 0);
    jest.restoreAllMocks();
  });

  test('keeps the same rival IDs between weekly updates', () => {
    const business = createBusiness('coffee_shop', 'Test Coffee', 1, 1, 1)!;
    const initial = createInitialCompetitors(business, 1);
    const first = processCompetitors([business], { [business.id]: initial }, 2).updatedCompetitors[business.id];
    const second = processCompetitors([business], { [business.id]: first }, 3).updatedCompetitors[business.id];
    expect(second.map((rival) => rival.id)).toEqual(first.map((rival) => rival.id));
    expect(second[0].strength).toBeGreaterThan(first[0].strength);
  });
});
