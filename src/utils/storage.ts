import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, INITIAL_GAME_STATE } from '../types/game';

const SAVE_KEY = 'life_biz_sim_save';

export async function saveGame(state: GameState): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const data = await AsyncStorage.getItem(SAVE_KEY);
    if (data) {
      return JSON.parse(data) as GameState;
    }
    return null;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('Failed to clear game:', e);
  }
}
