import { getBusinessOperatingScale, getBusinessUpgradeWeeks, getUpgrade, createBusiness, processBusinessWeek } from '../businessEngine';
import upgrades from '../../data/business_upgrades.json';
import { simulateBusinessScenario } from '../businessSimulation';

describe('lean startup business model', () => {
  afterEach(() => jest.restoreAllMocks());
  test('overhead scales smoothly with reputation and stops at full costs', () => {
    expect(getBusinessOperatingScale(0)).toEqual({ overhead: 0.25, premises: 0.65 });
    expect(getBusinessOperatingScale(70)).toEqual({ overhead: 1, premises: 1 });
    expect(getBusinessOperatingScale(100)).toEqual(getBusinessOperatingScale(70));
    expect(getBusinessOperatingScale(25).overhead).toBeLessThan(getBusinessOperatingScale(40).overhead);
    expect(getBusinessOperatingScale(-50)).toEqual(getBusinessOperatingScale(0));
  });
  test('all upgrades provide 2% revenue while reputation effects remain 25% weaker', () => {
    for (const upgrade of upgrades) {
      expect(getUpgrade(upgrade.id)?.revenueBoost).toBeCloseTo(0.02);
      expect(getUpgrade(upgrade.id)?.reputationBoost).toBeCloseTo(upgrade.reputationBoost * 0.75);
    }
  });
  test('new upgrade durations are 25% shorter rounded to full weeks', () => {
    for (let i=0; i<15; i++) expect(getBusinessUpgradeWeeks((i+0.1)/15)).toBe(Math.round((16+i)*0.75));
    expect(getBusinessUpgradeWeeks(0)).toBe(12);
    expect(getBusinessUpgradeWeeks(1)).toBe(23);
  });
  test('profitable companies retain the Balanced eight-week buffer before paying dividends', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const business = createBusiness('coffee_shop', null, 1, 1, 1)!;
    business.balance = 0;
    business.employees = Array.from({length:3}, (_,i)=>({id:String(i),name:'Worker',age:25,roleId:'worker',weeklySalary:300,skill:50,potential:70,morale:70,experience:0,weeksEmployed:0}));
    const result=processBusinessWeek(business,1,2,1);
    expect(result.weeklyProfit).toBeGreaterThan(0);
    expect(result.playerDividend).toBe(0);
    expect(result.updatedBusiness.balance).toBe(result.weeklyProfit);
    const rich = processBusinessWeek({...business,balance:100000},1,2,1);
    expect(rich.playerDividend).toBe(Math.round(rich.weeklyProfit * 0.25));
  });
  test('no first-level startup-support cliff at low reputation', () => {
    const initial = simulateBusinessScenario({businessTypeId:'coffee_shop',weeks:1,seed:11,employeeQuality:'average',upgrades:'none'}).endingBusiness;
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const first = processBusinessWeek({...initial,reputation:25,level:0},1,3,1);
    const next = processBusinessWeek({...initial,reputation:25,level:1},1,3,1);
    expect(next.weeklyRevenue).toBeGreaterThanOrEqual(first.weeklyRevenue);
  });
});
