import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import SectorPill from '../../src/components/SectorPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency, formatPercent } from '../../src/utils/format';
import stocksData from '../../src/data/stocks.json';

type FilterType = 'all' | 'stock' | 'commodity' | 'etf';

export default function MarketScreen() {
  const router = useRouter();
  const stocks = useGameStore((s) => s?.stocks ?? []);
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const [filter, setFilter] = useState<FilterType>('all');

  const filtered = (stocksData ?? []).filter((sd) => filter === 'all' || sd?.type === filter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>Stock Market</Text>
          <Text style={styles.headerSub}>Prices update weekly</Text>
        </View>
        <Pressable style={styles.portfolioBtn} onPress={() => router.push('/portfolio')}>
          <Ionicons name="pie-chart-outline" size={18} color={Colors.primary} />
          <Text style={styles.portfolioBtnText}>Portfolio</Text>
        </Pressable>
      </View>
      <GameStatusBar />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['all', 'stock', 'etf', 'commodity'] as FilterType[]).map((f) => (
          <Pressable key={f} style={[styles.filterTab, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'stock' ? 'Stocks' : f === 'etf' ? 'ETFs' : 'Commodities'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {filtered.map((sd) => {
          const stock = (stocks ?? []).find((s) => s?.ticker === sd?.ticker);
          const price = stock?.currentPrice ?? sd?.startPrice ?? 0;
          const history = stock?.priceHistory ?? [sd?.startPrice ?? 0];
          const prevPrice = (history?.length ?? 0) >= 2 ? history[(history?.length ?? 1) - 2] : price;
          const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
          const holding = (holdings ?? []).find((h) => h?.ticker === sd?.ticker);
          const isPositive = changePercent >= 0;

          return (
            <Pressable
              key={sd?.ticker}
              style={({ pressed }) => [styles.stockRow, pressed && styles.stockRowPressed]}
              onPress={() => router.push(`/stock/${sd?.ticker}`)}
            >
              <View style={styles.stockLeft}>
                <Text style={styles.ticker}>{sd?.ticker}</Text>
                <Text style={styles.company}>{sd?.company}</Text>
              </View>
              <SectorPill sector={sd?.sector ?? ''} />
              <View style={styles.stockRight}>
                <Text style={styles.price}>{formatCurrency(price, 2)}</Text>
                <Text style={[styles.change, { color: isPositive ? Colors.primary : Colors.negative }]}>
                  {isPositive ? '▲' : '▼'} {formatPercent(changePercent)}
                </Text>
                {(holding?.shares ?? 0) > 0 ? (
                  <Text style={styles.sharesBadge}>{holding?.shares} shares</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  headerSub: { color: Colors.textMuted, fontSize: 13 },
  portfolioBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.primary },
  portfolioBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder },
  filterActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: Colors.white },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 8 },
  stockRow: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.cardBorder, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  stockRowPressed: { opacity: 0.7 },
  stockLeft: { flex: 1 },
  ticker: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', fontFamily: Platform.select?.({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  company: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  stockRight: { alignItems: 'flex-end', minWidth: 80 },
  price: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  change: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  sharesBadge: { color: Colors.info, fontSize: 11, marginTop: 2, backgroundColor: `${Colors.info}22`, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
});
