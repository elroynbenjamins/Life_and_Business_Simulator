import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Platform, Modal, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PieChart } from 'react-native-chart-kit';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import {
  getLevelName, getBusinessType, getUpgrade, getEmployeeRole, getAutomationScore, getDemandLabel,
  getAllMoraleActions, getAllTraining, getAllProjects, computeMarketShare, meetsMinStaffing, MIN_EMPLOYEES_REQUIRED,
  TIER_CONFIG, getProjectDifficulty, getProjectOdds,
} from '../../src/engine/businessEngine';
import { inflated } from '../../src/engine/economyEngine';
import employeeRolesData from '../../src/data/employee_roles.json';

const SCREEN_W = Dimensions.get('window').width;

const PRICING_OPTIONS: { key: 'budget' | 'standard' | 'premium' | 'luxury'; label: string; desc: string }[] = [
  { key: 'budget', label: 'Budget', desc: 'Low prices, high demand' },
  { key: 'standard', label: 'Standard', desc: 'Balanced pricing' },
  { key: 'premium', label: 'Premium', desc: 'Higher prices, lower demand' },
  { key: 'luxury', label: 'Luxury', desc: 'Maximum prices, niche market' },
];

const AD_OPTIONS: { key: 'none' | 'basic' | 'moderate' | 'aggressive'; label: string; cost: string }[] = [
  { key: 'none', label: 'None', cost: '€0/wk' },
  { key: 'basic', label: 'Basic', cost: '€200/wk' },
  { key: 'moderate', label: 'Moderate', cost: '€500/wk' },
  { key: 'aggressive', label: 'Aggressive', cost: '€1,200/wk' },
];

const LOAN_OPTIONS = [
  { amount: 10000, rate: 0.12, weeks: 26, label: '€10K • 12% • 26wk' },
  { amount: 25000, rate: 0.10, weeks: 40, label: '€25K • 10% • 40wk' },
  { amount: 50000, rate: 0.08, weeks: 52, label: '€50K • 8% • 52wk' },
];

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export default function BusinessDetailScreen() {
  const router = useRouter();
  const { id = '' } = useLocalSearchParams();
  const businesses = useGameStore((s) => s?.businesses ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const competitors = useGameStore((s) => s?.competitors ?? {});
  const {
    sellBusiness, openCandidatePool, hireCandidate, cancelCandidatePool, fireEmployee,
    setBusinessPricing, setBusinessAdvertising,
    buyBusinessUpgrade, takeBusinessLoan,
    toggleAutoPilot, injectCashIntoBusiness, withdrawFromBusiness,
    applyMoraleActionToBusiness, startEmployeeTraining, startBusinessProject, resolveBusinessRetention,
  } = useGameStore();

  const [showHireModal, setShowHireModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState<'inject' | 'withdraw' | null>(null);
  const [transferAmount, setTransferAmount] = useState('');

  const confirmAction = (title: string, msg: string, action: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}: ${msg}`)) action();
    } else {
      Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm', onPress: action }]);
    }
  };
  const [showTrainingModal, setShowTrainingModal] = useState<string | null>(null); // employeeId
  const [showMoraleDropdown, setShowMoraleDropdown] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);

  const biz = businesses.find((b) => b?.id === id);
  if (!biz) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Business Not Found</Text>
          <View style={{ width: 24 }} />
        </View>
      </SafeAreaView>
    );
  }

  const type = getBusinessType(biz.typeId);
  const automation = getAutomationScore(biz);
  const maxEmployees = type?.maxEmployees ?? 1;
  const uniquePurchasedUpgrades = [...new Set(biz.purchasedUpgrades ?? [])];
  const availableUpgrades = (type?.upgrades ?? []).filter((uid) => !uniquePurchasedUpgrades.includes(uid));
  const isUnderStaffed = !meetsMinStaffing(biz);
  const allMoraleActions = getAllMoraleActions();
  const allTraining = getAllTraining();
  const allProjects = getAllProjects();

  // Market share pie chart data
  const bizCompetitors = competitors[biz.id] ?? [];
  const marketShare = useMemo(() => {
    const strengths = bizCompetitors.map((c) => c.strength ?? 30);
    return computeMarketShare(biz, strengths);
  }, [biz.reputation, biz.valuation, biz.marketShareModifier, biz.employees?.length, bizCompetitors]);

  const pieData = useMemo(() => {
    const data: { name: string; population: number; color: string; legendFontColor: string; legendFontSize: number }[] = [
      { name: biz.name?.slice(0, 14) ?? 'You', population: marketShare.player, color: PIE_COLORS[0], legendFontColor: Colors.textSecondary, legendFontSize: 11 },
    ];
    bizCompetitors.forEach((c, i) => {
      data.push({
        name: (c.name ?? `Rival ${i + 1}`).slice(0, 14),
        population: marketShare.competitors[i] ?? 0,
        color: PIE_COLORS[(i + 1) % PIE_COLORS.length],
        legendFontColor: Colors.textSecondary,
        legendFontSize: 11,
      });
    });
    return data;
  }, [marketShare, bizCompetitors.length]);

  // Expense breakdown
  const eb = biz.lastExpenseBreakdown;

  // Retention event
  const retention = biz.pendingRetention;
  const retentionEmployee = retention ? (biz.employees ?? []).find((e) => e.id === retention.employeeId) : null;

  const handleSell = () => {
    const salePrice = biz.valuation ?? 0;
    const doSell = () => {
      sellBusiness(biz.id);
      // Navigate away immediately to avoid rendering with deleted business
      router.replace('/tabs');
    };
    if (Platform.OS === 'web') {
      if (confirm(`Sell ${biz.name} for ${formatCurrency(salePrice)}?`)) doSell();
    } else {
      Alert.alert('Sell Business', `Sell ${biz.name} for ${formatCurrency(salePrice)}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sell', style: 'destructive', onPress: doSell },
      ]);
    }
  };

  const handleTransfer = () => {
    const amt = parseInt(transferAmount, 10);
    if (isNaN(amt) || amt <= 0) return;
    if (showTransferModal === 'inject') {
      injectCashIntoBusiness(biz.id, amt);
    } else {
      withdrawFromBusiness(biz.id, amt);
    }
    setShowTransferModal(null);
    setTransferAmount('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{biz.name}</Text>
        <Pressable onPress={handleSell} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color={Colors.negative} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Understaffed Warning */}
        {isUnderStaffed && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={18} color={Colors.warning} />
            <Text style={styles.warningText}>
              Need {MIN_EMPLOYEES_REQUIRED} employees to start earning revenue ({biz.employees?.length ?? 0}/{MIN_EMPLOYEES_REQUIRED} hired)
            </Text>
          </View>
        )}

        {/* Top Info */}
        <GameCard>
          <View style={styles.topInfo}>
            <View style={styles.topIconWrap}>
              <Ionicons name={(type?.icon as any) ?? 'business'} size={28} color={Colors.primary} />
            </View>
            <View style={styles.topDetails}>
              <Text style={styles.levelBadge}>{getLevelName(biz.level)}</Text>
              <Text style={styles.industry}>{type?.industry ?? ''}</Text>
            </View>
          </View>
          <View style={styles.topStats}>
            <TopStat label="Valuation" value={formatCurrency(biz.valuation)} color={Colors.info} />
            <TopStat label="Balance" value={formatCurrency(biz.balance)} color={(biz.balance ?? 0) >= 0 ? Colors.primary : Colors.negative} />
            <TopStat label="Reputation" value={`${Math.round(biz.reputation)}/100`} color={Colors.warning} />
          </View>
          <View style={styles.automationRow}>
            <Text style={styles.automationLabel}>Automation: {automation}%</Text>
            <View style={styles.automationTrack}>
              <View style={[styles.automationFill, { width: `${automation}%` }]} />
            </View>
          </View>
        </GameCard>

        {/* Weekly Financials */}
        <GameCard title="Weekly Financials">
          <StatRow label="Revenue" value={biz.lastWeekRevenue} positive />
          <StatRow label="Expenses" value={biz.lastWeekExpenses} />
          <View style={styles.divider} />
          <StatRow label="Profit" value={biz.lastWeekProfit} positive={(biz.lastWeekProfit ?? 0) >= 0} bold />
        </GameCard>

        {/* Expense Breakdown */}
        {eb && (
          <GameCard title="Expense Breakdown">
            {eb.rent > 0 && <ExpRow label="Rent" value={eb.rent} />}
            {eb.salaries > 0 && <ExpRow label="Salaries" value={eb.salaries} />}
            {eb.cogs > 0 && <ExpRow label="Cost of Goods" value={eb.cogs} />}
            {eb.utilities > 0 && <ExpRow label="Utilities" value={eb.utilities} />}
            {eb.marketing > 0 && <ExpRow label="Marketing" value={eb.marketing} />}
            {eb.insurance > 0 && <ExpRow label="Insurance" value={eb.insurance} />}
            {eb.maintenance > 0 && <ExpRow label="Maintenance" value={eb.maintenance} />}
            {eb.taxes > 0 && <ExpRow label="Taxes" value={eb.taxes} />}
            {eb.loanInterest > 0 && <ExpRow label="Loan Interest" value={eb.loanInterest} />}
            {eb.misc > 0 && <ExpRow label="Misc" value={eb.misc} />}
          </GameCard>
        )}

        {/* Market Share Pie Chart */}
        {bizCompetitors.length > 0 && (
          <GameCard title="Market Share">
            <View style={styles.chartWrap}>
              <PieChart
                data={pieData}
                width={Math.min(SCREEN_W - 64, 340)}
                height={180}
                chartConfig={{
                  color: () => Colors.textSecondary,
                  labelColor: () => Colors.textSecondary,
                  backgroundGradientFrom: Colors.card,
                  backgroundGradientTo: Colors.card,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute={false}
              />
            </View>
          </GameCard>
        )}

        {/* Cash Management */}
        <GameCard title="Cash Management">
          <View style={styles.cashBtnRow}>
            <Pressable style={styles.cashBtn} onPress={() => { setShowTransferModal('inject'); setTransferAmount(''); }}>
              <Ionicons name="arrow-down-circle" size={18} color={Colors.primary} />
              <Text style={styles.cashBtnText}>Inject Cash</Text>
            </Pressable>
            <Pressable style={styles.cashBtn} onPress={() => { setShowTransferModal('withdraw'); setTransferAmount(''); }}>
              <Ionicons name="arrow-up-circle" size={18} color={Colors.warning} />
              <Text style={styles.cashBtnText}>Withdraw</Text>
            </Pressable>
          </View>
        </GameCard>

        {/* Auto Pilot */}
        <Pressable onPress={() => toggleAutoPilot(biz.id)}>
          <GameCard>
            <View style={styles.autoPilotRow}>
              <View>
                <Text style={styles.autoPilotTitle}>Auto-Pilot Mode</Text>
                <Text style={styles.autoPilotDesc}>Business runs automatically with lower dividends</Text>
              </View>
              <View style={[styles.toggle, biz.autoPilot && styles.toggleOn]}>
                <View style={[styles.toggleThumb, biz.autoPilot && styles.toggleThumbOn]} />
              </View>
            </View>
          </GameCard>
        </Pressable>

        {/* Pricing Strategy */}
        <GameCard title="Pricing Strategy">
          <View style={styles.optionGrid}>
            {PRICING_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.optionChip, biz.pricingStrategy === opt.key && styles.optionChipActive]}
                onPress={() => setBusinessPricing(biz.id, opt.key)}
              >
                <Text style={[styles.optionChipLabel, biz.pricingStrategy === opt.key && styles.optionChipLabelActive]}>{opt.label}</Text>
                <Text style={styles.optionChipDesc}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>
        </GameCard>

        {/* Advertising */}
        <GameCard title="Advertising">
          <View style={styles.optionGrid}>
            {AD_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[styles.optionChip, biz.advertisingLevel === opt.key && styles.optionChipActive]}
                onPress={() => setBusinessAdvertising(biz.id, opt.key)}
              >
                <Text style={[styles.optionChipLabel, biz.advertisingLevel === opt.key && styles.optionChipLabelActive]}>{opt.label}</Text>
                <Text style={styles.optionChipDesc}>{opt.cost}</Text>
              </Pressable>
            ))}
          </View>
        </GameCard>

        {/* Employees */}
        <GameCard title={`Employees (${biz.employees?.length ?? 0}/${maxEmployees})`}>
          <Text style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 8 }}>
            Skill boosts productivity (0.4x-1.2x). Potential caps how high skill can grow. Morale multiplies output (0.5x-1.2x).
          </Text>
          {(biz.employees ?? []).map((emp) => {
            const role = getEmployeeRole(emp.roleId);
            const inTraining = !!emp.inTrainingId;
            const tier = emp.tier ?? 'common';
            const tierCfg = TIER_CONFIG[tier];
            return (
              <View key={emp.id} style={styles.empRow}>
                <View style={styles.empInfo}>
                  <Text style={[styles.empName, { color: tierCfg.color }]}>
                    {emp.name} <Text style={{ fontSize: 10, color: tierCfg.color, fontWeight: '700' }}>[{tierCfg.label}]</Text>
                  </Text>
                  <Text style={styles.empRole}>
                    {role?.name ?? emp.roleId} • Skill {Math.round(emp.skill)} • Exp {emp.experience ?? 0}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Text style={{ color: Colors.textMuted, fontSize: 11 }}>Potential</Text>
                    <StarsRow value={(emp.potential ?? 70) / 20} />
                  </View>
                  <Text style={styles.empMeta}>
                    Age {emp.age ?? '?'} • Morale {Math.round(emp.morale)}
                    {inTraining ? ` • Training (${emp.trainingWeeksRemaining ?? 0}wk left)` : ''}
                  </Text>
                  {(emp.buffs ?? []).length > 0 && (
                    <Text style={{ color: tierCfg.color, fontSize: 11, marginTop: 3 }}>
                      {(emp.buffs ?? []).map((b) => `✦ ${b.label}`).join('   ')}
                    </Text>
                  )}
                </View>
                <View style={styles.empActions}>
                  <Text style={styles.empSalary}>{formatCurrency(emp.weeklySalary)}/wk</Text>
                  <View style={styles.empBtnRow}>
                    {!inTraining && (
                      <Pressable onPress={() => setShowTrainingModal(emp.id)} hitSlop={6} style={styles.smallBtn}>
                        <Ionicons name="school" size={16} color={Colors.info} />
                      </Pressable>
                    )}
                    <Pressable onPress={() => fireEmployee(biz.id, emp.id)} hitSlop={6} style={styles.smallBtn}>
                      <Ionicons name="close-circle" size={18} color={Colors.negative} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
          {(biz.employees?.length ?? 0) < maxEmployees && (() => {
            const free = biz.freeRecruits ?? 0;
            const charges = biz.recruitCharges ?? 0;
            const progress = biz.recruitProgress ?? 0;
            const totalAvail = free + charges;
            const nextChargeIn = charges < 5 ? Math.max(1, 5 - progress) : 0;
            const canRecruit = totalAvail > 0;
            const label = free > 0
              ? `Recruit (Free ${free} left)`
              : charges > 0
                ? `Recruit (€10,000 • ${charges} charge${charges !== 1 ? 's' : ''} left)`
                : `Recharging… ${nextChargeIn}wk to next charge`;
            return (
              <Pressable
                style={[styles.hireBtn, !canRecruit && { opacity: 0.5 }]}
                onPress={() => canRecruit && setShowHireModal(true)}
                disabled={!canRecruit}
              >
                <Ionicons name="sparkles" size={18} color={Colors.primary} />
                <Text style={styles.hireBtnText}>{label}</Text>
              </Pressable>
            );
          })()}
          {(biz.employees?.length ?? 0) < maxEmployees && (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 4, textAlign: 'center' }}>
              Odds: 65% Common · 20% <Text style={{ color: TIER_CONFIG.rare.color }}>Rare</Text> · 10% <Text style={{ color: TIER_CONFIG.epic.color }}>Epic</Text> · 5% <Text style={{ color: TIER_CONFIG.legendary.color }}>Legendary</Text>
            </Text>
          )}
        </GameCard>

        {/* Morale Actions */}
        <GameCard title="Team Morale Actions">
          <Text style={styles.sectionHint}>Boost employee morale with team activities</Text>
          {allMoraleActions.map((ma: any) => {
            const cost = Math.round((ma.costPerEmployee ?? 0) * (biz.employees?.length ?? 0));
            return (
              <Pressable
                key={ma.id}
                style={styles.actionRow}
                onPress={() => confirmAction('Team Activity', `Spend ${formatCurrency(cost)} on "${ma.name}" for +${ma.moraleBoost} morale?`, () => applyMoraleActionToBusiness(biz.id, ma.id))}
                disabled={(biz.employees?.length ?? 0) === 0}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionName}>{ma.name}</Text>
                  <Text style={styles.actionDesc}>+{ma.moraleBoost} morale</Text>
                </View>
                <Text style={styles.actionCost}>{formatCurrency(cost)}</Text>
              </Pressable>
            );
          })}
        </GameCard>

        {/* Active Business Projects */}
        <GameCard title="Business Projects">
          {/* Active projects */}
          {(biz.activeProjects ?? []).length > 0 && (
            <View style={{ marginBottom: 10 }}>
              <Text style={styles.subHeading}>Active</Text>
              {(biz.activeProjects ?? []).map((p) => {
                const proj: any = allProjects.find((pp: any) => pp.id === p.projectType);
                return (
                  <View key={p.id} style={styles.projectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionName}>{proj?.name ?? p.projectType}</Text>
                      <Text style={[styles.actionDesc, { color: p.succeeded ? Colors.primary : Colors.negative }]}>
                        {p.succeeded ? 'On track' : 'Struggling'} • {p.weeksRemaining}wk left
                      </Text>
                    </View>
                    <Text style={styles.actionCost}>{formatCurrency(p.cost)}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {/* Start new project — one at a time */}
          <Text style={styles.subHeading}>Start New (D20 skill check • 1 active max)</Text>
          {(() => {
            const hasActive = (biz.activeProjects ?? []).some((p) => !p.resolved);
            return (
              <>
                {hasActive && (
                  <Text style={{ color: Colors.warning, fontSize: 12, marginBottom: 6 }}>
                    A project is already active — finish it first to start another.
                  </Text>
                )}
                {allProjects.map((proj: any) => {
                  const hasRole = (biz.employees ?? []).some((e) => e.roleId === proj.requiredRoleId);
                  const roleName = getEmployeeRole(proj.requiredRoleId)?.name ?? proj.requiredRoleId;
                  const cost = Math.round((proj.baseCost ?? 0) * inflationMultiplier);
                  const bestSkill = (biz.employees ?? []).filter((e) => e.roleId === proj.requiredRoleId).reduce((m, e) => Math.max(m, e.skill ?? 0), 0);
                  const needed = getProjectDifficulty(proj);
                  const odds = getProjectOdds(proj, bestSkill);
                  const disabled = !hasRole || hasActive;
                  return (
                    <Pressable
                      key={proj.id}
                      style={[styles.actionRow, disabled && styles.disabledRow]}
                      onPress={() => !disabled && confirmAction('Start Project', `Invest ${formatCurrency(cost)} in "${proj.name}" (${proj.weeks} weeks, ~${odds}% success)?`, () => startBusinessProject(biz.id, proj.id))}
                      disabled={disabled}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.actionName, disabled && { color: Colors.textMuted }]}>{proj.name}</Text>
                        <Text style={styles.actionDesc}>
                          Requires: {roleName} {!hasRole ? '(missing)' : '✓'} • {proj.weeks}wk
                        </Text>
                        <Text style={[styles.actionDesc, { color: Colors.primary, marginTop: 2 }]}>
                          Effect: {proj.revenueMultiplier && proj.revenueMultiplier !== 1 ? `${proj.revenueMultiplier > 1 ? '+' : ''}${Math.round((proj.revenueMultiplier - 1) * 100)}% revenue` : ''}
                          {proj.expenseMultiplier && proj.expenseMultiplier !== 1 ? ` • ${proj.expenseMultiplier < 1 ? '' : '+'}${Math.round((proj.expenseMultiplier - 1) * 100)}% expenses` : ''}
                          {proj.reputationBonus ? ` • +${proj.reputationBonus} rep` : ''}
                        </Text>
                        <Text style={{ color: odds >= 60 ? Colors.primary : odds >= 30 ? Colors.warning : Colors.negative, fontSize: 11, marginTop: 3 }}>
                          🎲 Difficulty {needed}/20 • Best skill {Math.round(bestSkill)} • Odds ~{odds}%
                        </Text>
                      </View>
                      <Text style={[styles.actionCost, disabled && { color: Colors.textMuted }]}>{formatCurrency(cost)}</Text>
                    </Pressable>
                  );
                })}
              </>
            );
          })()}
        </GameCard>

        {/* Upgrades */}
        {(availableUpgrades.length > 0 || biz.activeUpgrade) && (
          <GameCard title="Upgrades">
            {biz.activeUpgrade && (
              <View style={{ padding: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 13 }}>🔧 Building: {getUpgrade(biz.activeUpgrade.upgradeId)?.name ?? biz.activeUpgrade.upgradeId}</Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>{biz.activeUpgrade.weeksRemaining} weeks remaining</Text>
              </View>
            )}
            {availableUpgrades.map((uid) => {
              const upg = getUpgrade(uid);
              if (!upg) return null;
              const cost = inflated(upg.cost ?? 0, inflationMultiplier);
              const bizBal = biz.balance ?? 0;
              const affordable = bizBal >= cost && !biz.activeUpgrade;
              const reason = biz.activeUpgrade ? 'Upgrade in progress' : bizBal < cost ? 'Insufficient balance' : '';
              return (
                <Pressable
                  key={uid}
                  style={styles.upgradeRow}
                  onPress={() => affordable && confirmAction('Buy Upgrade', `Purchase "${upg.name}" for ${formatCurrency(cost)} from business balance?`, () => buyBusinessUpgrade(biz.id, uid))}
                  disabled={!affordable}
                >
                  <View style={styles.upgradeInfo}>
                    <Text style={styles.upgradeName}>{upg.name}</Text>
                    <Text style={styles.upgradeDesc}>{upg.description}</Text>
                    <Text style={styles.upgradeBoost}>+{Math.round((upg.revenueBoost ?? 0) * 100)}% revenue • +{upg.reputationBoost ?? 0} rep</Text>
                  </View>
                  <View style={styles.upgradeCostWrap}>
                    <Text style={[styles.upgradeCost, { color: affordable ? Colors.primary : Colors.negative }]}>{formatCurrency(cost)}</Text>
                    {!affordable && <Text style={styles.cantAfford}>{reason}</Text>}
                  </View>
                </Pressable>
              );
            })}
          </GameCard>
        )}

        {/* Purchased Upgrades */}
        {uniquePurchasedUpgrades.length > 0 && (
          <GameCard title="Purchased Upgrades">
            {uniquePurchasedUpgrades.map((uid) => {
              const upg = getUpgrade(uid);
              return (
                <View key={uid} style={styles.purchasedUpgrade}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                  <Text style={styles.purchasedUpgradeName}>{upg?.name ?? uid}</Text>
                </View>
              );
            })}
          </GameCard>
        )}

        {/* Business Loans */}
        <GameCard title="Business Loans">
          {(biz.businessLoans ?? []).map((loan) => (
            <View key={loan.id} style={styles.loanRow}>
              <Text style={styles.loanAmount}>{formatCurrency(loan.remainingAmount)} remaining</Text>
              <Text style={styles.loanPayment}>{formatCurrency(loan.weeklyPayment)}/wk • {loan.weeksRemaining}wk left</Text>
            </View>
          ))}
          {(biz.businessLoans?.length ?? 0) < 3 && (
            <View style={styles.loanOptions}>
              {LOAN_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.amount}
                  style={styles.loanBtn}
                  onPress={() => takeBusinessLoan(biz.id, opt.amount, opt.rate, opt.weeks)}
                >
                  <Text style={styles.loanBtnText}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </GameCard>

        {/* Active Events */}
        {(biz.activeEvents?.length ?? 0) > 0 && (
          <GameCard title="Active Effects">
            {(biz.activeEvents ?? []).map((ae, i) => (
              <View key={i} style={styles.eventRow}>
                <Text style={styles.eventText}>
                  {ae.revenueMultiplier !== 1 ? `Revenue ×${ae.revenueMultiplier.toFixed(2)}` : ''}
                  {ae.expenseMultiplier !== 1 ? ` Expenses ×${ae.expenseMultiplier.toFixed(2)}` : ''}
                </Text>
                <Text style={styles.eventWeeks}>{ae.weeksRemaining}wk</Text>
              </View>
            ))}
          </GameCard>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Hire Modal — select role */}
      <Modal visible={showHireModal} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowHireModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Role to Hire</Text>
            {(employeeRolesData ?? []).map((role) => {
              const salary = Math.round((role.baseSalary ?? 280) * inflationMultiplier);
              return (
                <Pressable
                  key={role.id}
                  style={styles.roleOption}
                  onPress={() => { openCandidatePool(biz.id, role.id); setShowHireModal(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleName}>{role.name}</Text>
                    <Text style={styles.roleDesc}>{role.description}</Text>
                  </View>
                  <Text style={styles.roleSalary}>~{formatCurrency(salary)}/wk</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.modalClose} onPress={() => setShowHireModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Candidate Selection Modal */}
      <Modal visible={!!biz.pendingCandidates && biz.pendingCandidates.length > 0} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => cancelCandidatePool(biz.id)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Choose a Candidate</Text>
            <Text style={styles.sectionHint}>3 candidates generated — pick one to hire</Text>
            {(biz.pendingCandidates ?? []).map((c) => {
              const tier = c.tier ?? 'common';
              const tierCfg = TIER_CONFIG[tier];
              const archLabel = c.archetype === 'young' ? '🌱 Young' : c.archetype === 'veteran' ? '⭐ Vet' : '⚖️ Bal';
              return (
                <Pressable
                  key={c.id}
                  style={styles.candidateCard}
                  onPress={() => hireCandidate(biz.id, c.id)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Text style={{ color: tierCfg.color, fontWeight: '700', fontSize: 14 }}>{c.name}</Text>
                    <Text style={{ color: tierCfg.color, fontSize: 10, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>{tierCfg.label}</Text>
                    <Text style={{ color: Colors.textMuted, fontSize: 10 }}>{archLabel}</Text>
                  </View>
                  <View style={styles.candidateStats}>
                    <Text style={styles.candidateStat}>Skill {c.skill}</Text>
                    <StarsRow value={(c.potential ?? 70) / 20} />
                    <Text style={styles.candidateStat}>Exp {c.experience}</Text>
                    <Text style={styles.candidateStat}>Age {c.age}</Text>
                  </View>
                  {(c.buffs ?? []).length > 0 && (
                    <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 2 }}>
                      {(c.buffs ?? []).map((b) => `✦ ${b.label}`).join(' · ')}
                    </Text>
                  )}
                  <Text style={styles.candidateSalary}>{formatCurrency(c.weeklySalary)}/wk</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.modalClose} onPress={() => cancelCandidatePool(biz.id)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Training Modal */}
      <Modal visible={showTrainingModal !== null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTrainingModal(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select Training</Text>
            {allTraining.map((tr: any) => {
              const cost = Math.round((tr.cost ?? 0) * inflationMultiplier);
              return (
                <Pressable
                  key={tr.id}
                  style={styles.roleOption}
                  onPress={() => { if (showTrainingModal) startEmployeeTraining(biz.id, showTrainingModal, tr.id); setShowTrainingModal(null); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleName}>{tr.name}</Text>
                    <Text style={styles.roleDesc}>
                      +{tr.skillGain ?? tr.skillBoost ?? '?'} skill • {tr.weeks}wk • {Math.round((tr.failChance ?? 0) * 100)}% fail
                    </Text>
                  </View>
                  <Text style={styles.roleSalary}>{formatCurrency(cost)}</Text>
                </Pressable>
              );
            })}
            <Pressable style={styles.modalClose} onPress={() => setShowTrainingModal(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Retention Event Modal */}
      <Modal visible={!!retention && !!retentionEmployee} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Employee Request</Text>
            {retention && retentionEmployee && (
              <>
                <Text style={styles.retentionDesc}>
                  {retention.type === 'poach'
                    ? `${retentionEmployee.name} has received a job offer from a competitor!`
                    : retention.type === 'raise'
                    ? `${retentionEmployee.name} is requesting a raise.`
                    : retention.type === 'promotion'
                    ? `${retentionEmployee.name} wants a promotion.`
                    : `${retentionEmployee.name} is requesting training opportunities.`}
                </Text>
                {retention.type === 'poach' && (
                  <View style={styles.retentionBtns}>
                    <RetBtn label="Match Salary (+15%)" onPress={() => resolveBusinessRetention(biz.id, 'match_salary')} color={Colors.info} />
                    <RetBtn label="Big Raise (+25%)" onPress={() => resolveBusinessRetention(biz.id, 'increase_salary')} color={Colors.primary} />
                    <RetBtn label="Promote (+20%)" onPress={() => resolveBusinessRetention(biz.id, 'promote')} color={Colors.warning} />
                    <RetBtn label="Let Them Go" onPress={() => resolveBusinessRetention(biz.id, 'let_go')} color={Colors.negative} />
                  </View>
                )}
                {retention.type === 'raise' && (
                  <View style={styles.retentionBtns}>
                    <RetBtn label="Grant Raise (+15%)" onPress={() => resolveBusinessRetention(biz.id, 'accept')} color={Colors.primary} />
                    <RetBtn label="Deny" onPress={() => resolveBusinessRetention(biz.id, 'deny')} color={Colors.negative} />
                  </View>
                )}
                {retention.type === 'promotion' && (
                  <View style={styles.retentionBtns}>
                    <RetBtn label="Promote (+25%)" onPress={() => resolveBusinessRetention(biz.id, 'promote')} color={Colors.primary} />
                    <RetBtn label="Deny" onPress={() => resolveBusinessRetention(biz.id, 'deny')} color={Colors.negative} />
                  </View>
                )}
                {retention.type === 'training' && (
                  <View style={styles.retentionBtns}>
                    <RetBtn label="Fund Training (€2,000)" onPress={() => resolveBusinessRetention(biz.id, 'accept')} color={Colors.primary} />
                    <RetBtn label="Deny" onPress={() => resolveBusinessRetention(biz.id, 'deny')} color={Colors.negative} />
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Transfer Modal */}
      <Modal visible={showTransferModal !== null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setShowTransferModal(null)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>
              {showTransferModal === 'inject' ? 'Inject Cash into Business' : 'Withdraw from Business'}
            </Text>
            <Text style={styles.transferInfo}>
              {showTransferModal === 'inject'
                ? `Your cash: ${formatCurrency(cash)}`
                : `Business balance: ${formatCurrency(biz.balance)}`}
            </Text>
            <TextInput
              style={styles.transferInput}
              placeholder="Amount"
              placeholderTextColor={Colors.textMuted}
              value={transferAmount}
              onChangeText={setTransferAmount}
              keyboardType="numeric"
            />
            <Pressable style={styles.transferBtn} onPress={handleTransfer}>
              <Text style={styles.transferBtnText}>Confirm</Text>
            </Pressable>
            <Pressable style={styles.modalClose} onPress={() => setShowTransferModal(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function StarsRow({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(value * 2) / 2));
  const full = Math.floor(v);
  const half = v - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < full; i++) stars.push(<Ionicons key={'f' + i} name="star" size={12} color="#FBBF24" />);
  if (half) stars.push(<Ionicons key="h" name="star-half" size={12} color="#FBBF24" />);
  for (let i = 0; i < empty; i++) stars.push(<Ionicons key={'e' + i} name="star-outline" size={12} color="#FBBF24" />);
  return <View style={{ flexDirection: 'row', gap: 1 }}>{stars}</View>;
}

function TopStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.topStatItem}>
      <Text style={styles.topStatLabel}>{label}</Text>
      <Text style={[styles.topStatValue, { color }]}>{value}</Text>
    </View>
  );
}

function StatRow({ label, value, positive, bold }: { label: string; value: number; positive?: boolean; bold?: boolean }) {
  const color = positive ? Colors.primary : Colors.negative;
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statRowLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[styles.statRowValue, { color }, bold && { fontWeight: '700' }]}>
        {positive ? '+' : '-'}{formatCurrency(Math.abs(value))}
      </Text>
    </View>
  );
}

function ExpRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statRowLabel}>{label}</Text>
      <Text style={[styles.statRowValue, { color: Colors.negative }]}>-{formatCurrency(value)}</Text>
    </View>
  );
}

function RetBtn({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <Pressable style={[styles.retBtn, { borderColor: color }]} onPress={onPress}>
      <Text style={[styles.retBtnText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.warning}20`, borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: `${Colors.warning}40` },
  warningText: { color: Colors.warning, fontSize: 13, fontWeight: '600', flex: 1 },
  topInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: `${Colors.primary}20`, justifyContent: 'center', alignItems: 'center' },
  topDetails: {},
  levelBadge: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  industry: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  topStats: { flexDirection: 'row', marginTop: 14, gap: 8 },
  topStatItem: { flex: 1 },
  topStatLabel: { color: Colors.textMuted, fontSize: 11 },
  topStatValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  automationRow: { marginTop: 12 },
  automationLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  automationTrack: { height: 6, backgroundColor: Colors.elevated, borderRadius: 3 },
  automationFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statRowLabel: { color: Colors.textSecondary, fontSize: 14 },
  statRowValue: { fontSize: 14, fontWeight: '600' },
  chartWrap: { alignItems: 'center', marginVertical: 4 },
  cashBtnRow: { flexDirection: 'row', gap: 12 },
  cashBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.elevated, borderRadius: 10, padding: 12 },
  cashBtnText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  autoPilotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  autoPilotTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  autoPilotDesc: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, maxWidth: 220 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: Colors.elevated, padding: 3, justifyContent: 'center' },
  toggleOn: { backgroundColor: `${Colors.primary}40` },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.textMuted },
  toggleThumbOn: { backgroundColor: Colors.primary, alignSelf: 'flex-end' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, paddingVertical: 10, minWidth: '45%', flex: 1 },
  optionChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}15` },
  optionChipLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  optionChipLabelActive: { color: Colors.primary },
  optionChipDesc: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  empRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  empInfo: { flex: 1 },
  empName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  empRole: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  empMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  empActions: { alignItems: 'flex-end' },
  empSalary: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  empBtnRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  smallBtn: { padding: 4 },
  fireBtn: { padding: 4 },
  hireBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
  hireBtnText: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  sectionHint: { color: Colors.textMuted, fontSize: 12, marginBottom: 8 },
  subHeading: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  actionName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  actionDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  actionCost: { color: Colors.warning, fontSize: 13, fontWeight: '600', marginLeft: 8 },
  disabledRow: { opacity: 0.45 },
  projectRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  upgradeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  upgradeInfo: { flex: 1 },
  upgradeName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  upgradeDesc: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  upgradeBoost: { color: Colors.primary, fontSize: 11, marginTop: 4 },
  upgradeCostWrap: { alignItems: 'flex-end', marginLeft: 8 },
  upgradeCost: { fontSize: 14, fontWeight: '700' },
  cantAfford: { color: Colors.negative, fontSize: 10, marginTop: 2 },
  purchasedUpgrade: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  purchasedUpgradeName: { color: Colors.textSecondary, fontSize: 14 },
  loanRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  loanAmount: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  loanPayment: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  loanOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  loanBtn: { backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  loanBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '500' },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  eventText: { color: Colors.textSecondary, fontSize: 13, flex: 1 },
  eventWeeks: { color: Colors.textMuted, fontSize: 12 },
  candidateCard: { backgroundColor: Colors.elevated, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.cardBorder },
  candidateArchetype: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  candidateName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  candidateStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  candidateStat: { color: Colors.textSecondary, fontSize: 12, backgroundColor: `${Colors.primary}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  candidateSalary: { color: Colors.warning, fontSize: 14, fontWeight: '700', marginTop: 8 },
  retentionDesc: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 },
  retentionBtns: { gap: 8 },
  retBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  retBtnText: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400, maxHeight: '85%' },
  modalTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  roleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  roleName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  roleDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2, maxWidth: 200 },
  roleSalary: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  modalClose: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  modalCloseText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  transferInfo: { color: Colors.textSecondary, fontSize: 14, marginBottom: 12 },
  transferInput: { backgroundColor: Colors.elevated, borderRadius: 10, padding: 14, color: Colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 12 },
  transferBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  transferBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
