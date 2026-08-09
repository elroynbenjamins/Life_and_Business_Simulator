import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState, INITIAL_GAME_STATE, PlayerProfile, INITIAL_PROFILE, SaveSlotMeta } from '../types/game';
import { getNetWorth } from '../engine/financeEngine';

// --- Save Slots (3 slots: 0, 1, 2) ---
const SLOT_KEY = (slot: number) => `life_biz_sim_slot_${slot}`;
const ACTIVE_SLOT_KEY = 'life_biz_sim_active_slot';
const SLOT_META_KEY = 'life_biz_sim_slot_meta';

// --- Player Profile (cross-game XP + gems) ---
const PROFILE_KEY = 'life_biz_sim_profile';

// ---- Save Slot Functions ----

export async function saveGame(state: GameState, slot?: number): Promise<void> {
  try {
    const activeSlot = slot ?? (await getActiveSlot());
    await AsyncStorage.setItem(SLOT_KEY(activeSlot), JSON.stringify(state));
    // Update slot metadata
    const meta: SaveSlotMeta = {
      playerName: state.playerName ?? 'Player',
      week: state.week ?? 1,
      year: state.year ?? 1,
      age: state.age ?? 22,
      cash: state.cash ?? 0,
      netWorth: getNetWorth(state),
      lastSaved: Date.now(),
    };
    const allMeta = await loadAllSlotMeta();
    allMeta[activeSlot] = meta;
    await AsyncStorage.setItem(SLOT_META_KEY, JSON.stringify(allMeta));
  } catch (e) {
    console.error('Failed to save game:', e);
  }
}

export async function loadGame(slot?: number): Promise<GameState | null> {
  try {
    const activeSlot = slot ?? (await getActiveSlot());
    const data = await AsyncStorage.getItem(SLOT_KEY(activeSlot));
    if (data) {
      return JSON.parse(data) as GameState;
    }
    return null;
  } catch (e) {
    console.error('Failed to load game:', e);
    return null;
  }
}

export async function clearGame(slot?: number): Promise<void> {
  try {
    const activeSlot = slot ?? (await getActiveSlot());
    await AsyncStorage.removeItem(SLOT_KEY(activeSlot));
    const allMeta = await loadAllSlotMeta();
    delete allMeta[activeSlot];
    await AsyncStorage.setItem(SLOT_META_KEY, JSON.stringify(allMeta));
  } catch (e) {
    console.error('Failed to clear game:', e);
  }
}

export async function getActiveSlot(): Promise<number> {
  try {
    const s = await AsyncStorage.getItem(ACTIVE_SLOT_KEY);
    return s !== null ? parseInt(s, 10) : 0;
  } catch {
    return 0;
  }
}

export async function setActiveSlot(slot: number): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_SLOT_KEY, String(slot));
  } catch (e) {
    console.error('Failed to set active slot:', e);
  }
}

export async function loadAllSlotMeta(): Promise<Record<number, SaveSlotMeta>> {
  try {
    const data = await AsyncStorage.getItem(SLOT_META_KEY);
    if (data) return JSON.parse(data);
    return {};
  } catch {
    return {};
  }
}

// ---- Player Profile (persists across all games) ----

export async function loadProfile(): Promise<PlayerProfile> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    if (data) {
      const p = JSON.parse(data);
      return { ...INITIAL_PROFILE, ...p };
    }
    return { ...INITIAL_PROFILE };
  } catch {
    return { ...INITIAL_PROFILE };
  }
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save profile:', e);
  }
}
