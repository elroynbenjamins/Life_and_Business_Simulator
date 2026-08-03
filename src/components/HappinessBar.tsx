import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  value: number;
}

export default function HappinessBar({ value }: Props) {
  const safe = Math.max(0, Math.min(100, value ?? 0));
  let color = Colors.negative;
  let label = 'Miserable';
  if (safe >= 80) { color = Colors.primary; label = 'Thriving'; }
  else if (safe >= 60) { color = '#10B981'; label = 'Happy'; }
  else if (safe >= 40) { color = Colors.warning; label = 'Content'; }
  else if (safe >= 20) { color = '#FB923C'; label = 'Struggling'; }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Happiness</Text>
        <Text style={[styles.value, { color }]}>{safe} - {label}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${safe}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { color: Colors.textSecondary, fontSize: 12 },
  value: { fontSize: 12, fontWeight: '600' },
  track: { height: 6, backgroundColor: Colors.elevated, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
