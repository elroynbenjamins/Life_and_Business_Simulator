import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import { showGameDialog } from '../../src/components/GameDialog';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import {
  ACQUISITION_MARKET_REFRESH_WEEKS,
  ACQUISITION_UNLOCK_NET_WORTH,
  getAcquisitionFinancingQuote,
  getAcquisitionPrice,
  getAcquisitionTransactionCost,
} from '../../src/engine/acquisitionEngine';
import { getPrestigeEffects } from '../../src/engine/prestigeEngine';
import { AcquisitionFundingMode } from '../../src/types/game';
import { getBusinessCapacity } from '../../src/engine/businessCapacityEngine';

const RISK_LABELS = {
  low: { label: 'Low risk', color: Colors.primary },
  medium: { label: 'Medium risk', color: Colors.warning },
  high: { label: 'High risk', color: Colors.negative },
};

const FUNDING_OPTIONS: Array<{ key: AcquisitionFundingMode; label: string; desc: string }> = [
  { key: 'cash', label: 'All Cash', desc: '100% cash • no acquisition debt' },
  { key: 'balanced', label: 'Balanced', desc: '60% cash • 40% acquisition debt' },
  { key: 'leveraged', label: 'Leveraged', desc: '30% cash • 70% acquisition debt' },
];

export default function BusinessAcquisitionsScreen() {
  const router = useRouter();
  const acquisitionTargets = useGameStore((s) => s.acquisitionTargets ?? []);
  const businesses = useGameStore((s) => s.businesses ?? []);
  const holdingCompanies = useGameStore((s) => s.holdingCompanies ?? []);
  const lastRefreshWeek = useGameStore((s) => s.lastAcquisitionRefreshWeek ?? 0);
  const cash = useGameStore((s) => s.cash ?? 0);
  const week = useGameStore((s) => s.week ?? 1);
  const year = useGameStore((s) => s.year ?? 1);
  const profile = useGameStore((s) => s.profile);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);
  const ensureAcquisitionMarket = useGameStore((s) => s.ensureAcquisitionMarket);
  const refreshAcquisitionMarket = useGameStore((s) => s.refreshAcquisitionMarket);
  const acquireBusiness = useGameStore((s) => s.acquireBusiness);

  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [fundingMode, setFundingMode] = useState<AcquisitionFundingMode>('balanced');
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);

  const netWorth = getNetWorthValue();
  const unlocked = netWorth >= ACQUISITION_UNLOCK_NET_WORTH;
  const effects = getPrestigeEffects(profile);
  const companyCapacity = getBusinessCapacity(profile);
  const capacityFull = businesses.length >= companyCapacity;
  const negotiationBonus = effects.negotiation ?? 0;
  const loanRateReduction = effects.loan_rate_reduction ?? 0;
  const globalWeek = ((year - 1) * 20) + week;
  const weeksUntilRefresh = lastRefreshWeek <= 0
    ? 0
    : Math.max(0, ACQUISITION_MARKET_REFRESH_WEEKS - (globalWeek - lastRefreshWeek));
  const selectedHolding = selectedHoldingId
    ? holdingCompanies.find((holding) => holding.id === selectedHoldingId) ?? null
    : null;
  const sourceCash = selectedHolding ? selectedHolding.cashReserve ?? 0 : cash;

  useEffect(() => {
    if (unlocked) ensureAcquisitionMarket();
  }, [unlocked, globalWeek, ensureAcquisitionMarket]);

  const sortedTargets = useMemo(
    () => [...acquisitionTargets].sort((a, b) => a.askingPrice - b.askingPrice),
    [acquisitionTargets]
  );

  const confirmAcquire = (targetId: string) => {
    const target = acquisitionTargets.find((item) => item.id === targetId);
    if (!target || capacityFull) return;
    const price = getAcquisitionPrice(target, negotiationBonus);
    const quote = getAcquisitionFinancingQuote(price, fundingMode, loanRateReduction);
    const transactionCost = getAcquisitionTransactionCost(target, price);
    const totalCashNeeded = quote.cashContribution + transactionCost;
    const destination = selectedHolding?.name ?? 'your direct portfolio';
    const debtText = quote.debtPrincipal > 0
      ? ` + ${formatCurrency(quote.debtPrincipal)} acquisition debt (${formatCurrency(quote.weeklyPayment)}/wk)`
      : '';

    showGameDialog({
      title: `Acquire ${target.name}?`,
      message: `${formatCurrency(totalCashNeeded)} total cash at closing (${formatCurrency(quote.cashContribution)} equity + ${formatCurrency(transactionCost)} advisory/legal costs)${debtText}. The company will enter ${destination}. After closing, choose Keep Independent, Integrate Operations, or Aggressive Turnaround.`,
      confirmText: 'Acquire',
      onConfirm: () => acquireBusiness(target.id, selectedHoldingId, fundingMode),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Acquisitions</Text>
        <Pressable
          hitSlop={10}
          disabled={!unlocked || weeksUntilRefresh > 0}
          onPress={refreshAcquisitionMarket}
        >
          <Ionicons
            name="refresh"
            size={22}
            color={unlocked && weeksUntilRefresh === 0 ? Colors.primary : Colors.textMuted}
          />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net Worth</Text>
            <Text style={styles.summaryValue}>{formatCurrency(netWorth)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{selectedHolding ? 'Holding Cash' : 'Personal Cash'}</Text>
            <Text style={styles.summaryValue}>{formatCurrency(sourceCash)}</Text>
          </View>
        </View>

        {unlocked && capacityFull && (
          <GameCard variant="attention" eyebrow="COMPANY CAPACITY" title="Unlock another company slot" accentColor={Colors.warning}>
            <Text style={styles.capacityText}>
              You currently own {businesses.length} of {companyCapacity} companies. Starting or acquiring another company requires a permanent capacity unlock.
            </Text>
            <Pressable style={styles.capacityLink} onPress={() => router.push('/business/start')}>
              <Text style={styles.capacityLinkText}>Open company slot unlocks</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.business} />
            </Pressable>
          </GameCard>
        )}

        {!unlocked ? (
          <GameCard>
            <View style={styles.locked}>
              <Ionicons name="lock-closed" size={34} color={Colors.warning} />
              <Text style={styles.lockedTitle}>Late-game M&A</Text>
              <Text style={styles.lockedText}>
                Business acquisitions unlock at {formatCurrency(ACQUISITION_UNLOCK_NET_WORTH)} net worth.
              </Text>
              <Text style={styles.progressText}>
                {Math.min(100, Math.round(netWorth / ACQUISITION_UNLOCK_NET_WORTH * 100))}% unlocked
              </Text>
            </View>
          </GameCard>
        ) : (
          <>
            <GameCard>
              <Text style={styles.sectionTitle}>Purchase Entity</Text>
              <Text style={styles.sectionSub}>
                A holding purchase uses that holding's cash reserve. Direct purchases use personal cash.
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Pressable
                  style={[styles.chip, selectedHoldingId === null && styles.chipActive]}
                  onPress={() => setSelectedHoldingId(null)}
                >
                  <Ionicons name="person" size={14} color={selectedHoldingId === null ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.chipText, selectedHoldingId === null && styles.chipTextActive]}>Direct • {formatCurrency(cash)}</Text>
                </Pressable>
                {holdingCompanies.map((holding) => (
                  <Pressable
                    key={holding.id}
                    style={[styles.chip, selectedHoldingId === holding.id && styles.chipActive]}
                    onPress={() => setSelectedHoldingId(holding.id)}
                  >
                    <Ionicons name="business" size={14} color={selectedHoldingId === holding.id ? Colors.white : Colors.textSecondary} />
                    <Text style={[styles.chipText, selectedHoldingId === holding.id && styles.chipTextActive]}>
                      {holding.name} • {formatCurrency(holding.cashReserve ?? 0)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {holdingCompanies.length === 0 && (
                <Pressable style={styles.linkButton} onPress={() => router.push('/business/holdings')}>
                  <Text style={styles.linkText}>Create and fund a holding company</Text>
                  <Ionicons name="arrow-forward" size={15} color={Colors.primary} />
                </Pressable>
              )}
            </GameCard>

            <GameCard>
              <Text style={styles.sectionTitle}>Financing</Text>
              <Text style={styles.sectionSub}>
                Acquisition debt stays on the acquired company and reduces net worth until repaid.
              </Text>
              <View style={styles.fundingGrid}>
                {FUNDING_OPTIONS.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setFundingMode(option.key)}
                    style={[styles.fundingOption, fundingMode === option.key && styles.fundingOptionActive]}
                  >
                    <Text style={[styles.fundingLabel, fundingMode === option.key && { color: Colors.primary }]}>{option.label}</Text>
                    <Text style={styles.fundingDesc}>{option.desc}</Text>
                  </Pressable>
                ))}
              </View>
            </GameCard>

            <View style={styles.marketHeader}>
              <View>
                <Text style={styles.marketTitle}>Acquisition Market</Text>
                <Text style={styles.marketSub}>
                  {weeksUntilRefresh > 0 ? `New targets in ${weeksUntilRefresh} week${weeksUntilRefresh === 1 ? '' : 's'}` : 'Market can refresh now'}
                </Text>
              </View>
              {negotiationBonus > 0 && (
                <View style={styles.negotiationBadge}>
                  <Ionicons name="hand-left" size={12} color={Colors.primary} />
                  <Text style={styles.negotiationText}>-{Math.round(negotiationBonus * 100)}% price</Text>
                </View>
              )}
            </View>

            {sortedTargets.length === 0 ? (
              <GameCard>
                <Text style={styles.emptyTitle}>No targets available</Text>
                <Text style={styles.emptyText}>The current market has been cleared. A new batch arrives at the next refresh.</Text>
              </GameCard>
            ) : sortedTargets.map((target) => {
              const risk = RISK_LABELS[target.risk];
              const price = getAcquisitionPrice(target, negotiationBonus);
              const quote = getAcquisitionFinancingQuote(price, fundingMode, loanRateReduction);
              const transactionCost = getAcquisitionTransactionCost(target, price);
              const totalCashNeeded = quote.cashContribution + transactionCost;
              const premiumPct = target.estimatedValue > 0
                ? Math.round((price / target.estimatedValue - 1) * 100)
                : 0;
              const debtServiceSafe = quote.weeklyPayment <= Math.max(1, target.weeklyProfit) * 0.80;
              const canAfford = sourceCash >= totalCashNeeded && debtServiceSafe && !capacityFull;
              const expanded = expandedTargetId === target.id;

              return (
                <GameCard key={target.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={styles.targetHeader}
                    onPress={() => setExpandedTargetId(expanded ? null : target.id)}
                  >
                    <View style={styles.targetIcon}>
                      <Ionicons name="business" size={23} color={Colors.info} />
                    </View>
                    <View style={styles.targetNameWrap}>
                      <Text style={styles.targetName}>{target.name}</Text>
                      <Text style={styles.targetMeta}>
                        {target.industry} • {target.tier.toUpperCase()} • {target.companyAgeYears ?? 8}y operating history
                      </Text>
                    </View>
                    <View style={styles.targetHeaderRight}>
                      <View style={[styles.riskBadge, { borderColor: risk.color }]}>
                        <Text style={[styles.riskText, { color: risk.color }]}>{risk.label}</Text>
                      </View>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.textMuted} />
                    </View>
                  </Pressable>

                  <View style={styles.metrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Price</Text>
                      <Text style={styles.metricValue}>{formatCurrency(price)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Est. value</Text>
                      <Text style={styles.metricValue}>{formatCurrency(target.estimatedValue)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Price / value</Text>
                      <Text style={[styles.metricValue, { color: premiumPct <= 0 ? Colors.primary : Colors.warning }]}>
                        {premiumPct > 0 ? '+' : ''}{premiumPct}%
                      </Text>
                    </View>
                  </View>

                  {!expanded && (
                    <View style={styles.compactDealSummary}>
                      <Text style={styles.compactDealText}>
                        Profit {formatCurrency(target.weeklyProfit)}/wk • Cash {formatCurrency(totalCashNeeded)} • Diligence {target.diligenceScore}/100
                      </Text>
                      <Text style={styles.compactDealAction}>Details</Text>
                    </View>
                  )}

                  {expanded && (
                    <>
                  <View style={styles.metrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Cash at closing</Text>
                      <Text style={styles.metricValue}>{formatCurrency(totalCashNeeded)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Financed</Text>
                      <Text style={styles.metricValue}>{formatCurrency(quote.debtPrincipal)}</Text>
                    </View>

                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Debt service</Text>
                      <Text style={[styles.metricValue, { color: debtServiceSafe ? Colors.textPrimary : Colors.negative }]}>
                        {quote.weeklyPayment > 0 ? `${formatCurrency(quote.weeklyPayment)}/wk` : 'None'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metrics}>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Weekly revenue</Text>
                      <Text style={styles.metricValue}>{formatCurrency(target.weeklyRevenue)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Weekly profit</Text>
                      <Text style={[styles.metricValue, { color: Colors.primary }]}>{formatCurrency(target.weeklyProfit)}</Text>
                    </View>
                    <View style={styles.metric}>
                      <Text style={styles.metricLabel}>Diligence</Text>
                      <Text style={styles.metricValue}>{target.diligenceScore}/100</Text>
                    </View>
                  </View>

                  <View style={styles.profileBox}>
                    <View style={styles.profileHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.diligenceTitle}>Company profile</Text>
                        <Text style={styles.profileReason}>{target.sellerReason ?? target.sellerName}</Text>
                        <Text style={styles.profileCost}>Closing costs {formatCurrency(transactionCost)}</Text>
                      </View>
                      <Text style={styles.profileAge}>{target.companyAgeYears ?? 8} years</Text>
                    </View>
                    {(target.traits ?? []).length > 0 && (
                      <View style={styles.traitRow}>
                        {(target.traits ?? []).map((trait) => (
                          <View
                            key={trait.id}
                            style={[
                              styles.traitChip,
                              trait.kind === 'strength' ? styles.traitStrength : styles.traitRisk,
                            ]}
                          >
                            <Ionicons
                              name={trait.kind === 'strength' ? 'sparkles-outline' : 'warning-outline'}
                              size={11}
                              color={trait.kind === 'strength' ? Colors.primary : Colors.warning}
                            />
                            <Text
                              style={[
                                styles.traitText,
                                { color: trait.kind === 'strength' ? Colors.primary : Colors.warning },
                              ]}
                            >
                              {trait.name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.diligenceBox}>
                    <Text style={styles.diligenceTitle}>Due diligence • {target.diligenceScore}/100</Text>
                    {(target.diligenceFindings?.length
                      ? target.diligenceFindings
                      : target.diligenceNotes.map((note, index) => ({
                          id: `fallback_${index}`,
                          title: note,
                          kind: 'neutral' as const,
                          description: 'Due-diligence observation.',
                        }))
                    ).map((finding) => {
                      const findingColor = finding.kind === 'strength'
                        ? Colors.primary
                        : finding.kind === 'risk'
                          ? Colors.warning
                          : Colors.info;
                      return (
                        <View key={finding.id} style={styles.findingRow}>
                          <View style={[styles.findingIcon, { borderColor: findingColor }]}>
                            <Ionicons
                              name={finding.kind === 'strength' ? 'checkmark' : finding.kind === 'risk' ? 'alert' : 'information'}
                              size={10}
                              color={findingColor}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.findingTitle, { color: findingColor }]}>{finding.title}</Text>
                            <Text style={styles.findingText}>{finding.description}</Text>
                          </View>
                        </View>
                      );
                    })}
                    <Text style={styles.integrationText}>
                      Persistent operating profile: {((target.persistentRevenueModifier ?? 0) * 100) >= 0 ? '+' : ''}
                      {((target.persistentRevenueModifier ?? 0) * 100).toFixed(1)}% revenue • {((target.persistentExpenseModifier ?? 0) * 100) >= 0 ? '+' : ''}
                      {((target.persistentExpenseModifier ?? 0) * 100).toFixed(1)}% expenses.
                    </Text>
                    <Text style={styles.integrationText}>
                      Base integration: {target.integrationWeeks} weeks • {Math.round(target.integrationPenalty * 100)}% disruption. You choose the integration approach after closing.
                    </Text>
                  </View>
                    </>
                  )}

                  <View style={styles.sellerRow}>
                    <Text style={styles.sellerText}>{target.sellerName}</Text>
                    <Pressable
                      disabled={!canAfford}
                      onPress={() => confirmAcquire(target.id)}
                      style={[styles.acquireButton, !canAfford && styles.acquireButtonDisabled]}
                    >
                      <Text style={[styles.acquireText, !canAfford && styles.acquireTextDisabled]}>
                        {capacityFull ? 'Need slot' : !debtServiceSafe ? 'Too leveraged' : sourceCash < totalCashNeeded ? 'Need cash' : 'Acquire'}
                      </Text>
                    </Pressable>
                  </View>
                </GameCard>
              );
            })}
          </>
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
  content: { padding: 16, paddingBottom: 36 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  summaryCard: { flex: 1, backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 12, padding: 13 },
  summaryLabel: { color: Colors.textMuted, fontSize: 11 },
  summaryValue: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginTop: 4 },
  capacityText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16 },
  capacityLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10 },
  capacityLinkText: { color: Colors.business, fontSize: 11, fontWeight: '800' },
  locked: { alignItems: 'center', paddingVertical: 18, gap: 9 },
  lockedTitle: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800' },
  lockedText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  progressText: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  chips: { gap: 8, paddingTop: 12, paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: Colors.elevated },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: Colors.white },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 12 },
  linkText: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  fundingGrid: { gap: 8, marginTop: 12 },
  fundingOption: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 10, backgroundColor: Colors.elevated },
  fundingOptionActive: { borderColor: Colors.primary, backgroundColor: '#10382D' },
  fundingLabel: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  fundingDesc: { color: Colors.textMuted, fontSize: 10, marginTop: 3 },
  marketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  marketTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  marketSub: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  negotiationBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: '#10382D', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  negotiationText: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  emptyText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 5 },
  targetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  targetHeaderRight: { alignItems: 'flex-end', gap: 5 },
  compactDealSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  compactDealText: { flex: 1, color: Colors.textMuted, fontSize: 9, lineHeight: 13 },
  compactDealAction: { color: Colors.info, fontSize: 9, fontWeight: '900' },
  targetIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  targetNameWrap: { flex: 1 },
  targetName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  targetMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  riskBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  riskText: { fontSize: 9, fontWeight: '900' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 12 },
  metric: { flex: 1, minWidth: 0 },
  metricLabel: { color: Colors.textMuted, fontSize: 9 },
  metricValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 3 },
  profileBox: { backgroundColor: '#14202F', borderRadius: 10, padding: 10, marginTop: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  profileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  profileReason: { color: Colors.textSecondary, fontSize: 10, marginTop: 2 },
  profileCost: { color: Colors.warning, fontSize: 9, fontWeight: '700', marginTop: 3 },
  profileAge: { color: Colors.info, fontSize: 10, fontWeight: '800' },
  traitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  traitChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5 },
  traitStrength: { borderColor: `${Colors.primary}55`, backgroundColor: `${Colors.primary}10` },
  traitRisk: { borderColor: `${Colors.warning}55`, backgroundColor: `${Colors.warning}10` },
  traitText: { fontSize: 9, fontWeight: '800' },
  diligenceBox: { backgroundColor: Colors.elevated, borderRadius: 10, padding: 10, marginTop: 8 },
  diligenceTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', marginBottom: 6 },
  findingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 7 },
  findingIcon: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  findingTitle: { fontSize: 10, fontWeight: '800' },
  findingText: { color: Colors.textSecondary, fontSize: 9, lineHeight: 13, marginTop: 1 },
  integrationText: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 8 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  sellerText: { color: Colors.textMuted, fontSize: 10, flex: 1 },
  acquireButton: { minWidth: 100, alignItems: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  acquireButtonDisabled: { backgroundColor: Colors.elevated },
  acquireText: { color: Colors.white, fontSize: 12, fontWeight: '900' },
  acquireTextDisabled: { color: Colors.textMuted },
});
