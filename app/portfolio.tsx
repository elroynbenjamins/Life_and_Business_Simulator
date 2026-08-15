import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import GameCard from '../src/components/GameCard';
import SectorPill from '../src/components/SectorPill';
import useGameStore from '../src/store/gameStore';
import { formatCurrency, formatPercent } from '../src/utils/format';
import stocksData from '../src/data/stocks.json';
import { showGameDialog } from '../src/components/GameDialog';

export default function PortfolioScreen() {
  const router = useRouter();
  const stocks = useGameStore((s) => s?.stocks ?? []);
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const sellStock = useGameStore((s) => s?.sellStock);
  const portfolioValue = useGameStore((s) => s?.getPortfolioValueTotal?.() ?? 0);

  const ownedHoldings = (holdings ?? []).filter((h) => (h?.shares ?? 0) > 0);

  let totalGainLoss = 0;
  let totalCostBasis = 0;
  ownedHoldings.forEach((h) => {
    const stock = (stocks ?? []).find((s) => s?.ticker === h?.ticker);
    const value = (h?.shares ?? 0) * (stock?.currentPrice ?? 0);
    const cost = (h?.shares ?? 0) * (h?.avgBuyPrice ?? 0);
    totalGainLoss += value - cost;
    totalCostBasis += cost;
  });
  const totalGainPercent = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Portfolio</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard>
          <Text style={styles.label}>Total Portfolio Value</Text>
          <Text style={styles.bigValue}>{formatCurrency(portfolioValue)}</Text>
          <Text style={[styles.gainText, { color: totalGainLoss >= 0 ? Colors.primary : Colors.negative }]}>
            {totalGainLoss >= 0 ? '+' : ''}{formatCurrency(totalGainLoss)} ({formatPercent(totalGainPercent)})
          </Text>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Cash</Text>
            <Text style={styles.val}>{formatCurrency(cash)}</Text>
          </View>
        </GameCard>

        {ownedHoldings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No stocks yet. Visit the Stock Market to start investing.</Text>
          </View>
        ) : null}

        {ownedHoldings.map((h) => {
          const sd = (stocksData ?? []).find((s) => s?.ticker === h?.ticker);
          const stock = (stocks ?? []).find((s) => s?.ticker === h?.ticker);
          const value = (h?.shares ?? 0) * (stock?.currentPrice ?? 0);
          const cost = (h?.shares ?? 0) * (h?.avgBuyPrice ?? 0);
          const gl = value - cost;
          const glPercent = cost > 0 ? (gl / cost) * 100 : 0;
          const isCommodity = sd?.type === 'commodity';

          const handleSellAll = () => {
            const message = `Sell all ${h?.shares} shares of ${h?.ticker} for ${formatCurrency(value, 2)}?`;
            showGameDialog({ title: 'Sell All', message, confirmText: 'Sell All', destructive: true, onConfirm: () => sellStock?.(h?.ticker, h?.shares ?? 0) });
          };

          return (
            <GameCard key={h?.ticker} onPress={() => router.push(`/stock/${h?.ticker}`)}>
              <View style={styles.row}>
                <View>
                  <View style={styles.tickerRow}>
                    <Text style={styles.ticker}>{h?.ticker}</Text>
                    {isCommodity && <SectorPill sector="Commodity" />}
                  </View>
                  <Text style={styles.company}>{sd?.company ?? ''}</Text>
                </View>
                <View style={styles.right}>
                  <Text style={styles.val}>{formatCurrency(value, 2)}</Text>
                  <Text style={[styles.smallGl, { color: gl >= 0 ? Colors.primary : Colors.negative }]}>
                    {gl >= 0 ? '+' : ''}{formatCurrency(gl, 2)} ({formatPercent(glPercent)})
                  </Text>
                </View>
              </View>
              <Text style={styles.meta}>{h?.shares} shares • Avg {formatCurrency(h?.avgBuyPrice, 2)}</Text>
              <Pressable style={styles.sellBtn} onPress={(e) => { e.stopPropagation?.(); handleSellAll(); }}>
                <Text style={styles.sellBtnText}>Sell All</Text>
              </Pressable>
            </GameCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  label: { color: Colors.textSecondary, fontSize: 13 },
  bigValue: { color: Colors.textPrimary, fontSize: 28, fontWeight: '700', marginTop: 4 },
  gainText: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  val: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  right: { alignItems: 'flex-end' },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ticker: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  company: { color: Colors.textMuted, fontSize: 12 },
  smallGl: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  sellBtn: { borderWidth: 1, borderColor: Colors.negative, borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 8 },
  sellBtnText: { color: Colors.negative, fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 16, maxWidth: 250 },
});
