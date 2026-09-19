import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Expo Go cannot load this project's custom AdMob or Play Billing modules. */
export function isExpoGoRuntime(): boolean {
  return Platform.OS !== 'web' && Constants.appOwnership === 'expo';
}

export function shouldSimulateNativeFeatures(): boolean {
  return Platform.OS === 'web' || isExpoGoRuntime();
}
