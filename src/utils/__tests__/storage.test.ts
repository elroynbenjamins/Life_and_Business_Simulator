import AsyncStorage from '@react-native-async-storage/async-storage';
import { INITIAL_GAME_STATE, INITIAL_PROFILE } from '../../types/game';
import { loadAllSlotMeta, loadGame, loadProfile, saveGame } from '../storage';

describe('save storage and migrations', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('fills new profile fields when loading an older profile', async () => {
    await AsyncStorage.setItem('life_biz_sim_profile', JSON.stringify({ totalXp: 25, gems: 4 }));
    const profile = await loadProfile();

    expect(profile.totalXp).toBe(25);
    expect(profile.gems).toBe(4);
    expect(profile.adsRemoved).toBe(false);
    expect(profile.processedPurchaseIds).toEqual([]);
    expect(profile.prestigePoints).toBe(INITIAL_PROFILE.prestigePoints);
  });

  test('saves a slot and creates matching slot metadata', async () => {
    const game = { ...INITIAL_GAME_STATE, playerName: 'Tester', cash: 12_345, week: 8, year: 3 };
    await saveGame(game, 1);

    const loaded = await loadGame(1);
    const metadata = await loadAllSlotMeta();
    expect(loaded?.playerName).toBe('Tester');
    expect(loaded?.cash).toBe(12_345);
    expect(metadata[1]).toMatchObject({ playerName: 'Tester', week: 8, year: 3, cash: 12_345 });
  });
});
