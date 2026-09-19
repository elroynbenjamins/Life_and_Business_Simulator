import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { applyWebTheme, setActiveThemeScheme } from './colors';

export type ThemePreference = 'system' | 'light' | 'dark';
type ThemeContextValue = {
  preference: ThemePreference;
  resolvedScheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
};

const STORAGE_KEY = 'life_empire_theme_preference';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const phoneScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const resolvedScheme = preference === 'system' ? (phoneScheme ?? 'dark') : preference;
  setActiveThemeScheme(resolvedScheme);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'system' || stored === 'light' || stored === 'dark') setPreferenceState(stored);
    }).catch(() => {});
  }, []);

  useEffect(() => { applyWebTheme(resolvedScheme); }, [resolvedScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ preference, resolvedScheme, setPreference }), [preference, resolvedScheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemePreference must be used inside ThemeProvider');
  return context;
}
