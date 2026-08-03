import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  color: string;
}

export default function StatusPill({ label, color }: Props) {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}33` }]}> 
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
