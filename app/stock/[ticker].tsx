import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, useWindowDimensions, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, resolveThemeColor } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import SectorPill from '../../src/components/SectorPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency, formatPercent } from '../../src/utils/format';
import stocksData from '../../src/data/stocks.json';
import { LineChart } from 'react-native-chart-kit';
import { showGameDialog } from '../../src/components/GameDialog';
import RepeatStepperButton from '../../src/components/RepeatStepperButton';
import StatusPill from '../../src/components/StatusPill';

export default function StockDetailScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { ticker = '' } = useLocalSearchParams<{ ticker: string }>();
  const router = useRouter();
  const stocks = useGameStore((s) => s?.stocks ?? []);
  const holdings = useGameStore((s) => s?.holdings ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const buyStock = useGameStore((s) => s?.buyStock);
  const sellStock = useGameStore((s) => s?.sellStock);

  const [qty, setQty] = useState(0);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const quantityRef = useRef<TextInput>(null);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => scrollRef.current?.scrollToEnd({ animated: true }));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setEditingQuantity(false));
    return () => { shown.remove(); hidden.remove(); };
  }, []);
  const finishQuantity = () => { quantityRef.current?.blur(); Keyboard.dismiss(); setEditingQuantity(false); };

  const sd = (stocksData ?? []).find((s) => s?.ticker === ticker);
  const stock = (stocks ?? []).find((s) => s?.ticker === ticker);
  const holding = (holdings ?? []).find((h) => h?.ticker === ticker);

  if (!sd || !stock) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.error}>Asset not found</Text>
      </SafeAreaView>
    );
  }

  const price = stock?.currentPrice ?? 0;
  const assetMeta = sd as any;
  const isCrypto = sd?.type === 'crypto';
  const isEmergingCompany = assetMeta.marketRole === 'emerging';
  const isDelisted = stock.marketStatus === 'delisted';
  const marketStage = stock.companyStage ?? (isEmergingCompany ? 'emerging' : 'established');
  const unitLabel = isCrypto ? 'coins' : 'shares';
  const singularUnit = isCrypto ? 'coin' : 'share';
  const unitsFor = (count: number) => count === 1 ? singularUnit : unitLabel;
  const history = stock?.priceHistory ?? [price];
  const prevPrice = (history?.length ?? 0) >= 2 ? history[(history?.length ?? 1) - 2] : price;
  const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0;
  const isPositive = changePercent >= 0;
  const chartWidth = Math.min(screenWidth - 64, 500);

  const totalCost = qty * price;
  const maxBuy = !isDelisted && price > 0 ? Math.floor(cash / price) : 0;
  const maxSell = holding?.shares ?? 0;

  const holdingValue = (holding?.shares ?? 0) * price;
  const holdingCost = (holding?.shares ?? 0) * (holding?.avgBuyPrice ?? 0);
  const gainLoss = holdingValue - holdingCost;
  const gainLossPercent = holdingCost > 0 ? (gainLoss / holdingCost) * 100 : 0;

  // Determine chart line color
  const firstPrice = history?.[0] ?? price;
  const lineColor = price >= firstPrice ? Colors.primary : Colors.negative;
  const chartBackground = resolveThemeColor(Colors.card) as string;
  const chartLabel = resolveThemeColor(Colors.textSecondary) as string;
  const chartGrid = resolveThemeColor(Colors.cardBorder) as string;
  const historyLow = Math.min(...history.map((value) => value ?? 0));
  const historyHigh = Math.max(...history.map((value) => value ?? 0));

  const handleBuy = () => {
    if (isDelisted || qty <= 0 || totalCost > cash) return;
    const message = `Buy ${qty} ${unitsFor(qty)} of ${sd?.ticker} for ${formatCurrency(totalCost, 2)}?`;
    showGameDialog({ title: 'Confirm Purchase', message, confirmText: 'Buy', onConfirm: () => { buyStock?.(ticker, qty); setQty(0); } });
  };

  const handleSell = () => {
    if (qty <= 0 || qty > maxSell) return;
    const message = `Sell ${qty} ${unitsFor(qty)} of ${sd?.ticker} for ${formatCurrency(qty * price, 2)}?`;
    showGameDialog({ title: 'Confirm Sale', message, confirmText: 'Sell', onConfirm: () => { sellStock?.(ticker, qty); setQty(0); } });
  };

  const handleSellAll = () => {
    if (maxSell <= 0) return;
    const totalSaleValue = maxSell * price;
    const message = `Sell all ${maxSell} ${unitsFor(maxSell)} of ${sd?.ticker} for ${formatCurrency(totalSaleValue, 2)}?`;
    showGameDialog({ title: 'Sell All', message, confirmText: 'Sell All', destructive: true, onConfirm: () => { sellStock?.(ticker, maxSell); setQty(0); } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{sd?.ticker} — {sd?.company}</Text>
      </View>
      {!editingQuantity && <GameStatusBar />}
      <KeyboardAvoidingView style={styles.scroll} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onContentSizeChange={() => { if (editingQuantity) scrollRef.current?.scrollToEnd({ animated: true }); }}>
        {/* Price Header */}
        <View style={styles.priceRow}>
          <Text style={styles.bigPrice}>{formatCurrency(price, 2)}</Text>
          <Text style={[styles.changeText, { color: isPositive ? Colors.primary : Colors.negative }]}>
            {isPositive ? '▲' : '▼'} {formatPercent(changePercent)}
          </Text>
          <SectorPill sector={sd?.sector ?? ''} />
        </View>

        {isEmergingCompany && (
          <GameCard
            variant={isDelisted ? 'danger' : marketStage === 'mature' ? 'subtle' : 'attention'}
            eyebrow="COMPANY LIFECYCLE"
            title={isDelisted ? 'Delisted' : marketStage === 'mature' ? 'Established Listing' : marketStage === 'growth' ? 'Growth Company' : 'Emerging Listing'}
            accentColor={isDelisted ? Colors.negative : marketStage === 'mature' ? Colors.primary : Colors.info}
            titleAccessory={(
              <StatusPill
                compact
                icon={isDelisted ? 'close-circle-outline' : marketStage === 'mature' ? 'shield-checkmark-outline' : 'rocket-outline'}
                label={isDelisted ? 'FAILED' : marketStage === 'mature' ? 'MATURED' : 'HIGHER RISK'}
                color={isDelisted ? Colors.negative : marketStage === 'mature' ? Colors.primary : Colors.warning}
              />
            )}
          >
            <Text style={styles.lifecycleText}>
              {isDelisted
                ? 'This company failed during its early public years. Trading is closed and any player position was settled automatically at the recovery value.'
                : marketStage === 'mature'
                  ? 'This former emerging company survived its risky early years. It now trades with a more established risk profile.'
                  : 'Young public companies can outperform quickly, stagnate, or fail and delist. Their early price swings are intentionally wider than established stocks.'}
            </Text>
          </GameCard>
        )}

        {isCrypto && (
          <GameCard title="Crypto Profile">
            <Text style={styles.cryptoDescription}>{assetMeta.description}</Text>
            <View style={styles.cryptoMechanicBox}>
              <Text style={styles.cryptoMechanicTitle}>Unique Mechanic</Text>
              <Text style={styles.cryptoMechanicText}>{assetMeta.mechanic}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Profile</Text>
              <Text style={styles.val}>
                {assetMeta.cryptoStyle === 'reserve' ? 'Digital Reserve'
                  : assetMeta.cryptoStyle === 'utility' ? 'Utility Network'
                    : 'Speculative / Meme'}
              </Text>
            </View>
            {assetMeta.stakingYield ? (
              <View style={styles.row}>
                <Text style={styles.label}>Annual Staking</Text>
                <Text style={[styles.val, { color: Colors.primary }]}>{(assetMeta.stakingYield * 100).toFixed(1)}%</Text>
              </View>
            ) : null}
          </GameCard>
        )}

        {/* Chart */}
        {(history?.length ?? 0) >= 2 ? (
          <GameCard title={`Price History (Last ${history.length} Weeks)`}>
            <LineChart
              data={{
                labels: history.map((_, i) => {
                  const len = history.length;
                  const weeksAgo = len - 1 - i;
                  if (weeksAgo === 0) return 'Now';
                  if (len <= 10) return `${weeksAgo}w`;
                  const step = len <= 20 ? 5 : 10;
                  return weeksAgo % step === 0 ? `${weeksAgo}w` : '';
                }),
                datasets: [{ data: history.map((p) => Math.max(0, p ?? 0)), color: () => lineColor, strokeWidth: 2 }],
              }}
              width={chartWidth}
              height={200}
              onDataPointClick={({ index }) => setSelectedPoint(index)}
              yAxisLabel="€"
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: chartBackground,
                backgroundGradientFrom: chartBackground,
                backgroundGradientTo: chartBackground,
                decimalPlaces: (isCrypto && price < 10) || historyHigh < 100 ? 2 : 0,
                color: () => lineColor,
                labelColor: () => chartLabel,
                propsForDots: { r: '4', strokeWidth: '1', stroke: lineColor },
                propsForBackgroundLines: { stroke: chartGrid, strokeDasharray: '4 4' },
              }}
              withHorizontalLabels
              withVerticalLabels
              withInnerLines
              bezier
              style={{ borderRadius: 8 }}
            />
            <Text style={styles.chartSummaryValue}>
              {selectedPoint !== null && history[selectedPoint] !== undefined
                ? `${history.length - 1 - selectedPoint} weeks ago: ${formatCurrency(history[selectedPoint], 2)}`
                : 'Tap a chart point to see its week and value'}
            </Text>
            <View style={styles.chartSummary}>
              <View style={styles.chartSummaryItem}><Text style={styles.chartSummaryLabel}>{history.length - 1}w ago</Text><Text style={styles.chartSummaryValue}>{formatCurrency(firstPrice, 2)}</Text></View>
              <View style={styles.chartSummaryItem}><Text style={styles.chartSummaryLabel}>Low / High</Text><Text style={styles.chartSummaryValue}>{formatCurrency(historyLow, 2)} / {formatCurrency(historyHigh, 2)}</Text></View>
              <View style={styles.chartSummaryItem}><Text style={styles.chartSummaryLabel}>Now</Text><Text style={[styles.chartSummaryValue, { color: lineColor }]}>{formatCurrency(price, 2)}</Text></View>
            </View>
            {assetMeta.dividendYield ? (
              <Text style={{ color: '#10B981', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '600' }}>
                💵 Dividend Yield: {(assetMeta.dividendYield * 100).toFixed(2)}% annual
              </Text>
            ) : assetMeta.stakingYield ? (
              <Text style={{ color: '#10B981', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: '600' }}>
                ⛓️ Staking Yield: {(assetMeta.stakingYield * 100).toFixed(2)}% annual
              </Text>
            ) : null}
          </GameCard>
        ) : null}

        {/* Holdings */}
        {(holding?.shares ?? 0) > 0 ? (
          <GameCard title="Your Position">
            <View style={styles.row}>
              <Text style={styles.label}>{isCrypto ? 'Coins Owned' : 'Shares Owned'}</Text>
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
        {isDelisted ? (
          <GameCard variant="subtle" title="Trading Closed">
            <Text style={styles.lifecycleText}>This ticker is retained only as market history. It can no longer be bought or sold.</Text>
          </GameCard>
        ) : (
          <GameCard title="Trade">
            <View style={styles.qtyRow}>
              <RepeatStepperButton
                style={styles.stepperBtn}
                accessibilityLabel={`Decrease ${unitLabel}`}
                disabled={qty <= 0}
                onStep={(amount) => setQty(current => Math.max(0, current - amount))}
              >
                <Text style={styles.stepperText}>−</Text>
              </RepeatStepperButton>
              <TextInput
                ref={quantityRef}
                accessibilityLabel={`Number of ${unitLabel}`}
                style={styles.qtyInput}
                value={qty > 0 ? String(qty) : ''}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                onChangeText={(t) => {
                  if (t === '') { setQty(0); return; }
                  const n = parseInt(t, 10);
                  setQty(isNaN(n) ? 0 : Math.max(0, n));
                }}
                keyboardType="number-pad"
                inputMode="numeric"
                disableFullscreenUI
                selectTextOnFocus
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={finishQuantity}
                onFocus={() => { setEditingQuantity(true); scrollRef.current?.scrollToEnd({ animated: true }); }}
                onBlur={() => setEditingQuantity(false)}
              />
              <RepeatStepperButton
                style={styles.stepperBtn}
                accessibilityLabel={`Increase ${unitLabel}`}
                disabled={qty >= Math.max(maxBuy, maxSell)}
                onStep={(amount) => setQty(current => Math.min(Math.max(maxBuy, maxSell), current + amount))}
              >
                <Text style={styles.stepperText}>+</Text>
              </RepeatStepperButton>
              <Pressable
                style={styles.maxBtn}
                onPress={() => setQty(maxBuy > 0 ? maxBuy : 0)}
              >
                <Text style={styles.maxText}>Max</Text>
              </Pressable>
            </View>
  
            {editingQuantity && <Pressable style={styles.doneButton} onPress={finishQuantity} accessibilityRole="button"><Text style={styles.doneText}>Done entering quantity</Text></Pressable>}
            {!editingQuantity && <Text style={styles.cashText}>Tap + / − for 1 {singularUnit}. Hold to change faster.</Text>}
            <Text style={styles.totalText}>Total: {formatCurrency(totalCost, 2)}</Text>
            <Text style={styles.cashText}>Cash: {formatCurrency(cash)}</Text>
  
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.buyBtn, (totalCost > cash || qty <= 0) && styles.disabledBtn]}
                onPress={() => { finishQuantity(); handleBuy(); }}
                disabled={totalCost > cash || qty <= 0}
              >
                <Text style={styles.buyText}>Buy</Text>
              </Pressable>
              <Pressable
                style={[styles.sellBtn, (qty > maxSell || qty <= 0) && styles.disabledBtn]}
                onPress={() => { finishQuantity(); handleSell(); }}
                disabled={qty > maxSell || maxSell === 0 || qty <= 0}
              >
                <Text style={styles.sellText}>Sell</Text>
              </Pressable>
            </View>
            {maxSell > 0 && (
              <Pressable style={styles.sellAllBtn} onPress={handleSellAll}>
                <Text style={styles.sellAllText}>Sell All ({maxSell} {unitsFor(maxSell)})</Text>
              </Pressable>
            )}
          </GameCard>
        )}
      </ScrollView>
      </KeyboardAvoidingView>
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
  doneButton: { alignItems: 'center', paddingVertical: 8, marginBottom: 8, borderRadius: 8, backgroundColor: '#047857' },
  doneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  cryptoDescription: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  lifecycleText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  cryptoMechanicBox: { backgroundColor: `${Colors.info}12`, borderRadius: 8, padding: 10, marginVertical: 10, borderWidth: 1, borderColor: `${Colors.info}28` },
  cryptoMechanicTitle: { color: Colors.info, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  cryptoMechanicText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
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
    minWidth: 0,
    width: 0,
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
  chartSummary: { flexDirection: 'row', gap: 8, marginTop: 10 },
  chartSummaryItem: { flex: 1, alignItems: 'center' },
  chartSummaryLabel: { color: Colors.textMuted, fontSize: 10, marginBottom: 2 },
  chartSummaryValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', textAlign: 'center' },
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
  sellAllBtn: { borderWidth: 1, borderColor: Colors.negative, borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 10 },
  sellAllText: { color: Colors.negative, fontSize: 14, fontWeight: '600' },
  disabledBtn: { opacity: 0.4 },
});
