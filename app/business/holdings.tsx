import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import ScreenTabs from '../../src/components/ScreenTabs';
import FeatureTourModal, { FeatureTourStep } from '../../src/components/FeatureTourModal';
import { showGameDialog } from '../../src/components/GameDialog';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import {
  ACQUISITION_UNLOCK_NET_WORTH,
  getAcquisitionReturn,
} from '../../src/engine/acquisitionEngine';
import { BUSINESS_DELEGATION_POLICIES, getDelegationManagerEffectiveness, getDelegationManagers, getHoldingSharedServiceUpgradeEconomics, getHoldingSynergyProfile } from '../../src/engine/businessEngine';
import {
  HOLDING_COMPANY_SETUP_COST,
  HOLDING_SHARED_SERVICE_DEFINITIONS,
  HOLDING_SHARED_SERVICE_MAX_LEVEL,
  canChargeHoldingManagementFee,
  filterAndSortHoldingSubsidiaries,
  getHoldingCapitalAllocationPreview,
  getHoldingSubsidiaryAttentionAction,
  getHoldingSubsidiaryAttentionSummary,
  getHoldingCompanySummary,
  getHoldingSubsidiaryHealthSnapshot,
  HoldingSubsidiaryFilter,
  HoldingSubsidiarySort,
  getHoldingManagementFeePolicyPreview,
  getHoldingReservePolicyPreview,
  getHoldingSharedServiceEffects,
  getHoldingTreasuryTransactionPreview,
  getHoldingSharedServiceUpgradeCost,
  normalizeHoldingSharedServices,
} from '../../src/engine/holdingCompanyEngine';
import { BusinessDelegationPolicy, HoldingSharedServiceId } from '../../src/types/game';
import CorporateGroupReportPanel from '../../src/components/CorporateGroupReportPanel';
import { getCorporateGroupManagementReport } from '../../src/engine/corporateGroupReportingEngine';
import { CorporateReportPeriod } from '../../src/engine/corporateReportingEngine';

const CAPITAL_AMOUNTS = [1_000_000, 5_000_000, 10_000_000];
const PAYOUT_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];
const SUBSIDIARY_ALLOCATION_AMOUNTS = [1_000_000, 5_000_000, 10_000_000] as const;
const MANAGEMENT_FEE_RATES = [0, 0.01, 0.02, 0.03];
const RESERVE_TARGET_WEEKS = [0, 4, 8, 12];

const COMPANY_FILTER_OPTIONS: Array<{ key: HoldingSubsidiaryFilter; label: string }> = [
  { key: 'all', label: 'All companies' },
  { key: 'attention', label: 'Needs attention' },
  { key: 'critical', label: 'Critical' },
  { key: 'watch', label: 'Watch' },
  { key: 'loss', label: 'Loss-making' },
  { key: 'reserve', label: 'Reserve shortfall' },
  { key: 'debt', label: 'Has debt' },
  { key: 'manual', label: 'Manual' },
  { key: 'delegated', label: 'Delegated' },
];

const COMPANY_SORT_OPTIONS: Array<{ key: HoldingSubsidiarySort; label: string }> = [
  { key: 'attention', label: 'Attention first' },
  { key: 'profit', label: 'Profit: low first' },
  { key: 'cash', label: 'Cash: low first' },
  { key: 'debt', label: 'Debt: high first' },
  { key: 'name', label: 'Name A–Z' },
];

const HOLDINGS_TOUR_STEPS: FeatureTourStep[] = [
  {
    title: 'The group has three separate cash pools',
    body: 'Personal cash belongs to you, the Holding reserve belongs to the parent company, and each subsidiary keeps its own company balance. Funding moves personal cash into the Holding; capital allocation moves Holding cash into a subsidiary.',
    icon: 'layers-outline',
  },
  {
    title: 'Reserve targets protect owner payouts',
    body: 'The Holding reserve target blocks owner distributions below the selected number of subsidiary expense weeks. It does not stop strategic capital allocation. Management fees also cannot pull cash out of protected subsidiary reserves.',
    icon: 'shield-checkmark-outline',
  },
  {
    title: 'Use previews before moving group capital',
    body: 'Treasury amount buttons first show personal and Holding cash before → after. In Subsidiaries, expand a company for Growth and Debt previews showing post-cash, reserve gaps, debt and interest effects, and minority-shareholder value before you confirm.',
    icon: 'analytics-outline',
  },
];

export default function HoldingCompaniesScreen() {
  const router = useRouter();
  const businesses = useGameStore((s) => s.businesses ?? []);
  const holdings = useGameStore((s) => s.holdingCompanies ?? []);
  const cash = useGameStore((s) => s.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s.inflationMultiplier ?? 1);
  const currentWeek = useGameStore((s) => s.week ?? 1);
  const currentYear = useGameStore((s) => s.year ?? 1);
  const relationshipState = useGameStore((s) => s.relationshipState);
  const getNetWorthValue = useGameStore((s) => s.getNetWorthValue);
  const createHoldingCompany = useGameStore((s) => s.createHoldingCompany);
  const fundHoldingCompany = useGameStore((s) => s.fundHoldingCompany);
  const distributeHoldingCash = useGameStore((s) => s.distributeHoldingCash);
  const setHoldingReserveTargetWeeks = useGameStore((s) => s.setHoldingReserveTargetWeeks);
  const setHoldingManagementFeeRate = useGameStore((s) => s.setHoldingManagementFeeRate);
  const upgradeHoldingSharedService = useGameStore((s) => s.upgradeHoldingSharedService);
  const allocateHoldingCapital = useGameStore((s) => s.allocateHoldingCapital);
  const setBusinessDelegation = useGameStore((s) => s.setBusinessDelegation);
  const appointChildToHolding = useGameStore((s) => s.appointChildToHolding);
  const assignBusinessToHolding = useGameStore((s) => s.assignBusinessToHolding);
  const toggleLongTermFamilyAsset = useGameStore((s) => s.toggleLongTermFamilyAsset);
  const [name, setName] = useState('');
  const [managerSelections, setManagerSelections] = useState<Record<string, string>>({});
  const [managementReportPeriod, setManagementReportPeriod] = useState<CorporateReportPeriod>('quarter');
  const [selectedHoldingId, setSelectedHoldingId] = useState<string | null>(null);
  const [holdingView, setHoldingView] = useState<'overview' | 'services' | 'subsidiaries'>('overview');
  const [showHoldingsTour, setShowHoldingsTour] = useState(false);
  const [showCreateHolding, setShowCreateHolding] = useState(holdings.length === 0);
  const [expandedSubsidiaryId, setExpandedSubsidiaryId] = useState<string | null>(null);
  const [focusedAllocation, setFocusedAllocation] = useState<{ businessId: string; mode: 'growth' | 'debt' } | null>(null);
  const [subsidiaryAllocationAmounts, setSubsidiaryAllocationAmounts] = useState<Record<string, number>>({});
  const [companyFilter, setCompanyFilter] = useState<HoldingSubsidiaryFilter>('all');
  const [companySort, setCompanySort] = useState<HoldingSubsidiarySort>('attention');
  const [companyControlOpen, setCompanyControlOpen] = useState<'filter' | 'sort' | null>(null);

  const netWorth = getNetWorthValue();
  const unlocked = netWorth >= ACQUISITION_UNLOCK_NET_WORTH;
  const setupCost = Math.round(HOLDING_COMPANY_SETUP_COST * Math.max(0.5, inflationMultiplier));
  const unassigned = businesses.filter((business) => !business.holdingCompanyId);
  const adultChildren = (relationshipState?.children ?? []).filter((child) => (child.age ?? 0) >= 18);
  const globalGameWeek = ((currentYear - 1) * 20) + currentWeek;

  const summaries = useMemo(() => holdings.map((holding) => {
    const summary = getHoldingCompanySummary(holding, businesses);
    const subsidiaries = businesses.filter((business) => business.holdingCompanyId === holding.id);
    const synergyProfiles = subsidiaries.map((business) => getHoldingSynergyProfile(business, businesses, holdings));
    const avgRevenueSynergy = synergyProfiles.length
      ? synergyProfiles.reduce((sum, profile) => sum + profile.revenueBonus, 0) / synergyProfiles.length
      : 0;
    const avgExpenseSynergy = synergyProfiles.length
      ? synergyProfiles.reduce((sum, profile) => sum + profile.expenseReduction, 0) / synergyProfiles.length
      : 0;
    const diversification = synergyProfiles.length
      ? Math.max(...synergyProfiles.map((profile) => profile.crisisReduction))
      : 0;
    const sharedServiceEffects = getHoldingSharedServiceEffects(holding);
    const managementFeeEligibleCount = subsidiaries.filter(canChargeHoldingManagementFee).length;
    const quarterlyManagementReport = getCorporateGroupManagementReport(
      subsidiaries,
      globalGameWeek,
      'quarter',
      inflationMultiplier,
    );
    const annualManagementReport = getCorporateGroupManagementReport(
      subsidiaries,
      globalGameWeek,
      'annual',
      inflationMultiplier,
    );
    return {
      holding,
      subsidiaries,
      ...summary,
      avgRevenueSynergy,
      avgExpenseSynergy,
      diversification,
      sharedServiceEffects,
      managementFeeEligibleCount,
      quarterlyManagementReport,
      annualManagementReport,
    };
  }), [holdings, businesses, globalGameWeek, inflationMultiplier]);
  const selectedSummary = summaries.find((summary) => summary.holding.id === selectedHoldingId) ?? summaries[0] ?? null;
  const visibleSummaries = selectedSummary ? [selectedSummary] : [];

  const createHolding = () => {
    const cleanName = name.trim();
    if (!cleanName) return;
    showGameDialog({
      title: 'Create holding company?',
      message: `Establish ${cleanName} for ${formatCurrency(setupCost)}. Holdings can own subsidiaries, hold cash, fund acquisitions, repay subsidiary debt and continue through the dynasty.`,
      confirmText: 'Create',
      onConfirm: () => {
        createHoldingCompany(cleanName);
        setName('');
        setShowCreateHolding(false);
      },
    });
  };

  const previewTreasuryTransaction = ({
    action,
    holdingId,
    holdingName,
    cashReserve,
    reserveTarget,
    amount,
  }: {
    action: 'fund' | 'distribution';
    holdingId: string;
    holdingName: string;
    cashReserve: number;
    reserveTarget: number;
    amount: number;
  }) => {
    const preview = getHoldingTreasuryTransactionPreview({
      action,
      personalCash: cash,
      cashReserve,
      reserveTarget,
      amount,
    });
    if (!preview.canExecute) return;

    if (action === 'fund') {
      showGameDialog({
        title: `Fund ${holdingName}?`,
        message:
          `Personal cash: ${formatCurrency(preview.personalCashBefore)} → ${formatCurrency(preview.personalCashAfter)}\n`
          + `Holding reserve: ${formatCurrency(preview.cashReserveBefore)} → ${formatCurrency(preview.cashReserveAfter)}\n\n`
          + 'This funds the parent treasury only. Subsidiary cash changes later when you allocate capital. Nothing moves until you confirm.',
        confirmText: 'Fund',
        cancelText: 'Back',
        onConfirm: () => fundHoldingCompany(holdingId, preview.transactionAmount),
      });
      return;
    }

    showGameDialog({
      title: `Distribute ${formatCurrency(preview.transactionAmount)} to owner?`,
      message:
        `Holding reserve: ${formatCurrency(preview.cashReserveBefore)} → ${formatCurrency(preview.cashReserveAfter)}\n`
        + `Personal cash: ${formatCurrency(preview.personalCashBefore)} → ${formatCurrency(preview.personalCashAfter)}\n`
        + (preview.reserveTarget > 0
          ? `Protected reserve target: ${formatCurrency(preview.reserveTarget)}\nCash above target after payout: ${formatCurrency(preview.cashAboveTargetAfter)}\n\n`
          : 'Protected reserve target: Off\n\n')
        + 'The reserve target remains protected. Nothing moves until you confirm.',
      confirmText: 'Distribute',
      cancelText: 'Back',
      onConfirm: () => distributeHoldingCash(holdingId, preview.transactionAmount),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
        </View>
        <Text style={styles.headerTitle} numberOfLines={1}>Holding Companies</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <Pressable
            onPress={() => setShowHoldingsTour(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open holdings tour"
          >
            <Ionicons name="help-circle-outline" size={23} color={Colors.info} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <GameCard>
          <View style={styles.introHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name="layers" size={24} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.introTitle}>Build a business group</Text>
              <Text style={styles.introText}>
                Holdings act as real group headquarters: allocate capital, build shared Finance, HR, Procurement,
                Marketing and IT teams, delegate routine subsidiary management and prepare the next generation.
              </Text>
            </View>
          </View>
        </GameCard>

        {!unlocked ? (
          <GameCard>
            <View style={styles.locked}>
              <Ionicons name="lock-closed" size={30} color={Colors.warning} />
              <Text style={styles.lockedTitle}>Unlocks at {formatCurrency(ACQUISITION_UNLOCK_NET_WORTH)}</Text>
              <Text style={styles.lockedText}>Current net worth: {formatCurrency(netWorth)}</Text>
            </View>
          </GameCard>
        ) : (
          <>
            {showCreateHolding ? (
              <GameCard>
                <View style={styles.createHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{holdings.length === 0 ? 'Create Holding' : 'Create Another Holding'}</Text>
                    <Text style={styles.sectionSub}>One-time setup: {formatCurrency(setupCost)} • Personal cash: {formatCurrency(cash)}</Text>
                  </View>
                  {holdings.length > 0 && (
                    <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowCreateHolding(false)}>
                      <Ionicons name="close" size={19} color={Colors.textMuted} />
                    </Pressable>
                  )}
                </View>
                <View style={styles.createRow}>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Benjamins Group"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                    maxLength={36}
                  />
                  <Pressable
                    onPress={createHolding}
                    disabled={!name.trim() || cash < setupCost}
                    style={[styles.createButton, (!name.trim() || cash < setupCost) && styles.disabledButton]}
                  >
                    <Ionicons name="add" size={18} color={name.trim() && cash >= setupCost ? Colors.white : Colors.textMuted} />
                  </Pressable>
                </View>
              </GameCard>
            ) : (
              <Pressable style={styles.createAnotherButton} onPress={() => setShowCreateHolding(true)}>
                <Ionicons name="add-circle-outline" size={17} color={Colors.info} />
                <Text style={styles.createAnotherText}>Create another holding</Text>
              </Pressable>
            )}

            {summaries.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.holdingSelector}>
                {summaries.map((summary) => {
                  const active = summary.holding.id === (selectedHoldingId ?? summaries[0]?.holding.id);
                  return (
                    <Pressable
                      key={summary.holding.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => { setSelectedHoldingId(summary.holding.id); setHoldingView('overview'); }}
                      style={[styles.holdingSelectorChip, active && styles.holdingSelectorChipActive]}
                    >
                      <Ionicons name="business-outline" size={14} color={active ? Colors.info : Colors.textMuted} />
                      <Text style={[styles.holdingSelectorText, active && styles.holdingSelectorTextActive]} numberOfLines={1}>
                        {summary.holding.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {holdingView === 'overview' && !!selectedSummary?.quarterlyManagementReport && !!selectedSummary?.annualManagementReport && (
              <View style={styles.reportingToolbar}>
                <View>
                  <Text style={styles.reportingToolbarTitle}>Group reporting period</Text>
                  <Text style={styles.reportingToolbarMeta}>Applied to every holding-company management report.</Text>
                </View>
                <View style={styles.reportingTabs}>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8 }}
                    onPress={() => setManagementReportPeriod('quarter')}
                    style={[styles.reportingTab, managementReportPeriod === 'quarter' && styles.reportingTabActive]}
                  >
                    <Text style={[styles.reportingTabText, managementReportPeriod === 'quarter' && { color: Colors.info }]}>Quarter</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8 }}
                    onPress={() => setManagementReportPeriod('annual')}
                    style={[styles.reportingTab, managementReportPeriod === 'annual' && styles.reportingTabActive]}
                  >
                    <Text style={[styles.reportingTabText, managementReportPeriod === 'annual' && { color: Colors.info }]}>Annual</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {summaries.length === 0 ? (
              <GameCard>
                <Text style={styles.emptyTitle}>No holding companies yet</Text>
                <Text style={styles.emptyText}>
                  Create one when you want acquisitions and family businesses managed as a single dynasty portfolio.
                </Text>
              </GameCard>
            ) : visibleSummaries.map(({
              holding, subsidiaries, subsidiaryCount, totalValue, totalDebt, netGroupEquity, ownerNetEquity, weeklyProfit,
              cashReserve, ownerGroupValue, totalCapitalDeployed, totalHoldingInflows, totalDividendsReceived,
              totalManagementFeesCollected, totalOwnerDistributions, reserveTargetWeeks, reserveTarget, availableDistributionCash,
              familyControlledPct, protectedAssets, avgRevenueSynergy, avgExpenseSynergy, diversification,
              sharedServiceEffects, managementFeeEligibleCount, quarterlyManagementReport, annualManagementReport,
            }) => {
              const visibleSubsidiaries = filterAndSortHoldingSubsidiaries(
                subsidiaries,
                inflationMultiplier,
                companyFilter,
                companySort,
              );
              const attentionSummary = getHoldingSubsidiaryAttentionSummary(
                subsidiaries,
                inflationMultiplier,
              );
              const attentionCount = attentionSummary.attention;
              const attentionShortcuts: Array<{
                key: HoldingSubsidiaryFilter;
                label: string;
                count: number;
                icon: React.ComponentProps<typeof Ionicons>['name'];
                color: string;
              }> = [
                { key: 'critical', label: 'Critical', count: attentionSummary.critical, icon: 'alert-circle-outline', color: Colors.negative },
                { key: 'watch', label: 'Watch', count: attentionSummary.watch, icon: 'warning-outline', color: Colors.warning },
                { key: 'loss', label: 'Loss', count: attentionSummary.loss, icon: 'trending-down-outline', color: Colors.negative },
                { key: 'reserve', label: 'Reserve', count: attentionSummary.reserve, icon: 'shield-outline', color: Colors.warning },
                { key: 'debt', label: 'Debt', count: attentionSummary.debt, icon: 'card-outline', color: Colors.info },
              ];
              const activeFilterLabel = COMPANY_FILTER_OPTIONS.find((option) => option.key === companyFilter)?.label ?? 'All companies';
              const activeSortLabel = COMPANY_SORT_OPTIONS.find((option) => option.key === companySort)?.label ?? 'Attention first';

              return (
              <GameCard key={holding.id}>
                <View style={styles.holdingHeader}>
                  <View style={styles.holdingIcon}>
                    <Ionicons name="business" size={22} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.holdingName}>{holding.name}</Text>
                    <Text style={styles.holdingMeta}>
                      Controller: {holding.controllerName} • Dynasty G{holding.generationsOwned}
                    </Text>
                  </View>
                </View>

                <ScreenTabs
                  items={[
                    { key: 'overview', label: 'Overview', icon: 'speedometer-outline' },
                    { key: 'services', label: 'Services', icon: 'git-network-outline' },
                    { key: 'subsidiaries', label: 'Companies', icon: 'business-outline' },
                  ]}
                  activeKey={holdingView}
                  onChange={setHoldingView}
                  accentColor={Colors.info}
                />

                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Group Value</Text>
                    <Text style={styles.statValue}>{formatCurrency(totalValue)}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Group Debt</Text>
                    <Text style={[styles.statValue, { color: totalDebt > 0 ? Colors.warning : Colors.textPrimary }]}>{formatCurrency(totalDebt)}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Owner Equity</Text>
                    <Text style={styles.statValue}>{formatCurrency(ownerNetEquity)}</Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Subsidiaries</Text>
                    <Text style={styles.statValue}>{subsidiaryCount}</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Weekly P&L</Text>
                    <Text style={[styles.statValue, { color: weeklyProfit >= 0 ? Colors.primary : Colors.negative }]}>
                      {weeklyProfit >= 0 ? '+' : ''}{formatCurrency(weeklyProfit)}
                    </Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Cash Reserve</Text>
                    <Text style={[styles.statValue, { color: Colors.info }]}>{formatCurrency(cashReserve)}</Text>
                  </View>
                </View>

                {holdingView === 'overview' && (
                  <>
                <View style={styles.familyControl}>
                  <Ionicons name="people" size={14} color={Colors.warning} />
                  <Text style={styles.familyControlText}>
                    {Math.round(familyControlledPct)}% family-controlled • {protectedAssets} protected long-term asset{protectedAssets === 1 ? '' : 's'}
                  </Text>
                </View>

                <View style={styles.synergyBox}>
                  <Text style={styles.synergyTitle}>Group Synergies</Text>
                  <Text style={styles.synergyText}>
                    Avg. revenue +{(avgRevenueSynergy * 100).toFixed(1)}% • cost reduction {(avgExpenseSynergy * 100).toFixed(1)}% • crisis protection {(diversification * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.synergyHint}>
                    Same-industry subsidiaries improve purchasing efficiency. Related industries improve cross-selling. Three or more industries add diversification protection. Organic synergies scale with acquisition integration outcomes, and all bonuses are capped.
                  </Text>
                </View>

                {quarterlyManagementReport && annualManagementReport && (
                  <View style={styles.managementReportBox}>
                    <Text style={styles.synergyTitle}>Group Management Report</Text>
                    <Text style={styles.managementReportHint}>
                      Consolidated operating KPIs for corporate-scale subsidiaries in this holding.
                    </Text>
                    <CorporateGroupReportPanel
                      quarterlyReport={quarterlyManagementReport}
                      annualReport={annualManagementReport}
                      period={managementReportPeriod}
                      onPeriodChange={setManagementReportPeriod}
                      showPeriodToggle={false}
                      onCompanyPress={(businessId) => router.push(`/business/${businessId}`)}
                    />
                  </View>
                )}

                  </>
                )}

                {holdingView === 'services' && (
                  <>
                <View style={styles.servicesBox}>
                  <View style={styles.servicesHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.synergyTitle}>Shared Services</Text>
                      <Text style={styles.servicesMeta}>
                        {sharedServiceEffects.totalLevels}/15 levels • +{(sharedServiceEffects.revenueBonus * 100).toFixed(1)}% revenue • {(sharedServiceEffects.expenseReduction * 100).toFixed(1)}% cost reduction • {(sharedServiceEffects.crisisReduction * 100).toFixed(1)}% crisis protection
                      </Text>
                    </View>
                    <Ionicons name="git-network-outline" size={18} color={Colors.info} />
                  </View>
                  {(Object.keys(HOLDING_SHARED_SERVICE_DEFINITIONS) as HoldingSharedServiceId[]).map((serviceId) => {
                    const definition = HOLDING_SHARED_SERVICE_DEFINITIONS[serviceId];
                    const levels = normalizeHoldingSharedServices(holding.sharedServices);
                    const level = levels[serviceId];
                    const maxed = level >= HOLDING_SHARED_SERVICE_MAX_LEVEL;
                    const cost = getHoldingSharedServiceUpgradeCost(holding, serviceId, inflationMultiplier);
                    const economics = getHoldingSharedServiceUpgradeEconomics(
                      holding,
                      businesses,
                      serviceId,
                      inflationMultiplier,
                    );
                    const affordable = !maxed && cashReserve >= cost;
                    const paybackLabel = economics.paybackWeeks == null
                      ? 'No direct financial payback'
                      : economics.paybackWeeks > 999
                        ? '999+w payback'
                        : `~${economics.paybackWeeks}w payback`;
                    return (
                      <View key={serviceId} style={styles.serviceRow}>
                        <View style={styles.serviceIcon}>
                          <Ionicons name={definition.icon} size={16} color={maxed ? Colors.primary : Colors.info} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.serviceTitleRow}>
                            <Text style={styles.serviceName}>{definition.name}</Text>
                            <Text style={styles.serviceLevel}>Lv {level}/{HOLDING_SHARED_SERVICE_MAX_LEVEL}</Text>
                          </View>
                          <Text style={styles.serviceDesc}>{definition.description}</Text>
                          {!maxed && (
                            <Text style={styles.serviceEconomics}>
                              {economics.weeklyFinancialBenefit > 0
                                ? `~${formatCurrency(economics.weeklyFinancialBenefit)}/wk direct benefit • ${paybackLabel}`
                                : paybackLabel}
                              {economics.crisisReductionDelta > 0
                                ? ` • +${(economics.crisisReductionDelta * 100).toFixed(1)}% avg. crisis protection`
                                : ''}
                            </Text>
                          )}
                        </View>
                        <Pressable
                          disabled={!affordable}
                          style={[styles.serviceUpgrade, !affordable && styles.disabledAction, maxed && styles.serviceMaxed]}
                          onPress={() => showGameDialog({
                            title: `Upgrade ${definition.name}?`,
                            message: `Invest ${formatCurrency(cost)} from ${holding.name}'s reserve to raise ${definition.name} to level ${Math.min(HOLDING_SHARED_SERVICE_MAX_LEVEL, level + 1)}. Shared-service effects apply to every subsidiary in the group.`,
                            confirmText: 'Upgrade',
                            onConfirm: () => upgradeHoldingSharedService(holding.id, serviceId),
                          })}
                        >
                          <Text style={styles.serviceUpgradeText}>{maxed ? 'MAX' : formatCurrency(cost)}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>

                  </>
                )}

                {holdingView === 'overview' && (
                  <>
                <View style={styles.capitalBox}>
                  <View style={styles.capitalHeader}>
                    <View>
                      <Text style={styles.capitalTitle}>Holding Reserve</Text>
                      <Text style={styles.capitalMeta}>Fund the reserve, receive subsidiary cash flows, then redeploy or distribute capital.</Text>
                    </View>
                  </View>
                  <View style={styles.capitalLedgerGrid}>
                    <View style={styles.capitalLedgerItem}>
                      <Text style={styles.capitalLedgerLabel}>Owner Group Value</Text>
                      <Text style={[styles.capitalLedgerValue, { color: Colors.info }]}>{formatCurrency(ownerGroupValue)}</Text>
                    </View>
                    <View style={styles.capitalLedgerItem}>
                      <Text style={styles.capitalLedgerLabel}>Cumulative Deployed</Text>
                      <Text style={styles.capitalLedgerValue}>{formatCurrency(totalCapitalDeployed)}</Text>
                    </View>
                    <View style={styles.capitalLedgerItem}>
                      <Text style={styles.capitalLedgerLabel}>Upstreamed Cash</Text>
                      <Text style={[styles.capitalLedgerValue, { color: Colors.primary }]}>{formatCurrency(totalHoldingInflows)}</Text>
                    </View>
                    <View style={styles.capitalLedgerItem}>
                      <Text style={styles.capitalLedgerLabel}>Paid to Owner</Text>
                      <Text style={styles.capitalLedgerValue}>{formatCurrency(totalOwnerDistributions)}</Text>
                    </View>
                  </View>
                  <Text style={styles.capitalMeta}>
                    Upstream mix: {formatCurrency(totalDividendsReceived)} dividends • {formatCurrency(totalManagementFeesCollected)} management fees.
                  </Text>
                  <Text style={styles.transactionHint}>Personal cash → Holding reserve • tap an amount to preview.</Text>
                  <View style={styles.buttonRow}>
                    {CAPITAL_AMOUNTS.map((amount) => (
                      <Pressable
                        key={amount}
                        accessibilityRole="button"
                        accessibilityLabel={`Preview funding ${formatCurrency(amount)}`}
                        disabled={cash < amount}
                        onPress={() => previewTreasuryTransaction({
                          action: 'fund',
                          holdingId: holding.id,
                          holdingName: holding.name,
                          cashReserve,
                          reserveTarget,
                          amount,
                        })}
                        style={[styles.smallAction, cash < amount && styles.disabledAction]}
                      >
                        <Text style={styles.smallActionText}>+{formatCurrency(amount)}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.synergyTitle}>Reserve target</Text>
                  <Text style={styles.capitalMeta}>
                    Sets the cash floor protected from owner distributions. Strategic investments may still use the full Holding reserve.
                  </Text>
                  <View style={styles.reservePolicySummary}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reservePolicySummaryLabel}>Current protection</Text>
                      <Text style={styles.reservePolicySummaryValue}>
                        {reserveTargetWeeks > 0 ? `${reserveTargetWeeks} weeks • ${formatCurrency(reserveTarget)}` : 'Off'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reservePolicySummaryLabel}>Owner available</Text>
                      <Text style={styles.reservePolicySummaryValue}>{formatCurrency(availableDistributionCash)}</Text>
                    </View>
                  </View>
                  <View style={styles.reservePolicyGrid}>
                    {RESERVE_TARGET_WEEKS.map((weeks) => {
                      const active = reserveTargetWeeks === weeks;
                      const policyPreview = getHoldingReservePolicyPreview(holding, businesses, weeks);
                      const targetGap = Math.max(0, policyPreview.nextTarget - policyPreview.cashReserve);
                      const delta = policyPreview.distributionHeadroomDelta;
                      return (
                        <Pressable
                          key={weeks}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active, disabled: active }}
                          accessibilityLabel={
                            weeks === 0
                              ? `Reserve target off, owner distribution headroom ${formatCurrency(policyPreview.nextAvailableDistributionCash)}`
                              : `${weeks} week reserve target, protects ${formatCurrency(policyPreview.nextTarget)}, owner distribution headroom ${formatCurrency(policyPreview.nextAvailableDistributionCash)}`
                          }
                          disabled={active}
                          onPress={() => showGameDialog({
                            title: weeks === 0 ? 'Turn reserve protection off?' : `Set a ${weeks}-week reserve target?`,
                            message:
                              `Weekly subsidiary operating expenses: ${formatCurrency(policyPreview.weeklyOperatingExpenses)}\n`
                              + `Protected reserve: ${formatCurrency(policyPreview.currentTarget)} → ${formatCurrency(policyPreview.nextTarget)}\n`
                              + `Owner distribution headroom: ${formatCurrency(policyPreview.currentAvailableDistributionCash)} → ${formatCurrency(policyPreview.nextAvailableDistributionCash)}\n\n`
                              + (delta < 0
                                ? `This protects ${formatCurrency(Math.abs(delta))} more cash from owner distributions. `
                                : delta > 0
                                  ? `This releases ${formatCurrency(delta)} more cash for owner distributions. `
                                  : 'Owner distribution headroom is unchanged. ')
                              + (targetGap > 0
                                ? `The target is currently ${formatCurrency(targetGap)} above the Holding reserve, so owner distributions stay blocked until reserve cash rises above it. `
                                : '')
                              + 'Strategic Holding investments can still use the full reserve.',
                            confirmText: weeks === 0 ? 'Turn Off' : `Set ${weeks}w`,
                            cancelText: 'Back',
                            onConfirm: () => setHoldingReserveTargetWeeks(holding.id, weeks),
                          })}
                          style={[styles.reservePolicyOption, active && styles.reservePolicyOptionActive]}
                        >
                          <View style={styles.reservePolicyOptionHeader}>
                            <Text style={[styles.reservePolicyWeeks, active && styles.reservePolicyWeeksActive]}>
                              {weeks === 0 ? 'Off' : `${weeks} weeks`}
                            </Text>
                            {active && <Text style={styles.reservePolicyCurrent}>CURRENT</Text>}
                          </View>
                          <Text style={styles.reservePolicyAmount}>
                            {weeks === 0 ? 'No protected cash floor' : `Protect ${formatCurrency(policyPreview.nextTarget)}`}
                          </Text>
                          <Text style={styles.reservePolicyHeadroom}>
                            Owner available {formatCurrency(policyPreview.nextAvailableDistributionCash)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.synergyTitle}>Management fee</Text>
                  <Text style={styles.capitalMeta}>
                    0–3% of revenue for wholly owned subsidiaries only. Fees require a profitable week, are capped at 35% of pre-fee profit, and cannot touch protected company cash. Estimates below use the latest reported week and current balances.
                  </Text>
                  {(() => {
                    const currentFeePreview = getHoldingManagementFeePolicyPreview(
                      holding,
                      businesses,
                      inflationMultiplier,
                      holding.managementFeeRate ?? 0.01,
                    ).current;
                    return (
                      <View style={styles.managementFeeSummary}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reservePolicySummaryLabel}>Current policy</Text>
                          <Text style={styles.reservePolicySummaryValue}>{Math.round(currentFeePreview.rate * 100)}%</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reservePolicySummaryLabel}>Est. fee / week</Text>
                          <Text style={styles.reservePolicySummaryValue}>~{formatCurrency(currentFeePreview.estimatedFee)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reservePolicySummaryLabel}>Eligible</Text>
                          <Text style={styles.reservePolicySummaryValue}>{managementFeeEligibleCount}/{subsidiaryCount}</Text>
                        </View>
                      </View>
                    );
                  })()}
                  <View style={styles.reservePolicyGrid}>
                    {MANAGEMENT_FEE_RATES.map((rate) => {
                      const feePreview = getHoldingManagementFeePolicyPreview(
                        holding,
                        businesses,
                        inflationMultiplier,
                        rate,
                      );
                      const active = Math.abs(feePreview.currentRate - rate) < 0.0001;
                      const next = feePreview.next;
                      const delta = feePreview.estimatedFeeDelta;
                      return (
                        <Pressable
                          key={rate}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active, disabled: active }}
                          accessibilityLabel={`${Math.round(rate * 100)} percent management fee, estimated ${formatCurrency(next.estimatedFee)} per week`}
                          disabled={active}
                          onPress={() => showGameDialog({
                            title: `Set management fee to ${Math.round(rate * 100)}%?`,
                            message:
                              `Eligible wholly owned subsidiaries: ${next.eligibleCount}/${feePreview.subsidiaryCount}`
                              + (next.excludedMinorityCount > 0 ? ` • ${next.excludedMinorityCount} co-owned excluded` : '')
                              + `\nLatest eligible revenue: ${formatCurrency(next.eligibleRevenue)}\n`
                              + `Estimated fee: ${formatCurrency(feePreview.current.estimatedFee)} → ${formatCurrency(next.estimatedFee)}/wk\n\n`
                              + `At ${Math.round(rate * 100)}% before caps: ${formatCurrency(next.grossRevenueFee)}\n`
                              + `After 35% profit cap: ${formatCurrency(next.afterProfitCapFee)}`
                              + (next.profitCapReduction > 0 ? ` (-${formatCurrency(next.profitCapReduction)})` : '')
                              + `\nAfter protected cash limits: ${formatCurrency(next.estimatedFee)}`
                              + (next.reserveProtectionReduction > 0 ? ` (-${formatCurrency(next.reserveProtectionReduction)})` : '')
                              + `\n\n`
                              + (delta > 0
                                ? `About ${formatCurrency(delta)} more would be upstreamed on the latest reported numbers. `
                                : delta < 0
                                  ? `About ${formatCurrency(Math.abs(delta))} less would be upstreamed on the latest reported numbers. `
                                  : 'Estimated weekly fee income is unchanged. ')
                              + (next.profitLimitedCount > 0
                                ? `${next.profitLimitedCount} subsidiar${next.profitLimitedCount === 1 ? 'y is' : 'ies are'} limited by the profit cap. `
                                : '')
                              + (next.reserveLimitedCount > 0
                                ? `${next.reserveLimitedCount} subsidiar${next.reserveLimitedCount === 1 ? 'y is' : 'ies are'} limited by protected cash. `
                                : '')
                              + 'Actual next-week fees may differ as revenue, expenses and cash balances change.',
                            confirmText: rate === 0 ? 'Turn Off' : `Set ${Math.round(rate * 100)}%`,
                            cancelText: 'Back',
                            onConfirm: () => setHoldingManagementFeeRate(holding.id, rate),
                          })}
                          style={[
                            styles.reservePolicyOption,
                            active && styles.managementFeeOptionActive,
                          ]}
                        >
                          <View style={styles.reservePolicyOptionHeader}>
                            <Text style={[styles.reservePolicyWeeks, active && styles.managementFeeRateActive]}>
                              {Math.round(rate * 100)}%
                            </Text>
                            {active && <Text style={styles.managementFeeCurrent}>CURRENT</Text>}
                          </View>
                          <Text style={styles.managementFeeEstimate}>
                            ~{formatCurrency(next.estimatedFee)}/wk
                          </Text>
                          <Text style={styles.managementFeeDetail}>
                            {rate === 0
                              ? 'No management fee'
                              : next.reserveProtectionReduction > 0
                                ? `${formatCurrency(next.reserveProtectionReduction)} blocked by reserves`
                                : next.profitCapReduction > 0
                                  ? `${formatCurrency(next.profitCapReduction)} blocked by profit cap`
                                  : 'No current cap reduction'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.synergyTitle}>Owner distribution</Text>
                  <Text style={styles.capitalMeta}>
                    Available above reserve target: {formatCurrency(availableDistributionCash)}. Strategic investments may still use the full Holding reserve.
                  </Text>
                  <Text style={styles.transactionHint}>Holding reserve → personal cash • tap an amount to preview.</Text>
                  <View style={styles.buttonRow}>
                    {PAYOUT_AMOUNTS.map((amount) => (
                      <Pressable
                        key={amount}
                        accessibilityRole="button"
                        accessibilityLabel={`Preview owner distribution ${formatCurrency(amount)}`}
                        disabled={availableDistributionCash < amount}
                        onPress={() => previewTreasuryTransaction({
                          action: 'distribution',
                          holdingId: holding.id,
                          holdingName: holding.name,
                          cashReserve,
                          reserveTarget,
                          amount,
                        })}
                        style={[styles.smallAction, availableDistributionCash < amount && styles.disabledAction]}
                      >
                        <Text style={styles.smallActionText}>{formatCurrency(amount)}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {adultChildren.length > 0 && (
                  <View style={styles.governanceBox}>
                    <Text style={styles.synergyTitle}>Dynasty Management</Text>
                    <Text style={styles.governanceCurrent}>
                      Executive: {holding.executiveChildName ?? 'None'}{holding.executiveChildName ? ` • Performance ${Math.round(holding.executivePerformance ?? 50)}` : ''}
                    </Text>
                    <Text style={styles.governanceCurrent}>Planned successor: {holding.designatedSuccessorChildName ?? 'None'}</Text>
                    {adultChildren.map((child) => (
                      <View key={child.id} style={styles.childRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.childName}>{child.name}</Text>
                          <Text style={styles.childMeta}>{child.occupationTitle ?? 'Independent'} • Relationship {Math.round(child.parentRelationship ?? 75)}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={{ top: 8, bottom: 8 }}
                          disabled={(child.parentRelationship ?? 75) < 30}
                          style={[styles.roleButton, holding.executiveChildId === child.id && styles.roleButtonActive]}
                          onPress={() => appointChildToHolding(holding.id, child.id, 'executive')}
                        >
                          <Text style={styles.roleText}>Executive</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={{ top: 8, bottom: 8 }}
                          disabled={(child.parentRelationship ?? 75) < 30}
                          style={[styles.roleButton, holding.designatedSuccessorChildId === child.id && styles.roleButtonActive]}
                          onPress={() => appointChildToHolding(holding.id, child.id, 'successor')}
                        >
                          <Text style={styles.roleText}>Successor</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                  </>
                )}

                {holdingView === 'subsidiaries' && (
                  <>
                {subsidiaries.length === 0 && (
                  <View style={styles.emptySubsidiaries}>
                    <Ionicons name="business-outline" size={24} color={Colors.textMuted} />
                    <Text style={styles.emptySubsidiariesTitle}>No companies assigned yet</Text>
                    <Text style={styles.emptySubsidiariesText}>Assign an existing company below or acquire a new target for this holding.</Text>
                  </View>
                )}
                {subsidiaries.length > 0 && (
                  <View style={styles.companyAttentionSummary}>
                    <View style={styles.companyAttentionSummaryHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.companyAttentionSummaryTitle}>Holding attention</Text>
                        <Text style={styles.companyAttentionSummaryMeta}>
                          {attentionSummary.critical > 0
                            ? `${attentionSummary.critical} critical`
                            : attentionSummary.watch > 0
                              ? `${attentionSummary.watch} to watch`
                              : 'No active attention issues'}
                          {' • '}{attentionSummary.total} companies
                        </Text>
                      </View>
                      {attentionSummary.attention > 0 && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Show all ${attentionSummary.attention} companies needing attention`}
                          onPress={() => {
                            setCompanyFilter('attention');
                            setCompanySort('attention');
                            setCompanyControlOpen(null);
                          }}
                          style={[
                            styles.companyAttentionAllButton,
                            companyFilter === 'attention' && styles.companyAttentionAllButtonActive,
                          ]}
                        >
                          <Text style={[
                            styles.companyAttentionAllText,
                            companyFilter === 'attention' && styles.companyAttentionAllTextActive,
                          ]}>
                            Review {attentionSummary.attention}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.companyAttentionChips}
                    >
                      {attentionShortcuts.map((item) => {
                        const active = companyFilter === item.key;
                        return (
                          <Pressable
                            key={item.key}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active, disabled: item.count === 0 }}
                            accessibilityLabel={`${item.label}: ${item.count} companies`}
                            disabled={item.count === 0}
                            onPress={() => {
                              setCompanyFilter(item.key);
                              setCompanySort('attention');
                              setCompanyControlOpen(null);
                            }}
                            style={[
                              styles.companyAttentionChip,
                              { borderColor: item.count > 0 ? `${item.color}55` : Colors.cardBorder },
                              active && { backgroundColor: `${item.color}14`, borderColor: item.color },
                              item.count === 0 && styles.companyAttentionChipDisabled,
                            ]}
                          >
                            <Ionicons name={item.icon} size={12} color={item.count > 0 ? item.color : Colors.textMuted} />
                            <Text style={[styles.companyAttentionChipLabel, item.count > 0 && { color: item.color }]}>
                              {item.label}
                            </Text>
                            <Text style={[styles.companyAttentionChipCount, item.count > 0 && { color: item.color }]}>
                              {item.count}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {subsidiaries.length > 0 && (
                  <View style={styles.companyPortfolioToolbar}>
                    <View style={styles.companyPortfolioSummary}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.companyPortfolioTitle}>Portfolio view</Text>
                        <Text style={styles.companyPortfolioMeta}>
                          {visibleSubsidiaries.length}/{subsidiaries.length} shown
                          {attentionCount > 0 ? ` • ${attentionCount} need review` : ' • no active attention items'}
                        </Text>
                      </View>
                      {(companyFilter !== 'all' || companySort !== 'attention') && (
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            setCompanyFilter('all');
                            setCompanySort('attention');
                            setCompanyControlOpen(null);
                          }}
                          style={styles.companyResetButton}
                        >
                          <Text style={styles.companyResetText}>Reset</Text>
                        </Pressable>
                      )}
                    </View>

                    <View style={styles.companyControlRow}>
                      <View style={styles.companyControlWrap}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: companyControlOpen === 'filter' }}
                          onPress={() => setCompanyControlOpen((current) => current === 'filter' ? null : 'filter')}
                          style={[styles.companyControlButton, companyControlOpen === 'filter' && styles.companyControlButtonOpen]}
                        >
                          <Ionicons name="filter-outline" size={13} color={Colors.info} />
                          <Text style={styles.companyControlText} numberOfLines={1}>Filter: {activeFilterLabel}</Text>
                          <Ionicons name={companyControlOpen === 'filter' ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.textMuted} />
                        </Pressable>
                        {companyControlOpen === 'filter' && (
                          <View style={styles.companyDropdownMenu}>
                            {COMPANY_FILTER_OPTIONS.map((option) => {
                              const active = option.key === companyFilter;
                              return (
                                <Pressable
                                  key={option.key}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: active }}
                                  onPress={() => {
                                    setCompanyFilter(option.key);
                                    setCompanyControlOpen(null);
                                  }}
                                  style={[styles.companyDropdownOption, active && styles.companyDropdownOptionActive]}
                                >
                                  <Text style={[styles.companyDropdownText, active && styles.companyDropdownTextActive]}>{option.label}</Text>
                                  {active && <Ionicons name="checkmark" size={13} color={Colors.info} />}
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>

                      <View style={styles.companyControlWrap}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded: companyControlOpen === 'sort' }}
                          onPress={() => setCompanyControlOpen((current) => current === 'sort' ? null : 'sort')}
                          style={[styles.companyControlButton, companyControlOpen === 'sort' && styles.companyControlButtonOpen]}
                        >
                          <Ionicons name="swap-vertical-outline" size={13} color={Colors.info} />
                          <Text style={styles.companyControlText} numberOfLines={1}>Sort: {activeSortLabel}</Text>
                          <Ionicons name={companyControlOpen === 'sort' ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.textMuted} />
                        </Pressable>
                        {companyControlOpen === 'sort' && (
                          <View style={styles.companyDropdownMenu}>
                            {COMPANY_SORT_OPTIONS.map((option) => {
                              const active = option.key === companySort;
                              return (
                                <Pressable
                                  key={option.key}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: active }}
                                  onPress={() => {
                                    setCompanySort(option.key);
                                    setCompanyControlOpen(null);
                                  }}
                                  style={[styles.companyDropdownOption, active && styles.companyDropdownOptionActive]}
                                >
                                  <Text style={[styles.companyDropdownText, active && styles.companyDropdownTextActive]}>{option.label}</Text>
                                  {active && <Ionicons name="checkmark" size={13} color={Colors.info} />}
                                </Pressable>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                {subsidiaries.length > 0 && visibleSubsidiaries.length === 0 && (
                  <View style={styles.companyFilterEmpty}>
                    <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
                    <Text style={styles.companyFilterEmptyTitle}>No companies match this filter</Text>
                    <Text style={styles.companyFilterEmptyText}>Choose another filter or reset the portfolio view.</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setCompanyFilter('all');
                        setCompanyControlOpen(null);
                      }}
                      style={styles.companyFilterEmptyButton}
                    >
                      <Text style={styles.companyFilterEmptyButtonText}>Show all companies</Text>
                    </Pressable>
                  </View>
                )}

                {visibleSubsidiaries.map((business) => {
                  const allocationAmount = subsidiaryAllocationAmounts[business.id] ?? 1_000_000;
                  const capitalPreview = getHoldingCapitalAllocationPreview(
                    business,
                    allocationAmount,
                    inflationMultiplier,
                  );
                  const debt = capitalPreview.debt.principalBefore;
                  const acquisitionReturn = getAcquisitionReturn(business);
                  const canAllocateGrowth = cashReserve >= allocationAmount;
                  const canAllocateDebt = capitalPreview.debt.cashUsed > 0
                    && cashReserve >= capitalPreview.debt.cashUsed;
                  const growthHoldingCashAfter = Math.max(0, cashReserve - allocationAmount);
                  const debtHoldingCashAfter = Math.max(0, cashReserve - capitalPreview.debt.cashUsed);
                  const growthFundingGap = Math.max(0, allocationAmount - cashReserve);
                  const debtFundingGap = Math.max(0, capitalPreview.debt.cashUsed - cashReserve);
                  const health = getHoldingSubsidiaryHealthSnapshot(business, inflationMultiplier);
                  const attentionAction = getHoldingSubsidiaryAttentionAction(business, inflationMultiplier);
                  const attentionColor = health.attention === 'critical'
                    ? Colors.negative
                    : health.attention === 'watch'
                      ? Colors.warning
                      : Colors.primary;
                  const managementMode = business.delegationPolicy && business.delegationPolicy !== 'manual'
                    ? BUSINESS_DELEGATION_POLICIES[business.delegationPolicy].label
                    : 'Manual';
                  const managers = getDelegationManagers(business);
                  const selectedManagerId = managerSelections[business.id]
                    ?? business.delegatedManagerEmployeeId
                    ?? managers[0]?.id
                    ?? '';
                  const expanded = expandedSubsidiaryId === business.id;
                  const growthFocused = focusedAllocation?.businessId === business.id && focusedAllocation.mode === 'growth';
                  const debtFocused = focusedAllocation?.businessId === business.id && focusedAllocation.mode === 'debt';
                  return (
                    <View key={business.id} style={styles.subsidiaryBlock}>
                      <View style={styles.subsidiaryRow}>
                        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/business/${business.id}`)}>
                          <View style={styles.subsidiaryTitleRow}>
                            <Text style={styles.subsidiaryName} numberOfLines={1}>{business.name}</Text>
                            <View style={[styles.subsidiaryAttentionPill, { borderColor: `${attentionColor}66`, backgroundColor: `${attentionColor}12` }]}>
                              <View style={[styles.subsidiaryAttentionDot, { backgroundColor: attentionColor }]} />
                              <Text style={[styles.subsidiaryAttentionText, { color: attentionColor }]}>
                                {health.attention === 'critical' ? 'Attention' : health.attention === 'watch' ? 'Watch' : 'Stable'}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.subsidiaryMeta}>
                            {formatCurrency(business.valuation ?? 0)}
                            {acquisitionReturn ? ` • owner ${acquisitionReturn.playerOwnershipPct.toFixed(0)}%` : ''}
                          </Text>

                          <View style={styles.subsidiaryHealthRow}>
                            <View style={styles.subsidiaryHealthChip}>
                              <Ionicons name="cash-outline" size={11} color={health.cash < 0 ? Colors.negative : Colors.textMuted} />
                              <Text style={[styles.subsidiaryHealthText, health.cash < 0 && { color: Colors.negative }]}>
                                {formatCurrency(health.cash)}
                              </Text>
                            </View>
                            <View style={styles.subsidiaryHealthChip}>
                              <Ionicons name={health.weeklyProfit >= 0 ? 'trending-up-outline' : 'trending-down-outline'} size={11} color={health.weeklyProfit >= 0 ? Colors.primary : Colors.negative} />
                              <Text style={[styles.subsidiaryHealthText, { color: health.weeklyProfit >= 0 ? Colors.primary : Colors.negative }]}>
                                {health.weeklyProfit >= 0 ? '+' : ''}{formatCurrency(health.weeklyProfit)}/wk
                              </Text>
                            </View>
                            {health.debtPrincipal > 0 && (
                              <View style={styles.subsidiaryHealthChip}>
                                <Ionicons name="card-outline" size={11} color={Colors.info} />
                                <Text style={styles.subsidiaryHealthText}>Debt {formatCurrency(health.debtPrincipal)}</Text>
                              </View>
                            )}
                            <View style={[
                              styles.subsidiaryHealthChip,
                              health.protectedCashGap > 0 && styles.subsidiaryHealthChipWarning,
                            ]}>
                              <Ionicons
                                name={health.protectedCashGap > 0 ? 'shield-outline' : 'shield-checkmark-outline'}
                                size={11}
                                color={health.protectedCashGap > 0 ? Colors.warning : Colors.primary}
                              />
                              <Text style={[styles.subsidiaryHealthText, { color: health.protectedCashGap > 0 ? Colors.warning : Colors.primary }]}>
                                {health.protectedCashGap > 0
                                  ? `Reserve ${Math.round(health.protectedCashCoverage * 100)}%`
                                  : 'Reserve OK'}
                              </Text>
                            </View>
                            <View style={styles.subsidiaryHealthChip}>
                              <Ionicons
                                name={managementMode === 'Manual' ? 'hand-left-outline' : 'briefcase-outline'}
                                size={11}
                                color={managementMode === 'Manual' ? Colors.textMuted : Colors.info}
                              />
                              <Text style={styles.subsidiaryHealthText}>{managementMode}</Text>
                            </View>
                          </View>

                          {health.attentionReasons.length > 0 && (
                            <Text style={[styles.subsidiaryAttentionReason, { color: attentionColor }]} numberOfLines={2}>
                              {health.attention === 'critical' ? 'Needs attention' : 'Watch'}: {health.attentionReasons.join(' • ')}
                            </Text>
                          )}
                          {acquisitionReturn && (
                            <Text style={[styles.returnText, { color: acquisitionReturn.returnPct >= 0 ? Colors.primary : Colors.negative }]}>
                              Owner return: {acquisitionReturn.returnPct >= 0 ? '+' : ''}{acquisitionReturn.returnPct.toFixed(1)}%
                            </Text>
                          )}
                          {business.portfolioIntent === 'long_term_family' && (
                            <Text style={styles.longTermText}>◆ Protected long-term family asset</Text>
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() => {
                            setFocusedAllocation(null);
                            setExpandedSubsidiaryId(expanded ? null : business.id);
                          }}
                          hitSlop={8}
                          style={styles.subsidiaryManageButton}
                        >
                          <Ionicons name={expanded ? 'chevron-up' : 'options-outline'} size={18} color={expanded ? Colors.info : Colors.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => assignBusinessToHolding(business.id, null)} hitSlop={10} style={styles.removeButton}>
                          <Ionicons name="remove-circle-outline" size={19} color={Colors.textMuted} />
                        </Pressable>
                      </View>

                      {attentionAction && (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${attentionAction.label} for ${business.name}`}
                          onPress={() => {
                            setCompanyControlOpen(null);
                            if (attentionAction.kind === 'holding_capital') {
                              setFocusedAllocation({ businessId: business.id, mode: attentionAction.focus });
                              setExpandedSubsidiaryId(business.id);
                              return;
                            }
                            if (attentionAction.kind === 'business_overview') {
                              router.push(`/business/${business.id}?section=overview&focus=${attentionAction.focus}`);
                              return;
                            }
                            router.push(`/business/${business.id}?section=finance&focus=${attentionAction.focus}`);
                          }}
                          style={[
                            styles.subsidiaryAttentionAction,
                            attentionAction.kind === 'holding_capital'
                              ? styles.subsidiaryAttentionActionHolding
                              : styles.subsidiaryAttentionActionBusiness,
                          ]}
                        >
                          <Ionicons
                            name={attentionAction.kind === 'holding_capital'
                              ? attentionAction.focus === 'debt' ? 'card-outline' : 'add-circle-outline'
                              : attentionAction.kind === 'business_finance'
                                ? 'cash-outline'
                                : 'open-outline'}
                            size={14}
                            color={attentionAction.kind === 'holding_capital' && attentionAction.focus === 'growth' ? Colors.primary : Colors.info}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[
                              styles.subsidiaryAttentionActionTitle,
                              { color: attentionAction.kind === 'holding_capital' && attentionAction.focus === 'growth' ? Colors.primary : Colors.info },
                            ]}>
                              {attentionAction.label}
                            </Text>
                            <Text style={styles.subsidiaryAttentionActionDetail}>{attentionAction.detail}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                        </Pressable>
                      )}

                      {expanded && (
                        <>
                      <View style={styles.capitalAllocationBox}>
                        <View style={styles.capitalAllocationHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.capitalAllocationTitle}>Capital Allocation</Text>
                            <Text style={styles.capitalAllocationMeta}>
                              Holding reserve {formatCurrency(cashReserve)} • choose a maximum allocation.
                            </Text>
                          </View>
                        </View>
                        <View style={styles.allocationAmountRow}>
                          {SUBSIDIARY_ALLOCATION_AMOUNTS.map((amount) => {
                            const active = allocationAmount === amount;
                            return (
                              <Pressable
                                key={amount}
                                accessibilityRole="button"
                                accessibilityState={{ selected: active }}
                                onPress={() => setSubsidiaryAllocationAmounts((current) => ({
                                  ...current,
                                  [business.id]: amount,
                                }))}
                                style={[styles.allocationAmountChip, active && styles.allocationAmountChipActive]}
                              >
                                <Text style={[styles.allocationAmountText, active && styles.allocationAmountTextActive]}>
                                  {formatCurrency(amount)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <View style={styles.allocationComparisonRow}>
                          <View style={[
                            styles.allocationChoiceCard,
                            styles.growthChoiceCard,
                            growthFocused && styles.growthChoiceCardFocused,
                          ]}>
                            <View style={styles.allocationChoiceHeader}>
                              <View style={styles.allocationChoiceIcon}>
                                <Ionicons name="trending-up-outline" size={16} color={Colors.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={styles.allocationChoiceTitleRow}>
                                  <Text style={styles.allocationChoiceTitle}>Growth Capital</Text>
                                  {growthFocused && <Text style={[styles.allocationFocusLabel, { color: Colors.primary }]}>FOCUS</Text>}
                                </View>
                                <Text style={styles.allocationChoiceSubtitle}>Liquidity & runway</Text>
                              </View>
                            </View>

                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Holding use</Text>
                              <Text style={styles.allocationMetricValue}>{formatCurrency(allocationAmount)}</Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Holding after</Text>
                              <Text style={styles.allocationMetricValue}>{formatCurrency(growthHoldingCashAfter)}</Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Company cash after</Text>
                              <Text style={styles.allocationMetricValue}>{formatCurrency(capitalPreview.growth.postBalance)}</Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Runway gained</Text>
                              <Text style={[styles.allocationMetricValue, { color: Colors.primary }]}>
                                {capitalPreview.growth.additionalRunwayWeeks == null
                                  ? 'Liquidity added'
                                  : `+${capitalPreview.growth.additionalRunwayWeeks.toFixed(1)}w`}
                              </Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Protected cash</Text>
                              <Text style={styles.allocationMetricValue}>
                                {capitalPreview.growth.reserveGapAfter > 0
                                  ? `Gap ${formatCurrency(capitalPreview.growth.reserveGapAfter)}`
                                  : `+${formatCurrency(capitalPreview.growth.cashAboveProtected)} above`}
                              </Text>
                            </View>
                            {capitalPreview.growth.reserveGapBefore > 0 && (
                              <Text style={styles.allocationChoiceHint}>
                                Closes {formatCurrency(capitalPreview.growth.reserveGapReduction)} of the reserve gap
                                {' • '}{Math.round(capitalPreview.growth.protectedCoverageAfter * 100)}% protected-cash coverage after.
                              </Text>
                            )}
                            {capitalPreview.growth.minorityValueTransfer > 0 && (
                              <Text style={styles.allocationMinorityWarning}>
                                ~{formatCurrency(capitalPreview.growth.minorityValueTransfer)} of added equity value accrues to minority owners.
                              </Text>
                            )}
                            {!canAllocateGrowth && (
                              <Text style={styles.allocationUnavailable}>
                                Need {formatCurrency(growthFundingGap)} more Holding cash.
                              </Text>
                            )}
                            <Pressable
                              accessibilityRole="button"
                              disabled={!canAllocateGrowth}
                              onPress={() => showGameDialog({
                                title: `Allocate ${formatCurrency(allocationAmount)} growth capital to ${business.name}?`,
                                message: `Holding reserve: ${formatCurrency(cashReserve)} → ${formatCurrency(growthHoldingCashAfter)}\nCompany cash: ${formatCurrency(business.balance ?? 0)} → ${formatCurrency(capitalPreview.growth.postBalance)}\n${capitalPreview.growth.additionalRunwayWeeks == null ? 'This adds liquidity.' : `Runway gained: about ${capitalPreview.growth.additionalRunwayWeeks.toFixed(1)} weeks of current operating expenses.`}\n${capitalPreview.growth.reserveGapAfter > 0 ? `Protected-cash gap after funding: ${formatCurrency(capitalPreview.growth.reserveGapAfter)}.` : `Cash above protected level after funding: ${formatCurrency(capitalPreview.growth.cashAboveProtected)}.`}\n\nGrowth capital increases tracked owner investment basis but does not directly increase revenue by itself.${capitalPreview.growth.minorityValueTransfer > 0 ? ` Other shareholders own ${capitalPreview.ownership.minorityOwnershipPct.toFixed(1)}%, so roughly ${formatCurrency(capitalPreview.growth.minorityValueTransfer)} of the added equity value accrues to those stakes.` : ''}`,
                                confirmText: 'Allocate Growth',
                                onConfirm: () => allocateHoldingCapital(holding.id, business.id, allocationAmount, 'capital'),
                              })}
                              style={[styles.allocationChoiceButton, styles.growthChoiceButton, !canAllocateGrowth && styles.disabledAction]}
                            >
                              <Text style={styles.allocationChoiceButtonText}>Allocate Growth</Text>
                            </Pressable>
                          </View>

                          <View style={[
                            styles.allocationChoiceCard,
                            styles.debtChoiceCard,
                            debtFocused && styles.debtChoiceCardFocused,
                          ]}>
                            <View style={styles.allocationChoiceHeader}>
                              <View style={[styles.allocationChoiceIcon, styles.debtChoiceIcon]}>
                                <Ionicons name="card-outline" size={16} color={Colors.info} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <View style={styles.allocationChoiceTitleRow}>
                                  <Text style={styles.allocationChoiceTitle}>Debt Paydown</Text>
                                  {debtFocused && <Text style={[styles.allocationFocusLabel, { color: Colors.info }]}>FOCUS</Text>}
                                </View>
                                <Text style={styles.allocationChoiceSubtitle}>Lower financing burden</Text>
                              </View>
                            </View>

                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Holding use</Text>
                              <Text style={styles.allocationMetricValue}>{formatCurrency(capitalPreview.debt.cashUsed)}</Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Holding after</Text>
                              <Text style={styles.allocationMetricValue}>{formatCurrency(debtHoldingCashAfter)}</Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Principal</Text>
                              <Text style={styles.allocationMetricValue}>
                                {formatCurrency(capitalPreview.debt.principalBefore)} → {formatCurrency(capitalPreview.debt.principalAfter)}
                              </Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Debt service</Text>
                              <Text style={[styles.allocationMetricValue, { color: Colors.info }]}>
                                -{formatCurrency(capitalPreview.debt.weeklyDebtServiceReduction)}/wk
                              </Text>
                            </View>
                            <View style={styles.allocationMetric}>
                              <Text style={styles.allocationMetricLabel}>Interest avoided</Text>
                              <Text style={styles.allocationMetricValue}>{formatCurrency(capitalPreview.debt.futureInterestAvoided)}</Text>
                            </View>
                            {capitalPreview.debt.cashUsed > 0 && (
                              <Text style={styles.allocationChoiceHint}>
                                Repays {Math.round(capitalPreview.debt.principalReductionPct * 100)}% of current principal.
                                {capitalPreview.debt.cashUsed < allocationAmount ? ` Only ${formatCurrency(capitalPreview.debt.cashUsed)} is needed from the selected ${formatCurrency(allocationAmount)} cap.` : ''}
                              </Text>
                            )}
                            {capitalPreview.debt.minorityValueTransfer > 0 && (
                              <Text style={styles.allocationMinorityWarning}>
                                ~{formatCurrency(capitalPreview.debt.minorityValueTransfer)} of equity benefit accrues to minority owners.
                              </Text>
                            )}
                            {debt <= 0 ? (
                              <Text style={styles.allocationUnavailable}>No subsidiary debt outstanding.</Text>
                            ) : debtFundingGap > 0 ? (
                              <Text style={styles.allocationUnavailable}>
                                Need {formatCurrency(debtFundingGap)} more Holding cash.
                              </Text>
                            ) : null}
                            <Pressable
                              accessibilityRole="button"
                              disabled={!canAllocateDebt || debt <= 0}
                              onPress={() => showGameDialog({
                                title: `Repay debt for ${business.name}?`,
                                message: `Holding reserve: ${formatCurrency(cashReserve)} → ${formatCurrency(debtHoldingCashAfter)}\nPrincipal: ${formatCurrency(capitalPreview.debt.principalBefore)} → ${formatCurrency(capitalPreview.debt.principalAfter)}\nWeekly debt service: ${formatCurrency(capitalPreview.debt.weeklyDebtServiceBefore)} → ${formatCurrency(capitalPreview.debt.weeklyDebtServiceAfter)}\nFuture scheduled interest avoided: about ${formatCurrency(capitalPreview.debt.futureInterestAvoided)}.\n\nOnly the actual payoff amount, ${formatCurrency(capitalPreview.debt.cashUsed)}, leaves the Holding reserve.${capitalPreview.debt.minorityValueTransfer > 0 ? ` Other shareholders own ${capitalPreview.ownership.minorityOwnershipPct.toFixed(1)}%, so roughly ${formatCurrency(capitalPreview.debt.minorityValueTransfer)} of the equity benefit accrues to those stakes.` : ''}`,
                                confirmText: 'Repay Debt',
                                onConfirm: () => allocateHoldingCapital(holding.id, business.id, allocationAmount, 'debt'),
                              })}
                              style={[styles.allocationChoiceButton, styles.debtChoiceButton, (!canAllocateDebt || debt <= 0) && styles.disabledAction]}
                            >
                              <Text style={styles.allocationChoiceButtonText}>Repay Debt</Text>
                            </Pressable>
                          </View>
                        </View>

                        {capitalPreview.ownership.minorityOwnershipPct > 0.001 && (
                          <View style={styles.allocationOwnershipBanner}>
                            <Ionicons name="people-outline" size={14} color={Colors.warning} />
                            <Text style={styles.allocationOwnershipText}>
                              Other shareholders own {capitalPreview.ownership.minorityOwnershipPct.toFixed(1)}%. Compare minority value transfer before allocating Holding capital.
                            </Text>
                          </View>
                        )}
                      </View>
                      {business.familyBusiness?.isFamilyBusiness && (
                        <View style={styles.familyAssetActionRow}>
                          <Pressable
                            onPress={() => toggleLongTermFamilyAsset(business.id)}
                            style={[styles.smallAction, business.portfolioIntent === 'long_term_family' && styles.protectedAction]}
                          >
                            <Text style={styles.smallActionText}>{business.portfolioIntent === 'long_term_family' ? 'Unprotect Family Asset' : 'Mark Long-term Family Asset'}</Text>
                          </Pressable>
                        </View>
                      )}

                      <View style={styles.delegationBox}>
                        <View style={styles.delegationHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.delegationTitle}>Management Delegation</Text>
                            <Text style={styles.delegationMeta}>
                              {business.delegationPolicy && business.delegationPolicy !== 'manual'
                                ? `${business.delegatedManagerName ?? 'Manager'} • ${BUSINESS_DELEGATION_POLICIES[business.delegationPolicy].label}`
                                : 'Manual control'}
                            </Text>
                          </View>
                          <Ionicons
                            name={business.delegationPolicy && business.delegationPolicy !== 'manual' ? 'briefcase' : 'hand-left-outline'}
                            size={16}
                            color={business.delegationPolicy && business.delegationPolicy !== 'manual' ? Colors.primary : Colors.textMuted}
                          />
                        </View>

                        {managers.length === 0 ? (
                          <Text style={styles.delegationWarning}>Hire a Manager or Supervisor before delegating routine operations.</Text>
                        ) : (
                          <>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.managerChips}>
                              {managers.map((manager) => {
                                const active = selectedManagerId === manager.id;
                                const effectiveness = getDelegationManagerEffectiveness(manager);
                                return (
                                  <Pressable
                                    key={manager.id}
                                    accessibilityRole="button"
                                    hitSlop={{ top: 8, bottom: 8 }}
                                    onPress={() => setManagerSelections((current) => ({ ...current, [business.id]: manager.id }))}
                                    style={[styles.managerChip, active && styles.managerChipActive]}
                                  >
                                    <Text style={[styles.managerChipText, active && styles.managerChipTextActive]}>
                                      {manager.name} • {manager.roleId === 'manager' ? 'Manager' : 'Supervisor'} • {effectiveness.label} {effectiveness.score}
                                    </Text>
                                    <Text style={[styles.managerChipMeta, active && styles.managerChipMetaActive]}>
                                      {effectiveness.reviewWeeks}w review • {effectiveness.staffingAdjustment >= 0 ? '+' : ''}{Math.round(effectiveness.staffingAdjustment * 100)}% staffing • max {effectiveness.maxAdvertising} ads
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </ScrollView>
                            <View style={styles.policyRow}>
                              {(Object.keys(BUSINESS_DELEGATION_POLICIES) as BusinessDelegationPolicy[]).map((policy) => {
                                const active = (business.delegationPolicy ?? 'manual') === policy;
                                return (
                                  <Pressable
                                    key={policy}
                                    accessibilityRole="button"
                                    hitSlop={{ top: 8, bottom: 8 }}
                                    onPress={() => setBusinessDelegation(
                                      business.id,
                                      policy,
                                      policy === 'manual' ? null : selectedManagerId,
                                    )}
                                    style={[styles.policyChip, active && styles.policyChipActive]}
                                  >
                                    <Text style={[styles.policyChipText, active && styles.policyChipTextActive]}>
                                      {BUSINESS_DELEGATION_POLICIES[policy].label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </>
                        )}
                        <Text style={styles.delegationHint}>
                          Delegation reviews routine pricing, advertising and staffing every 4 weeks. Strategic decisions, crises, acquisitions, ownership and succession always remain manual.
                        </Text>
                        {!!business.lastDelegationSummary && (
                          <Text style={styles.delegationSummary}>Last review: {business.lastDelegationSummary}</Text>
                        )}
                      </View>
                        </>
                      )}
                    </View>
                  );
                })}
                  </>
                )}
              </GameCard>
              );
            })}

            {holdingView === 'subsidiaries' && holdings.length > 0 && unassigned.length > 0 && (
              <GameCard>
                <Text style={styles.sectionTitle}>Unassigned Companies</Text>
                <Text style={styles.sectionSub}>Move existing businesses into a group to activate portfolio synergies.</Text>
                {unassigned.map((business) => (
                  <View key={business.id} style={styles.assignmentBlock}>
                    <Text style={styles.assignmentName}>{business.name}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignmentChips}>
                      {holdings.map((holding) => (
                        <Pressable
                          key={holding.id}
                          onPress={() => assignBusinessToHolding(business.id, holding.id)}
                          style={styles.assignmentChip}
                        >
                          <Ionicons name="arrow-forward-circle" size={14} color={Colors.primary} />
                          <Text style={styles.assignmentChipText}>{holding.name}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </GameCard>
            )}

            <Pressable style={styles.marketButton} onPress={() => router.push('/business/acquisitions')}>
              <Ionicons name="trending-up" size={20} color={Colors.white} />
              <Text style={styles.marketButtonText}>Browse Acquisition Targets</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <FeatureTourModal
        visible={showHoldingsTour}
        title="Holdings cash basics"
        steps={HOLDINGS_TOUR_STEPS}
        onClose={() => setShowHoldingsTour(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerSide: { width: 44, minHeight: 28, justifyContent: 'center', alignItems: 'flex-start' },
  headerSideRight: { alignItems: 'flex-end' },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 6 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 36 },
  holdingSelector: { gap: 7, paddingBottom: 10, paddingRight: 6 },
  holdingSelectorChip: { maxWidth: 190, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  holdingSelectorChipActive: { borderColor: `${Colors.info}66`, backgroundColor: `${Colors.info}12` },
  holdingSelectorText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '800', maxWidth: 145 },
  holdingSelectorTextActive: { color: Colors.info },
  introHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: { width: 44, height: 44, borderRadius: 11, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  introTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  introText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 4 },
  locked: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  lockedTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  lockedText: { color: Colors.textSecondary, fontSize: 12 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  createHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  createAnotherButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: `${Colors.info}55`, backgroundColor: `${Colors.info}0D`, borderRadius: 10, marginBottom: 10 },
  createAnotherText: { color: Colors.info, fontSize: 11, fontWeight: '800' },
  sectionSub: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  reportingToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 11, padding: 10 },
  reportingToolbarTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900' },
  reportingToolbarMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  reportingTabs: { flexDirection: 'row', padding: 2, backgroundColor: Colors.elevated, borderRadius: 9 },
  reportingTab: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  reportingTabActive: { backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.info}55` },
  reportingTabText: { color: Colors.textMuted, fontSize: 8, fontWeight: '900' },
  createRow: { flexDirection: 'row', gap: 9, marginTop: 12 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, paddingHorizontal: 12, color: Colors.textPrimary, backgroundColor: Colors.elevated },
  createButton: { width: 46, minHeight: 44, borderRadius: 10, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { backgroundColor: Colors.elevated },
  emptyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  emptyText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 5 },
  holdingHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  holdingIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#10382D', alignItems: 'center', justifyContent: 'center' },
  holdingName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  holdingMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 7, marginTop: 12 },
  stat: { flex: 1 },
  statLabel: { color: Colors.textMuted, fontSize: 9 },
  statValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 3 },
  familyControl: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 11, backgroundColor: '#33270F', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8 },
  familyControlText: { color: Colors.warning, fontSize: 10, fontWeight: '700', flex: 1 },
  synergyBox: { backgroundColor: Colors.elevated, borderRadius: 9, padding: 10, marginTop: 10 },
  synergyTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  synergyText: { color: Colors.primary, fontSize: 10, fontWeight: '700', marginTop: 5 },
  synergyHint: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 5 },
  managementReportBox: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 11, paddingTop: 10 },
  managementReportHint: { color: Colors.textMuted, fontSize: 8, lineHeight: 12, marginTop: 3, marginBottom: 8 },
  servicesBox: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 11, paddingTop: 10 },
  servicesHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  servicesMeta: { color: Colors.info, fontSize: 8, lineHeight: 12, marginTop: 3 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  serviceIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  serviceTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  serviceName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  serviceLevel: { color: Colors.info, fontSize: 8, fontWeight: '800' },
  serviceDesc: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  serviceEconomics: { color: Colors.info, fontSize: 8, lineHeight: 11, marginTop: 3 },
  serviceUpgrade: { minWidth: 72, borderRadius: 7, borderWidth: 1, borderColor: Colors.primary, backgroundColor: '#10382D', paddingHorizontal: 7, paddingVertical: 7, alignItems: 'center' },
  serviceMaxed: { borderColor: Colors.primary, opacity: 0.8 },
  serviceUpgradeText: { color: Colors.primary, fontSize: 8, fontWeight: '900' },
  capitalBox: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 11, paddingTop: 10 },
  capitalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capitalTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  capitalMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  transactionHint: { color: Colors.info, fontSize: 8, lineHeight: 12, marginTop: 7 },
  reservePolicySummary: { flexDirection: 'row', gap: 8, marginTop: 8, padding: 9, borderRadius: 8, backgroundColor: Colors.elevated },
  reservePolicySummaryLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '700' },
  reservePolicySummaryValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900', marginTop: 2 },
  reservePolicyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  reservePolicyOption: { width: '48%', minHeight: 72, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, backgroundColor: Colors.elevated, paddingHorizontal: 9, paddingVertical: 8 },
  reservePolicyOptionActive: { borderColor: Colors.warning, backgroundColor: '#33270F' },
  reservePolicyOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 5 },
  reservePolicyWeeks: { color: Colors.textSecondary, fontSize: 10, fontWeight: '900' },
  reservePolicyWeeksActive: { color: Colors.warning },
  reservePolicyCurrent: { color: Colors.warning, fontSize: 6, fontWeight: '900', letterSpacing: 0.4 },
  reservePolicyAmount: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800', marginTop: 6 },
  reservePolicyHeadroom: { color: Colors.info, fontSize: 7, lineHeight: 10, marginTop: 3 },
  managementFeeSummary: { flexDirection: 'row', gap: 7, marginTop: 8, padding: 9, borderRadius: 8, backgroundColor: Colors.elevated },
  managementFeeOptionActive: { borderColor: Colors.info, backgroundColor: '#17263A' },
  managementFeeRateActive: { color: Colors.info },
  managementFeeCurrent: { color: Colors.info, fontSize: 6, fontWeight: '900', letterSpacing: 0.4 },
  managementFeeEstimate: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900', marginTop: 6 },
  managementFeeDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 3 },
  capitalLedgerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9, marginBottom: 3 },
  capitalLedgerItem: { width: '48.5%', backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  capitalLedgerLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '700' },
  capitalLedgerValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900', marginTop: 3 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  smallAction: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: Colors.elevated },
  disabledAction: { opacity: 0.35 },
  protectedAction: { borderColor: Colors.warning, backgroundColor: '#33270F' },
  smallActionText: { color: Colors.textSecondary, fontSize: 9, fontWeight: '800' },
  governanceBox: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 11, paddingTop: 10 },
  governanceCurrent: { color: Colors.textSecondary, fontSize: 9, marginTop: 4 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingTop: 8 },
  childName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  childMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  roleButton: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 6 },
  roleButtonActive: { borderColor: Colors.primary, backgroundColor: '#10382D' },
  roleText: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800' },
  emptySubsidiaries: { alignItems: 'center', paddingVertical: 18, paddingHorizontal: 12 },
  emptySubsidiariesTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', marginTop: 7 },
  emptySubsidiariesText: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, textAlign: 'center', marginTop: 3 },
  companyAttentionSummary: { borderWidth: 1, borderColor: `${Colors.warning}30`, borderRadius: 10, backgroundColor: Colors.elevated, padding: 9, marginTop: 8 },
  companyAttentionSummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  companyAttentionSummaryTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900' },
  companyAttentionSummaryMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  companyAttentionAllButton: { minHeight: 30, borderWidth: 1, borderColor: `${Colors.warning}55`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, justifyContent: 'center' },
  companyAttentionAllButtonActive: { borderColor: Colors.warning, backgroundColor: '#33270F' },
  companyAttentionAllText: { color: Colors.warning, fontSize: 7, fontWeight: '900' },
  companyAttentionAllTextActive: { color: Colors.warning },
  companyAttentionChips: { gap: 6, paddingTop: 8, paddingRight: 2 },
  companyAttentionChip: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 9, backgroundColor: Colors.card, paddingHorizontal: 7, paddingVertical: 5 },
  companyAttentionChipDisabled: { opacity: 0.38 },
  companyAttentionChipLabel: { color: Colors.textSecondary, fontSize: 7, fontWeight: '800' },
  companyAttentionChipCount: { minWidth: 12, color: Colors.textPrimary, fontSize: 8, fontWeight: '900', textAlign: 'right' },
  companyPortfolioToolbar: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, backgroundColor: Colors.elevated, padding: 9, marginTop: 8 },
  companyPortfolioSummary: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  companyPortfolioTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900' },
  companyPortfolioMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  companyResetButton: { borderWidth: 1, borderColor: `${Colors.info}55`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  companyResetText: { color: Colors.info, fontSize: 7, fontWeight: '900' },
  companyControlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8, alignItems: 'flex-start' },
  companyControlWrap: { flexGrow: 1, flexBasis: 145 },
  companyControlButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, backgroundColor: Colors.card, paddingHorizontal: 9, paddingVertical: 7 },
  companyControlButtonOpen: { borderColor: `${Colors.info}66`, backgroundColor: '#17263A' },
  companyControlText: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800', flex: 1 },
  companyDropdownMenu: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, backgroundColor: Colors.card, marginTop: 5, overflow: 'hidden' },
  companyDropdownOption: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 9, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  companyDropdownOptionActive: { backgroundColor: '#17263A' },
  companyDropdownText: { color: Colors.textSecondary, fontSize: 8, fontWeight: '700', flex: 1 },
  companyDropdownTextActive: { color: Colors.info, fontWeight: '900' },
  companyFilterEmpty: { alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, backgroundColor: Colors.elevated, padding: 14, marginTop: 9 },
  companyFilterEmptyTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900', marginTop: 6 },
  companyFilterEmptyText: { color: Colors.textMuted, fontSize: 8, lineHeight: 12, textAlign: 'center', marginTop: 3 },
  companyFilterEmptyButton: { minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: `${Colors.info}55`, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8, justifyContent: 'center' },
  companyFilterEmptyButtonText: { color: Colors.info, fontSize: 8, fontWeight: '900' },
  subsidiaryBlock: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10, marginTop: 10 },
  subsidiaryRow: { flexDirection: 'row', alignItems: 'center' },
  subsidiaryManageButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  subsidiaryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  subsidiaryName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', flex: 1 },
  subsidiaryMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  subsidiaryAttentionPill: { minHeight: 20, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
  subsidiaryAttentionDot: { width: 5, height: 5, borderRadius: 3 },
  subsidiaryAttentionText: { fontSize: 7, fontWeight: '900' },
  subsidiaryHealthRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  subsidiaryHealthChip: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, backgroundColor: Colors.elevated, paddingHorizontal: 6, paddingVertical: 4 },
  subsidiaryHealthChipWarning: { borderColor: `${Colors.warning}55`, backgroundColor: `${Colors.warning}0A` },
  subsidiaryHealthText: { color: Colors.textSecondary, fontSize: 7, fontWeight: '800' },
  subsidiaryAttentionReason: { fontSize: 8, lineHeight: 11, fontWeight: '800', marginTop: 6 },
  subsidiaryAttentionAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, marginTop: 7 },
  subsidiaryAttentionActionHolding: { borderColor: `${Colors.primary}44`, backgroundColor: `${Colors.primary}08` },
  subsidiaryAttentionActionBusiness: { borderColor: `${Colors.info}44`, backgroundColor: '#17263A' },
  subsidiaryAttentionActionTitle: { fontSize: 8, fontWeight: '900' },
  subsidiaryAttentionActionDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 1 },
  capitalAllocationBox: { backgroundColor: Colors.elevated, borderRadius: 9, padding: 9, marginTop: 9 },
  capitalAllocationHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  capitalAllocationTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  capitalAllocationMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  allocationAmountRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7, marginBottom: 2 },
  allocationAmountChip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 5 },
  allocationAmountChipActive: { borderColor: Colors.info, backgroundColor: '#17263A' },
  allocationAmountText: { color: Colors.textMuted, fontSize: 8, fontWeight: '800' },
  allocationAmountTextActive: { color: Colors.info },
  capitalAllocationText: { color: Colors.textMuted, fontSize: 8, lineHeight: 12, marginTop: 4 },
  capitalAllocationWarning: { color: Colors.warning, fontSize: 8, lineHeight: 12, marginTop: 5 },
  allocationComparisonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  allocationChoiceCard: { flexGrow: 1, flexBasis: 145, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 9, backgroundColor: Colors.card },
  growthChoiceCard: { borderColor: `${Colors.primary}44` },
  growthChoiceCardFocused: { borderWidth: 2, borderColor: Colors.primary, backgroundColor: `${Colors.primary}08` },
  debtChoiceCard: { borderColor: `${Colors.info}44` },
  debtChoiceCardFocused: { borderWidth: 2, borderColor: Colors.info, backgroundColor: '#17263A' },
  allocationChoiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  allocationChoiceTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  allocationChoiceIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${Colors.primary}18`, alignItems: 'center', justifyContent: 'center' },
  debtChoiceIcon: { backgroundColor: '#17263A' },
  allocationChoiceTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  allocationFocusLabel: { fontSize: 6, fontWeight: '900', letterSpacing: 0.4 },
  allocationChoiceSubtitle: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  allocationMetric: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, paddingVertical: 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  allocationMetricLabel: { color: Colors.textMuted, fontSize: 7, flexShrink: 1 },
  allocationMetricValue: { color: Colors.textSecondary, fontSize: 7, fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  allocationChoiceHint: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 6 },
  allocationMinorityWarning: { color: Colors.warning, fontSize: 7, lineHeight: 10, marginTop: 5 },
  allocationUnavailable: { color: Colors.negative, fontSize: 7, lineHeight: 10, marginTop: 5, fontWeight: '700' },
  allocationChoiceButton: { minHeight: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 7 },
  growthChoiceButton: { backgroundColor: Colors.primary },
  debtChoiceButton: { backgroundColor: Colors.info },
  allocationChoiceButtonText: { color: Colors.white, fontSize: 8, fontWeight: '900' },
  allocationOwnershipBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 8, backgroundColor: '#33270F', padding: 8, marginTop: 8 },
  allocationOwnershipText: { color: Colors.warning, fontSize: 7, lineHeight: 10, flex: 1 },
  familyAssetActionRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 7 },
  returnText: { fontSize: 9, fontWeight: '700', marginTop: 3 },
  integrationWarning: { color: Colors.warning, fontSize: 9, fontWeight: '800', marginTop: 3 },
  longTermText: { color: Colors.warning, fontSize: 9, marginTop: 3 },
  delegationBox: { backgroundColor: Colors.elevated, borderRadius: 9, padding: 9, marginTop: 9 },
  delegationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delegationTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  delegationMeta: { color: Colors.info, fontSize: 8, marginTop: 2 },
  delegationWarning: { color: Colors.warning, fontSize: 8, lineHeight: 12, marginTop: 7 },
  managerChips: { gap: 5, paddingTop: 7, paddingBottom: 2 },
  managerChip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 11, paddingHorizontal: 7, paddingVertical: 5 },
  managerChipActive: { borderColor: Colors.info, backgroundColor: '#17263A' },
  managerChipText: { color: Colors.textMuted, fontSize: 8, fontWeight: '700' },
  managerChipTextActive: { color: Colors.info },
  managerChipMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 2 },
  managerChipMetaActive: { color: Colors.textSecondary },
  policyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  policyChip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 11, paddingHorizontal: 7, paddingVertical: 5 },
  policyChipActive: { borderColor: Colors.primary, backgroundColor: '#10382D' },
  policyChipText: { color: Colors.textMuted, fontSize: 8, fontWeight: '800' },
  policyChipTextActive: { color: Colors.primary },
  delegationHint: { color: Colors.textMuted, fontSize: 8, lineHeight: 12, marginTop: 7 },
  delegationSummary: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 5, fontStyle: 'italic' },
  removeButton: { paddingLeft: 12, paddingVertical: 4 },
  assignmentBlock: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10, marginTop: 10 },
  assignmentName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  assignmentChips: { gap: 7, paddingTop: 8, paddingBottom: 1 },
  assignmentChip: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder },
  assignmentChipText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  marketButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: 13, padding: 15, marginTop: 7 },
  marketButtonText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
});
