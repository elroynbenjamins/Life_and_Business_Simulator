import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import useGameStore from '../src/store/gameStore';
import { Colors } from '../src/theme/colors';
import { formatPercent } from '../src/utils/format';
import { getLatestStockChanges } from '../src/engine/stockEngine';
import stocksData from '../src/data/stocks.json';

export default function NewsScreen() {
  const history = useGameStore((st: any) => st.newsHistory) ?? [];
  const currentHeadline = useGameStore((st: any) => st.currentHeadline);
  const stocks = useGameStore((st: any) => st.stocks) ?? [];
  const items = [...history].reverse().slice(0, 5);
  const latestChanges = getLatestStockChanges(stocks);
  const gainers = latestChanges.filter((item) => item.change > 0).sort((a, b) => b.change - a.change).slice(0, 2);
  const losers = latestChanges.filter((item) => item.change < 0).sort((a, b) => a.change - b.change).slice(0, 2);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>News Feed</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={styles.moversCard}>
          <Text style={styles.moversTitle}>This Week’s Market Movers</Text>
          <View style={styles.moversColumns}>
            <View style={styles.moversColumn}>
              <Text style={[styles.moversHeading, { color: Colors.primary }]}>Top Gainers</Text>
              {gainers.length > 0 ? gainers.map((item) => (
                <MarketMover key={item.ticker} ticker={item.ticker} change={item.change} />
              )) : <Text style={styles.noMovers}>No gainers</Text>}
            </View>
            <View style={styles.moversColumn}>
              <Text style={[styles.moversHeading, { color: Colors.negative }]}>Top Losers</Text>
              {losers.length > 0 ? losers.map((item) => (
                <MarketMover key={item.ticker} ticker={item.ticker} change={item.change} />
              )) : <Text style={styles.noMovers}>No losers</Text>}
            </View>
          </View>
        </View>

        {items.length === 0 ? (
          <Text style={styles.empty}>{currentHeadline ?? 'No news yet — advance a week to see headlines.'}</Text>
        ) : (
          items.map((headline: string, idx: number) => (
            <View key={idx} style={styles.card}>
              <Text style={styles.weekLabel}>{idx === 0 ? 'This week' : `${idx} week${idx === 1 ? '' : 's'} ago`}</Text>
              <Text style={styles.headline}>📰 {headline}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MarketMover({ ticker, change }: { ticker: string; change: number }) {
  const company = (stocksData as any[]).find((stock) => stock?.ticker === ticker)?.company ?? ticker;
  return (
    <View style={styles.moverRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.moverTicker}>{ticker}</Text>
        <Text style={styles.moverCompany} numberOfLines={1}>{company}</Text>
      </View>
      <Text style={[styles.moverChange, { color: change >= 0 ? Colors.primary : Colors.negative }]}>
        {formatPercent(change)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  back: { marginRight: 12 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  card: { backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  weekLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  headline: { color: Colors.textPrimary, fontSize: 15, lineHeight: 21 },
  empty: { color: Colors.textMuted, textAlign: 'center', fontSize: 15, marginTop: 40 },
  moversCard: { backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 14 },
  moversTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  moversColumns: { flexDirection: 'row', gap: 16 },
  moversColumn: { flex: 1 },
  moversHeading: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  moverRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 6 },
  moverTicker: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  moverCompany: { color: Colors.textMuted, fontSize: 10 },
  moverChange: { fontSize: 12, fontWeight: '700' },
  noMovers: { color: Colors.textMuted, fontSize: 12, paddingVertical: 5 },
});
