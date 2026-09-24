import { DynamicColorIOS, Platform, processColor, StyleSheet } from 'react-native';

export const DARK_THEME_COLORS = {
  background: '#0D0D0D', card: '#1A1A1A', cardBorder: '#2A2A2A', elevated: '#242424',
  statusBar: '#111111', tabBar: '#111111', textPrimary: '#E5E5E5', textSecondary: '#A3A3A3', textMuted: '#737373',
} as const;

export const LIGHT_THEME_COLORS = {
  background: '#F4F6F8', card: '#FFFFFF', cardBorder: '#D8DEE6', elevated: '#E9EDF2',
  statusBar: '#FFFFFF', tabBar: '#FFFFFF', textPrimary: '#172033', textSecondary: '#526075', textMuted: '#758196',
} as const;

type AdaptiveColorName = keyof typeof DARK_THEME_COLORS;
let activeThemeScheme: 'light' | 'dark' = 'dark';
const TOKEN_PREFIX = '__life_theme_';

export function setActiveThemeScheme(scheme: 'light' | 'dark'): void {
  activeThemeScheme = scheme;
}

export function resolveThemeColor(value: unknown): unknown {
  // SVG/chart libraries need literal colors, not CSS variables or dynamic objects.
  for (const name of Object.keys(DARK_THEME_COLORS) as AdaptiveColorName[]) {
    if (value === Colors[name]) return (activeThemeScheme === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS)[name];
  }
  if (typeof value !== 'string' || !value.startsWith(TOKEN_PREFIX)) return value;
  const name = value.slice(TOKEN_PREFIX.length) as AdaptiveColorName;
  return (activeThemeScheme === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS)[name] ?? value;
}

if (Platform.OS === 'android') {
  const colorAttributes = [
    'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor',
    'borderBottomColor', 'borderLeftColor', 'color', 'shadowColor',
    'textDecorationColor', 'tintColor', 'overlayColor',
  ];
  for (const attribute of colorAttributes) {
    StyleSheet.setStyleAttributePreprocessor(attribute, (value) => processColor(resolveThemeColor(value) as any));
  }
}

function adaptiveColor(name: AdaptiveColorName): string {
  const light = LIGHT_THEME_COLORS[name];
  const dark = DARK_THEME_COLORS[name];
  // Android receives stable semantic tokens. A style preprocessor resolves
  // them against the active Life Empire palette at render time.
  if (Platform.OS === 'android') return `${TOKEN_PREFIX}${name}`;
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark }) as unknown as string;
  if (Platform.OS === 'web') return `var(--life-${name}, ${dark})`;
  return dark;
}

export function applyWebTheme(scheme: 'light' | 'dark'): void {
  if (Platform.OS !== 'web') return;
  const root = (globalThis as any)?.document?.documentElement;
  if (!root) return;
  const palette = scheme === 'light' ? LIGHT_THEME_COLORS : DARK_THEME_COLORS;
  for (const [name, value] of Object.entries(palette)) root.style.setProperty(`--life-${name}`, value);
  root.style.colorScheme = scheme;
}

export const Colors = {
  background: adaptiveColor('background'), card: adaptiveColor('card'), cardBorder: adaptiveColor('cardBorder'),
  elevated: adaptiveColor('elevated'), statusBar: adaptiveColor('statusBar'), tabBar: adaptiveColor('tabBar'),
  primary: '#10B981', negative: '#EF4444', warning: '#F59E0B', info: '#3B82F6', happiness: '#EC4899',
  business: '#06B6D4', premium: '#8B5CF6', family: '#EC4899', education: '#3B82F6',
  textPrimary: adaptiveColor('textPrimary'), textSecondary: adaptiveColor('textSecondary'), textMuted: adaptiveColor('textMuted'), white: '#FFFFFF',
  sectorColors: {
    Tech: '#3B82F6', 'E-Commerce': '#F59E0B', EV: '#10B981', 'Social Media': '#8B5CF6', Banking: '#6B7280',
    Energy: '#84CC16', Healthcare: '#EF4444', Retail: '#F97316', Semiconductors: '#06B6D4', Entertainment: '#EC4899',
    Airlines: '#14B8A6', Automotive: '#A855F7', Industrial: '#78716C', Pharma: '#22D3EE', Telecom: '#FB923C',
    'Consumer Goods': '#4ADE80', Finance: '#818CF8', Commodity: '#D4A843',
  } as Record<string, string>,
};
