import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

type Tone = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

interface Props {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  tone?: Tone;
}

const toneColor: Record<Tone, string> = {
  positive: Colors.primary,
  negative: Colors.negative,
  warning: Colors.warning,
  info: Colors.info,
  neutral: Colors.textSecondary,
};

export default function ConsequenceChip({ label, icon, tone = 'neutral' }: Props) {
  const color = toneColor[tone];
  const supportsAlphaSuffix = typeof color === 'string' && color.startsWith('#');
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: supportsAlphaSuffix ? `${color}55` : Colors.cardBorder,
          backgroundColor: supportsAlphaSuffix ? `${color}12` : Colors.elevated,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 24,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
  },
});
