import { INITIAL_GAME_STATE, INITIAL_CAREER_STATE, INITIAL_RELATIONSHIP_STATE } from '../../types/game';
import { createAcquiredBusiness, generateAcquisitionTargets, applyIntegrationStrategy } from '../acquisitionEngine';
import { processBusinessWeek } from '../businessEngine';
import { calculatePartnerContribution } from '../relationshipEngine';
import { getCareerSalary } from '../careerEngine';
import { calculateTax, getWeeklyRent, getWeeklyUtilityCost, getWeeklyFoodCost, getWeeklyCarCost } from '../financeEngine';
import paths from '../../data/career_paths.json';
import { getPrestigeBonuses, getPrestigeEffects } from '../prestigeEngine';
import { INITIAL_PROFILE } from '../../types/game';
import { processLifecycle } from '../lifecycleEngine';

const diagnostic = process.env.BALANCE_DIAGNOSTICS === '1' ? test : test.skip;
const median = (v: number[]) => v.sort((a,b) => a-b)[Math.floor(v.length / 2)];

diagnostic('mortality distribution across 10000 seeded lifetimes', () => {
  let seed = 919;
  const spy = jest.spyOn(Math, 'random').mockImplementation(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  const ages: number[] = [];
  try {
    for (let run = 0; run < 10000; run++) {
      for (let age = 21; age <= 110; age++) {
        const result = processLifecycle({ ...INITIAL_GAME_STATE, age, year: age - 19 }, age - 1);
        if (result.diedThisWeek) { ages.push(age); break; }
      }
    }
    ages.sort((a,b) => a-b);
    console.log('MORTALITY_AGES', JSON.stringify({ lives: ages.length, min: ages[0], p10: ages[999], p50: ages[4999], p90: ages[8999], max: ages[9999] }));
    expect(ages).toHaveLength(10000);
    expect(ages[0]).toBeGreaterThanOrEqual(55);
  } finally { spy.mockRestore(); }
});

diagnostic('acquisition quote vs first 20 actual operating weeks', () => {
  let seed = 9192026;
  const spy = jest.spyOn(Math, 'random').mockImplementation(() => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  const samples: any[] = [];
  try {
    for (let run = 0; run < 50; run++) {
      const state = { ...INITIAL_GAME_STATE, year: 21, age: 40 };
      for (const target of generateAcquisitionTargets(401, 1)) {
        let business = applyIntegrationStrategy(createAcquiredBusiness(target, state, null, target.askingPrice, 'cash')!, 'integrate');
        let profit = 0, dividends = 0;
        for (let week = 1; week <= 20; week++) {
          const result = processBusinessWeek(business, 1, week, 21);
          business = result.updatedBusiness;
          profit += business.lastWeekProfit; dividends += result.playerDividend;
        }
        samples.push({ tier: target.tier, ratio: profit / 20 / target.weeklyProfit, yield: profit / target.askingPrice * 100, dividends: dividends / target.askingPrice * 100 });
      }
    }
    console.log('ACQUISITION_YIELDS', JSON.stringify(['regional','national','enterprise'].map(tier => {
      const rows = samples.filter(s => s.tier === tier);
      return { tier, samples: rows.length, medianActualToQuotedProfit: median(rows.map(s => s.ratio)), medianFirstYearProfitYieldPct: median(rows.map(s => s.yield)), medianFirstYearCashDividendYieldPct: median(rows.map(s => s.dividends)) };
    })));
    expect(samples).toHaveLength(300);
  } finally { spy.mockRestore(); }
});

diagnostic('single-parent budgets across job levels and inflation', () => {
  const rows: any[] = [];
  for (const inflation of [1, 3]) for (const level of [1, 2, 3, 4, 5, 6, 7]) for (const raises of [0, 5]) {
    const budgets: number[] = [];
    for (const path of paths) {
      if (!path.positions.some(position => position.level === level)) continue;
      const career = { ...INITIAL_CAREER_STATE, companyId: 'career_employer', careerPathId: path.id, positionLevel: level, performanceRaisesAtLevel: raises };
      const state = { ...INITIAL_GAME_STATE, career, inflationMultiplier: inflation, year: 21,
        currentHousingId: level >= 7 ? 'luxury_villa' : level >= 6 ? 'family_house' : level >= 5 ? 'small_house' : level >= 3 ? 'studio_apartment' : 'cheap_apartment',
        currentCarId: level >= 5 ? 'suv' : level >= 3 ? 'sedan' : 'used_car', relationshipModeEnabled: true,
        relationshipState: { ...INITIAL_RELATIONSHIP_STATE, children: [1,7,14].map((age,i) => ({ id: String(i), name: 'Child', gender: 'girl' as const, birthGlobalWeek: 401-age*20, age, educationFund: 0 })) } };
      const salary = getCareerSalary(career, inflation);
      const costs = getWeeklyRent(state) + getWeeklyUtilityCost(state) + getWeeklyFoodCost(state) + getWeeklyCarCost(state) + calculatePartnerContribution(null, state).familyCost;
      budgets.push(salary - calculateTax(salary * 20, inflation, level) / 20 - costs);
    }
    rows.push({ inflation, level, raises, careers: budgets.length, minWeeklySurplus: Math.round(Math.min(...budgets)), medianWeeklySurplus: Math.round(median(budgets)), maxWeeklySurplus: Math.round(Math.max(...budgets)) });
  }
  console.log('SINGLE_PARENT_BUDGETS', JSON.stringify(rows));
  const effects = getPrestigeEffects({ ...INITIAL_PROFILE, unlockedPrestige: getPrestigeBonuses().map(b => b.id) });
  console.log('MAX_PRESTIGE_EFFECTS', JSON.stringify(effects));
  expect(rows).toHaveLength(28);
});
