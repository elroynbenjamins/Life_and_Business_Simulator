import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import ScreenTabs from '../../src/components/ScreenTabs';
import { showGameDialog } from '../../src/components/GameDialog';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import {
  ACQUISITION_UNLOCK_NET_WORTH,
  getAcquisitionReturn,
} from '../../src/engine/acquisitionEngine';
import { BUSINESS_DELEGATION_POLICIES, getDelegationManagers, getHoldingSynergyProfile } from '../../src/engine/businessEngine';
import {
  HOLDING_COMPANY_SETUP_COST,
  HOLDING_SHARED_SERVICE_DEFINITIONS,
  HOLDING_SHARED_SERVICE_MAX_LEVEL,
  canChargeHoldingManagementFee,
  getHoldingCompanySummary,
  getHoldingSharedServiceEffects,
  getHoldingSharedServiceUpgradeCost,
  normalizeHoldingSharedServices,
} from '../../src/engine/holdingCompanyEngine';
import { BusinessDelegationPolicy, HoldingSharedServiceId } from '../../src/types/game';
import CorporateGroupReportPanel from '../../src/components/CorporateGroupReportPanel';
import { getCorporateGroupManagementReport } from '../../src/engine/corporateGroupReportingEngine';
import { CorporateReportPeriod } from '../../src/engine/corporateReportingEngine';

const CAPITAL_AMOUNTS = [1_000_000, 5_000_000, 10_000_000];
const PAYOUT_AMOUNTS = [100_000, 500_000, 1_000_000, 5_000_000];
const MANAGEMENT_FEE_RATES = [0, 0.01, 0.02, 0.03];
const RESERVE_TARGET_WEEKS = [0, 4, 8, 12];

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
  const [showCreateHolding, setShowCreateHolding] = useState(holdings.length === 0);
  const [expandedSubsidiaryId, setExpandedSubsidiaryId] = useState<string | null>(null);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Holding Companies</Text>
        <View style={{ width: 24 }} />
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
                Holdings act as real group headquarters: allocate capital, build shared Finance/HR/Procurement/
                Marketing/IT teams, delegate routine subsidiary management and prepare the next generation.
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
            }) => (
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
                    const affordable = !maxed && cashReserve >= cost;
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
                  <View style={styles.buttonRow}>
                    {CAPITAL_AMOUNTS.map((amount) => (
                      <Pressable
                        key={amount}
                        disabled={cash < amount}
                        onPress={() => fundHoldingCompany(holding.id, amount)}
                        style={[styles.smallAction, cash < amount && styles.disabledAction]}
                      >
                        <Text style={styles.smallActionText}>+{formatCurrency(amount)}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.synergyTitle}>Reserve target</Text>
                  <Text style={styles.capitalMeta}>
                    Protect owner distributions below {reserveTargetWeeks} weeks of subsidiary operating expenses
                    {reserveTargetWeeks > 0 ? ` • target ${formatCurrency(reserveTarget)}` : ' • disabled'}.
                  </Text>
                  <View style={styles.buttonRow}>
                    {RESERVE_TARGET_WEEKS.map((weeks) => {
                      const active = reserveTargetWeeks === weeks;
                      return (
                        <Pressable
                          key={weeks}
                          onPress={() => setHoldingReserveTargetWeeks(holding.id, weeks)}
                          style={[styles.smallAction, active && styles.protectedAction]}
                        >
                          <Text style={styles.smallActionText}>{weeks === 0 ? 'Off' : `${weeks}w`}</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.synergyTitle}>Management fee</Text>
                  <Text style={styles.capitalMeta}>0–3% of revenue for wholly owned subsidiaries only • eligible now: {managementFeeEligibleCount}/{subsidiaryCount}. Fees require a profitable week, are capped at 35% of pre-fee profit, and cannot touch protected reserves. Co-owned companies upstream cash only through pro-rata dividends.</Text>
                  <View style={styles.buttonRow}>
                    {MANAGEMENT_FEE_RATES.map((rate) => {
                      const active = Math.abs((holding.managementFeeRate ?? 0.01) - rate) < 0.0001;
                      return (
                        <Pressable
                          key={rate}
                          onPress={() => setHoldingManagementFeeRate(holding.id, rate)}
                          style={[styles.smallAction, active && styles.protectedAction]}
                        >
                          <Text style={styles.smallActionText}>{Math.round(rate * 100)}%</Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Text style={styles.synergyTitle}>Owner distribution</Text>
                  <Text style={styles.capitalMeta}>
                    Available above reserve target: {formatCurrency(availableDistributionCash)}. Strategic investments may still use the full Holding reserve.
                  </Text>
                  <View style={styles.buttonRow}>
                    {PAYOUT_AMOUNTS.map((amount) => (
                      <Pressable
                        key={amount}
                        disabled={availableDistributionCash < amount}
                        onPress={() => distributeHoldingCash(holding.id, amount)}
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
                {subsidiaries.map((business) => {
                  const debt = (business.businessLoans ?? []).reduce((sum, loan) => sum + Math.max(0, loan.remainingAmount ?? 0), 0);
                  const acquisitionReturn = getAcquisitionReturn(business);
                  const canAllocateMillion = cashReserve >= 1_000_000;
                  const managers = getDelegationManagers(business);
                  const selectedManagerId = managerSelections[business.id]
                    ?? business.delegatedManagerEmployeeId
                    ?? managers[0]?.id
                    ?? '';
                  const expanded = expandedSubsidiaryId === business.id;
                  return (
                    <View key={business.id} style={styles.subsidiaryBlock}>
                      <View style={styles.subsidiaryRow}>
                        <Pressable style={{ flex: 1 }} onPress={() => router.push(`/business/${business.id}`)}>
                          <Text style={styles.subsidiaryName}>{business.name}</Text>
                          <Text style={styles.subsidiaryMeta}>
                            {formatCurrency(business.valuation ?? 0)} • {(business.lastWeekProfit ?? 0) >= 0 ? '+' : ''}{formatCurrency(business.lastWeekProfit ?? 0)}/wk
                          </Text>
                          {acquisitionReturn && (
                            <Text style={[styles.returnText, { color: acquisitionReturn.returnPct >= 0 ? Colors.primary : Colors.negative }]}>
                              Owner return ({acquisitionReturn.playerOwnershipPct.toFixed(0)}% stake): {acquisitionReturn.returnPct >= 0 ? '+' : ''}{acquisitionReturn.returnPct.toFixed(1)}%
                            </Text>
                          )}
                          {business.acquisition?.integrationStrategy === 'pending' && (
                            <Text style={styles.integrationWarning}>Integration decision required</Text>
                          )}
                          {business.portfolioIntent === 'long_term_family' && (
                            <Text style={styles.longTermText}>◆ Protected long-term family asset</Text>
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          onPress={() => setExpandedSubsidiaryId(expanded ? null : business.id)}
                          hitSlop={8}
                          style={styles.subsidiaryManageButton}
                        >
                          <Ionicons name={expanded ? 'chevron-up' : 'options-outline'} size={18} color={expanded ? Colors.info : Colors.textMuted} />
                        </Pressable>
                        <Pressable onPress={() => assignBusinessToHolding(business.id, null)} hitSlop={10} style={styles.removeButton}>
                          <Ionicons name="remove-circle-outline" size={19} color={Colors.textMuted} />
                        </Pressable>
                      </View>

                      {expanded && (
                        <>
                      <View style={styles.buttonRow}>
                        <Pressable
                          disabled={!canAllocateMillion}
                          onPress={() => allocateHoldingCapital(holding.id, business.id, 1_000_000, 'capital')}
                          style={[styles.smallAction, !canAllocateMillion && styles.disabledAction]}
                        >
                          <Text style={styles.smallActionText}>+€1M Growth</Text>
                        </Pressable>
                        <Pressable
                          disabled={!canAllocateMillion || debt <= 0}
                          onPress={() => allocateHoldingCapital(holding.id, business.id, 1_000_000, 'debt')}
                          style={[styles.smallAction, (!canAllocateMillion || debt <= 0) && styles.disabledAction]}
                        >
                          <Text style={styles.smallActionText}>€1M Debt</Text>
                        </Pressable>
                        {business.familyBusiness?.isFamilyBusiness && (
                          <Pressable
                            onPress={() => toggleLongTermFamilyAsset(business.id)}
                            style={[styles.smallAction, business.portfolioIntent === 'long_term_family' && styles.protectedAction]}
                          >
                            <Text style={styles.smallActionText}>{business.portfolioIntent === 'long_term_family' ? 'Unprotect' : 'Long-term'}</Text>
                          </Pressable>
                        )}
                      </View>

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
                                return (
                                  <Pressable
                                    key={manager.id}
                                    accessibilityRole="button"
                                    hitSlop={{ top: 8, bottom: 8 }}
                                    onPress={() => setManagerSelections((current) => ({ ...current, [business.id]: manager.id }))}
                                    style={[styles.managerChip, active && styles.managerChipActive]}
                                  >
                                    <Text style={[styles.managerChipText, active && styles.managerChipTextActive]}>
                                      {manager.name} • {manager.roleId === 'manager' ? 'Manager' : 'Supervisor'}
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
            ))}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
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
  serviceUpgrade: { minWidth: 72, borderRadius: 7, borderWidth: 1, borderColor: Colors.primary, backgroundColor: '#10382D', paddingHorizontal: 7, paddingVertical: 7, alignItems: 'center' },
  serviceMaxed: { borderColor: Colors.primary, opacity: 0.8 },
  serviceUpgradeText: { color: Colors.primary, fontSize: 8, fontWeight: '900' },
  capitalBox: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 11, paddingTop: 10 },
  capitalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capitalTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  capitalMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
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
  subsidiaryBlock: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 10, marginTop: 10 },
  subsidiaryRow: { flexDirection: 'row', alignItems: 'center' },
  subsidiaryManageButton: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  subsidiaryName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  subsidiaryMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
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
