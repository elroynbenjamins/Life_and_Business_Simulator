import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';

function formatHudCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs < 1_000_000) return formatCurrency(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}€${(abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  return `${sign}€${(abs / 1_000_000).toFixed(abs >= 100_000_000 ? 0 : 1)}M`;
}

export default function GameStatusBar() {
  const week = useGameStore((s) => s?.week ?? 1);
  const year = useGameStore((s) => s?.year ?? 1);
  const age = useGameStore((s) => s?.age ?? 22);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const getNetWorthValue = useGameStore((s) => s?.getNetWorthValue);
  const netWorth = getNetWorthValue?.() ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.timeGroup}>
        <View style={styles.timePill}>
          <Ionicons name="calendar-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.timeText}>Y{year} W{week}</Text>
        </View>
        <View style={styles.timePill}>
          <Ionicons name="person-outline" size={12} color={Colors.textSecondary} />
          <Text style={styles.timeText}>Age {age}</Text>
        </View>
      </View>

      <View style={styles.moneyGroup}>
        <View style={styles.moneyItem}>
          <Text style={styles.moneyLabel}>CASH</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.moneyValue, { color: cash >= 0 ? Colors.primary : Colors.negative }]}
          >
            {formatHudCurrency(cash)}
          </Text>
        </View>
        <View style={styles.moneyDivider} />
        <View style={styles.moneyItem}>
          <Text style={styles.moneyLabel}>NET WORTH</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.moneyValue, { color: Colors.info }]}
          >
            {formatHudCurrency(netWorth)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 48,
    backgroundColor: Colors.statusBar,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  timePill: {
    minHeight: 27,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  moneyGroup: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  moneyItem: {
    minWidth: 0,
    maxWidth: 100,
    alignItems: 'flex-end',
  },
  moneyLabel: {
    color: Colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.75,
  },
  moneyValue: {
    maxWidth: '100%',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
  },
  moneyDivider: {
    width: 1,
    height: 25,
    backgroundColor: Colors.cardBorder,
  },
});
