import achievementsData from '../../data/achievements.json';
import prestigeData from '../../data/prestige_tree_v2.json';
import { checkAchievements } from '../achievementEngine';
import { canUnlockPrestige, getPrestigeEffects, unlockPrestige } from '../prestigeEngine';
import { getSuccessionPreview } from '../lifecycleEngine';
import { processStocks } from '../stockEngine';
import { INITIAL_GAME_STATE, INITIAL_PROFILE, INITIAL_RELATIONSHIP_STATE } from '../../types/game';

describe('achievement and Prestige expansion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('all four-level Prestige branches charge 10 gems at level 3 and 25 at level 4', () => {
    const fourLevelPrefixes = [
      'salary_boost',
      'study_speed',
      'starting_cash',
      'business_costs',
      'skill_growth',
      'tax_reduction',
      'dividend_boost',
      'business_resilience',
      'family_leadership',
      'legacy_planning',
      'crypto_risk_control',
    ];

    for (const prefix of fourLevelPrefixes) {
      const level3 = (prestigeData as any[]).find((node) => node.id === `${prefix}_3`);
      const level4 = (prestigeData as any[]).find((node) => node.id === `${prefix}_4`);
      expect(level3?.gemCost).toBe(10);
      expect(level4?.gemCost).toBe(25);
    }
  });

  test('Prestige unlocks require and deduct gems on top of Prestige Points', () => {
    const level3 = (prestigeData as any[]).find((node) => node.id === 'salary_boost_3');
    expect(level3).toBeTruthy();

    const missingGems = {
      ...INITIAL_PROFILE,
      prestigePoints: 1000,
      gems: 9,
      unlockedPrestige: ['salary_boost', 'salary_boost_2'],
    };
    expect(canUnlockPrestige(missingGems, 'salary_boost_3')).toBe(false);

    const funded = { ...missingGems, gems: 30 };
    expect(canUnlockPrestige(funded, 'salary_boost_3')).toBe(true);

    const unlocked = unlockPrestige(funded, 'salary_boost_3');
    expect(unlocked?.prestigePoints).toBe(1000 - level3.cost);
    expect(unlocked?.gems).toBe(20);
    expect(unlocked?.unlockedPrestige).toContain('salary_boost_3');
  });

  test('new Prestige branches expose their highest unlocked effects', () => {
    const profile = {
      ...INITIAL_PROFILE,
      unlockedPrestige: [
        'business_resilience',
        'business_resilience_2',
        'business_resilience_3',
        'business_resilience_4',
        'family_leadership',
        'family_leadership_2',
        'family_leadership_3',
        'family_leadership_4',
        'legacy_planning',
        'legacy_planning_2',
        'legacy_planning_3',
        'legacy_planning_4',
        'crypto_risk_control',
        'crypto_risk_control_2',
        'crypto_risk_control_3',
        'crypto_risk_control_4',
      ],
    };

    const effects = getPrestigeEffects(profile);
    expect(effects.business_crisis_reduction).toBeCloseTo(0.20);
    expect(effects.family_governance_bonus).toBe(12);
    expect(effects.inheritance_tax_reduction).toBeCloseTo(0.10);
    expect(effects.crypto_downside_reduction).toBeCloseTo(0.16);
  });

  test('Legacy Planning reduces the heir inheritance-tax preview', () => {
    const child = {
      id: 'tax-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      savings: 100000,
      parentRelationship: 80,
    };
    const state = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        estateSettlement: {
          grossEstate: 1000000,
          outstandingRelationshipObligations: 0,
          administrationCost: 0,
          netEstate: 1000000,
          beneficiaries: [{
            id: child.id,
            name: child.name,
            relationship: 'child' as const,
            share: 1,
            amount: 1000000,
          }],
          successorName: null,
          businessValue: 0,
        },
      },
    };

    const base = getSuccessionPreview(state, child.id, 'liquidate', 0);
    const reduced = getSuccessionPreview(state, child.id, 'liquidate', 0.10);
    const attemptedOverCap = getSuccessionPreview(state, child.id, 'liquidate', 0.50);
    expect(reduced?.inheritanceTax).toBeLessThan(base?.inheritanceTax ?? 0);
    expect(reduced?.inheritanceTax).toBe(Math.round((base?.inheritanceTax ?? 0) * 0.90));
    expect(attemptedOverCap?.inheritanceTax).toBe(reduced?.inheritanceTax);
  });

  test('Crypto Risk Control softens negative crypto weeks without boosting positive weeks', () => {
    const state = {
      ...INITIAL_GAME_STATE,
      stocks: [{ ticker: 'NEXA', currentPrice: 100, priceHistory: [100] }],
    };

    jest.spyOn(Math, 'random').mockReturnValue(0);
    const unprotected = processStocks(state, { headline: 'Quiet week', effects: {} }, 0, 0);
    jest.restoreAllMocks();

    jest.spyOn(Math, 'random').mockReturnValue(0);
    const protectedResult = processStocks(state, { headline: 'Quiet week', effects: {} }, 0, 0.16);

    expect(protectedResult.stocks[0].currentPrice).toBeGreaterThan(unprotected.stocks[0].currentPrice);
  });

  test('new system milestones unlock their matching achievements', () => {
    const child = {
      id: 'achievement-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      parentRelationship: 92,
      descendants: [{
        id: 'grandchild',
        name: 'Liv',
        gender: 'girl' as const,
        birthGlobalWeek: 500,
        age: 2,
      }],
    };

    const state = {
      ...INITIAL_GAME_STATE,
      generation: 3,
      relationshipModeEnabled: true,
      familyTree: {
        currentPlayerId: 'player:g3',
        people: Array.from({ length: 10 }, (_, index) => ({
          id: `person-${index}`,
          name: `Person ${index}`,
          generation: Math.max(1, Math.ceil((index + 1) / 4)),
          status: 'living' as const,
          age: 20 + index,
          birthYear: 1,
          parentIds: [],
          partnerIds: [],
          childIds: [],
        })),
      },
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        estatePlan: {
          ...INITIAL_RELATIONSHIP_STATE.estatePlan,
          structure: 'family_trust' as const,
        },
        children: [child],
      },
      businesses: [{
        id: 'family-business',
        name: 'Family Co',
        familyBusiness: {
          isFamilyBusiness: true,
          familyName: 'Family Co',
          founderGeneration: 1,
          generationsOwned: 3,
          controllerName: 'Player',
          controllerPersonId: 'player:g3',
          familyOwnershipPct: 90,
          designatedYear: 1,
        },
        familyRoles: [{
          childId: child.id,
          childName: child.name,
          role: 'board' as const,
          appointedYear: 20,
          experienceWeeks: 10,
          performance: 70,
          weeklySalary: 0,
        }],
        ownership: [
          { ownerType: 'player' as const, ownerId: 'player:g3', ownerName: 'Player', percent: 80, votingPercent: 80 },
          { ownerType: 'child' as const, ownerId: child.id, ownerName: child.name, percent: 10, votingPercent: 10 },
          { ownerType: 'investor' as const, ownerId: 'investor', ownerName: 'Investor', percent: 10, votingPercent: 10 },
        ],
        timeline: [
          { week: 1, year: 2, title: '🧭 Investment Priority: Invest in R&D', icon: '🧭', kind: 'event' as const },
          { week: 2, year: 2, title: '⚠️ Supplier Cost Shock: Switch Supplier', icon: '⚠️', kind: 'event' as const },
        ],
      } as any],
      stocks: [
        { ticker: 'AURX', currentPrice: 500, priceHistory: [500] },
        { ticker: 'NEXA', currentPrice: 100, priceHistory: [100] },
        { ticker: 'MOJO', currentPrice: 10, priceHistory: [10] },
      ],
      holdings: [
        { ticker: 'AURX', shares: 100, avgBuyPrice: 400 },
        { ticker: 'NEXA', shares: 300, avgBuyPrice: 80 },
        { ticker: 'MOJO', shares: 3000, avgBuyPrice: 4 },
      ],
    };

    const unlocked = checkAchievements(state, 1000000, 0);
    for (const id of [
      'parent_bond_90',
      'grandparent',
      'family_tree_10',
      'generation_2',
      'generation_3',
      'family_trust_established',
      'family_business_first',
      'family_business_gen2',
      'family_business_gen3',
      'family_governance_first',
      'business_strategy_decision',
      'business_crisis_resolved',
      'outside_investors',
      'child_shareholder',
      'crypto_first',
      'crypto_trinity',
      'crypto_100k',
      'mojo_double',
    ]) {
      expect(unlocked).toContain(id);
    }
  });

  test('achievement data contains all new milestone IDs', () => {
    const ids = new Set((achievementsData as any[]).map((achievement) => achievement.id));
    expect(ids.size).toBeGreaterThanOrEqual(69);
    expect(ids.has('generation_3')).toBe(true);
    expect(ids.has('family_business_gen3')).toBe(true);
    expect(ids.has('business_crisis_resolved')).toBe(true);
    expect(ids.has('crypto_trinity')).toBe(true);
  });
});
