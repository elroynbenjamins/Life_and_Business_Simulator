import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getLevelName, getBusinessType, getAutomationScore } from '../../src/engine/businessEngine';
import {
  getBusinessDebt,
  getBusinessEmpireSummary,
  getBusinessEquityReturn,
} from '../../src/engine/businessPortfolioEngine';
import { businessTypeImages } from '../../src/assets/progressionImages';
import { ACQUISITION_UNLOCK_NET_WORTH } from '../../src/engine/acquisitionEngine';
import { getBusinessReinvestmentUrgency } from '../../src/engine/businessReinvestmentEngine';
import { BUSINESS_INSURANCE_AREAS, getBusinessCoverageGaps } from '../../src/engine/businessInsuranceEngine';

type SortMode = 'attention' | 'value' | 'profit' | 'roi';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SORT_OPTIONS: Array<{ key: SortMode; label: string; icon: IconName }> = [
  { key: 'attention', label: 'Attention', icon: 'alert-circle-outline' },
  { key: 'value', label: 'Value', icon: 'diamond-outline' },
  { key: 'profit', label: 'Profit', icon: 'cash-outline' },
  { key: 'roi', label: 'ROI', icon: 'trending-up-outline' },
];

function needsAttention(business: any): boolean {
  return Boolean(
    business.pendingDecision
    || business.pendingRetention
    || business.acquisition?.integrationStrategy === 'pending'
    || getBusinessReinvestmentUrgency(business)
    || getBusinessCoverageGaps(business).length > 0
  );
}

function formatReturn(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export default function BusinessPortfolioScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isBusinessTab = pathname === '/tabs/business';
  const businesses = useGameStore((state) => state.businesses ?? []);
  const soldBusinesses = useGameStore((state) => state.soldBusinesses ?? []);
  const holdingCompanies = useGameStore((state) => state.holdingCompanies ?? []);
  const getNetWorthValue = useGameStore((state) => state.getNetWorthValue);
  const [sortMode, setSortMode] = useState<SortMode>('attention');

  const netWorth = getNetWorthValue();
  const acquisitionsUnlocked = netWorth >= ACQUISITION_UNLOCK_NET_WORTH;
  const summary = useMemo(
    () => getBusinessEmpireSummary(businesses, holdingCompanies),
    [businesses, holdingCompanies],
  );

  const sortedBusinesses = useMemo(() => {
    return [...businesses].sort((a, b) => {
      if (sortMode === 'attention') {
        const aAttention = needsAttention(a) ? 1 : 0;
        const bAttention = needsAttention(b) ? 1 : 0;
        if (aAttention !== bAttention) return bAttention - aAttention;
        return (b.lastWeekProfit ?? 0) - (a.lastWeekProfit ?? 0);
      }
      if (sortMode === 'value') return (b.valuation ?? 0) - (a.valuation ?? 0);
      if (sortMode === 'profit') return (b.lastWeekProfit ?? 0) - (a.lastWeekProfit ?? 0);

      const aRoi = getBusinessEquityReturn(a).returnPct;
      const bRoi = getBusinessEquityReturn(b).returnPct;
      if (aRoi == null && bRoi == null) return (b.valuation ?? 0) - (a.valuation ?? 0);
      if (aRoi == null) return 1;
      if (bRoi == null) return -1;
      return bRoi - aRoi;
    });
  }, [businesses, sortMode]);

  const recentDeals = soldBusinesses.slice(0, 5);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {isBusinessTab ? (
          <View style={{ width: 24 }} />
        ) : (
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Business Empire</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Business Value</Text>
            <Text style={[styles.summaryValue, { color: Colors.info }]}>{formatCurrency(summary.totalValue)}</Text>
            <Text style={styles.summaryFoot}>Equity {formatCurrency(summary.netBusinessEquity)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Weekly Profit</Text>
            <Text style={[styles.summaryValue, { color: summary.weeklyProfit >= 0 ? Colors.primary : Colors.negative }]}>
              {summary.weeklyProfit >= 0 ? '+' : ''}{formatCurrency(summary.weeklyProfit)}
            </Text>
            <Text style={styles.summaryFoot}>{businesses.length} active {businesses.length === 1 ? 'company' : 'companies'}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Business Debt</Text>
            <Text style={[styles.summaryValue, { color: summary.totalDebt > 0 ? Colors.warning : Colors.primary }]}>
              {formatCurrency(summary.totalDebt)}
            </Text>
            <Text style={styles.summaryFoot}>{summary.leveragedAcquisitionCount} leveraged M&A</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Empire Cash</Text>
            <Text style={[styles.summaryValue, { color: Colors.primary }]}>{formatCurrency(summary.totalEmpireCash)}</Text>
            <Text style={styles.summaryFoot}>Companies + holdings</Text>
          </View>
        </View>

        {businesses.length > 0 && (
          <GameCard>
            <View style={styles.pulseHeader}>
              <View style={styles.capitalIcon}>
                <Ionicons name="pulse" size={21} color={summary.attentionCount > 0 ? Colors.warning : Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.capitalTitle}>Empire Pulse</Text>
                <Text style={styles.capitalSub}>
                  {summary.attentionCount > 0
                    ? `${summary.attentionCount} ${summary.attentionCount === 1 ? 'company needs' : 'companies need'} attention.`
                    : 'No urgent portfolio actions right now.'}
                </Text>
              </View>
              <View style={styles.pulseBadge}>
                <Text style={styles.pulseBadgeText}>{summary.acquisitionCount} M&A</Text>
              </View>
            </View>
          </GameCard>
        )}

        <GameCard>
          <View style={styles.capitalHeader}>
            <View style={styles.capitalIcon}>
              <Ionicons name="layers" size={22} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.capitalTitle}>Capital Allocation</Text>
              <Text style={styles.capitalSub}>
                {acquisitionsUnlocked
                  ? 'Acquire established companies and organize subsidiaries under holding companies.'
                  : `Unlock M&A at ${formatCurrency(ACQUISITION_UNLOCK_NET_WORTH)} net worth.`}
              </Text>
            </View>
          </View>
          <View style={styles.capitalActions}>
            <Pressable
              style={[styles.capitalButton, !acquisitionsUnlocked && styles.capitalButtonLocked]}
              onPress={() => router.push('/business/acquisitions')}
            >
              <Ionicons name={acquisitionsUnlocked ? 'trending-up' : 'lock-closed'} size={17} color={acquisitionsUnlocked ? Colors.primary : Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.capitalButtonTitle, !acquisitionsUnlocked && { color: Colors.textMuted }]}>Acquisitions</Text>
                <Text style={styles.capitalButtonSub}>
                  {acquisitionsUnlocked
                    ? 'Browse established companies'
                    : `${Math.min(100, Math.round(netWorth / ACQUISITION_UNLOCK_NET_WORTH * 100))}% unlocked`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.capitalButton, !acquisitionsUnlocked && styles.capitalButtonLocked]}
              onPress={() => router.push('/business/holdings')}
            >
              <Ionicons name="business" size={17} color={acquisitionsUnlocked ? Colors.warning : Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.capitalButtonTitle, !acquisitionsUnlocked && { color: Colors.textMuted }]}>Holdings</Text>
                <Text style={styles.capitalButtonSub}>
                  {holdingCompanies.length} holding {holdingCompanies.length === 1 ? 'company' : 'companies'} • {formatCurrency(summary.holdingCash)} reserve
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
        </GameCard>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Active Portfolio</Text>
            <Text style={styles.sectionSub}>Sort the empire by what matters right now.</Text>
          </View>
          <Text style={styles.sectionCount}>{businesses.length}</Text>
        </View>

        {businesses.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
            {SORT_OPTIONS.map((option) => {
              const active = option.key === sortMode;
              return (
                <Pressable
                  key={option.key}
                  style={[styles.sortChip, active && styles.sortChipActive]}
                  onPress={() => setSortMode(option.key)}
                >
                  <Ionicons name={option.icon} size={13} color={active ? Colors.white : Colors.textSecondary} />
                  <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {businesses.length === 0 ? (
          <GameCard>
            <View style={styles.emptyState}>
              <Ionicons name="business-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Businesses Yet</Text>
              <Text style={styles.emptySubtitle}>Start your first business and build an empire.</Text>
            </View>
          </GameCard>
        ) : (
          sortedBusinesses.map((biz) => {
            const type = getBusinessType(biz.typeId);
            const automation = getAutomationScore(biz);
            const debt = getBusinessDebt(biz);
            const equityReturn = getBusinessEquityReturn(biz);
            const attention = needsAttention(biz);
            const risk = biz.acquisition?.initialRisk;

            return (
              <Pressable
                key={biz.id}
                onPress={() => router.push(`/business/${biz.id}`)}
                style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
              >
                <GameCard>
                  <View style={styles.bizHeader}>
                    <Image
                      source={businessTypeImages[biz.typeId]}
                      style={styles.bizArtwork}
                      resizeMode="contain"
                      accessibilityLabel={`${type?.name ?? 'Business'} pixel art`}
                    />
                    <View style={styles.bizInfo}>
                      <Text style={styles.bizName}>{biz.name}</Text>
                      <Text style={styles.bizLevel}>{getLevelName(biz.level)} • {type?.industry ?? ''}</Text>
                      <View style={styles.badgeLine}>
                        {biz.familyBusiness?.isFamilyBusiness && (
                          <View style={styles.familyBadge}>
                            <Ionicons name="people" size={11} color={Colors.warning} />
                            <Text style={styles.familyBadgeText}>Family • G{biz.familyBusiness.generationsOwned}</Text>
                          </View>
                        )}
                        {biz.holdingCompanyId && (
                          <View style={styles.holdingBadge}>
                            <Ionicons name="layers" size={11} color={Colors.info} />
                            <Text style={styles.holdingBadgeText}>
                              {holdingCompanies.find((holding) => holding.id === biz.holdingCompanyId)?.name ?? 'Holding'}
                            </Text>
                          </View>
                        )}
                        {biz.acquisition && (
                          <View style={styles.acquisitionBadge}>
                            <Ionicons name="git-merge-outline" size={11} color={Colors.primary} />
                            <Text style={styles.acquisitionBadgeText}>Acquired{risk ? ` • ${risk}` : ''}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.bizRight}>
                      {attention && (
                        <View style={[styles.attentionBadge, biz.pendingDecision?.kind === 'crisis' && styles.crisisAttention]}>
                          <Text style={styles.attentionText}>!</Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                    </View>
                  </View>

                  <View style={styles.bizStats}>
                    <View style={styles.bizStat}>
                      <Text style={styles.bizStatLabel}>Value</Text>
                      <Text style={[styles.bizStatValue, { color: Colors.info }]}>{formatCurrency(biz.valuation ?? 0)}</Text>
                    </View>
                    <View style={styles.bizStat}>
                      <Text style={styles.bizStatLabel}>Weekly P&L</Text>
                      <Text style={[styles.bizStatValue, { color: (biz.lastWeekProfit ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                        {(biz.lastWeekProfit ?? 0) >= 0 ? '+' : ''}{formatCurrency(biz.lastWeekProfit ?? 0)}
                      </Text>
                    </View>
                    <View style={styles.bizStat}>
                      <Text style={styles.bizStatLabel}>{equityReturn.investmentBasis != null ? 'Lifetime ROI' : 'Reputation'}</Text>
                      <Text style={[styles.bizStatValue, {
                        color: equityReturn.investmentBasis != null
                          ? ((equityReturn.returnPct ?? 0) >= 0 ? Colors.primary : Colors.negative)
                          : Colors.warning,
                      }]}>
                        {equityReturn.investmentBasis != null ? formatReturn(equityReturn.returnPct) : `${Math.round(biz.reputation)}/100`}
                      </Text>
                    </View>
                  </View>

                  {debt > 0 && (
                    <View style={styles.debtRow}>
                      <Ionicons name="card-outline" size={13} color={Colors.warning} />
                      <Text style={styles.debtText}>Outstanding business debt {formatCurrency(debt)}</Text>
                    </View>
                  )}

                  {biz.pendingDecision && (
                    <View style={[styles.pendingStrip, biz.pendingDecision.kind === 'crisis' && styles.pendingStripCrisis]}>
                      <Text style={styles.pendingStripText}>
                        {biz.pendingDecision.kind === 'crisis' ? 'Crisis' : 'Decision'}: {biz.pendingDecision.title}
                      </Text>
                    </View>
                  )}
                  {!biz.pendingDecision && biz.acquisition?.integrationStrategy === 'pending' && (
                    <View style={styles.pendingStrip}>
                      <Text style={styles.pendingStripText}>Acquisition integration strategy needs a decision.</Text>
                    </View>
                  )}
                  {!biz.pendingDecision && biz.acquisition?.integrationStrategy !== 'pending' && getBusinessReinvestmentUrgency(biz) && (
                    <View style={styles.pendingStrip}>
                      <Text style={styles.pendingStripText}>
                        Reinvestment due: {getBusinessReinvestmentUrgency(biz) === 'technology' ? 'technology' : getBusinessReinvestmentUrgency(biz) === 'premises' ? 'premises' : 'equipment'} is aging.
                      </Text>
                    </View>
                  )}
                  {!biz.pendingDecision && !getBusinessReinvestmentUrgency(biz) && getBusinessCoverageGaps(biz).length > 0 && (
                    <View style={styles.pendingStrip}>
                      <Text style={styles.pendingStripText}>
                        Coverage gap: {getBusinessCoverageGaps(biz).map((area) => BUSINESS_INSURANCE_AREAS[area].name).join(', ')}.
                      </Text>
                    </View>
                  )}

                  <View style={styles.bottomRow}>
                    <View style={styles.automationBar}>
                      <Text style={styles.automationLabel}>Automation</Text>
                      <View style={styles.automationTrack}>
                        <View style={[styles.automationFill, { width: `${automation}%` }]} />
                      </View>
                      <Text style={styles.automationValue}>{automation}%</Text>
                    </View>
                  </View>
                </GameCard>
              </Pressable>
            );
          })
        )}

        <Pressable
          style={({ pressed }) => [styles.startButton, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}
          onPress={() => router.push('/business/start')}
        >
          <Ionicons name="add-circle" size={22} color={Colors.white} />
          <Text style={styles.startButtonText}>Start New Business</Text>
        </Pressable>

        {recentDeals.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Deal History</Text>
                <Text style={styles.sectionSub}>Recent exits stay visible after the company leaves your portfolio.</Text>
              </View>
              <Pressable style={styles.historyLink} onPress={() => router.push('/business/history')}>
                <Text style={styles.historyLinkText}>View all {soldBusinesses.length}</Text>
                <Ionicons name="chevron-forward" size={13} color={Colors.info} />
              </Pressable>
            </View>

            <GameCard>
              <View style={styles.dealList}>
                {recentDeals.map((deal, index) => {
                  const type = getBusinessType(deal.typeId);
                  const positive = (deal.lifetimeCashResult ?? 0) >= 0;
                  return (
                    <View key={deal.id}>
                      <View style={styles.dealRow}>
                        <View style={styles.dealIcon}>
                          <Ionicons name="checkmark" size={15} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dealName}>{deal.name}</Text>
                          <Text style={styles.dealMeta}>
                            {type?.industry ?? 'Business'} • Sold Y{deal.soldYear} W{deal.soldWeek} • Held {deal.heldWeeks}w
                          </Text>
                        </View>
                        <View style={styles.dealRight}>
                          <Text style={styles.dealProceeds}>{formatCurrency(deal.netSaleProceeds)}</Text>
                          <Text style={[styles.dealReturn, deal.lifetimeReturnPct != null && { color: positive ? Colors.primary : Colors.negative }]}>
                            {formatReturn(deal.lifetimeReturnPct)}
                          </Text>
                        </View>
                      </View>
                      {index < recentDeals.length - 1 && <View style={styles.dealDivider} />}
                    </View>
                  );
                })}
              </View>
            </GameCard>
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
  scrollContent: { padding: 16, paddingBottom: 32, gap: 10 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48.5%', minHeight: 88, backgroundColor: Colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.cardBorder },
  summaryLabel: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  summaryValue: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  summaryFoot: { color: Colors.textMuted, fontSize: 9, marginTop: 5 },
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  capitalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  capitalIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#17263A', justifyContent: 'center', alignItems: 'center' },
  capitalTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  capitalSub: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  pulseBadge: { borderRadius: 12, backgroundColor: '#17263A', paddingHorizontal: 9, paddingVertical: 6 },
  pulseBadgeText: { color: Colors.info, fontSize: 10, fontWeight: '800' },
  capitalActions: { gap: 8, marginTop: 12 },
  capitalButton: { flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 48, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 },
  capitalButtonLocked: { opacity: 0.75 },
  capitalButtonTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  capitalButtonSub: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionSub: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  sectionCount: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5 },
  historyLinkText: { color: Colors.info, fontSize: 10, fontWeight: '800' },
  sortRow: { gap: 7, paddingVertical: 1 },
  sortChip: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, paddingHorizontal: 10, flexDirection: 'row', gap: 5, alignItems: 'center' },
  sortChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  sortChipText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800' },
  sortChipTextActive: { color: Colors.white },
  bizHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  bizArtwork: { width: 56, height: 56 },
  bizInfo: { flex: 1 },
  bizName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  bizLevel: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  badgeLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  familyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: `${Colors.warning}15` },
  familyBadgeText: { color: Colors.warning, fontSize: 8, fontWeight: '800' },
  holdingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: '#17263A' },
  holdingBadgeText: { color: Colors.info, fontSize: 8, fontWeight: '800', maxWidth: 110 },
  acquisitionBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: `${Colors.primary}12` },
  acquisitionBadgeText: { color: Colors.primary, fontSize: 8, fontWeight: '800', textTransform: 'capitalize' },
  bizRight: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  attentionBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: `${Colors.warning}22`, borderWidth: 1, borderColor: Colors.warning, alignItems: 'center', justifyContent: 'center' },
  crisisAttention: { backgroundColor: `${Colors.negative}22`, borderColor: Colors.negative },
  attentionText: { color: Colors.white, fontSize: 11, fontWeight: '900' },
  bizStats: { flexDirection: 'row', marginTop: 12, gap: 8 },
  bizStat: { flex: 1 },
  bizStatLabel: { color: Colors.textMuted, fontSize: 9 },
  bizStatValue: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  debtText: { color: Colors.warning, fontSize: 9, fontWeight: '700' },
  pendingStrip: { backgroundColor: `${Colors.warning}10`, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6, marginTop: 9 },
  pendingStripCrisis: { backgroundColor: `${Colors.negative}10` },
  pendingStripText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  automationBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  automationLabel: { color: Colors.textMuted, fontSize: 10 },
  automationTrack: { flex: 1, height: 4, backgroundColor: Colors.elevated, borderRadius: 2 },
  automationFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  automationValue: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600', width: 30, textAlign: 'right' },
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 14, padding: 15 },
  startButtonText: { color: Colors.white, fontSize: 15, fontWeight: '800' },
  dealList: { gap: 0 },
  dealRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  dealIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: `${Colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  dealName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  dealMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  dealRight: { alignItems: 'flex-end' },
  dealProceeds: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  dealReturn: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  dealDivider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 5 },
});
