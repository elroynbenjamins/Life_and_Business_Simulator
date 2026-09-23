import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import ScreenHeader from '../../src/components/ScreenHeader';
import StatusPill from '../../src/components/StatusPill';
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
import { isBusinessBudgetReviewDue } from '../../src/engine/businessBudgetEngine';
import { getBusinessGovernanceAttentionReason } from '../../src/engine/businessGovernanceEngine';
import { getCorporateWorkforceAttentionReason } from '../../src/engine/businessWorkforceEngine';
import CorporateGroupReportPanel from '../../src/components/CorporateGroupReportPanel';
import { getCorporateGroupManagementReport } from '../../src/engine/corporateGroupReportingEngine';
import { CorporateReportPeriod, getCorporateManagementAttentionReason } from '../../src/engine/corporateReportingEngine';

type SortMode = 'attention' | 'value' | 'profit' | 'roi';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

const SORT_OPTIONS: Array<{ key: SortMode; label: string; icon: IconName }> = [
  { key: 'attention', label: 'Attention', icon: 'alert-circle-outline' },
  { key: 'value', label: 'Value', icon: 'diamond-outline' },
  { key: 'profit', label: 'Profit', icon: 'cash-outline' },
  { key: 'roi', label: 'ROI', icon: 'trending-up-outline' },
];

type BusinessAttentionItem = {
  label: string;
  detail: string;
  color: string;
  icon: IconName;
};

function getBusinessAttentionItems(
  business: any,
  currentYear: number,
  currentWeek: number,
  inflationMultiplier: number,
): BusinessAttentionItem[] {
  const items: BusinessAttentionItem[] = [];
  const globalWeek = Math.max(1, ((currentYear - 1) * 20) + currentWeek);

  if (business.pendingDecision) {
    const crisis = business.pendingDecision.kind === 'crisis';
    items.push({
      label: crisis ? 'Crisis' : 'Decision',
      detail: business.pendingDecision.title,
      color: crisis ? Colors.negative : Colors.warning,
      icon: crisis ? 'warning-outline' : 'alert-circle-outline',
    });
  }
  if (business.pendingRetention) {
    items.push({
      label: 'Retention',
      detail: 'An employee retention decision needs your attention.',
      color: Colors.warning,
      icon: 'people-outline',
    });
  }
  if (business.acquisition?.integrationStrategy === 'pending') {
    items.push({
      label: 'Integration',
      detail: 'Choose how this acquisition should be integrated.',
      color: Colors.warning,
      icon: 'git-merge-outline',
    });
  }

  const reinvestment = getBusinessReinvestmentUrgency(business);
  if (reinvestment) {
    items.push({
      label: 'Reinvest',
      detail: `${reinvestment === 'technology' ? 'Technology' : reinvestment === 'premises' ? 'Premises' : 'Equipment'} is aging and needs reinvestment.`,
      color: Colors.warning,
      icon: 'construct-outline',
    });
  }

  const coverageGaps = getBusinessCoverageGaps(business);
  if (coverageGaps.length > 0) {
    items.push({
      label: 'Coverage',
      detail: `Insurance gap: ${coverageGaps.map((area) => BUSINESS_INSURANCE_AREAS[area].name).join(', ')}.`,
      color: Colors.warning,
      icon: 'shield-outline',
    });
  }

  if (isBusinessBudgetReviewDue(business, currentYear)) {
    items.push({
      label: 'Budget',
      detail: `Annual cash-plan review is due for Year ${currentYear}.`,
      color: Colors.info,
      icon: 'wallet-outline',
    });
  }

  const governance = getBusinessGovernanceAttentionReason(business);
  if (governance) {
    items.push({
      label: 'Governance',
      detail: governance,
      color: Colors.info,
      icon: 'people-circle-outline',
    });
  }

  const workforce = getCorporateWorkforceAttentionReason(business);
  if (workforce) {
    items.push({
      label: 'Workforce',
      detail: workforce,
      color: Colors.info,
      icon: 'briefcase-outline',
    });
  }

  const management = getCorporateManagementAttentionReason(business, globalWeek, inflationMultiplier);
  if (management) {
    items.push({
      label: 'KPI Watch',
      detail: management,
      color: Colors.info,
      icon: 'analytics-outline',
    });
  }

  return items;
}

function needsAttention(
  business: any,
  currentYear: number,
  currentWeek: number,
  inflationMultiplier: number,
): boolean {
  return getBusinessAttentionItems(business, currentYear, currentWeek, inflationMultiplier).length > 0;
}

function getBusinessVisualStatus(
  business: any,
  currentYear: number,
  currentWeek: number,
  inflationMultiplier: number,
) {
  const items = getBusinessAttentionItems(business, currentYear, currentWeek, inflationMultiplier);
  if (items.length === 0) {
    return {
      label: 'Healthy',
      detail: null as string | null,
      color: Colors.primary,
      icon: 'checkmark-circle-outline' as IconName,
      issueCount: 0,
    };
  }
  return {
    ...items[0],
    issueCount: items.length,
  };
}

function formatReturn(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function compactMetadataLabel(value: string, maxLength = 18): string {
  const clean = value.trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(1, maxLength - 1))}…`;
}

export default function BusinessPortfolioScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const isBusinessTab = pathname === '/tabs/business';
  const businesses = useGameStore((state) => state.businesses ?? []);
  const soldBusinesses = useGameStore((state) => state.soldBusinesses ?? []);
  const holdingCompanies = useGameStore((state) => state.holdingCompanies ?? []);
  const currentYear = useGameStore((state) => state.year ?? 1);
  const currentWeek = useGameStore((state) => state.week ?? 1);
  const inflationMultiplier = useGameStore((state) => state.inflationMultiplier ?? 1);
  const getNetWorthValue = useGameStore((state) => state.getNetWorthValue);
  const [sortMode, setSortMode] = useState<SortMode>('attention');
  const [managementReportPeriod, setManagementReportPeriod] = useState<CorporateReportPeriod>('quarter');

  const netWorth = getNetWorthValue();
  const acquisitionsUnlocked = netWorth >= ACQUISITION_UNLOCK_NET_WORTH;
  const summary = useMemo(
    () => getBusinessEmpireSummary(businesses, holdingCompanies, currentYear, currentWeek, inflationMultiplier),
    [businesses, holdingCompanies, currentYear, currentWeek, inflationMultiplier],
  );

  const totalAttentionItems = useMemo(
    () => businesses.reduce(
      (total, business) => total + getBusinessAttentionItems(business, currentYear, currentWeek, inflationMultiplier).length,
      0,
    ),
    [businesses, currentYear, currentWeek, inflationMultiplier],
  );

  const sortedBusinesses = useMemo(() => {
    return [...businesses].sort((a, b) => {
      if (sortMode === 'attention') {
        const aAttention = needsAttention(a, currentYear, currentWeek, inflationMultiplier) ? 1 : 0;
        const bAttention = needsAttention(b, currentYear, currentWeek, inflationMultiplier) ? 1 : 0;
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
  }, [businesses, sortMode, currentYear, currentWeek, inflationMultiplier]);

  const recentDeals = soldBusinesses.slice(0, 5);
  const globalGameWeek = ((currentYear - 1) * 20) + currentWeek;
  const quarterlyManagementReport = useMemo(
    () => getCorporateGroupManagementReport(businesses, globalGameWeek, 'quarter', inflationMultiplier),
    [businesses, globalGameWeek, inflationMultiplier],
  );
  const annualManagementReport = useMemo(
    () => getCorporateGroupManagementReport(businesses, globalGameWeek, 'annual', inflationMultiplier),
    [businesses, globalGameWeek, inflationMultiplier],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Business Empire"
        subtitle={businesses.length > 0 ? `${businesses.length} active compan${businesses.length === 1 ? 'y' : 'ies'}` : 'Build and manage your companies'}
        showBack={!isBusinessTab}
        onBack={() => router.back()}
        accentColor={Colors.business}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <GameCard
          variant="hero"
          eyebrow="EMPIRE OVERVIEW"
          title={businesses.length > 0 ? `${businesses.length} active compan${businesses.length === 1 ? 'y' : 'ies'}` : 'Ready to build'}
          accentColor={Colors.business}
          titleAccessory={(
            <StatusPill
              compact
              icon={summary.attentionCount > 0 ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              label={summary.attentionCount > 0 ? `${summary.attentionCount} need attention` : 'Portfolio healthy'}
              color={summary.attentionCount > 0 ? Colors.warning : Colors.primary}
            />
          )}
        >
          <View style={styles.empireValueBlock}>
            <Text style={styles.empireValueLabel}>BUSINESS VALUE</Text>
            <Text style={styles.empireValue}>{formatCurrency(summary.totalValue)}</Text>
            <Text style={styles.empireEquity}>Net business equity {formatCurrency(summary.netBusinessEquity)}</Text>
          </View>

          <View style={styles.empireMetrics}>
            <View style={styles.empireMetric}>
              <Text style={styles.empireMetricLabel}>Weekly Profit</Text>
              <Text style={[styles.empireMetricValue, { color: summary.weeklyProfit >= 0 ? Colors.primary : Colors.negative }]}>
                {summary.weeklyProfit >= 0 ? '+' : ''}{formatCurrency(summary.weeklyProfit)}
              </Text>
            </View>
            <View style={styles.empireMetric}>
              <Text style={styles.empireMetricLabel}>Empire Cash</Text>
              <Text style={[styles.empireMetricValue, { color: Colors.primary }]}>{formatCurrency(summary.totalEmpireCash)}</Text>
            </View>
            <View style={styles.empireMetric}>
              <Text style={styles.empireMetricLabel}>Debt</Text>
              <Text style={[styles.empireMetricValue, { color: summary.totalDebt > 0 ? Colors.warning : Colors.primary }]}>
                {formatCurrency(summary.totalDebt)}
              </Text>
            </View>
          </View>

          <View style={[styles.empirePulse, summary.attentionCount > 0 && styles.empirePulseAttention]}>
            <Ionicons
              name={summary.attentionCount > 0 ? 'pulse-outline' : 'shield-checkmark-outline'}
              size={16}
              color={summary.attentionCount > 0 ? Colors.warning : Colors.primary}
            />
            <Text style={styles.empirePulseText}>
              {summary.attentionCount > 0
                ? `${summary.attentionCount} compan${summary.attentionCount === 1 ? 'y' : 'ies'} • ${totalAttentionItems} open attention item${totalAttentionItems === 1 ? '' : 's'}`
                : 'No urgent portfolio actions right now.'}
            </Text>
          </View>
        </GameCard>

        <View style={styles.empireActions}>
          <Pressable style={styles.empireAction} onPress={() => router.push('/business/start')}>
            <View style={[styles.empireActionIcon, { backgroundColor: `${Colors.business}14` }]}>
              <Ionicons name="add" size={20} color={Colors.business} />
            </View>
            <Text style={styles.empireActionTitle}>Start</Text>
            <Text style={styles.empireActionSub}>New business</Text>
          </Pressable>

          <Pressable style={styles.empireAction} onPress={() => router.push('/business/acquisitions')}>
            <View style={[styles.empireActionIcon, { backgroundColor: acquisitionsUnlocked ? `${Colors.primary}14` : Colors.elevated }]}>
              <Ionicons name={acquisitionsUnlocked ? 'git-merge-outline' : 'lock-closed-outline'} size={19} color={acquisitionsUnlocked ? Colors.primary : Colors.textMuted} />
            </View>
            <Text style={[styles.empireActionTitle, !acquisitionsUnlocked && { color: Colors.textMuted }]}>Acquire</Text>
            <Text style={styles.empireActionSub}>
              {acquisitionsUnlocked ? 'M&A market' : `${Math.min(100, Math.round(netWorth / ACQUISITION_UNLOCK_NET_WORTH * 100))}% unlocked`}
            </Text>
          </Pressable>

          <Pressable style={styles.empireAction} onPress={() => router.push('/business/holdings')}>
            <View style={[styles.empireActionIcon, { backgroundColor: `${Colors.info}14` }]}>
              <Ionicons name="layers-outline" size={19} color={Colors.info} />
            </View>
            <Text style={styles.empireActionTitle}>Holdings</Text>
            <Text style={styles.empireActionSub}>{holdingCompanies.length} active</Text>
          </Pressable>
        </View>

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
            const visualStatus = getBusinessVisualStatus(biz, currentYear, currentWeek, inflationMultiplier);
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
                      <Text style={styles.bizName} numberOfLines={1}>{biz.name}</Text>
                      <Text style={styles.bizLevel} numberOfLines={1}>{getLevelName(biz.level)} • {type?.industry ?? ''}</Text>
                      <View style={styles.primaryStatus}>
                        <StatusPill
                          compact
                          icon={visualStatus.icon}
                          label={visualStatus.issueCount > 1 ? `${visualStatus.label} +${visualStatus.issueCount - 1}` : visualStatus.label}
                          color={visualStatus.color}
                        />
                      </View>
                      <View style={styles.badgeLine}>
                        {biz.familyBusiness?.isFamilyBusiness && (
                          <StatusPill compact icon="people-outline" label={`Family G${biz.familyBusiness.generationsOwned}`} color={Colors.warning} />
                        )}
                        {biz.holdingCompanyId && (
                          <StatusPill
                            compact
                            icon="layers-outline"
                            label={compactMetadataLabel(holdingCompanies.find((holding) => holding.id === biz.holdingCompanyId)?.name ?? 'Holding')}
                            color={Colors.info}
                          />
                        )}
                        {biz.acquisition && (
                          <StatusPill compact icon="git-merge-outline" label={`Acquired${risk ? ` • ${risk}` : ''}`} color={Colors.primary} />
                        )}
                      </View>
                    </View>
                    <View style={styles.bizRight}>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
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

                  {visualStatus.detail && (
                    <View style={[styles.statusStrip, { borderColor: `${visualStatus.color}55`, backgroundColor: `${visualStatus.color}10` }]}>
                      <Ionicons name={visualStatus.icon} size={14} color={visualStatus.color} />
                      <Text style={styles.statusStripText} numberOfLines={2}>{visualStatus.detail}</Text>
                      {visualStatus.issueCount > 1 && (
                        <Text style={[styles.statusMore, { color: visualStatus.color }]}>+${visualStatus.issueCount - 1}</Text>
                      )}
                    </View>
                  )}

                  <View style={styles.bizFooter}>
                    {debt > 0 ? (
                      <StatusPill compact icon="card-outline" label={`Debt ${formatCurrency(debt)}`} color={Colors.warning} />
                    ) : (
                      <View />
                    )}
                    <View style={styles.automationCompact}>
                      <Ionicons name="settings-outline" size={12} color={Colors.textMuted} />
                      <View style={styles.automationTrack}>
                        <View style={[styles.automationFill, { width: `${automation}%`, backgroundColor: Colors.business }]} />
                      </View>
                      <Text style={styles.automationValue}>{automation}%</Text>
                    </View>
                  </View>
                </GameCard>
              </Pressable>
            );
          })
        )}

        {quarterlyManagementReport && annualManagementReport && (
          <GameCard variant="subtle" eyebrow="MANAGEMENT" title="Empire Report" accentColor={Colors.info}>
            <CorporateGroupReportPanel
              quarterlyReport={quarterlyManagementReport}
              annualReport={annualManagementReport}
              period={managementReportPeriod}
              onPeriodChange={setManagementReportPeriod}
              onCompanyPress={(businessId) => router.push(`/business/${businessId}`)}
            />
          </GameCard>
        )}


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
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 10 },
  empireValueBlock: { marginBottom: 13 },
  empireValueLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  empireValue: { color: Colors.info, fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 1 },
  empireEquity: { color: Colors.textSecondary, fontSize: 10, marginTop: 1 },
  empireMetrics: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  empireMetric: { flex: 1, minWidth: 0, backgroundColor: Colors.elevated, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 8, paddingVertical: 8 },
  empireMetricLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.35 },
  empireMetricValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '900', marginTop: 3 },
  empirePulse: { minHeight: 32, borderRadius: 9, backgroundColor: `${Colors.primary}0D`, borderWidth: 1, borderColor: `${Colors.primary}33`, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 7 },
  empirePulseAttention: { backgroundColor: `${Colors.warning}0D`, borderColor: `${Colors.warning}33` },
  empirePulseText: { flex: 1, color: Colors.textSecondary, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  empireActions: { flexDirection: 'row', gap: 7, marginTop: -1, marginBottom: 2 },
  empireAction: { flex: 1, minWidth: 0, minHeight: 82, backgroundColor: Colors.card, borderRadius: 11, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 7, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  empireActionIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  empireActionTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '900' },
  empireActionSub: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, textAlign: 'center', marginTop: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 28 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptySubtitle: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, textAlign: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionSub: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  sectionCount: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', backgroundColor: Colors.elevated, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  historyLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5 },
  historyLinkText: { color: Colors.info, fontSize: 10, fontWeight: '800' },
  sortRow: { gap: 7, paddingVertical: 1 },
  sortChip: { minHeight: 32, borderRadius: 16, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, paddingHorizontal: 10, flexDirection: 'row', gap: 5, alignItems: 'center' },
  sortChipActive: { backgroundColor: Colors.business, borderColor: Colors.business },
  sortChipText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800' },
  sortChipTextActive: { color: Colors.white },
  bizHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bizArtwork: { width: 52, height: 52 },
  bizInfo: { flex: 1, minWidth: 0 },
  bizName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  bizLevel: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  primaryStatus: { marginTop: 5 },
  badgeLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 },
  bizRight: { width: 22, alignItems: 'flex-end', paddingTop: 15 },
  bizStats: { flexDirection: 'row', marginTop: 12, gap: 8 },
  bizStat: { flex: 1 },
  bizStatLabel: { color: Colors.textMuted, fontSize: 9 },
  bizStatValue: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  statusStrip: { minHeight: 34, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7, marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusStripText: { flex: 1, color: Colors.textSecondary, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  statusMore: { fontSize: 9, fontWeight: '900' },
  bizFooter: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 9 },
  automationCompact: { flex: 1, maxWidth: 132, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  automationTrack: { flex: 1, height: 4, backgroundColor: Colors.elevated, borderRadius: 2 },
  automationFill: { height: 4, backgroundColor: Colors.business, borderRadius: 2 },
  automationValue: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600', width: 30, textAlign: 'right' },
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
