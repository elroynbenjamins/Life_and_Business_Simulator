import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import { showGameDialog } from '../../src/components/GameDialog';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getBusinessType, getPlayerOwnershipPct } from '../../src/engine/businessEngine';
import { getBusinessSaleQuote } from '../../src/engine/businessPortfolioEngine';

function formatReturn(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Not tracked';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function BusinessSaleScreen() {
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const businesses = useGameStore((state) => state.businesses ?? []);
  const holdingCompanies = useGameStore((state) => state.holdingCompanies ?? []);
  const gameWeek = useGameStore((state) => state.week ?? 1);
  const gameYear = useGameStore((state) => state.year ?? 1);
  const sellBusiness = useGameStore((state) => state.sellBusiness);

  const business = businesses.find((item) => item.id === id);
  if (!business) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Sell Business</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.missing}>
          <Ionicons name="business-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.missingTitle}>Business not found</Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/tabs/business')}>
            <Text style={styles.secondaryButtonText}>Back to Businesses</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const type = getBusinessType(business.typeId);
  const quote = getBusinessSaleQuote(business, gameWeek, gameYear);
  const holding = business.holdingCompanyId
    ? holdingCompanies.find((item) => item.id === business.holdingCompanyId) ?? null
    : null;
  const playerOwnershipPct = getPlayerOwnershipPct(business);
  const protectedAsset = business.portfolioIntent === 'long_term_family';
  const canSell = !protectedAsset && playerOwnershipPct >= 99.9;
  const destination = holding ? `${holding.name} reserve` : 'Personal cash';
  const resultPositive = (quote.lifetimeCashResult ?? 0) >= 0;

  const confirmSale = () => {
    if (!canSell) return;
    showGameDialog({
      title: 'Confirm Business Sale',
      message: `Sell ${business.name} for ${formatCurrency(quote.netSaleProceeds)} net proceeds after repaying ${formatCurrency(quote.debtSettlement)} of outstanding loan principal and ${formatCurrency(quote.saleTransactionCost)} of transaction costs? Future scheduled interest is cancelled at payoff. The company will move to Deal History.`,
      confirmText: 'Sell Business',
      cancelText: 'Keep Business',
      destructive: true,
      onConfirm: () => {
        sellBusiness(business.id);
        router.replace('/tabs/business');
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Sell Business</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GameCard>
          <View style={styles.businessHeader}>
            <View style={styles.businessIcon}>
              <Ionicons name="business" size={24} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.businessName}>{business.name}</Text>
              <Text style={styles.businessMeta}>
                {type?.industry ?? 'Business'} • {business.acquisition ? 'Acquired company' : 'Founded company'}
              </Text>
            </View>
          </View>
          {protectedAsset && (
            <View style={styles.warningStrip}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>Remove Long-term Family Asset protection before selling.</Text>
            </View>
          )}
          {playerOwnershipPct < 99.9 && (
            <View style={styles.warningStrip}>
              <Ionicons name="people" size={16} color={Colors.warning} />
              <Text style={styles.warningText}>You need effectively 100% ownership before selling the whole company.</Text>
            </View>
          )}
        </GameCard>

        <GameCard>
          <Text style={styles.sectionTitle}>Sale Breakdown</Text>
          <Text style={styles.sectionSub}>Outstanding loan principal is repaid at closing; unearned future scheduled interest is cancelled. Transaction costs are deducted automatically.</Text>
          {business.acquisition && (quote.heldWeeks ?? 40) < 40 && (
            <Text style={styles.shortHoldNote}>
              Recent acquisition: exit costs decline toward 2.5% as ownership approaches 40 weeks.
            </Text>
          )}
          <View style={styles.rows}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Gross company value</Text>
              <Text style={styles.rowValue}>{formatCurrency(quote.grossSalePrice)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Loan principal repaid</Text>
              <Text style={[styles.rowValue, quote.debtSettlement > 0 && { color: Colors.negative }]}>
                {quote.debtSettlement > 0 ? '-' : ''}{formatCurrency(quote.debtSettlement)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>
                Sale transaction costs ({(quote.saleTransactionCostRate * 100).toFixed(1)}%)
              </Text>
              <Text style={[styles.rowValue, { color: Colors.negative }]}>
                -{formatCurrency(quote.saleTransactionCost)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.netLabel}>Net proceeds</Text>
              <Text style={styles.netValue}>{formatCurrency(quote.netSaleProceeds)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Destination</Text>
              <Text style={styles.rowValue}>{destination}</Text>
            </View>
          </View>
        </GameCard>

        {playerOwnershipPct >= 99.9 && (
          <GameCard>
            <Text style={styles.sectionTitle}>Owner Deal Result</Text>
            <Text style={styles.sectionSub}>
              Includes tracked owner or holding distributions already received plus the cash delivered to the sale destination at closing.
            </Text>
            <View style={styles.rows}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{business.acquisition ? 'Equity invested' : 'Initial investment'}</Text>
                <Text style={styles.rowValue}>
                  {quote.investmentBasis == null ? 'Legacy save — not tracked' : formatCurrency(quote.investmentBasis)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{holding ? 'Holding distributions received' : 'Owner distributions received'}</Text>
                <Text style={styles.rowValue}>{formatCurrency(quote.totalPlayerDistributions)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.netLabel}>Owner cash result</Text>
                <Text style={[styles.netValue, quote.lifetimeCashResult != null && { color: resultPositive ? Colors.primary : Colors.negative }]}>
                  {quote.lifetimeCashResult == null ? 'Not tracked' : `${quote.lifetimeCashResult >= 0 ? '+' : ''}${formatCurrency(quote.lifetimeCashResult)}`}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Owner return</Text>
                <Text style={[styles.returnValue, quote.lifetimeReturnPct != null && { color: resultPositive ? Colors.primary : Colors.negative }]}>
                  {formatReturn(quote.lifetimeReturnPct)}
                </Text>
              </View>
            </View>
          </GameCard>
        )}

        {business.acquisition && (
          <GameCard>
            <Text style={styles.sectionTitle}>Acquisition Context</Text>
            <View style={styles.rows}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Purchase price</Text>
                <Text style={styles.rowValue}>{formatCurrency(business.acquisition.purchasePrice ?? 0)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Funding</Text>
                <Text style={styles.rowValue}>{business.acquisition.fundingMode.toUpperCase()}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Acquisition closing costs</Text>
                <Text style={styles.rowValue}>{formatCurrency(business.acquisition.acquisitionTransactionCost ?? 0)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Ownership period</Text>
                <Text style={styles.rowValue}>{quote.heldWeeks ?? 0} weeks</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Integration</Text>
                <Text style={styles.rowValue}>
                  {business.acquisition.integrationOutcome === 'pending'
                    ? business.acquisition.integrationStrategy === 'pending' ? 'Decision pending' : 'In progress'
                    : business.acquisition.integrationOutcome}
                </Text>
              </View>
            </View>
          </GameCard>
        )}

        <View style={styles.archiveNote}>
          <Ionicons name="time-outline" size={17} color={Colors.textSecondary} />
          <Text style={styles.archiveText}>
            Selling removes the company from your active portfolio, but the closing result stays permanently visible in Business Deal History.
          </Text>
        </View>

        <Pressable
          disabled={!canSell}
          style={({ pressed }) => [
            styles.sellButton,
            !canSell && styles.sellButtonDisabled,
            pressed && canSell && { transform: [{ scale: 0.98 }] },
          ]}
          onPress={confirmSale}
        >
          <Ionicons name="cash-outline" size={20} color={Colors.white} />
          <Text style={styles.sellButtonText}>
            {playerOwnershipPct < 99.9 ? '100% ownership required' : protectedAsset ? 'Remove family-asset protection first' : `Sell for ${formatCurrency(quote.netSaleProceeds)}`}
          </Text>
        </Pressable>
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
  businessHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  businessIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  businessName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  businessMeta: { color: Colors.textSecondary, fontSize: 11, marginTop: 3 },
  warningStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, backgroundColor: `${Colors.warning}12`, padding: 9, marginTop: 10 },
  warningText: { flex: 1, color: Colors.warning, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  sectionSub: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  shortHoldNote: { color: Colors.warning, fontSize: 9, lineHeight: 13, marginTop: 5 },
  rows: { gap: 10, marginTop: 13 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rowLabel: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  rowValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  divider: { height: 1, backgroundColor: Colors.cardBorder },
  netLabel: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', flex: 1 },
  netValue: { color: Colors.primary, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  returnValue: { color: Colors.textPrimary, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  archiveNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingHorizontal: 6, paddingVertical: 4 },
  archiveText: { flex: 1, color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  sellButton: { minHeight: 54, borderRadius: 13, backgroundColor: Colors.negative, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 2 },
  sellButtonDisabled: { opacity: 0.45 },
  sellButtonText: { color: Colors.white, fontSize: 15, fontWeight: '900' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  missingTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12 },
  secondaryButton: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  secondaryButtonText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
});
