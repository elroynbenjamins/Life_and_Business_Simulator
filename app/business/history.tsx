import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getBusinessType } from '../../src/engine/businessEngine';

function formatReturn(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Basis not tracked';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function BusinessDealHistoryScreen() {
  const router = useRouter();
  const deals = useGameStore((state) => state.soldBusinesses ?? []);

  const summary = useMemo(() => {
    const tracked = deals.filter((deal) => deal.lifetimeCashResult != null);
    return {
      count: deals.length,
      acquisitionCount: deals.filter((deal) => deal.wasAcquisition).length,
      totalProceeds: deals.reduce((sum, deal) => sum + Math.max(0, deal.netSaleProceeds ?? 0), 0),
      trackedResult: tracked.reduce((sum, deal) => sum + (deal.lifetimeCashResult ?? 0), 0),
      trackedCount: tracked.length,
    };
  }, [deals]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Deal History</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Completed Exits</Text>
            <Text style={styles.summaryValue}>{summary.count}</Text>
            <Text style={styles.summaryFoot}>{summary.acquisitionCount} acquired companies</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Sale Proceeds</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatCurrency(summary.totalProceeds)}</Text>
            <Text style={styles.summaryFoot}>After debt payoff and exit costs</Text>
          </View>
          <View style={styles.summaryCardWide}>
            <Text style={styles.summaryLabel}>Tracked Lifetime Result</Text>
            <Text style={[styles.summaryValue, { color: summary.trackedResult >= 0 ? Colors.primary : Colors.negative }]}>
              {summary.trackedResult >= 0 ? '+' : ''}{formatCurrency(summary.trackedResult)}
            </Text>
            <Text style={styles.summaryFoot}>
              {summary.trackedCount} of {summary.count} deals have a complete investment basis
            </Text>
          </View>
        </View>

        {deals.length === 0 ? (
          <GameCard>
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={46} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No completed deals yet</Text>
              <Text style={styles.emptyText}>Businesses you sell will remain here as a permanent closing record.</Text>
            </View>
          </GameCard>
        ) : (
          deals.map((deal) => {
            const type = getBusinessType(deal.typeId);
            const resultPositive = (deal.lifetimeCashResult ?? 0) >= 0;
            return (
              <GameCard key={deal.id}>
                <View style={styles.dealHeader}>
                  <View style={styles.dealIcon}>
                    <Ionicons name={deal.wasAcquisition ? 'git-merge-outline' : 'business-outline'} size={19} color={deal.wasAcquisition ? Colors.primary : Colors.info} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dealName}>{deal.name}</Text>
                    <Text style={styles.dealMeta}>
                      {type?.industry ?? 'Business'} • Sold Y{deal.soldYear} W{deal.soldWeek}
                    </Text>
                  </View>
                  <View style={styles.dealType}>
                    <Text style={styles.dealTypeText}>{deal.wasAcquisition ? 'M&A' : 'Founded'}</Text>
                  </View>
                </View>

                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Net proceeds</Text>
                    <Text style={styles.metricValue}>{formatCurrency(deal.netSaleProceeds)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Held</Text>
                    <Text style={styles.metricValue}>{deal.heldWeeks}w</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Lifetime ROI</Text>
                    <Text style={[styles.metricValue, deal.lifetimeReturnPct != null && { color: resultPositive ? Colors.primary : Colors.negative }]}>
                      {deal.lifetimeReturnPct == null ? '—' : formatReturn(deal.lifetimeReturnPct)}
                    </Text>
                  </View>
                </View>

                <View style={styles.breakdown}>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Gross value</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(deal.grossSalePrice)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Debt settled</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(deal.debtSettlement)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Sale transaction costs</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(deal.saleTransactionCost ?? 0)}</Text>
                  </View>
                  {deal.wasAcquisition && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Acquisition closing costs</Text>
                      <Text style={styles.breakdownValue}>{formatCurrency(deal.acquisitionTransactionCost ?? 0)}</Text>
                    </View>
                  )}
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Cash distributions</Text>
                    <Text style={styles.breakdownValue}>{formatCurrency(deal.totalPlayerDistributions)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Tracked capital</Text>
                    <Text style={styles.breakdownValue}>{deal.investmentBasis == null ? 'Legacy basis unavailable' : formatCurrency(deal.investmentBasis)}</Text>
                  </View>
                  {deal.holdingCompanyName && (
                    <View style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>Sale destination</Text>
                      <Text style={styles.breakdownValue}>{deal.holdingCompanyName}</Text>
                    </View>
                  )}
                </View>

                {deal.lifetimeCashResult != null && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Lifetime cash result</Text>
                    <Text style={[styles.resultValue, { color: resultPositive ? Colors.primary : Colors.negative }]}>
                      {deal.lifetimeCashResult >= 0 ? '+' : ''}{formatCurrency(deal.lifetimeCashResult)}
                    </Text>
                  </View>
                )}
              </GameCard>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48.5%', backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 12 },
  summaryCardWide: { width: '100%', backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 12 },
  summaryLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  summaryValue: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900', marginTop: 4 },
  summaryFoot: { color: Colors.textMuted, fontSize: 9, marginTop: 4 },
  empty: { alignItems: 'center', paddingVertical: 30 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 11 },
  emptyText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4, maxWidth: 280 },
  dealHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dealIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  dealName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  dealMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  dealType: { borderRadius: 9, backgroundColor: Colors.elevated, paddingHorizontal: 7, paddingVertical: 5 },
  dealTypeText: { color: Colors.textSecondary, fontSize: 8, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metric: { flex: 1 },
  metricLabel: { color: Colors.textMuted, fontSize: 8 },
  metricValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  breakdown: { gap: 7, marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  breakdownLabel: { color: Colors.textSecondary, fontSize: 10, flex: 1 },
  breakdownValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 11, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  resultLabel: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  resultValue: { fontSize: 13, fontWeight: '900' },
});
