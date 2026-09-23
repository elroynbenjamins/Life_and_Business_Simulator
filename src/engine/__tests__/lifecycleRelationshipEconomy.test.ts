import { INITIAL_GAME_STATE, INITIAL_RELATIONSHIP_STATE, RelationshipConnection } from '../../types/game';
import { annualDeathChance, calculateChildInheritanceTax, calculateEstateSettlement, getSuccessionPreview } from '../lifecycleEngine';
import { createInitialFamilyTree, syncFamilyTree, transitionFamilyTreeToChild } from '../familyTreeEngine';
import { getNetWorth } from '../financeEngine';
import { processEconomy } from '../economyEngine';
import { getChildFuturePotential, getChildPersonality, getChildWeeklyCost, getFamilyFormationProfile, getNormalizedDatingAgeBounds, getProposalCost, getWeddingCost, isNormalizedAgeMatch, processRelationships } from '../relationshipEngine';

describe('lifecycle and macro systems', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not introduce mortality before older age', () => {
    expect(annualDeathChance(54)).toBe(0);
    expect(annualDeathChance(55)).toBeGreaterThan(0);
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

  it('can spread a bounded market crash over several weekly waves', () => {
    const random = jest.spyOn(Math, 'random');
    random
      .mockReturnValueOnce(0) // trigger crash
      .mockReturnValueOnce(0) // 4% inflation correction
      .mockReturnValueOnce(0) // 10% total market decline
      .mockReturnValueOnce(0) // choose a spread crash
      .mockReturnValueOnce(0); // three waves

    const state = {
      ...INITIAL_GAME_STATE,
      year: 10,
      week: 19,
      inflationMultiplier: 1.4,
      lastMacroCrashWeek: 0,
    };

    const first = processEconomy(state, 20);
    expect(first.activeMacroCrash?.weeksRemaining).toBe(2);
    expect(first.crashEvent?.totalWeeks).toBe(3);
    expect(first.crashEvent?.stockShock).toBeGreaterThan(-0.10);

    const second = processEconomy({ ...state, activeMacroCrash: first.activeMacroCrash }, 1);
    const third = processEconomy({ ...state, activeMacroCrash: second.activeMacroCrash }, 2);
    expect(second.crashEvent?.isAftershock).toBe(true);
    expect(third.activeMacroCrash).toBeNull();

    const compoundedMove = Math.pow(1 + (first.crashEvent?.stockShock ?? 0), 3) - 1;
    expect(compoundedMove).toBeCloseTo(-0.10, 6);
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
    expect(getWeddingCost('courthouse', 1.5)).toBe(7500);
    expect(getWeddingCost('standard', 1)).toBe(30000);
    expect(getWeddingCost('luxury', 1)).toBe(120000);
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

  it('completes a shared cash-buffer goal through normal gameplay', () => {
    const partner: RelationshipConnection = {
      id: 'goal-partner',
      name: 'Laura',
      gender: 'woman',
      age: 29,
      occupationId: 'marketing',
      occupationTitle: 'Marketing Specialist',
      weeklyIncome: 900,
      savings: 8000,
      financialStyle: 'balanced',
      riskTolerance: 'balanced',
      ambition: 'career_minded',
      familyGoal: 'unsure',
      visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
      stage: 'living_together',
      connection: 80,
      relationship: 80,
      dates: 5,
      weeksKnown: 15,
      isCohabiting: true,
      householdSplit: 'equal',
    };

    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      cash: 20000,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: partner.id,
        activeConnections: [partner],
        personalActionWeek: 1,
        lastRelationshipEventWeek: 1,
        sharedGoal: {
          type: 'cash_buffer',
          target: 15000,
          startedGlobalWeek: 1,
          completed: false,
        },
      },
    });

    expect(result.state.sharedGoal?.completed).toBe(true);
    expect(result.relationshipGoalCompleted).toContain('cash buffer');
    expect(result.relationshipChange).toBeGreaterThanOrEqual(5);
  });

  it('stops partner household contributions while the partner is unemployed', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const partner: RelationshipConnection = {
      id: 'unemployed-partner',
      name: 'Sam',
      gender: 'man',
      age: 33,
      occupationId: 'consultant',
      occupationTitle: 'Business Consultant',
      weeklyIncome: 0,
      savings: 15000,
      financialStyle: 'balanced',
      riskTolerance: 'balanced',
      ambition: 'career_minded',
      familyGoal: 'unsure',
      visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
      stage: 'living_together',
      connection: 85,
      relationship: 85,
      dates: 6,
      weeksKnown: 25,
      isCohabiting: true,
      householdSplit: 'equal',
      employmentStatus: 'unemployed',
      unemploymentWeeks: 2,
      careerLevel: 2,
      lastCareerEventWeek: 1,
    };

    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      week: 5,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: partner.id,
        activeConnections: [partner],
        personalActionWeek: 5,
        lastRelationshipEventWeek: 5,
      },
    });

    expect(result.partnerContribution).toBe(0);
    expect(result.state.activeConnections[0].employmentStatus).toBe('unemployed');
  });

  it('distributes a default estate between spouse and children', () => {
    const spouse: RelationshipConnection = {
      id: 'spouse-estate',
      name: 'Sophie',
      gender: 'woman',
      age: 70,
      occupationId: 'accounting',
      occupationTitle: 'Assistant Accountant',
      weeklyIncome: 1000,
      savings: 40000,
      financialStyle: 'frugal',
      riskTolerance: 'balanced',
      ambition: 'career_minded',
      familyGoal: 'wants_children',
      visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
      stage: 'married',
      connection: 90,
      relationship: 90,
      dates: 10,
      weeksKnown: 200,
      isCohabiting: true,
      householdSplit: 'equal',
      marriageAgreement: 'separate',
    };
    const state = {
      ...INITIAL_GAME_STATE,
      cash: 100000,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        partnerId: spouse.id,
        activeConnections: [spouse],
        children: [
          { id: 'child-1', name: 'Mila', gender: 'girl' as const, birthGlobalWeek: 1, age: 25, educationFund: 0 },
          { id: 'child-2', name: 'Finn', gender: 'boy' as const, birthGlobalWeek: 1, age: 23, educationFund: 0 },
        ],
      },
    };
    const estate = calculateEstateSettlement(state);
    const spouseShare = estate.beneficiaries.find((item) => item.id === spouse.id);
    const childShares = estate.beneficiaries.filter((item) => item.relationship === 'child');

    expect(spouseShare?.share).toBeCloseTo(0.5);
    expect(childShares).toHaveLength(2);
    expect(childShares[0].share).toBeCloseTo(0.25);
    expect(estate.netEstate).toBeLessThan(estate.grossEstate);
  });

  it('reduces estate administration cost when a family trust exists', () => {
    const baseState = {
      ...INITIAL_GAME_STATE,
      cash: 1000000,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [{ id: 'child', name: 'Mila', gender: 'girl' as const, birthGlobalWeek: 1, age: 30, educationFund: 0 }],
      },
    };
    const withoutPlan = calculateEstateSettlement(baseState);
    const withTrust = calculateEstateSettlement({
      ...baseState,
      relationshipState: {
        ...baseState.relationshipState,
        estatePlan: {
          ...baseState.relationshipState.estatePlan,
          structure: 'family_trust' as const,
        },
      },
    });

    expect(withTrust.administrationCost).toBeLessThan(withoutPlan.administrationCost);
    expect(withTrust.netEstate).toBeGreaterThan(withoutPlan.netEstate);
  });

  it('can end an elderly marriage when the partner dies and transfers spouse savings', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const spouse: RelationshipConnection = {
      id: 'elder-spouse',
      name: 'Sophie',
      gender: 'woman',
      age: 125,
      occupationId: 'accounting',
      occupationTitle: 'Assistant Accountant',
      weeklyIncome: 1000,
      savings: 50000,
      financialStyle: 'frugal',
      riskTolerance: 'balanced',
      ambition: 'career_minded',
      familyGoal: 'wants_children',
      visibleTraits: ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'],
      stage: 'married',
      connection: 90,
      relationship: 90,
      dates: 10,
      weeksKnown: 200,
      isCohabiting: true,
      householdSplit: 'equal',
      marriageAgreement: 'separate',
      employmentStatus: 'employed',
      careerLevel: 3,
      lastCareerEventWeek: 1,
    };

    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      year: 20,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        preferencesSet: true,
        partnerId: spouse.id,
        activeConnections: [spouse],
        personalActionWeek: 381,
      },
    });

    expect(result.partnerDiedName).toBe('Sophie');
    expect(result.partnerInheritance).toBeGreaterThan(0);
    expect(result.state.partnerId).toBeNull();
    expect(result.state.formerPartners).toHaveLength(1);
  });

  it('launches a child into independent adulthood using the education fund', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.4);
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      year: 19,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [{
          id: 'launch-child',
          name: 'Mila',
          gender: 'girl' as const,
          birthGlobalWeek: 1,
          age: 17,
          educationFund: 50000,
          status: 'dependent' as const,
        }],
      },
    });

    const child = result.state.children[0];
    expect(child.status).toBe('independent');
    expect(child.educationFund).toBe(0);
    expect(child.occupationTitle).toBeTruthy();
    expect(child.weeklyIncome).toBeGreaterThan(0);
    expect(child.educationOutcome).toBe('elite');
    expect(result.familyMilestones[0]).toContain('became independent');
  });

  it('applies progressive inheritance tax only to child inheritance above the allowance', () => {
    expect(calculateChildInheritanceTax(50000)).toBe(0);
    expect(calculateChildInheritanceTax(150000)).toBe(10000);
    expect(calculateChildInheritanceTax(500000)).toBe(57500);
    expect(calculateChildInheritanceTax(6000000)).toBeGreaterThan(calculateChildInheritanceTax(1000000));
  });

  it('creates an illiquid succession tax bill when a child inherits a business', () => {
    const child = {
      id: 'succession-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      occupationTitle: 'Assistant Accountant',
      weeklyIncome: 1000,
      savings: 10000,
      homeStatus: 'renting' as const,
      partnerName: null,
      partnerGender: null,
      childrenCount: 0,
    };
    const state = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        estatePlan: {
          ...INITIAL_RELATIONSHIP_STATE.estatePlan,
          successorId: child.id,
        },
        estateSettlement: {
          grossEstate: 1000000,
          outstandingRelationshipObligations: 0,
          administrationCost: 20000,
          netEstate: 980000,
          beneficiaries: [{
            id: child.id,
            name: child.name,
            relationship: 'child' as const,
            share: 1,
            amount: 80000,
          }],
          successorName: child.name,
          businessValue: 900000,
        },
      },
    };
    const preview = getSuccessionPreview(state, child.id);
    expect(preview).not.toBeNull();
    expect(preview?.inheritanceTaxBase).toBe(980000);
    expect(preview?.taxCashAvailable).toBe(90000);
    expect(preview?.loanNeeded).toBeGreaterThan(0);
  });

  it('lets independent adult children progress into homes, partners, businesses and children', () => {
    const random = jest.spyOn(Math, 'random');
    random
      .mockReturnValueOnce(0.99) // avoid layoff
      .mockReturnValueOnce(0.01) // meet partner
      .mockReturnValueOnce(0.01) // partner gender
      .mockReturnValueOnce(0.01) // partner name
      .mockReturnValueOnce(0.01) // start business
      .mockReturnValueOnce(0.01) // buy home
      .mockReturnValueOnce(0.01) // have child
      .mockReturnValueOnce(0.01) // child gender
      .mockReturnValueOnce(0.01) // child name
      .mockReturnValue(0.99);
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [{
          id: 'adult-life',
          name: 'Mila',
          gender: 'girl' as const,
          birthGlobalWeek: 1,
          age: 30,
          educationFund: 0,
          status: 'independent' as const,
          occupationTitle: 'Assistant Accountant',
          weeklyIncome: 1200,
          educationOutcome: 'strong' as const,
          launchedGlobalWeek: 361,
          savings: 100000,
          homeStatus: 'renting' as const,
          partnerName: null,
          partnerGender: null,
          childrenCount: 0,
        }],
        lastRelationshipEventWeek: 1,
      },
    });

    const adult = result.state.children[0];
    expect(adult.occupationTitle).toBe('Entrepreneur');
    expect(adult.homeStatus).toBe('homeowner');
    expect(adult.partnerName).toBeTruthy();
    expect(adult.childrenCount).toBe(1);
    expect(result.familyMilestones.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps dating and marriage age gaps within a normal life-stage range', () => {
    expect(getNormalizedDatingAgeBounds(20)).toEqual({ min: 18, max: 24 });
    expect(getNormalizedDatingAgeBounds(30)).toEqual({ min: 24, max: 36 });
    expect(getNormalizedDatingAgeBounds(50)).toEqual({ min: 42, max: 58 });

    expect(isNormalizedAgeMatch(30, 34)).toBe(true);
    expect(isNormalizedAgeMatch(30, 36)).toBe(true);
    expect(isNormalizedAgeMatch(30, 39)).toBe(false);
    expect(isNormalizedAgeMatch(20, 25)).toBe(false);
  });

  it('centers family formation on normal adult ages and stops after 42', () => {
    expect(getFamilyFormationProfile(23, 24, 0).baseSuccessChance).toBeCloseTo(0.25);
    expect(getFamilyFormationProfile(30, 32, 0).baseSuccessChance).toBeCloseTo(0.85);
    expect(getFamilyFormationProfile(37, 39, 0).baseSuccessChance).toBeCloseTo(0.60);
    expect(getFamilyFormationProfile(40, 42, 0).baseSuccessChance).toBeCloseTo(0.25);
    expect(getFamilyFormationProfile(43, 41, 0).allowedByAge).toBe(false);
    expect(getFamilyFormationProfile(30, 31, 3).allowedByAge).toBe(false);
  });

  it('makes later additional children progressively less likely', () => {
    const first = getFamilyFormationProfile(31, 32, 0).baseSuccessChance;
    const second = getFamilyFormationProfile(31, 32, 1).baseSuccessChance;
    const third = getFamilyFormationProfile(31, 32, 2).baseSuccessChance;
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
  });

  it('assigns stable child personalities and meaningful future potential', () => {
    const first = getChildPersonality('child-stable-1');
    const second = getChildPersonality('child-stable-1');
    expect(first).toEqual(second);

    const child = {
      id: 'potential-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      occupationTitle: 'Software Developer',
      weeklyIncome: 1800,
      educationOutcome: 'elite' as const,
      savings: 150000,
      homeStatus: 'homeowner' as const,
      parentRelationship: 92,
      personality: {
        ambition: 'driven' as const,
        financialStyle: 'frugal' as const,
        riskTolerance: 'balanced' as const,
        independence: 'balanced' as const,
        resilience: 'resilient' as const,
      },
      adultStatus: 'employed' as const,
      debt: 0,
      failureCount: 0,
      businessValue: 0,
      descendants: [],
    };
    const potential = getChildFuturePotential(child);
    expect(potential.score).toBeGreaterThanOrEqual(80);
    expect(potential.label).toBe('Exceptional');
  });

  it('can produce an adult-child setback without deleting the child', () => {
    const random = jest.spyOn(Math, 'random');
    random.mockReturnValue(0);
    const child = {
      id: 'setback-child',
      name: 'Finn',
      gender: 'boy' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      occupationTitle: 'Engineer',
      weeklyIncome: 1200,
      educationOutcome: 'solid' as const,
      launchedGlobalWeek: 361,
      savings: 30000,
      homeStatus: 'renting' as const,
      partnerName: null,
      partnerGender: null,
      childrenCount: 0,
      descendants: [],
      parentRelationship: 75,
      personality: {
        ambition: 'relaxed' as const,
        financialStyle: 'balanced' as const,
        riskTolerance: 'balanced' as const,
        independence: 'independent' as const,
        resilience: 'fragile' as const,
      },
      adultStatus: 'employed' as const,
      debt: 0,
      failureCount: 0,
      businessValue: 0,
      lastAdultEventYear: 0,
    };

    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        lastRelationshipEventWeek: 600,
      },
    });
    expect(result.state.children).toHaveLength(1);
    expect(result.state.children[0].adultStatus).toBe('unemployed');
    expect(result.state.children[0].failureCount).toBeGreaterThan(0);
    expect(result.familyMilestones.some((item) => item.includes('lost their job'))).toBe(true);
  });

  it('preserves family-tree identities across succession', () => {
    const state = {
      ...INITIAL_GAME_STATE,
      playerName: 'Alex',
      year: 25,
      age: 44,
      generation: 1,
      relationshipModeEnabled: true,
      familyTree: createInitialFamilyTree('Alex', 44, 25, 1),
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [{
          id: 'tree-child',
          name: 'Mila',
          gender: 'girl' as const,
          birthGlobalWeek: 120,
          age: 24,
          educationFund: 0,
          status: 'independent' as const,
          parentRelationship: 80,
          descendants: [],
        }],
      },
    };
    const synced = syncFamilyTree(state);
    expect(synced.people.some((person) => person.name === 'Mila')).toBe(true);
    const transitioned = transitionFamilyTreeToChild({ ...state, familyTree: synced }, 'tree-child', 2);
    expect(transitioned.currentPlayerId).toBe('person:tree-child');
    expect(transitioned.people.find((person) => person.id === 'person:tree-child')?.playableGeneration).toBe(2);
  });

  it('lets succession preserve assets instead of forcing full liquidation', () => {
    const child = {
      id: 'asset-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      savings: 20000,
      parentRelationship: 80,
    };
    const property = {
      id: 'estate-property',
      typeId: 'small_house',
      name: 'Estate House',
      purchasePrice: 100000,
      currentValue: 100000,
      isRentedOut: false,
      isRenovated: false,
      purchaseWeek: 1,
      purchaseYear: 1,
      weeklyIncome: 0,
      weeklyMaintenance: 0,
    };
    const state = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      cash: 50000,
      relationshipModeEnabled: true,
      properties: [property],
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        estateSettlement: {
          grossEstate: 200000,
          outstandingRelationshipObligations: 0,
          administrationCost: 0,
          netEstate: 200000,
          beneficiaries: [{
            id: child.id,
            name: child.name,
            relationship: 'child' as const,
            share: 1,
            amount: 200000,
          }],
          successorName: null,
          businessValue: 0,
        },
      },
    };

    const liquid = getSuccessionPreview(state, child.id, 'liquidate');
    const keepProperty = getSuccessionPreview(state, child.id, 'keep_properties');
    expect(liquid?.inheritedPropertyValue).toBe(0);
    expect(keepProperty?.inheritedPropertyValue).toBe(100000);
    expect(keepProperty?.inheritedCash).toBeLessThan(liquid?.inheritedCash ?? 0);
    expect(keepProperty?.inheritanceTax).toBe(liquid?.inheritanceTax);
  });

  it('keeps only designated family businesses outside the liquidated estate split', () => {
    const child = {
      id: 'family-biz-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      parentRelationship: 80,
    };
    const baseBusiness: any = {
      id: 'biz-normal',
      typeId: 'retail',
      name: 'Normal Co',
      valuation: 500000,
      businessLoans: [],
      balance: 0,
      totalRevenue: 0,
      totalExpenses: 0,
      lastWeekRevenue: 0,
      lastWeekExpenses: 0,
      lastWeekProfit: 0,
      reputation: 50,
      level: 1,
      pricingStrategy: 'standard',
      advertisingLevel: 'none',
      employees: [],
      purchasedUpgrades: [],
      activeEvents: [],
      weeklyProfitHistory: [],
      foundedWeek: 1,
      foundedYear: 1,
    };
    const familyBusiness = {
      ...baseBusiness,
      id: 'biz-family',
      name: 'Family Co',
      familyBusiness: {
        isFamilyBusiness: true,
        familyName: 'Test Family',
        founderGeneration: 1,
        generationsOwned: 1,
        controllerName: 'Parent',
        controllerPersonId: 'player:g1',
        familyOwnershipPct: 100,
        designatedYear: 1,
      },
    };
    const state = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      cash: 100000,
      businesses: [baseBusiness, familyBusiness],
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        estatePlan: {
          ...INITIAL_RELATIONSHIP_STATE.estatePlan,
          successorId: child.id,
        },
      },
    };
    const estate = calculateEstateSettlement(state);
    expect(estate.businessValue).toBe(500000);
    expect(estate.successorName).toBe('Mila');
  });

  it('can make an estranged adult child unwilling to continue the dynasty', () => {
    const child = {
      id: 'estranged-child',
      name: 'Noah',
      gender: 'boy' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      savings: 25000,
      parentRelationship: 18,
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
          grossEstate: 100000,
          outstandingRelationshipObligations: 0,
          administrationCost: 0,
          netEstate: 100000,
          beneficiaries: [{
            id: child.id,
            name: child.name,
            relationship: 'child' as const,
            share: 1,
            amount: 100000,
          }],
          successorName: null,
          businessValue: 0,
        },
      },
    };
    const preview = getSuccessionPreview(state, child.id);
    expect(preview?.willingToSucceed).toBe(false);
    expect(preview?.parentRelationship).toBe(18);
  });

  it('slowly weakens a parent-child bond after long-term neglect', () => {
    const child = {
      id: 'neglected-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 10,
      educationFund: 0,
      status: 'dependent' as const,
      parentRelationship: 75,
      lastParentInteractionWeek: 1,
      descendants: [],
    };
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      year: 11,
      week: 1,
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        lastRelationshipEventWeek: 201,
      },
    });

    expect(result.state.children[0].parentRelationship).toBe(72);
  });

  it('keeps an adult child employed when they hold an operating family-business role', () => {
    const child = {
      id: 'family-exec-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      occupationTitle: 'Accountant',
      weeklyIncome: 1200,
      educationOutcome: 'strong' as const,
      savings: 50000,
      homeStatus: 'renting' as const,
      partnerName: null,
      partnerGender: null,
      descendants: [],
      parentRelationship: 80,
      personality: {
        ambition: 'driven' as const,
        financialStyle: 'frugal' as const,
        riskTolerance: 'balanced' as const,
        independence: 'balanced' as const,
        resilience: 'resilient' as const,
      },
      adultStatus: 'employed' as const,
      debt: 0,
      failureCount: 0,
      businessValue: 0,
    };

    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = processRelationships({
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      relationshipModeEnabled: true,
      businesses: [{
        id: 'family-company',
        name: 'Family Co',
        familyRoles: [{
          childId: child.id,
          childName: child.name,
          role: 'executive' as const,
          appointedYear: 25,
          experienceWeeks: 40,
          performance: 80,
          weeklySalary: 1800,
        }],
      } as any],
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        lastRelationshipEventWeek: 999,
      },
    });

    const updated = result.state.children[0];
    expect(updated.adultStatus).toBe('employed');
    expect(updated.occupationTitle).toBe('Family Co Executive');
    expect(updated.weeklyIncome).toBe(1800);
    expect(updated.failureCount).toBe(0);
  });

  it('separates company shares an heir already owns from newly inherited business equity', () => {
    const child = {
      id: 'existing-share-child',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      savings: 25000,
      parentRelationship: 80,
    };
    const business = {
      id: 'family-share-business',
      typeId: 'coffee_shop',
      name: 'Family Co',
      valuation: 1000000,
      businessLoans: [],
      familyBusiness: {
        isFamilyBusiness: true,
        familyName: 'Family Co',
        founderGeneration: 1,
        generationsOwned: 1,
        controllerName: 'Parent',
        controllerPersonId: 'player:g1',
        familyOwnershipPct: 100,
        designatedYear: 1,
      },
      ownership: [
        { ownerType: 'player' as const, ownerId: 'player:g1', ownerName: 'Parent', percent: 80, votingPercent: 80 },
        { ownerType: 'child' as const, ownerId: child.id, ownerName: child.name, percent: 20, votingPercent: 20 },
      ],
    } as any;

    const state = {
      ...INITIAL_GAME_STATE,
      year: 31,
      week: 1,
      businesses: [business],
      relationshipModeEnabled: true,
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [child],
        estateSettlement: {
          grossEstate: 800000,
          outstandingRelationshipObligations: 0,
          administrationCost: 0,
          netEstate: 800000,
          beneficiaries: [{
            id: child.id,
            name: child.name,
            relationship: 'child' as const,
            share: 1,
            amount: 0,
          }],
          successorName: child.name,
          businessValue: 800000,
        },
      },
    };

    const preview = getSuccessionPreview(state, child.id);
    expect(preview?.existingBusinessStakeValue).toBe(200000);
    expect(preview?.inheritedBusinessValue).toBe(800000);
    expect(preview?.inheritanceTaxBase).toBe(800000);
  });

  it('preserves non-selected sibling wealth when another child becomes playable', () => {
    const selected = {
      id: 'selected-heir',
      name: 'Mila',
      gender: 'girl' as const,
      birthGlobalWeek: 1,
      age: 30,
      educationFund: 0,
      status: 'independent' as const,
      savings: 80000,
      parentRelationship: 80,
    };
    const sibling = {
      id: 'wealthy-sibling',
      name: 'Noah',
      gender: 'boy' as const,
      birthGlobalWeek: 21,
      age: 29,
      educationFund: 0,
      status: 'independent' as const,
      savings: 120000,
      businessValue: 40000,
      parentRelationship: 75,
    };
    const state = {
      ...INITIAL_GAME_STATE,
      playerName: 'Parent',
      year: 31,
      week: 1,
      generation: 1,
      relationshipModeEnabled: true,
      familyTree: createInitialFamilyTree('Parent', 50, 31, 1),
      relationshipState: {
        ...INITIAL_RELATIONSHIP_STATE,
        children: [selected, sibling],
      },
    };

    const transitioned = transitionFamilyTreeToChild(state, selected.id, 2);
    const siblingNode = transitioned.people.find((person) => person.id === `person:${sibling.id}`);

    expect(siblingNode?.liquidWealth).toBe(160000);
  });
});
