import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface Props {
  label: string;
  color: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  compact?: boolean;
  outlined?: boolean;
}

export default function StatusPill({ label, color, icon, compact = false, outlined = false }: Props) {
  const supportsAlphaSuffix = typeof color === 'string' && color.startsWith('#');
  return (
    <View
      style={[
        styles.pill,
        compact && styles.compact,
        {
          backgroundColor: outlined ? 'transparent' : supportsAlphaSuffix ? `${color}18` : Colors.elevated,
          borderColor: supportsAlphaSuffix ? `${color}55` : Colors.cardBorder,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 11 : 12} color={color} /> : null}
      <Text style={[styles.text, compact && styles.compactText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 24,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compact: {
    minHeight: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  compactText: {
    fontSize: 10,
  },
});
