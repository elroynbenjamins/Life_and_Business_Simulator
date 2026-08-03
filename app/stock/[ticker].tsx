import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import SectorPill from '../../src/components/SectorPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency, formatPercent } from '../../src/utils/format';
import stocksData from '../../src/data/stocks.json';
import { LineChart } from 'react-native-chart-kit';

export default function StockDetailScreen() {
  const { ticker = '' } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const stocks = useGameStore((s) => s?.stocks ?? []);
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const buyStock = useGameStore((s) => s?.buyStock);
  const sellStock = useGameStore((s) => s?.sellStock);

  const [qty, setQty] = useState(1);

  const sd = (stocksData ?? []).find((s) => s?.ticker === ticker);
  const stock = (stocks ?? []).find((s) => s?.ticker === ticker);
  const holding = (holdings ?? []).find((h) => h?.ticker === ticker);

  if (!sd || !stock) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.error}>Stock not found</Text>
      </SafeAreaView>
    );
  }

  const price = stock?.currentPrice ?? 0;
  const history = stock?.priceHistory ?? [price];
  const prevPrice = (history?.length ?? 0) >= 2 ? history[(history?.length ?? 1) - 2] : price;
  const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
  const isPositive = changePercent >= 0;
  const chartWidth = Math.min(Dimensions.get('window').width - 64, 500);

  const totalCost = qty * price;
  const maxBuy = price > 0 ? Math.floor(cash / price) : 0;
  const maxSell = holding?.shares ?? 0;

  const holdingValue = (holding?.shares ?? 0) * price;
  const holdingCost = (holding?.shares ?? 0) * (holding?.avgBuyPrice ?? 0);
  const gainLoss = holdingValue - holdingCost;
  const gainLossPercent = holdingCost > 0 ? (gainLoss / holdingCost) * 100 : 0;

  // Determine chart line color
  const firstPrice = history?.[0] ?? price;
  const lineColor = price >= firstPrice ? Colors.primary : Colors.negative;

  const handleBuy = () => {
    if (qty <= 0 || totalCost > cash) return;
    Alert.alert('Confirm Purchase', `Buy ${qty} shares of ${sd?.ticker} for ${formatCurrency(totalCost, 2)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Buy', onPress: () => { buyStock?.(ticker, qty); setQty(1); } },
    ]);
  };

  const handleSell = () => {
    if (qty <= 0 || qty > maxSell) return;
    Alert.alert('Confirm Sale', `Sell ${qty} shares of ${sd?.ticker} for ${formatCurrency(qty * price, 2)}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sell', onPress: () => { sellStock?.(ticker, qty); setQty(1); } },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{sd?.ticker} — {sd?.company}</Text>
      </View>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Price Header */}
        <View style={styles.priceRow}>
          <Text style={styles.bigPrice}>{formatCurrency(price, 2)}</Text>
          <Text style={[styles.changeText, { color: isPositive ? Colors.primary : Colors.negative }]}>
            {isPositive ? '▲' : '▼'} {formatPercent(changePercent)}
          </Text>
          <SectorPill sector={sd?.sector ?? ''} />
        </View>

        {/* Chart */}
        {(history?.length ?? 0) >= 2 ? (
          <GameCard title="Price History (Last 10 Weeks)">
            <LineChart
              data={{
                labels: history.map((_, i) => `W${i + 1}`),
                datasets: [{ data: history.map((p) => Math.max(0, p ?? 0)), color: () => lineColor, strokeWidth: 2 }],
              }}
              width={chartWidth}
              height={200}
              yAxisLabel="€"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: Colors.card,
                backgroundGradientFrom: Colors.card,
                backgroundGradientTo: Colors.card,
                decimalPlaces: 0,
                color: () => lineColor,
                labelColor: () => Colors.textMuted,
                propsForDots: { r: '4', strokeWidth: '1', stroke: lineColor },
                propsForBackgroundLines: { stroke: Colors.cardBorder },
              }}
              bezier
              style={{ borderRadius: 8 }}
            />
          </GameCard>
        ) : null}

        {/* Holdings */}
        {(holding?.shares ?? 0) > 0 ? (
          <GameCard title="Your Position">
            <View style={styles.row}>
              <Text style={styles.label}>Shares Owned</Text>
              <Text style={styles.val}>{holding?.shares}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Avg Buy Price</Text>
              <Text style={styles.val}>{formatCurrency(holding?.avgBuyPrice, 2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Current Value</Text>
              <Text style={styles.val}>{formatCurrency(holdingValue, 2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Gain/Loss</Text>
              <Text style={[styles.val, { color: gainLoss >= 0 ? Colors.primary : Colors.negative }]}>
                {formatCurrency(gainLoss, 2)} ({formatPercent(gainLossPercent)})
              </Text>
            </View>
          </GameCard>
        ) : null}

        {/* Buy/Sell */}
        <GameCard title="Trade">
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => setQty(Math.max(1, qty - 1))}
            >
              <Text style={styles.stepperText}>−</Text>
            </Pressable>
            <TextInput
              style={styles.qtyInput}
              value={String(qty)}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                setQty(isNaN(n) ? 1 : Math.max(1, n));
              }}
              keyboardType="number-pad"
            />
            <Pressable
              style={styles.stepperBtn}
              onPress={() => setQty(qty + 1)}
            >
              <Text style={styles.stepperText}>+</Text>
            </Pressable>
            <Pressable
              style={styles.maxBtn}
              onPress={() => setQty(maxBuy > 0 ? maxBuy : 1)}
            >
              <Text style={styles.maxText}>Max</Text>
            </Pressable>
          </View>

          <Text style={styles.totalText}>Total: {formatCurrency(totalCost, 2)}</Text>
          <Text style={styles.cashText}>Cash: {formatCurrency(cash)}</Text>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.buyBtn, totalCost > cash && styles.disabledBtn]}
              onPress={handleBuy}
              disabled={totalCost > cash || qty <= 0}
            >
              <Text style={styles.buyText}>Buy</Text>
            </Pressable>
            <Pressable
              style={[styles.sellBtn, qty > maxSell && styles.disabledBtn]}
              onPress={handleSell}
              disabled={qty > maxSell || maxSell === 0}
            >
              <Text style={styles.sellText}>Sell</Text>
            </Pressable>
          </View>
        </GameCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', flex: 1 },
  error: { color: Colors.negative, fontSize: 18, textAlign: 'center', marginTop: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  bigPrice: { color: Colors.textPrimary, fontSize: 32, fontWeight: '700' },
  changeText: { fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  label: { color: Colors.textSecondary, fontSize: 14 },
  val: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stepperBtn: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperText: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  qtyInput: {
    backgroundColor: Colors.elevated,
    color: Colors.textPrimary,
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 44,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  maxBtn: {
    backgroundColor: Colors.elevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    justifyContent: 'center',
  },
  maxText: { color: Colors.info, fontSize: 14, fontWeight: '600' },
  totalText: { color: Colors.textSecondary, fontSize: 14, marginBottom: 4 },
  cashText: { color: Colors.textMuted, fontSize: 13, marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 12 },
  buyBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  buyText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  sellBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.negative,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  sellText: { color: Colors.negative, fontSize: 16, fontWeight: '700' },
  disabledBtn: { opacity: 0.4 },
});
