import { checkAchievements } from '../achievementEngine';
import { getPrestigeBonuses, getPrestigeEffects } from '../prestigeEngine';
import { INITIAL_GAME_STATE, INITIAL_PROFILE } from '../../types/game';
import { GEM_CASH_RATE } from '../../constants/rewards';

describe('expanded prestige and late-game achievements', () => {
  test('uses the highest non-additive financial Prestige tier', () => {
    const profile = {
      ...INITIAL_PROFILE,
      unlockedPrestige: ['dividend_boost', 'dividend_boost_2', 'dividend_boost_3', 'dividend_boost_4', 'loan_rate', 'loan_rate_2', 'deposit_interest', 'deposit_interest_2'],
    };
    const effects = getPrestigeEffects(profile);
    expect(effects.dividend_boost).toBe(0.20);
    expect(effects.loan_rate_reduction).toBe(0.015);
    expect(effects.bank_deposit_interest_bonus).toBe(0.015);
  });

  test('removes Career Climber and raises existing tree costs by 50 PP', () => {
    const bonuses = getPrestigeBonuses();
    expect(bonuses.some((bonus) => bonus.id === 'promotion_speed')).toBe(false);
    expect(bonuses.find((bonus) => bonus.id === 'salary_boost')?.cost).toBe(70);
    expect(bonuses.find((bonus) => bonus.id === 'negotiation')?.cost).toBe(145);
  });

  test('unlocks requested time, portfolio, and realized-profit milestones', () => {
    const state = {
      ...INITIAL_GAME_STATE,
      happiness: 100,
      statistics: { ...INITIAL_GAME_STATE.statistics, weeksPlayed: 1000 },
      stocks: [{ ticker: 'TEST', currentPrice: 25_000, priceHistory: [25_000] }],
      holdings: [{ ticker: 'TEST', shares: 1000, avgBuyPrice: 100 }],
      totalRealizedProfitLoss: 5_000_000,
    };
    const unlocked = checkAchievements(state, 25_000_000, 0);
    expect(unlocked).toEqual(expect.arrayContaining(['ten_years', 'twenty_five_years', 'fifty_years', 'portfolio_5m', 'portfolio_10m', 'portfolio_25m', 'realized_profit_1m', 'realized_profit_2_5m', 'realized_profit_5m']));
    expect(unlocked).not.toContain('happiness_80');
    expect(unlocked).not.toContain('happiness_90');
  });

  test('converts each gem to €100', () => {
    expect(GEM_CASH_RATE).toBe(100);
  });
});
