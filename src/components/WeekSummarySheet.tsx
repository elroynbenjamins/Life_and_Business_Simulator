import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency, formatPercent } from '../utils/format';
import useGameStore from '../store/gameStore';

export default function WeekSummarySheet() {
  const showSummary = useGameStore((s) => s?.showSummary);
  const summary = useGameStore((s) => s?.lastSummary);
  const dismissSummary = useGameStore((s) => s?.dismissSummary);

  if (!showSummary || !summary) return null;

  const topGainer = [...(summary?.stockChanges ?? [])].sort((a, b) => (b?.change ?? 0) - (a?.change ?? 0))?.[0];
  const topLoser = [...(summary?.stockChanges ?? [])].sort((a, b) => (a?.change ?? 0) - (b?.change ?? 0))?.[0];

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Week {summary?.newWeek ?? 0} Summary</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.headline}>"{summary?.headline ?? ''}"</Text>

            <View style={styles.row}>
              <Text style={styles.label}>Salary Earned</Text>
              <Text style={[styles.value, { color: Colors.primary }]}>
                +{formatCurrency(summary?.salaryEarned)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Rent Paid</Text>
              <Text style={[styles.value, { color: Colors.negative }]}>
                -{formatCurrency(summary?.rentPaid)}
              </Text>
            </View>

            {summary?.courseProgress ? (
              <View style={styles.row}>
                <Text style={styles.label}>Course</Text>
                <Text style={[styles.value, { color: Colors.info }]}>{summary.courseProgress}</Text>
              </View>
            ) : null}

            {topGainer && (topGainer?.change ?? 0) > 0 ? (
              <View style={styles.row}>
                <Text style={styles.label}>Top Gainer</Text>
                <Text style={[styles.value, { color: Colors.primary }]}>
                  {topGainer?.ticker} {formatPercent(topGainer?.change)}
                </Text>
              </View>
            ) : null}

            {topLoser && (topLoser?.change ?? 0) < 0 ? (
              <View style={styles.row}>
                <Text style={styles.label}>Top Loser</Text>
                <Text style={[styles.value, { color: Colors.negative }]}>
                  {topLoser?.ticker} {formatPercent(topLoser?.change)}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <Pressable style={styles.button} onPress={dismissSummary}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  scroll: {
    marginBottom: 16,
  },
  headline: {
    color: Colors.warning,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
