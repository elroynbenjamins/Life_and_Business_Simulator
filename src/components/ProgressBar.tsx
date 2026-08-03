import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';

interface Props {
  progress: number; // 0-1
  color?: string;
}

export default function ProgressBar({ progress, color = Colors.primary }: Props) {
  const safeProgress = Math.max(0, Math.min(1, progress ?? 0));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${safeProgress * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: Colors.elevated,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
