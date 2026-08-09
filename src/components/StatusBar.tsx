import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';
export default function GameStatusBar() {
  const week = useGameStore((s) => s?.week ?? 1);
  const year = useGameStore((s) => s?.year ?? 1);
  const age = useGameStore((s) => s?.age ?? 22);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const getNetWorthValue = useGameStore((s) => s?.getNetWorthValue);

  const netWorth = getNetWorthValue?.() ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.caption}>Week {week} | Year {year}</Text>
        <Text style={styles.caption}>Age {age}</Text>
        <Text style={[styles.cash, { color: cash >= 0 ? Colors.primary : Colors.negative }]}>
          {formatCurrency(cash)}
        </Text>
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.netWorth}>Net Worth: {formatCurrency(netWorth)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.statusBar,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caption: { color: Colors.textSecondary, fontSize: 13 },
  cash: { fontSize: 15, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2, marginBottom: 4 },
  netWorth: { color: Colors.textMuted, fontSize: 12 },
});
