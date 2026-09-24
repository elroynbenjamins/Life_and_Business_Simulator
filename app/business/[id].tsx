import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, useWindowDimensions, Image, LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PieChart } from 'react-native-chart-kit';
import { Colors, resolveThemeColor } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import StatusPill from '../../src/components/StatusPill';
import useGameStore from '../../src/store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { formatCurrency } from '../../src/utils/format';
import {
  getLevelName, getBusinessType, getUpgrade, getEmployeeRole, getAutomationScore, getDemandLabel,
  getAllMoraleActions, getAllTraining, getAllProjects, computeMarketShare, meetsMinStaffing, MIN_EMPLOYEES_REQUIRED,
  TIER_CONFIG, getProjectDifficulty, getProjectOdds,
  BUSINESS_LEVEL_REPUTATION_REQUIREMENTS, getAllBusinessLocationTemplates, getScaledLocationCosts, canStartBusinessExpansion,
  getBusinessHealthScore, BUSINESS_STRATEGIES, BUSINESS_DELEGATION_POLICIES,
  getBusinessDecisionChoiceCost, getPlayerOwnershipPct,
  BUSINESS_PROJECT_SLOT_2_GEM_COST, BUSINESS_UPGRADE_SLOT_2_GEM_COST,
  getBusinessProjectSlotLimit, getBusinessUpgradeSlotLimit,
} from '../../src/engine/businessEngine';
import { loadRewardedAd, showRewardedAd } from '../../src/services/adManager';
import { shouldSimulateNativeFeatures } from '../../src/services/runtimeEnvironment';
import { inflated } from '../../src/engine/economyEngine';
import employeeRolesData from '../../src/data/employee_roles.json';
import { businessTypeImages, employeeRoleImages } from '../../src/assets/progressionImages';
import { getPrestigeEffects } from '../../src/engine/prestigeEngine';
import { AcquisitionIntegrationStrategy, BusinessBoardMandate, BusinessExecutiveRole, BusinessGovernanceRole, BusinessInsuranceArea, BusinessInsuranceTier, BusinessReinvestmentArea, BusinessStrategicFocus, BusinessManagementTargetProfile, CorporateCompensationPolicy, CorporateDepartmentId, CorporateTrainingPolicy } from '../../src/types/game';
import { calculateChildInheritanceTax } from '../../src/engine/lifecycleEngine';
import { getIntegrationStrategyProfile } from '../../src/engine/acquisitionEngine';
import { getBusinessEquityReturn } from '../../src/engine/businessPortfolioEngine';
import { BUSINESS_IDENTITY_DEFINITIONS } from '../../src/engine/businessIdentityEngine';
import {
  CORPORATE_CAPEX_PROJECTS,
  canStartCorporateCapex,
  getCorporateCapexBookValue,
  getCorporateCapexCost,
  getCorporateCapexOperatingEffects,
  getCorporateScaleLabel,
  getCorporateScaleTier,
} from '../../src/engine/corporateScaleEngine';
import {
  getBondQuote,
  getCorporateCreditProfile,
  getProjectFinanceQuote,
  getRevolverDrawQuote,
} from '../../src/engine/corporateFinanceEngine';
import {
  BUSINESS_REINVESTMENT_AREAS,
  canStartBusinessReinvestment,
  getBusinessConditionLabel,
  getBusinessReinvestmentCost,
  getBusinessReinvestmentEffects,
  normalizeBusinessReinvestmentState,
} from '../../src/engine/businessReinvestmentEngine';
import {
  BUSINESS_INSURANCE_AREAS,
  BUSINESS_INSURANCE_TIERS,
  getBusinessInsuranceLossQuote,
  getBusinessInsuranceQuote,
  getBusinessInsuranceRiskSummary,
  getBusinessInsuranceTotalWeeklyPremium,
  normalizeBusinessInsurancePolicies,
} from '../../src/engine/businessInsuranceEngine';
import {
  BUSINESS_BUDGET_PRESETS,
  getBusinessBudgetReserveTargets,
  isBusinessBudgetReviewDue,
  normalizeBusinessBudgetPlan,
  normalizeBusinessBudgetReserves,
} from '../../src/engine/businessBudgetEngine';
import {
  BOARD_GOVERNANCE_UNLOCK_VALUATION,
  BUSINESS_BOARD_MANDATES,
  BUSINESS_EXECUTIVE_ROLES,
  getBusinessGovernanceEffects,
  getExecutiveRoleEligibility,
  getExecutiveSearchCooldownWeeks,
} from '../../src/engine/businessGovernanceEngine';
import {
  CORPORATE_COMPENSATION_POLICIES,
  CORPORATE_DEPARTMENT_DEFINITIONS,
  CORPORATE_TRAINING_POLICIES,
  CORPORATE_WORKFORCE_UNLOCK_VALUATION,
  getCorporateHrPolicyCooldownWeeks,
  getCorporateWorkforceEffects,
  getCorporateWorkforceWeeklyPayroll,
  getRecommendedDepartmentHeadcounts,
  normalizeCorporateWorkforce,
} from '../../src/engine/businessWorkforceEngine';
import {
  CorporateKpiStatus,
  CorporateManagementReport,
  CorporateReportPeriod,
  getCorporateManagementReport,
} from '../../src/engine/corporateReportingEngine';
import {
  CorporateManagementAction,
  CorporateManagementActionTarget,
  getCorporateManagementActions,
} from '../../src/engine/corporateManagementActionsEngine';
import {
  BUSINESS_MANAGEMENT_TARGET_PROFILES,
  BusinessManagementTargetProgress,
  BusinessManagementTargetStatus,
  BusinessManagementYearReview,
  getBusinessManagementReviewYears,
  getBusinessManagementTargetProgress,
} from '../../src/engine/businessManagementTargetsEngine';

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
  { amount: 10000, rate: 0.14, weeks: 26, label: '€10K • 14% • 26wk' },
  { amount: 25000, rate: 0.12, weeks: 40, label: '€25K • 12% • 40wk' },
  { amount: 50000, rate: 0.10, weeks: 52, label: '€50K • 10% • 52wk' },
];

const REVOLVER_DRAWS = [2_500_000, 5_000_000, 10_000_000];
const BOND_ISSUES = [10_000_000, 25_000_000, 50_000_000];

const STRATEGIC_FOCUS_OPTIONS: Array<{ key: BusinessStrategicFocus; label: string; desc: string }> = [
  { key: 'balanced', label: 'Balanced', desc: 'No structural bias. Preserve flexibility.' },
  { key: 'growth', label: 'Growth', desc: 'Higher revenue and costs; slight morale pressure.' },
  { key: 'margin', label: 'Margin', desc: 'Lower operating costs at some growth/reputation cost.' },
  { key: 'premium', label: 'Premium', desc: 'Brand/reputation focus with modest extra cost.' },
  { key: 'automation', label: 'Automation', desc: 'Lower costs, better scale, tougher on morale.' },
  { key: 'rd', label: 'R&D', desc: 'Higher spending now for innovation and reputation.' },
];

const GOVERNANCE_ROLES: Array<{ key: BusinessGovernanceRole; label: string }> = [
  { key: 'manager', label: 'Manager' },
  { key: 'executive', label: 'Executive' },
  { key: 'board', label: 'Board' },
  { key: 'successor', label: 'Successor' },
];

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];
const INTEGRATION_STRATEGIES: Array<Exclude<AcquisitionIntegrationStrategy, 'pending'>> = ['independent', 'integrate', 'turnaround'];

function businessIdentityColor(color: string): string {
  if (color === 'premium') return Colors.premium;
  if (color === 'info') return Colors.info;
  if (color === 'warning') return Colors.warning;
  if (color === 'family') return Colors.family;
  return Colors.primary;
}
type BusinessDetailSection = 'overview' | 'ownership' | 'leadership' | 'finance' | 'people' | 'risk' | 'growth' | 'capital';

const BUSINESS_SECTION_CHIPS: Array<{ key: BusinessDetailSection; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'overview', label: 'Overview', icon: 'speedometer-outline' },
  { key: 'ownership', label: 'Ownership', icon: 'people-outline' },
  { key: 'leadership', label: 'Corporate', icon: 'briefcase-outline' },
  { key: 'finance', label: 'Finance', icon: 'cash-outline' },
  { key: 'people', label: 'Team', icon: 'person-add-outline' },
  { key: 'risk', label: 'Risk', icon: 'shield-checkmark-outline' },
  { key: 'growth', label: 'Growth', icon: 'trending-up-outline' },
  { key: 'capital', label: 'Capital', icon: 'card-outline' },
];

const MANAGEMENT_TARGET_SECTION: Record<CorporateManagementActionTarget, BusinessDetailSection> = {
  workforce: 'leadership',
  budget: 'finance',
  finance: 'capital',
  maintenance: 'risk',
  investments: 'growth',
};

function normalizeBusinessDetailSection(value: string | string[] | undefined): BusinessDetailSection | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return BUSINESS_SECTION_CHIPS.some((section) => section.key === raw) ? raw as BusinessDetailSection : null;
}

export default function BusinessDetailScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const { id = '', newBusiness, section } = useLocalSearchParams();
  const requestedSection = normalizeBusinessDetailSection(section);
  const businesses = useGameStore((s) => s?.businesses ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const economicCycle = useGameStore((s) => s?.economicCycle);
  const competitors = useGameStore((s) => s?.competitors ?? {});
  const profile = useGameStore((s) => s.profile);
  const relationshipState = useGameStore((s) => s.relationshipState);
  const generation = useGameStore((s) => s.generation ?? 1);
  const gameWeek = useGameStore((s) => s.week ?? 1);
  const gameYear = useGameStore((s) => s.year ?? 1);
  const loanRateReduction = getPrestigeEffects(profile).loan_rate_reduction ?? 0;
  const rivalCyclePhase = economicCycle?.phase ?? 'expansion';
  const rivalCycleLabel = rivalCyclePhase.charAt(0).toUpperCase() + rivalCyclePhase.slice(1);
  const rivalCycleHint = rivalCyclePhase === 'recession'
    ? 'Cash-rich rivals may attack market share, while overextended rivals can weaken or preserve liquidity.'
    : rivalCyclePhase === 'boom'
      ? 'Rivals are more likely to expand, invest and compete aggressively while demand is strong.'
      : rivalCyclePhase === 'slowdown'
        ? 'Rivals are reducing risk and delaying expansion as demand cools.'
        : rivalCyclePhase === 'recovery'
          ? 'Rivals are beginning to invest again and compete for returning demand.'
          : 'Rivals are growing steadily and balancing expansion with cash generation.';
  const {
    designateFamilyBusiness, toggleLongTermFamilyAsset, setBusinessStrategicFocus, setBusinessDecisionAutomation, setBusinessBudgetProfile, setBusinessManagementTargetProfile,
    openExecutiveSearch, hireExecutiveCandidate, cancelExecutiveSearch, dismissBusinessExecutive, setBusinessBoardMandate,
    setCorporateDepartmentTarget, setCorporateCompensationPolicy, setCorporateTrainingPolicy, resolveBusinessDecision,
    setAcquisitionIntegrationStrategy,
    appointChildToBusiness, transferBusinessShares, buyBackInvestorShares, investFamilyTrustCashInBusiness,
    openCandidatePool, hireCandidate, cancelCandidatePool, fireEmployee,
    setBusinessPricing, setBusinessAdvertising,
    buyBusinessUpgrade, startBusinessExpansion, takeBusinessLoan,
    drawCorporateRevolver, issueCorporateBond, repayBusinessLoan,
    injectCashIntoBusiness, withdrawFromBusiness,
    applyMoraleActionToBusiness, startEmployeeTraining, startBusinessProject,
    unlockBusinessProjectSlot, grantTemporaryBusinessProjectSlot, unlockBusinessUpgradeSlot, grantTemporaryBusinessUpgradeSlot,
    getAdFreeSlotRewardUsage, claimAdFreeBusinessSlotReward,
    startBusinessReinvestment, setBusinessInsurancePolicy, startCorporateCapex, resolveBusinessRetention,
  } = useGameStore(useShallow((s) => ({
    designateFamilyBusiness: s.designateFamilyBusiness,
    toggleLongTermFamilyAsset: s.toggleLongTermFamilyAsset,
    setBusinessStrategicFocus: s.setBusinessStrategicFocus,
    setBusinessDecisionAutomation: s.setBusinessDecisionAutomation,
    setBusinessBudgetProfile: s.setBusinessBudgetProfile,
    setBusinessManagementTargetProfile: s.setBusinessManagementTargetProfile,
    openExecutiveSearch: s.openExecutiveSearch,
    hireExecutiveCandidate: s.hireExecutiveCandidate,
    cancelExecutiveSearch: s.cancelExecutiveSearch,
    dismissBusinessExecutive: s.dismissBusinessExecutive,
    setBusinessBoardMandate: s.setBusinessBoardMandate,
    setCorporateDepartmentTarget: s.setCorporateDepartmentTarget,
    setCorporateCompensationPolicy: s.setCorporateCompensationPolicy,
    setCorporateTrainingPolicy: s.setCorporateTrainingPolicy,
    resolveBusinessDecision: s.resolveBusinessDecision,
    setAcquisitionIntegrationStrategy: s.setAcquisitionIntegrationStrategy,
    appointChildToBusiness: s.appointChildToBusiness,
    transferBusinessShares: s.transferBusinessShares,
    buyBackInvestorShares: s.buyBackInvestorShares,
    investFamilyTrustCashInBusiness: s.investFamilyTrustCashInBusiness,
    openCandidatePool: s.openCandidatePool,
    hireCandidate: s.hireCandidate,
    cancelCandidatePool: s.cancelCandidatePool,
    fireEmployee: s.fireEmployee,
    setBusinessPricing: s.setBusinessPricing,
    setBusinessAdvertising: s.setBusinessAdvertising,
    buyBusinessUpgrade: s.buyBusinessUpgrade,
    startBusinessExpansion: s.startBusinessExpansion,
    takeBusinessLoan: s.takeBusinessLoan,
    drawCorporateRevolver: s.drawCorporateRevolver,
    issueCorporateBond: s.issueCorporateBond,
    repayBusinessLoan: s.repayBusinessLoan,
    injectCashIntoBusiness: s.injectCashIntoBusiness,
    withdrawFromBusiness: s.withdrawFromBusiness,
    applyMoraleActionToBusiness: s.applyMoraleActionToBusiness,
    startEmployeeTraining: s.startEmployeeTraining,
    startBusinessProject: s.startBusinessProject,
    unlockBusinessProjectSlot: s.unlockBusinessProjectSlot,
    grantTemporaryBusinessProjectSlot: s.grantTemporaryBusinessProjectSlot,
    unlockBusinessUpgradeSlot: s.unlockBusinessUpgradeSlot,
    grantTemporaryBusinessUpgradeSlot: s.grantTemporaryBusinessUpgradeSlot,
    getAdFreeSlotRewardUsage: s.getAdFreeSlotRewardUsage,
    claimAdFreeBusinessSlotReward: s.claimAdFreeBusinessSlotReward,
    startBusinessReinvestment: s.startBusinessReinvestment,
    setBusinessInsurancePolicy: s.setBusinessInsurancePolicy,
    startCorporateCapex: s.startCorporateCapex,
    resolveBusinessRetention: s.resolveBusinessRetention,
  })));

  const [showHireModal, setShowHireModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState<'inject' | 'withdraw' | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [dialog, setDialog] = useState<{ title: string; message: string; action: () => void } | null>(null);

  const confirmAction = (title: string, msg: string, action: () => void) => {
    setDialog({ title, message: msg, action });
  };
  const [showTrainingModal, setShowTrainingModal] = useState<string | null>(null); // employeeId
  const [showMoraleDropdown, setShowMoraleDropdown] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [slotAdLoading, setSlotAdLoading] = useState<'project' | 'upgrade' | null>(null);
  const [slotAdMessage, setSlotAdMessage] = useState<{ kind: 'project' | 'upgrade'; text: string } | null>(null);
  const [showFundingNotice, setShowFundingNotice] = useState(newBusiness === '1');
  const [activeSection, setActiveSection] = useState<BusinessDetailSection>(() => requestedSection ?? 'overview');
  const [managementReportPeriod, setManagementReportPeriod] = useState<CorporateReportPeriod>('quarter');
  const [transferError, setTransferError] = useState('');
  const detailScrollRef = useRef<ScrollView>(null);
  const sectionTabScrollRef = useRef<ScrollView>(null);
  const managementSectionOffsets = useRef<Partial<Record<CorporateManagementActionTarget, number>>>({});

  const activateSection = (target: BusinessDetailSection) => {
    setActiveSection(target);
    const tabIndex = BUSINESS_SECTION_CHIPS.findIndex((section) => section.key === target);
    if (tabIndex >= 0) {
      sectionTabScrollRef.current?.scrollTo({ x: Math.max(0, tabIndex * 86 - 18), animated: true });
    }
    requestAnimationFrame(() => detailScrollRef.current?.scrollTo({ y: 0, animated: true }));
  };

  const recordManagementSection = (target: CorporateManagementActionTarget, event: LayoutChangeEvent) => {
    managementSectionOffsets.current[target] = event.nativeEvent.layout.y;
  };
  const scrollToManagementSection = (target: CorporateManagementActionTarget) => {
    activateSection(MANAGEMENT_TARGET_SECTION[target]);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const y = managementSectionOffsets.current[target];
        detailScrollRef.current?.scrollTo({ y: Math.max(0, (y ?? 0) - 12), animated: true });
      });
    });
  };

  useEffect(() => {
    if (!requestedSection) return;
    setActiveSection(requestedSection);
    const tabIndex = BUSINESS_SECTION_CHIPS.findIndex((item) => item.key === requestedSection);
    requestAnimationFrame(() => {
      if (tabIndex >= 0) {
        sectionTabScrollRef.current?.scrollTo({ x: Math.max(0, tabIndex * 86 - 18), animated: true });
      }
      detailScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [requestedSection]);

  const biz = businesses.find((b) => b?.id === id);
  useEffect(() => {
    // Low-balance warnings are handled globally, including away from this screen.
  }, [biz?.balance]);
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

  const handleSlotRewardedAd = async (kind: 'project' | 'upgrade') => {
    if (slotAdLoading) return;
    setSlotAdLoading(kind);
    setSlotAdMessage(null);

    if (profile.adsRemoved) {
      const claimed = claimAdFreeBusinessSlotReward(biz.id, kind);
      setSlotAdLoading(null);
      setSlotAdMessage({
        kind,
        text: claimed
          ? 'Daily ad-free Slot 2 reward claimed.'
          : 'Today’s ad-free Slot 2 reward is already used or this slot is unavailable.',
      });
      return;
    }

    const grantSlot = () => {
      if (kind === 'project') grantTemporaryBusinessProjectSlot(biz.id);
      else grantTemporaryBusinessUpgradeSlot(biz.id);
    };

    if (shouldSimulateNativeFeatures()) {
      grantSlot();
      setSlotAdLoading(null);
      setSlotAdMessage({ kind, text: 'Slot 2 is ready for one extra task.' });
      return;
    }

    const placement = kind === 'project' ? 'business_project_slot' : 'business_upgrade_slot';
    const loaded = await loadRewardedAd(placement);
    if (!loaded) {
      setSlotAdLoading(null);
      setSlotAdMessage({ kind, text: 'Rewarded ad unavailable right now.' });
      return;
    }

    const earned = await showRewardedAd(grantSlot);
    setSlotAdLoading(null);
    setSlotAdMessage({
      kind,
      text: earned ? 'Slot 2 is ready for one extra task.' : 'Watch the full ad to unlock Slot 2.',
    });
  };

  const handleTransfer = () => {
    const amount = Math.floor(Number(transferAmount));
    if (!Number.isFinite(amount) || amount <= 0 || !showTransferModal) {
      setTransferError('Enter a valid amount first.');
      return;
    }
    if (showTransferModal === 'inject') {
      if (amount > cash) {
        setTransferError(`You only have ${formatCurrency(cash)} personal cash available.`);
        return;
      }
      injectCashIntoBusiness(biz.id, amount);
    } else {
      if (amount > (biz.balance ?? 0)) {
        setTransferError(`This business only has ${formatCurrency(biz.balance ?? 0)} available.`);
        return;
      }
      withdrawFromBusiness(biz.id, amount);
    }
    setTransferAmount('');
    setTransferError('');
    setShowTransferModal(null);
  };

  const type = getBusinessType(biz.typeId);
  const automation = getAutomationScore(biz);
  const maxEmployees = type?.maxEmployees ?? 1;
  const uniquePurchasedUpgrades = [...new Set(biz.purchasedUpgrades ?? [])];
  const activeUpgrades = [biz.activeUpgrade, biz.secondaryActiveUpgrade].filter(
    (upgrade): upgrade is { upgradeId: string; weeksRemaining: number } => !!upgrade
  );
  const activeUpgradeIds = activeUpgrades.map((upgrade) => upgrade.upgradeId);
  const activeUpgradeCount = activeUpgrades.length;
  const upgradeSlotLimit = getBusinessUpgradeSlotLimit(biz);
  const availableUpgrades = (type?.upgrades ?? []).filter(
    (uid) => !uniquePurchasedUpgrades.includes(uid) && !activeUpgradeIds.includes(uid)
  );
  const activeProjects = (biz.activeProjects ?? []).filter((project) => !project.resolved);
  const activeProjectCount = activeProjects.length;
  const projectSlotLimit = getBusinessProjectSlotLimit(biz);
  const adFreeSlotReward = getAdFreeSlotRewardUsage();
  const isUnderStaffed = !meetsMinStaffing(biz);
  const allMoraleActions = getAllMoraleActions();
  const allTraining = getAllTraining();
  const allProjects = getAllProjects();
  const corporateScaleTier = getCorporateScaleTier(biz);
  const corporateScaleLabel = getCorporateScaleLabel(corporateScaleTier);
  const corporateCapexEffects = getCorporateCapexOperatingEffects(biz);
  const corporateCapexBookValue = getCorporateCapexBookValue(biz);
  const corporateCredit = getCorporateCreditProfile(biz);
  const locationTemplates = getAllBusinessLocationTemplates();
  const adultChildren = (relationshipState?.children ?? []).filter((child) => (child.age ?? 0) >= 18);
  const ownership = biz.ownership?.length ? biz.ownership : [{
    ownerType: 'player' as const,
    ownerId: 'player',
    ownerName: 'You',
    percent: 100,
    votingPercent: 100,
  }];
  const playerOwnershipPct = getPlayerOwnershipPct(biz);
  const investorOwnershipPct = ownership
    .filter((stake) => stake.ownerType === 'investor')
    .reduce((sum, stake) => sum + (stake.percent ?? 0), 0);
  const familyTrustPct = ownership
    .filter((stake) => stake.ownerType === 'family_trust')
    .reduce((sum, stake) => sum + (stake.percent ?? 0), 0);
  const familyTrustCash = relationshipState?.familyTrustCash ?? 0;
  const pendingDecision = biz.pendingDecision ?? null;
  const globalGameWeek = ((gameYear - 1) * 20) + gameWeek;
  const strategicPrograms = (biz.strategyModifiers ?? []).filter((modifier) => modifier.id.startsWith('strategy_'));
  const primaryStrategicProgram = strategicPrograms
    .slice()
    .sort((a, b) => (b.weeksRemaining ?? 0) - (a.weeksRemaining ?? 0))[0] ?? null;
  const strategyProgramWeeksRemaining = strategicPrograms.reduce(
    (max, modifier) => Math.max(max, modifier.weeksRemaining ?? 0),
    0,
  );
  const scheduledStrategicReviewWeeks = Math.max(0, (biz.nextStrategicDecisionWeek ?? (globalGameWeek + 18)) - globalGameWeek);
  const estimatedStrategicReviewWeeks = Math.max(scheduledStrategicReviewWeeks, strategyProgramWeeksRemaining);
  const waitingStrategicDecision = pendingDecision?.kind === 'strategy';
  const reinvestmentState = normalizeBusinessReinvestmentState(biz.reinvestment, globalGameWeek);
  const reinvestmentEffects = getBusinessReinvestmentEffects(biz);
  const insurancePolicies = normalizeBusinessInsurancePolicies(biz.insurancePolicies);
  const insuranceRisk = getBusinessInsuranceRiskSummary(biz);
  const insuranceWeeklyPremium = getBusinessInsuranceTotalWeeklyPremium(biz, globalGameWeek);
  const budgetPlan = normalizeBusinessBudgetPlan(biz.budgetPlan, gameYear);
  const budgetReserves = normalizeBusinessBudgetReserves(biz.budgetReserves);
  const budgetTargets = getBusinessBudgetReserveTargets(biz, biz.lastWeekExpenses ?? 0, inflationMultiplier);
  const budgetReviewDue = isBusinessBudgetReviewDue(biz, gameYear);
  const governanceEffects = getBusinessGovernanceEffects(biz);
  const corporateWorkforce = normalizeCorporateWorkforce(
    biz,
    biz.corporateWorkforce,
    globalGameWeek,
    inflationMultiplier,
  );
  const workforceEffects = getCorporateWorkforceEffects(
    corporateWorkforce ? { ...biz, corporateWorkforce } : biz,
    corporateWorkforce,
  );
  const workforceRecommended = getRecommendedDepartmentHeadcounts(
    corporateWorkforce ? { ...biz, corporateWorkforce } : biz,
  );
  const workforcePayroll = getCorporateWorkforceWeeklyPayroll(corporateWorkforce);
  const workforceCompensationPolicy = corporateWorkforce?.compensationPolicy ?? 'market';
  const workforceTrainingPolicy = corporateWorkforce?.trainingPolicy ?? 'standard';
  const workforceTrainingCost = Math.round(
    workforcePayroll * CORPORATE_TRAINING_POLICIES[workforceTrainingPolicy].payrollCostPct
  );
  const hrPolicyCooldown = getCorporateHrPolicyCooldownWeeks(
    corporateWorkforce ? { ...biz, corporateWorkforce } : biz,
    globalGameWeek,
  );
  const workforceHeadcount = corporateWorkforce
    ? (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
        .reduce((sum, departmentId) => sum + corporateWorkforce.departments[departmentId].headcount, 0)
    : 0;
  const workforceTargetHeadcount = corporateWorkforce
    ? (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
        .reduce((sum, departmentId) => sum + corporateWorkforce.departments[departmentId].targetHeadcount, 0)
    : 0;
  const workforceRecommendedTotal = (Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[])
    .reduce((sum, departmentId) => sum + (workforceRecommended[departmentId] ?? 0), 0);
  const reportingBusiness = corporateWorkforce ? { ...biz, corporateWorkforce } : biz;
  const quarterlyManagementReport = getCorporateManagementReport(
    reportingBusiness,
    globalGameWeek,
    'quarter',
    inflationMultiplier,
  );
  const annualManagementReport = getCorporateManagementReport(
    reportingBusiness,
    globalGameWeek,
    'annual',
    inflationMultiplier,
  );
  const quarterlyManagementActions = quarterlyManagementReport
    ? getCorporateManagementActions(reportingBusiness, quarterlyManagementReport, inflationMultiplier)
    : [];
  const annualManagementActions = annualManagementReport
    ? getCorporateManagementActions(reportingBusiness, annualManagementReport, inflationMultiplier)
    : [];
  const managementTargetProgress = quarterlyManagementReport
    ? getBusinessManagementTargetProgress(
        reportingBusiness,
        quarterlyManagementReport,
        globalGameWeek,
      )
    : null;
  const managementReviewYears = getBusinessManagementReviewYears(reportingBusiness);
  const boardMandateCooldown = biz.boardGovernance
    ? Math.max(0, 10 - (globalGameWeek - (biz.boardGovernance.lastMandateChangeGlobalWeek ?? 0)))
    : 0;
  const decisionWeeksLeft = pendingDecision
    ? Math.max(0, (pendingDecision.deadlineGlobalWeek ?? pendingDecision.createdGlobalWeek + 4) - globalGameWeek)
    : 0;
  const equityStructuringUnlocked = (biz.level ?? 0) >= 3;
  const canIssue5 = playerOwnershipPct * 0.95 >= 51;
  const canIssue10 = playerOwnershipPct * 0.90 >= 51;
  const canTransfer5 = playerOwnershipPct >= 56;
  const fivePctStakeValue = Math.round((biz.valuation ?? 0) * 0.05);
  const childShareGiftTax = calculateChildInheritanceTax(fivePctStakeValue);
  const trustShareTransferTax = Math.round(fivePctStakeValue * 0.075);
  const acquisitionReturn = biz.acquisition ? getBusinessEquityReturn(biz) : null;
  // Market share pie chart data. Keep these as plain calculations rather than
  // hooks because selling the current business removes it from the store
  // synchronously and this screen then takes the early "not found" return.
  const bizCompetitors = competitors[biz.id] ?? [];
  const strengths = bizCompetitors.map((c) => c.strength ?? 30);
  const marketShare = computeMarketShare(biz, strengths);
  const pieData: { name: string; population: number; color: string; legendFontColor: string; legendFontSize: number }[] = [
    { name: biz.name?.slice(0, 14) ?? 'You', population: marketShare.player, color: PIE_COLORS[0], legendFontColor: Colors.textSecondary, legendFontSize: 11 },
    ...bizCompetitors.map((c, i) => ({
      name: (c.name ?? `Rival ${i + 1}`).slice(0, 14),
      population: marketShare.competitors[i] ?? 0,
      color: PIE_COLORS[(i + 1) % PIE_COLORS.length],
      legendFontColor: Colors.textSecondary,
      legendFontSize: 11,
    })),
  ];

  // Expense breakdown
  const eb = biz.lastExpenseBreakdown;

  const nextAction = (() => {
    if (pendingDecision) {
      return {
        tone: pendingDecision.kind === 'crisis' ? Colors.negative : Colors.warning,
        icon: pendingDecision.kind === 'crisis' ? 'alert-circle-outline' : 'help-circle-outline',
        title: pendingDecision.kind === 'crisis' ? 'Resolve the business crisis' : 'Choose a business decision',
        detail: `${pendingDecision.title} expires in ${decisionWeeksLeft} week${decisionWeeksLeft === 1 ? '' : 's'}.`,
        target: 'overview' as BusinessDetailSection,
      };
    }
    if (isUnderStaffed) {
      return {
        tone: Colors.warning,
        icon: 'person-add-outline',
        title: 'Recruit enough employees',
        detail: `Hire ${Math.max(0, MIN_EMPLOYEES_REQUIRED - (biz.employees?.length ?? 0))} more before this business can earn revenue.`,
        target: 'people' as BusinessDetailSection,
      };
    }
    if (biz.acquisition?.integrationStrategy === 'pending') {
      return {
        tone: Colors.info,
        icon: 'git-merge-outline',
        title: 'Choose an acquisition strategy',
        detail: 'Set whether the company stays independent, integrates, or goes through turnaround.',
        target: 'overview' as BusinessDetailSection,
      };
    }
    if (budgetReviewDue) {
      return {
        tone: Colors.warning,
        icon: 'calendar-outline',
        title: 'Review the annual cash plan',
        detail: 'Budget policy controls dividends, debt paydown, reinvestment reserves, and growth reserves.',
        target: 'finance' as BusinessDetailSection,
      };
    }
    if (insuranceRisk.coverageGaps.length > 0) {
      return {
        tone: Colors.warning,
        icon: 'shield-outline',
        title: 'Close insurance coverage gaps',
        detail: `${insuranceRisk.coverageGaps.length} risk area${insuranceRisk.coverageGaps.length === 1 ? '' : 's'} currently has no cover.`,
        target: 'risk' as BusinessDetailSection,
      };
    }
    if (reinvestmentEffects.revenuePenalty > 0.04 || reinvestmentEffects.expenseIncrease > 0.04) {
      return {
        tone: Colors.warning,
        icon: 'construct-outline',
        title: 'Renew aging infrastructure',
        detail: `Current drag is -${(reinvestmentEffects.revenuePenalty * 100).toFixed(1)}% revenue and +${(reinvestmentEffects.expenseIncrease * 100).toFixed(1)}% expenses.`,
        target: 'risk' as BusinessDetailSection,
      };
    }
    if ((biz.balance ?? 0) < 0) {
      return {
        tone: Colors.negative,
        icon: 'cash-outline',
        title: 'Repair the business balance',
        detail: 'Inject personal cash, take a business loan, or reduce spending before losses compound.',
        target: 'finance' as BusinessDetailSection,
      };
    }
    if ((biz.valuation ?? 0) >= 25_000_000 && !corporateWorkforce) {
      return {
        tone: Colors.info,
        icon: 'business-outline',
        title: 'Set up corporate departments',
        detail: 'The company is large enough for corporate workforce planning and management reports.',
        target: 'leadership' as BusinessDetailSection,
      };
    }
    return {
      tone: Colors.primary,
      icon: 'trending-up-outline',
      title: 'Grow reputation and cash flow',
      detail: 'Use marketing, projects, upgrades and reinvestment to prepare for the next business level.',
      target: 'growth' as BusinessDetailSection,
    };
  })();

  // Retention event
  const retention = biz.pendingRetention;
  const retentionEmployee = retention ? (biz.employees ?? []).find((e) => e.id === retention.employeeId) : null;

  const handleSell = () => {
    if (biz.portfolioIntent === 'long_term_family') {
      confirmAction(
        'Protected Family Asset',
        'This company is marked as a long-term family asset. Remove that protection before selling it.',
        () => {}
      );
      return;
    }
    router.push({ pathname: '/business/sell', params: { id: biz.id } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{biz.name}</Text>
        <Pressable disabled={playerOwnershipPct < 99.9} onPress={handleSell} hitSlop={12}>
          <Ionicons name="trash-outline" size={22} color={playerOwnershipPct >= 99.9 ? Colors.negative : Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.sectionTabShell}>
        <ScrollView ref={sectionTabScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionJumpRow}>
          {BUSINESS_SECTION_CHIPS.map((section) => (
            <Pressable
              key={section.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeSection === section.key }}
              style={[styles.sectionJumpChip, activeSection === section.key && styles.sectionJumpChipActive]}
              onPress={() => activateSection(section.key)}
            >
              <Ionicons name={section.icon as any} size={13} color={activeSection === section.key ? Colors.business : Colors.textSecondary} />
              <Text style={[styles.sectionJumpText, activeSection === section.key && styles.sectionJumpTextActive]}>{section.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

      </View>

      <ScrollView ref={detailScrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Understaffed Warning */}
        {isUnderStaffed && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={18} color={Colors.warning} />
            <Text style={styles.warningText}>
              Need {MIN_EMPLOYEES_REQUIRED} employees to start earning revenue ({biz.employees?.length ?? 0}/{MIN_EMPLOYEES_REQUIRED} hired)
            </Text>
          </View>
        )}

        <View style={styles.businessContextRow}>
          <View style={styles.businessContextItem}>
            <Text style={styles.businessContextLabel}>Value</Text>
            <Text style={styles.businessContextValue} numberOfLines={1}>{formatCurrency(biz.valuation)}</Text>
          </View>
          <View style={styles.businessContextItem}>
            <Text style={styles.businessContextLabel}>Balance</Text>
            <Text style={[styles.businessContextValue, { color: (biz.balance ?? 0) >= 0 ? Colors.primary : Colors.negative }]} numberOfLines={1}>
              {formatCurrency(biz.balance)}
            </Text>
          </View>
          <View style={styles.businessContextItem}>
            <Text style={styles.businessContextLabel}>Health</Text>
            <Text
              style={[
                styles.businessContextValue,
                { color: getBusinessHealthScore(biz) >= 70 ? Colors.primary : getBusinessHealthScore(biz) >= 45 ? Colors.warning : Colors.negative },
              ]}
            >
              {getBusinessHealthScore(biz)}/100
            </Text>
          </View>
        </View>

        {activeSection === 'overview' && (
          <>
        {/* Top Info */}
        <GameCard>
          <View style={styles.topInfo}>
            <Image source={businessTypeImages[biz.typeId]} style={styles.topArtwork} resizeMode="contain" accessibilityLabel={`${type?.name ?? 'Business'} pixel art`} />
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
          <View style={styles.healthPanel}>
            <Text style={styles.sectionHint}>Business health</Text>
            <Text style={[styles.healthScore, { color: getBusinessHealthScore(biz) >= 70 ? Colors.primary : getBusinessHealthScore(biz) >= 45 ? Colors.warning : Colors.negative }]}>{getBusinessHealthScore(biz)}/100</Text>
            <Text style={styles.sectionHint}>Cash flow 35% · Reputation 30% · Morale 20% · Market share 15%</Text>
          </View>
          {type && BUSINESS_STRATEGIES[biz.typeId] && (
            <View style={styles.strategyPanel}>
              <Text style={styles.sectionHint}>Strategy guide</Text>
              <Text style={styles.strategyText}>✓ Advantage: {BUSINESS_STRATEGIES[biz.typeId].advantage}</Text>
              <Text style={styles.strategyText}>! Watch out: {BUSINESS_STRATEGIES[biz.typeId].weakness}</Text>
            </View>
          )}
          <View style={styles.automationRow}>
            <Text style={styles.automationLabel}>Automation: {automation}%</Text>
            <View style={styles.automationTrack}>
              <View style={[styles.automationFill, { width: `${automation}%` }]} />
            </View>
          </View>
          {biz.delegationPolicy && biz.delegationPolicy !== 'manual' && (
            <View style={styles.delegationStatus}>
              <Ionicons name="briefcase" size={14} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.delegationStatusTitle}>
                  Delegated • {BUSINESS_DELEGATION_POLICIES[biz.delegationPolicy].label}
                </Text>
                <Text style={styles.delegationStatusText}>
                  {biz.delegatedManagerName ?? 'Manager'} reviews routine pricing, marketing and staffing every 4 weeks.
                </Text>
                {!!biz.lastDelegationSummary && (
                  <Text style={styles.delegationStatusLast}>{biz.lastDelegationSummary}</Text>
                )}
              </View>
            </View>
          )}
          {biz.level < 7 && (
            <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 8 }}>
              Next level requires reputation {BUSINESS_LEVEL_REPUTATION_REQUIREMENTS[biz.level + 1]} and the valuation target. Expansion requirements are shown on each location.
            </Text>
          )}
        </GameCard>

        <GameCard
          variant={(biz.identityTraits?.length ?? 0) > 0 ? 'standard' : 'subtle'}
          eyebrow="COMPANY IDENTITY"
          title={(biz.identityTraits?.length ?? 0) > 0 ? 'What this company has become' : 'Identity still forming'}
          accentColor={Colors.business}
        >
          {(biz.identityTraits?.length ?? 0) > 0 ? (
            <View style={styles.identityList}>
              {(biz.identityTraits ?? []).map((trait) => {
                const definition = BUSINESS_IDENTITY_DEFINITIONS[trait.id];
                return (
                  <View key={trait.id} style={styles.identityRow}>
                    <StatusPill
                      compact
                      icon={definition.icon as any}
                      label={definition.name}
                      color={businessIdentityColor(definition.color)}
                    />
                    <Text style={styles.identityDescription}>{definition.description}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.identityEmpty}>
              Persistent identity traits emerge naturally from sustained pricing, strategy, employee, financing and family-governance choices. They are not selected manually.
            </Text>
          )}
        </GameCard>
          </>
        )}

        <Pressable
          style={[styles.nextActionCard, { borderColor: `${nextAction.tone}55`, backgroundColor: `${nextAction.tone}12` }]}
          onPress={() => activateSection(nextAction.target)}
        >
          <View style={[styles.nextActionIcon, { backgroundColor: `${nextAction.tone}22` }]}>
            <Ionicons name={nextAction.icon as any} size={20} color={nextAction.tone} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nextActionEyebrow, { color: nextAction.tone }]}>Recommended next action</Text>
            <Text style={styles.nextActionTitle}>{nextAction.title}</Text>
            <Text style={styles.nextActionDetail}>{nextAction.detail}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={nextAction.tone} />
        </Pressable>

        {activeSection === 'overview' && (
          <>
        {/* Family Business */}
        <GameCard title="Family Business">
          {biz.familyBusiness?.isFamilyBusiness ? (
            <>
              <View style={styles.familyBusinessHeader}>
                <Ionicons name="people" size={22} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.familyBusinessTitle}>{biz.familyBusiness.familyName}</Text>
                  <Text style={styles.sectionHint}>
                    Owned across {biz.familyBusiness.generationsOwned} generation{biz.familyBusiness.generationsOwned === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <View style={styles.familyBusinessStats}>
                <View style={styles.familyBusinessStat}>
                  <Text style={styles.bizStatLabel}>Founder Gen</Text>
                  <Text style={styles.bizStatValue}>G{biz.familyBusiness.founderGeneration}</Text>
                </View>
                <View style={styles.familyBusinessStat}>
                  <Text style={styles.bizStatLabel}>Controller</Text>
                  <Text style={styles.bizStatValue} numberOfLines={1}>{biz.familyBusiness.controllerName}</Text>
                </View>
                <View style={styles.familyBusinessStat}>
                  <Text style={styles.bizStatLabel}>Family Ownership</Text>
                  <Text style={styles.bizStatValue}>{Math.round(biz.familyBusiness.familyOwnershipPct)}%</Text>
                </View>
              </View>
              <Text style={styles.sectionHint}>
                If this business is inherited by your named child successor, its history, employees, competitors and family-business generation continue.
              </Text>
              <Pressable
                style={[styles.familyBusinessButton, biz.portfolioIntent === 'long_term_family' && styles.longTermButton]}
                onPress={() => toggleLongTermFamilyAsset(biz.id)}
              >
                <Ionicons name={biz.portfolioIntent === 'long_term_family' ? 'shield-checkmark' : 'shield-outline'} size={18} color={Colors.warning} />
                <Text style={styles.familyBusinessButtonText}>
                  {biz.portfolioIntent === 'long_term_family' ? 'Long-term Family Asset — Protected' : 'Mark as Long-term Family Asset'}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.sectionHint}>
                Designate this company as part of your family legacy. This does not change current ownership or profit; it records multi-generation continuity.
              </Text>
              <Pressable
                disabled={!relationshipState?.partnerId && (relationshipState?.children?.length ?? 0) === 0 && generation <= 1}
                style={[
                  styles.familyBusinessButton,
                  !relationshipState?.partnerId && (relationshipState?.children?.length ?? 0) === 0 && generation <= 1 && { opacity: 0.35 },
                ]}
                onPress={() => designateFamilyBusiness(biz.id)}
              >
                <Ionicons name="ribbon-outline" size={18} color={Colors.warning} />
                <Text style={styles.familyBusinessButtonText}>Designate Family Business</Text>
              </Pressable>
            </>
          )}
        </GameCard>

        {biz.acquisition && (
          <GameCard title="Acquisition & Integration">
            <View style={styles.acquisitionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.acquisitionTitle}>
                  {biz.acquisition.fundingMode === 'cash' ? 'Cash Acquisition' : biz.acquisition.fundingMode === 'balanced' ? 'Balanced Financing' : 'Leveraged Acquisition'}
                </Text>
                <Text style={styles.sectionHint}>
                  Purchased for {formatCurrency(biz.acquisition.purchasePrice)} • Cash contribution {formatCurrency(biz.acquisition.cashContribution ?? 0)} • Initial debt {formatCurrency(biz.acquisition.debtFinanced ?? 0)}
                </Text>
              </View>
              {acquisitionReturn?.returnPct != null && (
                <Text style={[styles.acquisitionReturn, { color: acquisitionReturn.returnPct >= 0 ? Colors.primary : Colors.negative }]}>
                  {acquisitionReturn.returnPct >= 0 ? '+' : ''}{acquisitionReturn.returnPct.toFixed(1)}%
                </Text>
              )}
            </View>

            <View style={styles.acquisitionProfile}>
              <View style={styles.acquisitionProfileHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acquisitionProfileTitle}>Company history</Text>
                  <Text style={styles.acquisitionProfileText}>
                    {biz.acquisition.companyAgeYears ?? 8} years operating • {biz.acquisition.sellerReason ?? biz.acquisition.sellerName}
                  </Text>
                </View>
                <Text style={styles.acquisitionCostText}>
                  {formatCurrency(biz.acquisition.acquisitionTransactionCost ?? 0)} closing costs
                </Text>
              </View>

              {(biz.acquisition.traits ?? []).length > 0 && (
                <View style={styles.acquisitionTraitRow}>
                  {(biz.acquisition.traits ?? []).map((trait) => (
                    <View
                      key={trait.id}
                      style={[
                        styles.acquisitionTraitChip,
                        trait.kind === 'strength' ? styles.acquisitionTraitStrength : styles.acquisitionTraitRisk,
                      ]}
                    >
                      <Ionicons
                        name={trait.kind === 'strength' ? 'sparkles-outline' : 'warning-outline'}
                        size={11}
                        color={trait.kind === 'strength' ? Colors.primary : Colors.warning}
                      />
                      <Text
                        style={[
                          styles.acquisitionTraitText,
                          { color: trait.kind === 'strength' ? Colors.primary : Colors.warning },
                        ]}
                      >
                        {trait.name}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {(biz.acquisition.diligenceFindings ?? []).length > 0 && (
                <View style={styles.acquisitionFindings}>
                  {(biz.acquisition.diligenceFindings ?? []).map((finding) => {
                    const findingColor = finding.kind === 'strength'
                      ? Colors.primary
                      : finding.kind === 'risk'
                        ? Colors.warning
                        : Colors.info;
                    return (
                      <View key={finding.id} style={styles.acquisitionFindingRow}>
                        <Ionicons
                          name={finding.kind === 'strength' ? 'checkmark-circle-outline' : finding.kind === 'risk' ? 'alert-circle-outline' : 'information-circle-outline'}
                          size={14}
                          color={findingColor}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.acquisitionFindingTitle, { color: findingColor }]}>{finding.title}</Text>
                          <Text style={styles.acquisitionFindingText}>{finding.description}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.acquisitionOperatingProfile}>
                Structural profile: {((biz.acquisition.persistentRevenueModifier ?? 0) * 100) >= 0 ? '+' : ''}
                {((biz.acquisition.persistentRevenueModifier ?? 0) * 100).toFixed(1)}% revenue • {((biz.acquisition.persistentExpenseModifier ?? 0) * 100) >= 0 ? '+' : ''}
                {((biz.acquisition.persistentExpenseModifier ?? 0) * 100).toFixed(1)}% expenses
              </Text>
            </View>

            {biz.acquisition.integrationStrategy === 'pending' ? (
              <>
                <Text style={styles.integrationPrompt}>Choose how to integrate this company. The integration clock begins only after you choose.</Text>
                {INTEGRATION_STRATEGIES.map((strategy) => {
                  const profile = getIntegrationStrategyProfile(
                    biz.acquisition!.baseIntegrationWeeks,
                    biz.acquisition!.baseIntegrationPenalty,
                    biz.acquisition!.diligenceScore,
                    strategy,
                  );
                  return (
                    <Pressable
                      key={strategy}
                      style={styles.integrationChoice}
                      onPress={() => setAcquisitionIntegrationStrategy(biz.id, strategy)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.integrationChoiceTitle}>{profile.label}</Text>
                        <Text style={styles.integrationChoiceDesc}>{profile.description}</Text>
                        <Text style={styles.integrationChoiceMeta}>
                          {profile.weeks} weeks • {Math.round(profile.penalty * 100)}% initial disruption • {Math.round(profile.successChance * 100)}% target success chance
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </Pressable>
                  );
                })}
              </>
            ) : biz.acquisition.integrationOutcome === 'pending' ? (
              <View style={styles.integrationActive}>
                <Ionicons name="git-merge-outline" size={20} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.integrationActiveTitle}>
                    {biz.acquisition.integrationStrategy === 'independent' ? 'Keep Independent' : biz.acquisition.integrationStrategy === 'integrate' ? 'Integrating Operations' : 'Aggressive Turnaround'}
                  </Text>
                  <Text style={styles.integrationActiveText}>
                    {biz.acquisition.integrationWeeksRemaining} weeks remaining • {Math.round((biz.acquisition.integrationPenalty ?? 0) * 100)}% temporary disruption
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.integrationResult}>
                <Text style={styles.integrationResultTitle}>
                  Integration {biz.acquisition.integrationOutcome.toUpperCase()}
                </Text>
                <Text style={styles.integrationResultText}>
                  Permanent revenue effect {(biz.acquisition.postIntegrationRevenueBonus ?? 0) >= 0 ? '+' : ''}{((biz.acquisition.postIntegrationRevenueBonus ?? 0) * 100).toFixed(1)}% • expense reduction {((biz.acquisition.postIntegrationExpenseReduction ?? 0) * 100).toFixed(1)}%
                </Text>
              </View>
            )}
          </GameCard>
        )}

        {pendingDecision && (
          <GameCard>
            <View style={[styles.decisionBanner, pendingDecision.kind === 'crisis' && styles.crisisBanner]}>
              <Text style={styles.decisionIcon}>{pendingDecision.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.decisionEyebrow, pendingDecision.kind === 'crisis' && { color: Colors.negative }]}>
                  {pendingDecision.kind === 'crisis' ? 'CRISIS — ATTENTION REQUIRED' : 'STRATEGIC DECISION'}
                </Text>
                <Text style={styles.decisionTitle}>{pendingDecision.title}</Text>
                <Text style={styles.decisionDesc}>{pendingDecision.description}</Text>
                <Text style={styles.decisionDeadline}>
                  {decisionWeeksLeft > 0 ? `${decisionWeeksLeft} week${decisionWeeksLeft === 1 ? '' : 's'} to respond` : 'Final response week'}
                </Text>
                {pendingDecision.insuranceArea && (
                  <Text style={styles.decisionInsurance}>
                    Insurance at incident time: {BUSINESS_INSURANCE_AREAS[pendingDecision.insuranceArea].name} • {(pendingDecision.insuranceTierAtCreation ?? 'none').toUpperCase()}
                  </Text>
                )}
              </View>
            </View>
            {(pendingDecision.choices ?? []).map((choice) => {
              const grossCost = getBusinessDecisionChoiceCost(choice, inflationMultiplier);
              const insuranceQuote = pendingDecision.insuranceArea && grossCost > 0
                ? getBusinessInsuranceLossQuote(pendingDecision.insuranceTierAtCreation ?? 'none', grossCost)
                : { netLoss: grossCost, payout: 0, deductible: grossCost };
              const scaledCost = insuranceQuote.netLoss;
              const affordable = (biz.balance ?? 0) >= scaledCost;
              return (
                <Pressable
                  key={choice.id}
                  disabled={!affordable}
                  style={[styles.decisionChoice, !affordable && { opacity: 0.35 }]}
                  onPress={() => resolveBusinessDecision(biz.id, choice.id)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.decisionChoiceTitle}>{choice.text}</Text>
                    <Text style={styles.decisionChoiceDesc}>{choice.description}</Text>
                    <Text style={styles.decisionEffects}>
                      {choice.durationWeeks && choice.durationWeeks > 1 ? `${choice.durationWeeks}wk effect` : 'Immediate'}
                      {choice.revenueMultiplier && choice.revenueMultiplier !== 1 ? ` • Revenue ${choice.revenueMultiplier > 1 ? '+' : ''}${Math.round((choice.revenueMultiplier - 1) * 100)}%` : ''}
                      {choice.expenseMultiplier && choice.expenseMultiplier !== 1 ? ` • Costs ${choice.expenseMultiplier > 1 ? '+' : ''}${Math.round((choice.expenseMultiplier - 1) * 100)}%` : ''}
                      {choice.reputationDelta ? ` • Rep ${choice.reputationDelta > 0 ? '+' : ''}${choice.reputationDelta}` : ''}
                      {choice.marketShareDelta ? ` • Share ${choice.marketShareDelta > 0 ? '+' : ''}${choice.marketShareDelta}` : ''}
                      {choice.moraleDelta ? ` • Morale ${choice.moraleDelta > 0 ? '+' : ''}${choice.moraleDelta}` : ''}
                      {choice.workforceCompensationPolicy ? ` • Pay: ${CORPORATE_COMPENSATION_POLICIES[choice.workforceCompensationPolicy].label}` : ''}
                      {choice.workforceTrainingPolicy ? ` • Training: ${CORPORATE_TRAINING_POLICIES[choice.workforceTrainingPolicy].label}` : ''}
                      {choice.workforceRelationsDelta ? ` • Relations ${choice.workforceRelationsDelta > 0 ? '+' : ''}${choice.workforceRelationsDelta}` : ''}
                      {choice.workforceTargetMultiplier ? ` • Staffing targets ${Math.round((choice.workforceTargetMultiplier - 1) * 100)}%` : ''}
                    </Text>
                    {grossCost > 0 && insuranceQuote.payout > 0 && (
                      <Text style={styles.decisionInsurancePayout}>
                        Gross {formatCurrency(grossCost)} • insurer pays {formatCurrency(insuranceQuote.payout)} • your cost {formatCurrency(insuranceQuote.netLoss)}
                      </Text>
                    )}
                  </View>
                  {scaledCost > 0 && <Text style={[styles.decisionCost, !affordable && { color: Colors.negative }]}>{formatCurrency(scaledCost)}</Text>}
                </Pressable>
              );
            })}
          </GameCard>
        )}

        <GameCard title="Strategic Direction">
          <Text style={styles.sectionHint}>Persistent company posture. Routine strategic reviews are spaced roughly 12–24 weeks apart and their meaningful effects usually last 16–24 weeks.</Text>

          <View style={styles.strategyStatusGrid}>
            <View style={styles.strategyStatusCard}>
              <Text style={styles.strategyStatusLabel}>CURRENT PROGRAM</Text>
              <Text style={styles.strategyStatusValue} numberOfLines={1}>
                {primaryStrategicProgram ? primaryStrategicProgram.title.replace(' (Auto)', '') : 'No active program'}
              </Text>
              <Text style={styles.strategyStatusMeta}>
                {primaryStrategicProgram
                  ? `${strategyProgramWeeksRemaining} week${strategyProgramWeeksRemaining === 1 ? '' : 's'} remaining`
                  : 'Company is between strategic programs'}
              </Text>
            </View>
            <View style={styles.strategyStatusCard}>
              <Text style={styles.strategyStatusLabel}>NEXT BOARD REVIEW</Text>
              <Text style={[styles.strategyStatusValue, waitingStrategicDecision && { color: Colors.warning }]}>
                {waitingStrategicDecision ? 'Decision waiting' : estimatedStrategicReviewWeeks <= 0 ? 'Due now' : `~${estimatedStrategicReviewWeeks} weeks`}
              </Text>
              <Text style={styles.strategyStatusMeta}>
                {waitingStrategicDecision
                  ? `${pendingDecision?.title ?? 'Strategic review'} needs a choice`
                  : strategyProgramWeeksRemaining > scheduledStrategicReviewWeeks
                    ? 'Current program must finish first'
                    : biz.autoStrategicDecisions
                      ? 'Auto Strategy will handle routine review'
                      : 'You will be asked for the next direction'}
              </Text>
            </View>
          </View>

          <View style={styles.autoStrategyRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.autoStrategyTitleRow}>
                <Ionicons name="flash-outline" size={15} color={biz.autoStrategicDecisions ? Colors.primary : Colors.textMuted} />
                <Text style={styles.autoStrategyTitle}>Auto Strategy</Text>
                <StatusPill
                  compact
                  label={biz.autoStrategicDecisions ? 'ON' : 'OFF'}
                  color={biz.autoStrategicDecisions ? Colors.primary : Colors.textSecondary}
                />
              </View>
              <Text style={styles.autoStrategyDesc}>
                {biz.autoStrategicDecisions
                  ? 'Routine strategy and corporate HR choices follow the strategic focus below. Crises still require your decision.'
                  : 'Turn this on to reduce routine choice prompts. Crises always remain manual.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: !!biz.autoStrategicDecisions }}
              hitSlop={{ top: 8, bottom: 8 }}
              style={[styles.autoStrategyToggle, biz.autoStrategicDecisions && styles.autoStrategyToggleOn]}
              onPress={() => setBusinessDecisionAutomation(biz.id, !biz.autoStrategicDecisions)}
            >
              <View style={[styles.autoStrategyThumb, biz.autoStrategicDecisions && styles.autoStrategyThumbOn]} />
            </Pressable>
          </View>

          <Text style={styles.subHeading}>Strategic Focus</Text>
          <View style={styles.strategyFocusGrid}>
            {STRATEGIC_FOCUS_OPTIONS.map((option) => (
              <Pressable
                key={option.key}
                style={[styles.strategyFocus, (biz.strategicFocus ?? 'balanced') === option.key && styles.strategyFocusActive]}
                onPress={() => setBusinessStrategicFocus(biz.id, option.key)}
              >
                <Text style={[styles.strategyFocusTitle, (biz.strategicFocus ?? 'balanced') === option.key && { color: Colors.primary }]}>{option.label}</Text>
                <Text style={styles.strategyFocusDesc}>{option.desc}</Text>
              </Pressable>
            ))}
          </View>
          {(biz.strategyModifiers ?? []).length > 0 && (
            <View style={styles.activeStrategyBox}>
              <Text style={styles.subHeading}>Temporary Effects</Text>
              {(biz.strategyModifiers ?? []).map((modifier) => {
                const revenuePct = Math.round(((modifier.revenueMultiplier ?? 1) - 1) * 100);
                const expensePct = Math.round(((modifier.expenseMultiplier ?? 1) - 1) * 100);
                const effectParts = [
                  revenuePct !== 0 ? `Revenue ${revenuePct > 0 ? '+' : ''}${revenuePct}%` : null,
                  expensePct !== 0 ? `Costs ${expensePct > 0 ? '+' : ''}${expensePct}%` : null,
                ].filter(Boolean);
                return (
                  <View key={modifier.id} style={styles.activeStrategyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actionName}>{modifier.title}</Text>
                      {effectParts.length > 0 && <Text style={styles.strategyEffectMeta}>{effectParts.join(' • ')}</Text>}
                    </View>
                    <Text style={styles.rivalMeta}>{modifier.weeksRemaining}wk</Text>
                  </View>
                );
              })}
            </View>
          )}
        </GameCard>

          </>
        )}

        {activeSection === 'ownership' && (
          <>
        <View collapsable={false} />
        <GameCard title="Ownership Structure">
          <View style={styles.ownershipSummary}>
            <View>
              <Text style={styles.summaryLabel}>Your Equity</Text>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>{playerOwnershipPct.toFixed(1)}%</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.summaryLabel}>Personal Value</Text>
              <Text style={styles.ownershipValue}>{formatCurrency((biz.valuation ?? 0) * playerOwnershipPct / 100)}</Text>
            </View>
          </View>
          <Text style={styles.controlNote}>
            Current governance requires the playable owner to retain at least 51% voting control. A full company sale requires 100% ownership. Lifetime family transfers use game transfer taxes so they cannot freely bypass inheritance tax.
          </Text>
          {ownership.map((stake, index) => (
            <View key={`${stake.ownerType}_${stake.ownerId}_${index}`} style={styles.ownerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerName}>{stake.ownerName}</Text>
                <Text style={styles.ownerType}>{stake.ownerType.replace('_', ' ')} • Voting {stake.votingPercent.toFixed(1)}%</Text>
              </View>
              <Text style={styles.ownerPct}>{stake.percent.toFixed(1)}%</Text>
            </View>
          ))}

          {!equityStructuringUnlocked && (
            <View style={styles.lockedEquity}>
              <Ionicons name="lock-closed-outline" size={15} color={Colors.textMuted} />
              <Text style={styles.lockedEquityText}>New share transfers unlock when the company reaches Regional scale.</Text>
            </View>
          )}

          {playerOwnershipPct > 0 && equityStructuringUnlocked && (
            <>
              <Text style={styles.subHeading}>Raise / Transfer Equity</Text>
              <View style={styles.shareActions}>
                <Pressable
                  disabled={!canIssue5}
                  style={[styles.shareButton, !canIssue5 && { opacity: 0.35 }]}
                  onPress={() => confirmAction(
                    'Issue New Shares',
                    `Issue 5% new equity to outside investors? Existing owners will be diluted proportionally and the company should raise about ${formatCurrency(Math.round((biz.valuation ?? 0) * 0.05 * 0.90))}.`,
                    () => transferBusinessShares(biz.id, 'investor', null, 5),
                  )}
                >
                  <Text style={styles.shareButtonTitle}>Sell 5%</Text>
                  <Text style={styles.shareButtonMeta}>Outside investor</Text>
                </Pressable>
                <Pressable
                  disabled={!canIssue10}
                  style={[styles.shareButton, !canIssue10 && { opacity: 0.35 }]}
                  onPress={() => confirmAction(
                    'Issue New Shares',
                    `Issue 10% new equity to outside investors? Existing owners will be diluted proportionally and the company should raise about ${formatCurrency(Math.round((biz.valuation ?? 0) * 0.10 * 0.90))}.`,
                    () => transferBusinessShares(biz.id, 'investor', null, 10),
                  )}
                >
                  <Text style={styles.shareButtonTitle}>Sell 10%</Text>
                  <Text style={styles.shareButtonMeta}>Raise company cash</Text>
                </Pressable>
              </View>

              {relationshipState?.estatePlan?.structure === 'family_trust' && (
                <View style={styles.shareActions}>
                  <Pressable
                    disabled={!canTransfer5 || cash < trustShareTransferTax}
                    style={[styles.shareButton, (!canTransfer5 || cash < trustShareTransferTax) && { opacity: 0.35 }]}
                    onPress={() => confirmAction(
                      'Transfer Shares to Trust',
                      `Move 5 percentage points of your personal ownership into the Family Trust? Current value: ${formatCurrency(fivePctStakeValue)}. Game transfer levy: ${formatCurrency(trustShareTransferTax)} from personal cash. Future appreciation and trust-held shares remain outside your personal estate.`,
                      () => transferBusinessShares(biz.id, 'family_trust', null, 5),
                    )}
                  >
                    <Text style={styles.shareButtonTitle}>Trust 5%</Text>
                    <Text style={styles.shareButtonMeta}>Outside personal estate</Text>
                  </Pressable>
                  <View style={styles.shareInfo}>
                    <Text style={styles.shareInfoText}>Trust currently owns {familyTrustPct.toFixed(1)}%</Text>
                  </View>
                </View>
              )}

              {adultChildren.map((child) => (
                <View key={child.id} style={styles.childShareRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actionName}>{child.name}</Text>
                    <Text style={styles.actionDesc}>Parent bond {Math.round(child.parentRelationship ?? 75)}%</Text>
                  </View>
                  <Pressable
                    disabled={!canTransfer5 || cash < childShareGiftTax}
                    style={[styles.smallShareButton, (!canTransfer5 || cash < childShareGiftTax) && { opacity: 0.35 }]}
                    onPress={() => confirmAction(
                      'Gift Business Shares',
                      `Permanently gift 5 percentage points of your ownership in ${biz.name} to ${child.name}? Current value: ${formatCurrency(fivePctStakeValue)}. Family transfer tax: ${formatCurrency(childShareGiftTax)} from personal cash. The child owns these shares before any later inheritance.`,
                      () => transferBusinessShares(biz.id, 'child', child.id, 5),
                    )}
                  >
                    <Text style={styles.smallShareText}>Give 5%</Text>
                  </Pressable>
                </View>
              ))}
            </>
          )}

          {investorOwnershipPct > 0 && (
            <Pressable style={styles.buybackButton} onPress={() => {
                const pct = Math.min(5, investorOwnershipPct);
                const cost = Math.round((biz.valuation ?? 0) * (pct / 100) * 1.05);
                confirmAction(
                  'Buy Back Investor Shares',
                  `Use about ${formatCurrency(cost)} of company cash to repurchase and retire ${pct.toFixed(1)}% of investor equity?`,
                  () => buyBackInvestorShares(biz.id, pct),
                );
              }}>
              <Text style={styles.buybackText}>Buy Back {Math.min(5, investorOwnershipPct).toFixed(0)}% Investor Shares</Text>
            </Pressable>
          )}

          {biz.familyBusiness?.isFamilyBusiness && familyTrustCash > 0 && (
            <View style={styles.trustReserveBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerName}>Family Trust Reserve</Text>
                <Text style={styles.ownerType}>{formatCurrency(familyTrustCash)} available for family-company capital</Text>
              </View>
              <View style={styles.trustCapitalButtons}>
                {[10000, 50000].filter((amount) => amount <= familyTrustCash).map((amount) => (
                  <Pressable
                    key={amount}
                    style={styles.smallShareButton}
                    onPress={() => confirmAction(
                      'Trust Capital',
                      `Invest ${formatCurrency(amount)} from the Family Trust into ${biz.name}? This money stays inside the family company.`,
                      () => investFamilyTrustCashInBusiness(biz.id, amount),
                    )}
                  >
                    <Text style={styles.smallShareText}>{formatCurrency(amount)}</Text>
                  </Pressable>
                ))}
                {familyTrustCash < 10000 && (
                  <Pressable
                    style={styles.smallShareButton}
                    onPress={() => investFamilyTrustCashInBusiness(biz.id, familyTrustCash)}
                  >
                    <Text style={styles.smallShareText}>All</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </GameCard>

        {adultChildren.length > 0 && (
          <GameCard title="Family Governance">
            <Text style={styles.sectionHint}>
              Adult children can enter management, sit on the board, or train as a successor candidate. Their personality and education determine starting performance. Estate Planning still decides the legal business heir.
            </Text>
            {adultChildren.map((child) => {
              const familyRole = (biz.familyRoles ?? []).find((role) => role.childId === child.id);
              return (
                <View key={child.id} style={styles.governanceChild}>
                  <View style={styles.governanceHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ownerName}>{child.name}</Text>
                      <Text style={styles.ownerType}>
                        {child.occupationTitle ?? 'Independent'} • {familyRole ? `${familyRole.role} • Performance ${Math.round(familyRole.performance)} • ${formatCurrency(familyRole.weeklySalary ?? 0)}/wk` : 'Not involved'}
                      </Text>
                      {(child.parentRelationship ?? 75) < 30 && <Text style={styles.governanceWarning}>Estranged — refuses family appointment</Text>}
                    </View>
                  </View>
                  <View style={styles.governanceButtons}>
                    {GOVERNANCE_ROLES.map((role) => {
                      const isOperatingRole = role.key !== 'board';
                      const operatingElsewhere = isOperatingRole && businesses.some((otherBusiness) =>
                        otherBusiness.id !== biz.id
                        && (otherBusiness.familyRoles ?? []).some((otherRole) =>
                          otherRole.childId === child.id && otherRole.role !== 'board'
                        )
                      );
                      const unavailable = (child.parentRelationship ?? 75) < 30 || operatingElsewhere;
                      return (
                        <Pressable
                          key={role.key}
                          disabled={unavailable}
                          style={[
                            styles.governanceButton,
                            familyRole?.role === role.key && styles.governanceButtonActive,
                            unavailable && { opacity: 0.35 },
                          ]}
                          onPress={() => appointChildToBusiness(biz.id, child.id, role.key)}
                        >
                          <Text style={[styles.governanceButtonText, familyRole?.role === role.key && { color: Colors.primary }]}>{role.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </GameCard>
        )}

          </>
        )}

        {activeSection === 'leadership' && (
          <>
        <View collapsable={false} />
        {((biz.valuation ?? 0) >= 10_000_000 || (biz.executives?.length ?? 0) > 0 || !!biz.pendingExecutiveSearch || !!biz.boardGovernance) && (
          <GameCard title="Executive Leadership & Board">
            <Text style={styles.sectionHint}>
              Professional executives specialize in finance, operations, technology, growth and legal risk. Family Governance remains separate for dynasty roles and succession.
            </Text>

            <View style={styles.execEffectGrid}>
              <View style={styles.execEffectItem}>
                <Text style={styles.execEffectValue}>
                  {governanceEffects.revenueBonus >= 0 ? '+' : ''}{(governanceEffects.revenueBonus * 100).toFixed(1)}%
                </Text>
                <Text style={styles.execEffectLabel}>Revenue</Text>
              </View>
              <View style={styles.execEffectItem}>
                <Text style={styles.execEffectValue}>
                  {governanceEffects.expenseReduction >= 0 ? '-' : '+'}{Math.abs(governanceEffects.expenseReduction * 100).toFixed(1)}%
                </Text>
                <Text style={styles.execEffectLabel}>Expenses</Text>
              </View>
              <View style={styles.execEffectItem}>
                <Text style={styles.execEffectValue}>-{(governanceEffects.financingRateReduction * 100).toFixed(2)}pp</Text>
                <Text style={styles.execEffectLabel}>Finance rate</Text>
              </View>
              <View style={styles.execEffectItem}>
                <Text style={styles.execEffectValue}>-{(governanceEffects.crisisReduction * 100).toFixed(1)}%</Text>
                <Text style={styles.execEffectLabel}>Crisis risk</Text>
              </View>
            </View>
            <Text style={styles.execPayroll}>
              Executive payroll {formatCurrency(governanceEffects.executiveWeeklySalary)}/wk
              {governanceEffects.boardWeeklyCost > 0 ? ` • Board fees ${formatCurrency(governanceEffects.boardWeeklyCost)}/wk` : ''}
            </Text>

            <Text style={styles.subHeading}>C-suite</Text>
            {(Object.keys(BUSINESS_EXECUTIVE_ROLES) as BusinessExecutiveRole[]).map((role) => {
              const definition = BUSINESS_EXECUTIVE_ROLES[role];
              const executive = (biz.executives ?? []).find((item) => item.role === role);
              const eligibility = getExecutiveRoleEligibility(biz, role);
              const searchActive = biz.pendingExecutiveSearch?.role === role;
              const searchCooldown = getExecutiveSearchCooldownWeeks(biz, role, globalGameWeek);
              const searchBlockedByOtherRole = !!biz.pendingExecutiveSearch && !searchActive;
              const severance = executive ? Math.round((executive.weeklySalary ?? 0) * 6) : 0;

              return (
                <View key={role} style={styles.execRoleRow}>
                  <View style={styles.execRoleBadge}>
                    <Text style={styles.execRoleBadgeText}>{definition.shortLabel}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.execRoleName}>{definition.label}</Text>
                    {executive ? (
                      <>
                        <Text style={styles.execName}>
                          {executive.name} • Performance {Math.round(executive.performance)}
                        </Text>
                        <Text style={styles.execMeta}>
                          {executive.trait.replace(/_/g, ' ')} • {formatCurrency(executive.weeklySalary)}/wk • {executive.tenureWeeks}w tenure
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.execVacant}>Vacant</Text>
                        <Text style={styles.execMeta}>
                          {eligibility.allowed
                            ? definition.description
                            : eligibility.reason}
                        </Text>
                      </>
                    )}
                  </View>
                  {executive ? (
                    <Pressable
                      disabled={(biz.balance ?? 0) < severance}
                      style={[styles.execSmallButton, (biz.balance ?? 0) < severance && styles.disabledAction]}
                      onPress={() => confirmAction(
                        'Dismiss Executive',
                        `Dismiss ${executive.name} from the ${definition.shortLabel} role? Severance costs ${formatCurrency(severance)}.`,
                        () => dismissBusinessExecutive(biz.id, executive.id),
                      )}
                    >
                      <Text style={styles.execSmallButtonText}>Dismiss</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      disabled={!eligibility.allowed || searchActive || searchCooldown > 0 || searchBlockedByOtherRole}
                      style={[
                        styles.execSmallButton,
                        eligibility.allowed && searchCooldown <= 0 && !searchBlockedByOtherRole && styles.execSearchButton,
                        (!eligibility.allowed || searchActive || searchCooldown > 0 || searchBlockedByOtherRole) && styles.disabledAction,
                      ]}
                      onPress={() => openExecutiveSearch(biz.id, role)}
                    >
                      <Text style={[styles.execSmallButtonText, eligibility.allowed && searchCooldown <= 0 && !searchBlockedByOtherRole && { color: Colors.info }]}>
                        {searchActive ? 'Active' : searchBlockedByOtherRole ? 'Wait' : searchCooldown > 0 ? `${searchCooldown}w` : 'Search'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}

            {biz.pendingExecutiveSearch && (
              <View style={styles.execSearchBox}>
                <View style={styles.execSearchHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.execSearchTitle}>
                      {BUSINESS_EXECUTIVE_ROLES[biz.pendingExecutiveSearch.role].shortLabel} Search
                    </Text>
                    <Text style={styles.execSearchMeta}>Choose one candidate. Signing/search fee is paid immediately.</Text>
                  </View>
                  <Pressable onPress={() => cancelExecutiveSearch(biz.id)} hitSlop={8}>
                    <Ionicons name="close" size={17} color={Colors.textMuted} />
                  </Pressable>
                </View>
                {(biz.pendingExecutiveSearch.candidates ?? []).map((candidate) => {
                  const affordable = (biz.balance ?? 0) >= candidate.signingFee;
                  return (
                    <View key={candidate.id} style={styles.execCandidateRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.execCandidateName}>{candidate.name}</Text>
                        <Text style={styles.execCandidateMeta}>
                          Performance {candidate.performance} • {candidate.trait.replace(/_/g, ' ')}
                        </Text>
                        <Text style={styles.execCandidateMeta}>
                          {formatCurrency(candidate.weeklySalary)}/wk • Signing/search {formatCurrency(candidate.signingFee)}
                        </Text>
                      </View>
                      <Pressable
                        disabled={!affordable}
                        style={[styles.execHireButton, !affordable && styles.disabledAction]}
                        onPress={() => hireExecutiveCandidate(biz.id, candidate.id)}
                      >
                        <Text style={styles.execHireButtonText}>{affordable ? 'Hire' : 'Need cash'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            {((biz.valuation ?? 0) >= BOARD_GOVERNANCE_UNLOCK_VALUATION || !!biz.boardGovernance) && (
              <View style={styles.boardSection}>
                <View style={styles.boardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boardTitle}>Board Governance</Text>
                    <Text style={styles.boardMeta}>
                      {biz.boardGovernance
                        ? `${BUSINESS_BOARD_MANDATES[biz.boardGovernance.mandate].label} • Confidence ${Math.round(biz.boardGovernance.confidence)}/100`
                        : 'Not yet established'}
                    </Text>
                  </View>
                  <Ionicons name="people-circle-outline" size={20} color={biz.boardGovernance ? Colors.info : Colors.textMuted} />
                </View>

                {!!biz.boardGovernance?.lastReviewSummary && (
                  <Text style={styles.boardReview}>{biz.boardGovernance.lastReviewSummary}</Text>
                )}

                <View style={styles.boardMandateGrid}>
                  {(Object.keys(BUSINESS_BOARD_MANDATES) as BusinessBoardMandate[]).map((mandate) => {
                    const definition = BUSINESS_BOARD_MANDATES[mandate];
                    const active = biz.boardGovernance?.mandate === mandate;
                    const disabled = !!biz.boardGovernance && boardMandateCooldown > 0 && !active;
                    return (
                      <Pressable
                        key={mandate}
                        disabled={disabled || active}
                        style={[
                          styles.boardMandateChip,
                          active && styles.boardMandateChipActive,
                          disabled && styles.disabledAction,
                        ]}
                        onPress={() => setBusinessBoardMandate(biz.id, mandate)}
                      >
                        <Text style={[styles.boardMandateTitle, active && { color: Colors.primary }]}>{definition.label}</Text>
                        <Text style={styles.boardMandateDesc}>{definition.description}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {boardMandateCooldown > 0 && (
                  <Text style={styles.boardCooldown}>Board mandate can change again in {boardMandateCooldown} weeks.</Text>
                )}
              </View>
            )}
          </GameCard>
        )}

        <View collapsable={false} onLayout={(event) => recordManagementSection('workforce', event)} />
        {((biz.valuation ?? 0) >= 20_000_000 || !!corporateWorkforce) && (
          <GameCard title="Corporate Workforce">
            {!corporateWorkforce ? (
              <View style={styles.workforceLocked}>
                <Ionicons name="people-outline" size={21} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.workforceLockedTitle}>Department workforce unlocks at €25M valuation</Text>
                  <Text style={styles.workforceLockedText}>
                    Named employees remain key people. At corporate scale, broader Operations, Sales, Finance, Technology and Support headcount becomes a separate management layer.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.workforceSummary}>
                  <View style={styles.workforceSummaryMain}>
                    <Text style={styles.workforceSummaryValue}>{workforceHeadcount}</Text>
                    <Text style={styles.workforceSummaryLabel}>Employees</Text>
                  </View>
                  <View style={styles.workforceSummaryStat}>
                    <Text style={styles.workforceSummarySmall}>{workforceTargetHeadcount}</Text>
                    <Text style={styles.workforceSummaryLabel}>Target</Text>
                  </View>
                  <View style={styles.workforceSummaryStat}>
                    <Text style={styles.workforceSummarySmall}>{workforceRecommendedTotal}</Text>
                    <Text style={styles.workforceSummaryLabel}>Recommended</Text>
                  </View>
                  <View style={styles.workforceSummaryStat}>
                    <Text style={styles.workforceSummarySmall}>{workforceEffects.staffingScore}%</Text>
                    <Text style={styles.workforceSummaryLabel}>Staffing</Text>
                  </View>
                </View>

                <Text style={styles.workforcePayrollText}>
                  Department payroll {formatCurrency(workforcePayroll)}/wk • Named employees and C-suite are shown separately.
                </Text>
                <Text style={styles.workforceEffectText}>
                  Current capacity effect: {workforceEffects.revenueBonus >= 0 ? '+' : ''}{(workforceEffects.revenueBonus * 100).toFixed(1)}% revenue • {workforceEffects.expenseReduction >= 0 ? '-' : '+'}{Math.abs(workforceEffects.expenseReduction * 100).toFixed(1)}% overhead • {workforceEffects.crisisReduction >= 0 ? '-' : '+'}{Math.abs(workforceEffects.crisisReduction * 100).toFixed(1)}% risk
                </Text>

                <View style={styles.hrSummary}>
                  <View style={styles.hrSummaryItem}>
                    <Text style={styles.hrSummaryValue}>{Math.round(corporateWorkforce.employeeRelations ?? 70)}</Text>
                    <Text style={styles.hrSummaryLabel}>Relations</Text>
                  </View>
                  <View style={styles.hrSummaryItem}>
                    <Text style={styles.hrSummaryValue}>{Math.round(corporateWorkforce.laborMarketPressure ?? 50)}</Text>
                    <Text style={styles.hrSummaryLabel}>Labor pressure</Text>
                  </View>
                  <View style={styles.hrSummaryItem}>
                    <Text style={[styles.hrSummaryValue, (corporateWorkforce.recentTurnover ?? 0) > 0 && { color: Colors.warning }]}>
                      {corporateWorkforce.recentTurnover ?? 0}
                    </Text>
                    <Text style={styles.hrSummaryLabel}>Turnover</Text>
                  </View>
                  <View style={styles.hrSummaryItem}>
                    <Text style={styles.hrSummaryValue}>{formatCurrency(workforceTrainingCost)}</Text>
                    <Text style={styles.hrSummaryLabel}>Training/wk</Text>
                  </View>
                </View>

                <View style={styles.hrPolicySection}>
                  <View style={styles.hrPolicyHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hrPolicyTitle}>Compensation Policy</Text>
                      <Text style={styles.hrPolicyDesc}>{CORPORATE_COMPENSATION_POLICIES[workforceCompensationPolicy].description}</Text>
                    </View>
                    <Text style={styles.hrPolicyCurrent}>{CORPORATE_COMPENSATION_POLICIES[workforceCompensationPolicy].label}</Text>
                  </View>
                  <View style={styles.hrPolicyChips}>
                    {(Object.keys(CORPORATE_COMPENSATION_POLICIES) as CorporateCompensationPolicy[]).map((policy) => {
                      const active = workforceCompensationPolicy === policy;
                      const disabled = hrPolicyCooldown > 0 && !active;
                      return (
                        <Pressable
                          key={policy}
                          disabled={active || disabled}
                          style={[styles.hrPolicyChip, active && styles.hrPolicyChipActive, disabled && styles.disabledAction]}
                          onPress={() => setCorporateCompensationPolicy(biz.id, policy)}
                        >
                          <Text style={[styles.hrPolicyChipTitle, active && { color: Colors.primary }]}>
                            {CORPORATE_COMPENSATION_POLICIES[policy].label}
                          </Text>
                          <Text style={styles.hrPolicyChipMeta}>
                            {Math.round(CORPORATE_COMPENSATION_POLICIES[policy].wageMultiplier * 100)}% wage
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.hrPolicySection}>
                  <View style={styles.hrPolicyHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hrPolicyTitle}>Training Policy</Text>
                      <Text style={styles.hrPolicyDesc}>{CORPORATE_TRAINING_POLICIES[workforceTrainingPolicy].description}</Text>
                    </View>
                    <Text style={styles.hrPolicyCurrent}>{CORPORATE_TRAINING_POLICIES[workforceTrainingPolicy].label}</Text>
                  </View>
                  <View style={styles.hrPolicyChips}>
                    {(Object.keys(CORPORATE_TRAINING_POLICIES) as CorporateTrainingPolicy[]).map((policy) => {
                      const active = workforceTrainingPolicy === policy;
                      const disabled = hrPolicyCooldown > 0 && !active;
                      return (
                        <Pressable
                          key={policy}
                          disabled={active || disabled}
                          style={[styles.hrPolicyChip, active && styles.hrPolicyChipActive, disabled && styles.disabledAction]}
                          onPress={() => setCorporateTrainingPolicy(biz.id, policy)}
                        >
                          <Text style={[styles.hrPolicyChipTitle, active && { color: Colors.primary }]}>
                            {CORPORATE_TRAINING_POLICIES[policy].label}
                          </Text>
                          <Text style={styles.hrPolicyChipMeta}>
                            {(CORPORATE_TRAINING_POLICIES[policy].payrollCostPct * 100).toFixed(1)}% payroll
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {hrPolicyCooldown > 0 && (
                    <Text style={styles.hrPolicyCooldown}>HR policy can change again in {hrPolicyCooldown} weeks.</Text>
                  )}
                </View>

                {(Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]).map((departmentId) => {
                  const definition = CORPORATE_DEPARTMENT_DEFINITIONS[departmentId];
                  const department = corporateWorkforce.departments[departmentId];
                  const recommended = workforceRecommended[departmentId] ?? department.headcount;
                  const ratio = workforceEffects.departmentRatios[departmentId];
                  const step = recommended < 50 ? 5 : 10;
                  const executive = definition.executiveRole
                    ? (biz.executives ?? []).find((item) => item.role === definition.executiveRole)
                    : null;
                  const statusColor = ratio >= 0.95
                    ? Colors.primary
                    : ratio >= 0.78
                      ? Colors.warning
                      : Colors.negative;

                  return (
                    <View key={departmentId} style={styles.workforceDepartment}>
                      <View style={styles.workforceDepartmentHeader}>
                        <View style={styles.workforceDepartmentIcon}>
                          <Text style={styles.workforceDepartmentEmoji}>{definition.icon}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.workforceTitleRow}>
                            <Text style={styles.workforceDepartmentName}>{definition.name}</Text>
                            <Text style={[styles.workforceCapacity, { color: statusColor }]}>
                              {Math.round(ratio * 100)}% capacity
                            </Text>
                          </View>
                          <Text style={styles.workforceDepartmentMeta}>
                            {department.headcount} current • {department.targetHeadcount} target • {recommended} recommended
                          </Text>
                          <Text style={styles.workforceDepartmentMeta}>
                            Skill {Math.round(department.averageSkill)} • Morale {Math.round(department.morale)} • {formatCurrency(department.weeklyWage)}/employee/wk
                          </Text>
                          <Text style={styles.workforceLeader}>
                            {executive
                              ? `Led by ${BUSINESS_EXECUTIVE_ROLES[executive.role].shortLabel} ${executive.name}`
                              : definition.executiveRole
                                ? `${BUSINESS_EXECUTIVE_ROLES[definition.executiveRole].shortLabel} role vacant`
                                : 'No dedicated executive role'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.workforceTargetControls}>
                        <Pressable
                          style={styles.workforceTargetButton}
                          onPress={() => setCorporateDepartmentTarget(
                            biz.id,
                            departmentId,
                            department.targetHeadcount - step,
                          )}
                        >
                          <Text style={styles.workforceTargetButtonText}>−{step}</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.workforceTargetButton, styles.workforceRecommendedButton]}
                          onPress={() => setCorporateDepartmentTarget(biz.id, departmentId, recommended)}
                        >
                          <Text style={[styles.workforceTargetButtonText, { color: Colors.info }]}>Recommended</Text>
                        </Pressable>
                        <Pressable
                          style={styles.workforceTargetButton}
                          onPress={() => setCorporateDepartmentTarget(
                            biz.id,
                            departmentId,
                            department.targetHeadcount + step,
                          )}
                        >
                          <Text style={styles.workforceTargetButtonText}>+{step}</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                <View style={styles.workforcePlanNote}>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.workforcePlanText}>
                    Targets execute gradually each week. Hiring costs about 2 weeks of salary per new employee; layoffs cost about 1.5 weeks of salary in severance and temporarily hurt department morale.
                  </Text>
                </View>
                {!!corporateWorkforce.lastChangeSummary && (
                  <Text style={styles.workforceLastChange}>Last change: {corporateWorkforce.lastChangeSummary}</Text>
                )}
              </>
            )}
          </GameCard>
        )}

        {corporateWorkforce && quarterlyManagementReport && annualManagementReport && (
          <GameCard title="Management Report">
            <CorporateManagementReportPanel
              quarterlyReport={quarterlyManagementReport}
              annualReport={annualManagementReport}
              period={managementReportPeriod}
              onPeriodChange={setManagementReportPeriod}
              quarterlyActions={quarterlyManagementActions}
              annualActions={annualManagementActions}
              targetProgress={managementTargetProgress}
              reviewYears={managementReviewYears}
              onTargetProfileChange={(profile) => setBusinessManagementTargetProfile(biz.id, profile)}
              onActionPress={scrollToManagementSection}
            />
          </GameCard>
        )}

        {/* Weekly Financials */}
          </>
        )}

        {activeSection === 'finance' && (
          <>
        <View collapsable={false} />
        <GameCard title="Weekly Financials">
          <Text style={styles.sectionHint}>Revenue = employees × productivity × reputation demand × market share × upgrades. Reputation improves demand; upgrades add revenue; market share changes customer volume. Lower-reputation companies use leaner overhead and premises.</Text>
          <StatRow label="Revenue" value={biz.lastWeekRevenue} positive />
          <StatRow label="Expenses" value={biz.lastWeekExpenses} />
          <View style={styles.divider} />
          <StatRow label="Profit" value={biz.lastWeekProfit} positive={(biz.lastWeekProfit ?? 0) >= 0} bold />
        </GameCard>

        <View collapsable={false} onLayout={(event) => recordManagementSection('budget', event)} />
        <GameCard title="Annual Cash Plan">
          <View style={styles.budgetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.budgetProfileName}>{BUSINESS_BUDGET_PRESETS[budgetPlan.profile].label}</Text>
              <Text style={styles.budgetProfileDesc}>{BUSINESS_BUDGET_PRESETS[budgetPlan.profile].description}</Text>
            </View>
            <View style={[styles.budgetReviewBadge, budgetReviewDue && styles.budgetReviewBadgeDue]}>
              <Text style={[styles.budgetReviewText, budgetReviewDue && { color: Colors.warning }]}>
                {budgetReviewDue ? `Year ${gameYear} review due` : `Reviewed Y${budgetPlan.reviewYear}`}
              </Text>
            </View>
          </View>

          <View style={styles.budgetAllocationGrid}>
            <View style={styles.budgetAllocationItem}>
              <Text style={styles.budgetAllocationPct}>{Math.round(budgetPlan.dividendPct * 100)}%</Text>
              <Text style={styles.budgetAllocationLabel}>Dividends</Text>
            </View>
            <View style={styles.budgetAllocationItem}>
              <Text style={styles.budgetAllocationPct}>{Math.round(budgetPlan.debtPaydownPct * 100)}%</Text>
              <Text style={styles.budgetAllocationLabel}>Debt</Text>
            </View>
            <View style={styles.budgetAllocationItem}>
              <Text style={styles.budgetAllocationPct}>{Math.round(budgetPlan.reinvestmentPct * 100)}%</Text>
              <Text style={styles.budgetAllocationLabel}>Upkeep</Text>
            </View>
            <View style={styles.budgetAllocationItem}>
              <Text style={styles.budgetAllocationPct}>{Math.round(budgetPlan.growthPct * 100)}%</Text>
              <Text style={styles.budgetAllocationLabel}>Growth</Text>
            </View>
          </View>

          <View style={styles.budgetReserveBox}>
            <View style={styles.budgetReserveHeader}>
              <Text style={styles.budgetReserveTitle}>Operating buffer</Text>
              <Text style={styles.budgetReserveValue}>
                {budgetPlan.targetReserveWeeks}w • {formatCurrency(budgetTargets.operatingReserveTarget)}
              </Text>
            </View>
            <View style={styles.budgetReserveTrack}>
              <View
                style={[
                  styles.budgetReserveFill,
                  {
                    width: `${Math.min(100, budgetTargets.operatingReserveTarget > 0
                      ? ((biz.balance ?? 0) / budgetTargets.operatingReserveTarget) * 100
                      : 100)}%`,
                  },
                ]}
              />
            </View>

            <View style={styles.budgetEarmarkRow}>
              <View style={styles.budgetEarmark}>
                <Text style={styles.budgetEarmarkLabel}>Reinvestment reserve</Text>
                <Text style={styles.budgetEarmarkValue}>
                  {formatCurrency(budgetReserves.reinvestment)} / {formatCurrency(budgetTargets.reinvestmentReserveTarget)}
                </Text>
              </View>
              <View style={styles.budgetEarmark}>
                <Text style={styles.budgetEarmarkLabel}>Growth reserve</Text>
                <Text style={styles.budgetEarmarkValue}>
                  {formatCurrency(budgetReserves.growth)} / {formatCurrency(budgetTargets.growthReserveTarget)}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.subHeading}>Budget Policy</Text>
          <View style={styles.budgetProfileGrid}>
            {(Object.keys(BUSINESS_BUDGET_PRESETS) as Array<keyof typeof BUSINESS_BUDGET_PRESETS>).map((profile) => {
              const preset = BUSINESS_BUDGET_PRESETS[profile];
              const active = budgetPlan.profile === profile;
              return (
                <Pressable
                  key={profile}
                  style={[styles.budgetProfileChip, active && styles.budgetProfileChipActive]}
                  onPress={() => setBusinessBudgetProfile(biz.id, profile)}
                >
                  <Text style={[styles.budgetProfileChipTitle, active && { color: Colors.primary }]}>{preset.label}</Text>
                  <Text style={styles.budgetProfileChipMeta}>{preset.targetReserveWeeks}w reserve</Text>
                </Pressable>
              );
            })}
          </View>

          {biz.lastBudgetAllocation && (
            <View style={styles.budgetLastWeek}>
              <Text style={styles.budgetLastWeekTitle}>Last weekly allocation</Text>
              <Text style={styles.budgetLastWeekText}>
                Profit basis {formatCurrency(biz.lastBudgetAllocation.profitBasis)}
                {biz.lastBudgetAllocation.extraDebtPaid > 0 ? ` • Debt -${formatCurrency(biz.lastBudgetAllocation.extraDebtPaid)}` : ''}
                {biz.lastBudgetAllocation.reinvestmentAllocated > 0 ? ` • Upkeep +${formatCurrency(biz.lastBudgetAllocation.reinvestmentAllocated)}` : ''}
                {biz.lastBudgetAllocation.growthAllocated > 0 ? ` • Growth +${formatCurrency(biz.lastBudgetAllocation.growthAllocated)}` : ''}
                {biz.lastBudgetAllocation.dividendPaid > 0 ? ` • Dividend ${formatCurrency(biz.lastBudgetAllocation.dividendPaid)}` : ''}
              </Text>
            </View>
          )}
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
            {(eb.boardFees ?? 0) > 0 && <ExpRow label="Board Fees" value={eb.boardFees ?? 0} />}
            {(eb.workforceTraining ?? 0) > 0 && <ExpRow label="Workforce Training" value={eb.workforceTraining ?? 0} />}
            {(eb.workforceTransition ?? 0) > 0 && <ExpRow label="Hiring / Severance" value={eb.workforceTransition ?? 0} />}
            {eb.misc > 0 && <ExpRow label="Misc" value={eb.misc} />}
          </GameCard>
        )}

        {/* Market Share Pie Chart */}
        {bizCompetitors.length > 0 && (
          <GameCard title="Market Share">
            <View style={styles.chartWrap}>
              <PieChart
                data={pieData}
                width={Math.min(screenWidth - 64, 340)}
                height={180}
                chartConfig={{
                  color: () => resolveThemeColor(Colors.textSecondary) as string,
                  labelColor: () => resolveThemeColor(Colors.textSecondary) as string,
                  backgroundGradientFrom: resolveThemeColor(Colors.card) as string,
                  backgroundGradientTo: resolveThemeColor(Colors.card) as string,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute={false}
                hasLegend={false}
              />
            </View>
            {pieData.map((entry, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: entry.color }} />
              <Text style={{ color: Colors.textPrimary, flex: 1, fontSize: 13 }}>
                {index === 0 ? biz.name : bizCompetitors[index - 1]?.name}
                {index > 0 && bizCompetitors[index - 1]?.ceoName ? ` · ${bizCompetitors[index - 1].ceoName}` : ''}
              </Text>
              <Text style={{ color: Colors.textSecondary }}>{entry.population.toFixed(1)}%</Text>
            </View>)}
          </GameCard>
        )}

        {bizCompetitors.length > 0 && (
          <GameCard title="Rival CEOs">
            <Text style={styles.sectionHint}>These CEOs persist in this save and make a strategic decision every four weeks.</Text>
            <Text style={styles.rivalAction}>{rivalCycleLabel}: {rivalCycleHint}</Text>
            {bizCompetitors.map((rival) => (
              <View key={rival.id} style={styles.rivalRow}>
                <View style={styles.rivalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rivalName}>{rival.ceoName ?? 'Unknown CEO'}</Text>
                    <Text style={styles.rivalCompany}>{rival.name} · {(rival.personality ?? 'conservative').replace('_', ' ')}</Text>
                  </View>
                  <Text style={styles.rivalStrength}>Strength {Math.round(rival.strength)}</Text>
                </View>
                <Text style={styles.rivalMeta}>Cash {formatCurrency(rival.cash ?? 0)} · Reputation {Math.round(rival.reputation ?? 0)}</Text>
                <Text style={styles.rivalAction}>Latest: {rival.lastDecision ?? 'Building the company'}</Text>
              </View>
            ))}
          </GameCard>
        )}

        {/* Cash Management */}
        <GameCard title="Cash Management">
          <View style={styles.cashBtnRow}>
            <Pressable style={styles.cashBtn} onPress={() => { setShowTransferModal('inject'); setTransferAmount(''); setTransferError(''); }}>
              <Ionicons name="arrow-down-circle" size={18} color={Colors.primary} />
              <Text style={styles.cashBtnText}>Inject Cash</Text>
            </Pressable>
            <Pressable style={styles.cashBtn} onPress={() => { setShowTransferModal('withdraw'); setTransferAmount(''); setTransferError(''); }}>
              <Ionicons name="arrow-up-circle" size={18} color={Colors.warning} />
              <Text style={styles.cashBtnText}>Withdraw</Text>
            </Pressable>
          </View>
        </GameCard>

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

          </>
        )}

        {activeSection === 'people' && (
          <>
        <View collapsable={false} />
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
                <Image source={employeeRoleImages[emp.roleId]} style={styles.employeeArtwork} resizeMode="contain" accessibilityLabel={`${role?.name ?? 'Employee'} pixel art`} />
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

          </>
        )}

        {activeSection === 'risk' && (
          <>
        <View collapsable={false} />
        <GameCard title="Insurance & Risk">
          <View style={styles.insuranceSummary}>
            <View style={styles.insuranceScoreBox}>
              <Text style={styles.insuranceScore}>{insuranceRisk.score}</Text>
              <Text style={styles.insuranceScoreLabel}>Risk cover</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.insuranceSummaryTitle}>
                {insuranceRisk.coveredAreas}/4 areas insured • {formatCurrency(insuranceWeeklyPremium)}/wk
              </Text>
              <Text style={styles.insuranceSummaryText}>
                Insurance reduces eligible incident costs after the deductible. It does not prevent the incident or remove operational disruption.
              </Text>
              {insuranceRisk.coverageGaps.length > 0 && (
                <Text style={styles.insuranceGapText}>
                  Coverage gap: {insuranceRisk.coverageGaps.map((area) => BUSINESS_INSURANCE_AREAS[area].name).join(', ')}
                </Text>
              )}
            </View>
          </View>

          {(Object.keys(BUSINESS_INSURANCE_AREAS) as BusinessInsuranceArea[]).map((area) => {
            const definition = BUSINESS_INSURANCE_AREAS[area];
            const currentTier = insurancePolicies[area];
            const currentQuote = getBusinessInsuranceQuote(biz, area, currentTier, globalGameWeek);
            return (
              <View key={area} style={styles.insuranceAreaRow}>
                <View style={styles.insuranceAreaHeader}>
                  <Text style={styles.insuranceIcon}>{definition.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.insuranceAreaName}>{definition.name}</Text>
                    <Text style={styles.insuranceAreaDesc}>{definition.description}</Text>
                    <Text style={styles.insuranceAreaMeta}>
                      Current: {currentTier.toUpperCase()} • {formatCurrency(currentQuote.weeklyPremium)}/wk • {Math.round(currentQuote.coveragePct * 100)}% of covered loss after {Math.round(currentQuote.deductiblePct * 100)}% deductible
                    </Text>
                  </View>
                </View>
                <View style={styles.insuranceTierRow}>
                  {BUSINESS_INSURANCE_TIERS.map((tier) => {
                    const quote = getBusinessInsuranceQuote(biz, area, tier, globalGameWeek);
                    const active = currentTier === tier;
                    return (
                      <Pressable
                        key={tier}
                        style={[styles.insuranceTierChip, active && styles.insuranceTierChipActive]}
                        onPress={() => setBusinessInsurancePolicy(biz.id, area, tier)}
                      >
                        <Text style={[styles.insuranceTierLabel, active && styles.insuranceTierLabelActive]}>
                          {tier === 'none' ? 'None' : tier[0].toUpperCase() + tier.slice(1)}
                        </Text>
                        <Text style={styles.insuranceTierMeta}>
                          {tier === 'none' ? '€0' : `${formatCurrency(quote.weeklyPremium)}/wk`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}

          {(biz.insuranceClaims?.length ?? 0) > 0 && (
            <View style={styles.claimHistory}>
              <Text style={styles.subHeading}>Recent Claims</Text>
              {(biz.insuranceClaims ?? []).slice(0, 5).map((claim) => (
                <View key={claim.id} style={styles.claimRow}>
                  <Text style={styles.claimIcon}>{BUSINESS_INSURANCE_AREAS[claim.area].icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.claimTitle}>{claim.incidentTitle}</Text>
                    <Text style={styles.claimMeta}>
                      {claim.policyTier.toUpperCase()} • Gross {formatCurrency(claim.grossLoss)} • Payout {formatCurrency(claim.payout)}
                    </Text>
                  </View>
                  <Text style={styles.claimNet}>-{formatCurrency(claim.netLoss)}</Text>
                </View>
              ))}
            </View>
          )}
        </GameCard>

        <View collapsable={false} onLayout={(event) => recordManagementSection('maintenance', event)} />
        <GameCard title="Business Reinvestment">
          <Text style={styles.sectionHint}>
            Technology, premises and equipment wear down over time. Reinvest before they become outdated; neglected infrastructure gradually lowers revenue, raises costs and increases business risk.
          </Text>

          {(reinvestmentEffects.revenuePenalty > 0 || reinvestmentEffects.expenseIncrease > 0) && (
            <View style={styles.reinvestmentWarning}>
              <Ionicons name="warning-outline" size={15} color={Colors.warning} />
              <Text style={styles.reinvestmentWarningText}>
                Current drag: -{(reinvestmentEffects.revenuePenalty * 100).toFixed(1)}% revenue • +{(reinvestmentEffects.expenseIncrease * 100).toFixed(1)}% expenses • +{(reinvestmentEffects.crisisIncrease * 100).toFixed(1)}% crisis pressure
              </Text>
            </View>
          )}

          {biz.activeReinvestment && (
            <View style={styles.reinvestmentActive}>
              <Text style={styles.reinvestmentActiveTitle}>
                {BUSINESS_REINVESTMENT_AREAS[biz.activeReinvestment.area].icon} {biz.activeReinvestment.projectName}
              </Text>
              <Text style={styles.reinvestmentActiveMeta}>
                {biz.activeReinvestment.weeksRemaining} weeks remaining • {formatCurrency(biz.activeReinvestment.costPaid)} invested
              </Text>
            </View>
          )}

          {(Object.keys(BUSINESS_REINVESTMENT_AREAS) as BusinessReinvestmentArea[]).map((area) => {
            const definition = BUSINESS_REINVESTMENT_AREAS[area];
            const track = reinvestmentState[area];
            const condition = Math.round(track.condition);
            const label = getBusinessConditionLabel(condition);
            const cost = getBusinessReinvestmentCost(biz, area, inflationMultiplier);
            const eligibility = canStartBusinessReinvestment(biz, area);
            const affordable = (biz.balance ?? 0) >= cost;
            const disabled = !eligibility.allowed || !affordable || !!biz.activeReinvestment;
            const statusColor = label.severity === 'good'
              ? Colors.primary
              : label.severity === 'bad'
                ? Colors.negative
                : Colors.warning;

            return (
              <View key={area} style={styles.reinvestmentRow}>
                <View style={styles.reinvestmentIcon}>
                  <Text style={styles.reinvestmentIconText}>{definition.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.reinvestmentTitleRow}>
                    <Text style={styles.reinvestmentName}>{definition.name}</Text>
                    <Text style={[styles.reinvestmentCondition, { color: statusColor }]}>
                      {condition}% • {label.label}
                    </Text>
                  </View>
                  <Text style={styles.reinvestmentDesc}>{definition.description}</Text>
                  <View style={styles.reinvestmentTrack}>
                    <View style={[styles.reinvestmentFill, { width: `${Math.max(0, Math.min(100, condition))}%`, backgroundColor: statusColor }]} />
                  </View>
                  <Text style={styles.reinvestmentMeta}>
                    {definition.weeks} weeks • Current renewal cost {formatCurrency(cost)}
                  </Text>
                  {!eligibility.allowed && !biz.activeReinvestment && (
                    <Text style={styles.reinvestmentLocked}>{eligibility.reason}</Text>
                  )}
                  {eligibility.allowed && !affordable && (
                    <Text style={styles.reinvestmentLocked}>
                      Need {formatCurrency(cost - (biz.balance ?? 0))} more business cash
                    </Text>
                  )}
                </View>
                <Pressable
                  disabled={disabled}
                  onPress={() => confirmAction(
                    definition.name,
                    `Invest ${formatCurrency(cost)} from the business account? Work takes ${definition.weeks} weeks and restores ${definition.name.toLowerCase()} condition to 100% when complete.`,
                    () => startBusinessReinvestment(biz.id, area),
                  )}
                  style={[styles.reinvestmentButton, !disabled && styles.reinvestmentButtonActive, disabled && styles.disabledAction]}
                >
                  <Text style={[styles.reinvestmentButtonText, !disabled && { color: Colors.primary }]}>
                    {biz.activeReinvestment?.area === area ? 'WORKING' : 'RENEW'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </GameCard>

        {/* Active Business Projects */}
          </>
        )}

        {activeSection === 'growth' && (
          <>
        <View collapsable={false} />
        <GameCard title="Business Projects">
          <View style={styles.slotAccessRow}>
            <View style={styles.slotAccessStatus}>
              <Ionicons name="layers-outline" size={12} color={Colors.info} />
              <Text style={styles.slotAccessText}>Slots {activeProjectCount}/{projectSlotLimit}</Text>
            </View>
            {!biz.projectSlot2Unlocked && !biz.temporaryProjectSlot2 && activeProjectCount === 1 && (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                style={[styles.slotMiniButton, (slotAdLoading === 'project' || (profile.adsRemoved && !adFreeSlotReward.available)) && styles.disabledRow]}
                disabled={slotAdLoading !== null || (profile.adsRemoved && !adFreeSlotReward.available)}
                onPress={() => handleSlotRewardedAd('project')}
              >
                <Ionicons name={profile.adsRemoved ? "gift-outline" : "play-circle-outline"} size={12} color={Colors.info} />
                <Text style={styles.slotMiniButtonText}>
                  {slotAdLoading === 'project' ? 'Loading…' : profile.adsRemoved ? (adFreeSlotReward.available ? 'Daily Slot 2' : 'Daily used') : 'Ad Slot 2'}
                </Text>
              </Pressable>
            )}
            {!biz.projectSlot2Unlocked && (
              <Pressable
                accessibilityRole="button"
                hitSlop={10}
                style={[styles.slotMiniButton, styles.slotGemButton, (profile.gems ?? 0) < BUSINESS_PROJECT_SLOT_2_GEM_COST && styles.disabledRow]}
                disabled={(profile.gems ?? 0) < BUSINESS_PROJECT_SLOT_2_GEM_COST}
                onPress={() => confirmAction(
                  'Unlock Project Slot 2',
                  `Spend ${BUSINESS_PROJECT_SLOT_2_GEM_COST} gems to permanently run two projects at once for this business?`,
                  () => unlockBusinessProjectSlot(biz.id),
                )}
              >
                <Ionicons name="diamond-outline" size={11} color={Colors.warning} />
                <Text style={styles.slotGemButtonText}>{BUSINESS_PROJECT_SLOT_2_GEM_COST}</Text>
              </Pressable>
            )}
            {biz.projectSlot2Unlocked && <Text style={styles.slotPermanentLabel}>2 permanent</Text>}
            {!biz.projectSlot2Unlocked && biz.temporaryProjectSlot2 && <Text style={styles.slotTemporaryLabel}>Ad slot ready</Text>}
          </View>
          {slotAdMessage?.kind === 'project' && <Text style={styles.slotMessage}>{slotAdMessage.text}</Text>}
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
                      {typeof p.actualRoll === 'number' && <Text style={styles.actionDesc}>Dice roll: {p.actualRoll}/20 • Needed: {p.neededRoll}</Text>}
                    </View>
                    <Text style={styles.actionCost}>{formatCurrency(p.cost)}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={styles.subHeading}>Start New • D20 skill check • max 2</Text>
          {(() => {
            const slotFull = activeProjectCount >= projectSlotLimit;
            return (
              <>
                {slotFull && (
                  <Text style={{ color: Colors.warning, fontSize: 12, marginBottom: 6 }}>
                    All available project slots are in use.
                  </Text>
                )}
                {allProjects.map((proj: any) => {
                  const hasRole = !proj.requiredRoleId || (biz.employees ?? []).some((e) => e.roleId === proj.requiredRoleId);
                  const roleName = proj.requiredRoleId ? (getEmployeeRole(proj.requiredRoleId)?.name ?? proj.requiredRoleId) : 'No specialist required';
                  const levelScale = proj.scalesWithLevel ? 1 + (biz.level ?? 0) * 0.75 : 1;
                  const cost = Math.round((proj.baseCost ?? 0) * levelScale * inflationMultiplier);
                  const relevantEmployees = proj.requiredRoleId ? (biz.employees ?? []).filter((e) => e.roleId === proj.requiredRoleId) : (biz.employees ?? []);
                  const bestSkill = relevantEmployees.reduce((m, e) => Math.max(m, e.skill ?? 0), 0);
                  const needed = getProjectDifficulty(proj);
                  const odds = proj.guaranteed ? 100 : getProjectOdds(proj, bestSkill);
                  const scaledReputation = proj.scalesWithLevel ? Math.min(proj.maxReputationBonus ?? 4, (proj.reputationBonus ?? 0) + (biz.level ?? 0) * 0.4) : proj.reputationBonus;
                  const duplicateActive = activeProjects.some((project) => project.projectType === proj.id);
                  const disabled = !hasRole || slotFull || duplicateActive;
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
                          {scaledReputation ? ` • +${scaledReputation.toFixed(1)} rep${proj.guaranteed ? ' guaranteed' : ''}` : ''}
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

        <View collapsable={false} onLayout={(event) => recordManagementSection('investments', event)} />
        {(biz.valuation ?? 0) >= 10_000_000 || !!biz.activeCorporateCapex || (biz.completedCorporateCapex?.length ?? 0) > 0 ? (
          <GameCard title="Corporate Investments">
            <View style={styles.corporateHeader}>
              <View style={styles.corporateScaleBadge}>
                <Ionicons name="business" size={15} color={corporateScaleTier === 'local' ? Colors.textMuted : Colors.info} />
                <Text style={[styles.corporateScaleText, corporateScaleTier === 'local' && { color: Colors.textMuted }]}>
                  {corporateScaleLabel}
                </Text>
              </View>
              <Text style={styles.corporateBookValue}>Assets {formatCurrency(corporateCapexBookValue)}</Text>
            </View>

            {corporateScaleTier === 'local' && !biz.activeCorporateCapex && (biz.completedCorporateCapex?.length ?? 0) === 0 ? (
              <View style={styles.corporateLocked}>
                <Ionicons name="lock-closed-outline" size={20} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.corporateLockedTitle}>Corporate scale unlocks at €25M valuation</Text>
                  <Text style={styles.corporateLockedText}>
                    Large capital projects become available once the company has enough scale and reputation to support them.
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.corporateEffectSummary}>
                  Permanent portfolio: +{(corporateCapexEffects.revenueBonus * 100).toFixed(1)}% revenue • {corporateCapexEffects.expenseReduction >= 0 ? '-' : '+'}{Math.abs(corporateCapexEffects.expenseReduction * 100).toFixed(1)}% expenses • {(corporateCapexEffects.crisisReduction * 100).toFixed(1)}% crisis protection
                </Text>

                {biz.activeCorporateCapex && (() => {
                  const activeDefinition = CORPORATE_CAPEX_PROJECTS.find((project) => project.id === biz.activeCorporateCapex?.projectId);
                  const progress = Math.max(0, Math.min(100, Math.round(
                    (1 - (biz.activeCorporateCapex.weeksRemaining / Math.max(1, biz.activeCorporateCapex.totalWeeks))) * 100
                  )));
                  return (
                    <View style={styles.corporateActive}>
                      <View style={styles.corporateActiveHeader}>
                        <Text style={styles.corporateActiveTitle}>{activeDefinition?.icon ?? '🏗️'} {biz.activeCorporateCapex.projectName}</Text>
                        <Text style={styles.corporateActiveWeeks}>{biz.activeCorporateCapex.weeksRemaining}w</Text>
                      </View>
                      <View style={styles.corporateProgressTrack}>
                        <View style={[styles.corporateProgressFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.corporateConstructionText}>
                        Construction disruption: -{((activeDefinition?.constructionRevenuePenalty ?? 0) * 100).toFixed(1)}% revenue • +{((activeDefinition?.constructionExpensePenalty ?? 0) * 100).toFixed(1)}% expenses
                      </Text>
                    </View>
                  );
                })()}

                {(biz.completedCorporateCapex?.length ?? 0) > 0 && (
                  <View style={styles.corporateCompletedWrap}>
                    <Text style={styles.subHeading}>Completed Assets</Text>
                    {(biz.completedCorporateCapex ?? []).map((completed) => {
                      const definition = CORPORATE_CAPEX_PROJECTS.find((project) => project.id === completed.projectId);
                      return (
                        <View key={completed.projectId} style={styles.corporateCompletedRow}>
                          <Text style={styles.corporateCompletedIcon}>{definition?.icon ?? '🏢'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.corporateCompletedName}>{completed.projectName}</Text>
                            <Text style={styles.corporateCompletedMeta}>{formatCurrency(completed.costPaid)} invested</Text>
                          </View>
                          <Ionicons name="checkmark-circle" size={17} color={Colors.primary} />
                        </View>
                      );
                    })}
                  </View>
                )}

                <Text style={styles.subHeading}>Long-term Capital Projects</Text>
                {CORPORATE_CAPEX_PROJECTS.map((project) => {
                  const eligibility = canStartCorporateCapex(biz, project);
                  const cost = getCorporateCapexCost(project, inflationMultiplier);
                  const projectFinance = getProjectFinanceQuote(biz, cost, loanRateReduction);
                  const completed = (biz.completedCorporateCapex ?? []).some((item) => item.projectId === project.id);
                  const active = biz.activeCorporateCapex?.projectId === project.id;
                  const blocked = completed || active || !!biz.activeCorporateCapex || !eligibility.allowed;
                  const cashAffordable = (biz.balance ?? 0) >= cost;
                  const financedAffordable = projectFinance.allowed && (biz.balance ?? 0) >= projectFinance.cashContribution;
                  const expenseText = project.expenseReduction >= 0
                    ? `-${(project.expenseReduction * 100).toFixed(1)}% expenses`
                    : `+${Math.abs(project.expenseReduction * 100).toFixed(1)}% expenses`;

                  return (
                    <View key={project.id} style={[styles.corporateProjectRow, blocked && styles.disabledRow]}>
                      <View style={styles.corporateProjectIconWrap}>
                        <Text style={styles.corporateProjectIcon}>{project.icon}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.corporateProjectName}>{project.name}</Text>
                        <Text style={styles.corporateProjectDesc}>{project.description}</Text>
                        <Text style={styles.corporateProjectReq}>
                          Requires {formatCurrency(project.minValuation)} value • {project.minReputation} rep • {project.weeks}w
                        </Text>
                        <Text style={styles.corporateProjectEffect}>
                          Permanent: +{(project.revenueBonus * 100).toFixed(1)}% revenue • {expenseText} • {(project.crisisReduction * 100).toFixed(1)}% crisis protection
                        </Text>

                        {!completed && !active && !eligibility.allowed && (
                          <Text style={styles.corporateProjectLocked}>{eligibility.reason}</Text>
                        )}
                        {!blocked && (
                          <View style={styles.capexFundingRow}>
                            <Pressable
                              disabled={!cashAffordable}
                              style={[styles.capexFundingButton, cashAffordable && styles.capexFundingButtonCash, !cashAffordable && styles.disabledAction]}
                              onPress={() => confirmAction(
                                'Cash Fund Corporate Investment',
                                `Invest ${formatCurrency(cost)} of company cash in ${project.name}? Construction takes ${project.weeks} weeks and temporarily disrupts operations.`,
                                () => startCorporateCapex(biz.id, project.id, 'cash'),
                              )}
                            >
                              <Text style={[styles.capexFundingTitle, cashAffordable && { color: Colors.primary }]}>Cash</Text>
                              <Text style={styles.capexFundingMeta}>{formatCurrency(cost)}</Text>
                            </Pressable>

                            <Pressable
                              disabled={!financedAffordable}
                              style={[styles.capexFundingButton, financedAffordable && styles.capexFundingButtonFinance, !financedAffordable && styles.disabledAction]}
                              onPress={() => confirmAction(
                                'Project Finance Corporate Investment',
                                `Fund ${project.name} with ${formatCurrency(projectFinance.cashContribution)} company cash (40% equity + fee) and ${formatCurrency(projectFinance.debtPrincipal)} project debt at ${(projectFinance.interestRate * 100).toFixed(1)}%. Scheduled payment: ${formatCurrency(projectFinance.weeklyPayment)}/wk for ${projectFinance.durationWeeks} weeks.`,
                                () => startCorporateCapex(biz.id, project.id, 'project_finance'),
                              )}
                            >
                              <Text style={[styles.capexFundingTitle, financedAffordable && { color: Colors.info }]}>Finance 60%</Text>
                              <Text style={styles.capexFundingMeta}>
                                {projectFinance.allowed
                                  ? `${formatCurrency(projectFinance.cashContribution)} cash`
                                  : projectFinance.reason ?? 'Unavailable'}
                              </Text>
                            </Pressable>
                          </View>
                        )}

                        {!blocked && !cashAffordable && !financedAffordable && (
                          <Text style={styles.corporateProjectLocked}>
                            Cash funding needs {formatCurrency(Math.max(0, cost - (biz.balance ?? 0)))} more. {projectFinance.reason ?? 'Project finance also requires more available business cash.'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.corporateCostWrap}>
                        <Text style={[styles.corporateCost, blocked && { color: Colors.textMuted }]}>
                          {completed ? 'DONE' : active ? 'BUILDING' : formatCurrency(cost)}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </GameCard>
        ) : null}

        {/* Upgrades */}
        {(availableUpgrades.length > 0 || activeUpgradeCount > 0) && (
          <GameCard title="Upgrades">
            <View style={styles.slotAccessRow}>
              <View style={styles.slotAccessStatus}>
                <Ionicons name="layers-outline" size={12} color={Colors.info} />
                <Text style={styles.slotAccessText}>Slots {activeUpgradeCount}/{upgradeSlotLimit}</Text>
              </View>
              {!biz.upgradeSlot2Unlocked && !biz.temporaryUpgradeSlot2 && activeUpgradeCount === 1 && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  style={[styles.slotMiniButton, (slotAdLoading === 'upgrade' || (profile.adsRemoved && !adFreeSlotReward.available)) && styles.disabledRow]}
                  disabled={slotAdLoading !== null || (profile.adsRemoved && !adFreeSlotReward.available)}
                  onPress={() => handleSlotRewardedAd('upgrade')}
                >
                  <Ionicons name={profile.adsRemoved ? "gift-outline" : "play-circle-outline"} size={12} color={Colors.info} />
                  <Text style={styles.slotMiniButtonText}>
                    {slotAdLoading === 'upgrade' ? 'Loading…' : profile.adsRemoved ? (adFreeSlotReward.available ? 'Daily Slot 2' : 'Daily used') : 'Ad Slot 2'}
                  </Text>
                </Pressable>
              )}
              {!biz.upgradeSlot2Unlocked && (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  style={[styles.slotMiniButton, styles.slotGemButton, (profile.gems ?? 0) < BUSINESS_UPGRADE_SLOT_2_GEM_COST && styles.disabledRow]}
                  disabled={(profile.gems ?? 0) < BUSINESS_UPGRADE_SLOT_2_GEM_COST}
                  onPress={() => confirmAction(
                    'Unlock Upgrade Slot 2',
                    `Spend ${BUSINESS_UPGRADE_SLOT_2_GEM_COST} gems to permanently run two upgrades at once for this business?`,
                    () => unlockBusinessUpgradeSlot(biz.id),
                  )}
                >
                  <Ionicons name="diamond-outline" size={11} color={Colors.warning} />
                  <Text style={styles.slotGemButtonText}>{BUSINESS_UPGRADE_SLOT_2_GEM_COST}</Text>
                </Pressable>
              )}
              {biz.upgradeSlot2Unlocked && <Text style={styles.slotPermanentLabel}>2 permanent</Text>}
              {!biz.upgradeSlot2Unlocked && biz.temporaryUpgradeSlot2 && <Text style={styles.slotTemporaryLabel}>Ad slot ready</Text>}
            </View>
            {slotAdMessage?.kind === 'upgrade' && <Text style={styles.slotMessage}>{slotAdMessage.text}</Text>}

            {activeUpgrades.map((active, index) => (
              <View key={`${active.upgradeId}:${index}`} style={{ padding: 9, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 8, marginBottom: 7 }}>
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 12 }}>
                  🔧 Slot {index + 1}: {getUpgrade(active.upgradeId)?.name ?? active.upgradeId}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 10, marginTop: 2 }}>{active.weeksRemaining} weeks remaining</Text>
              </View>
            ))}

            {availableUpgrades.map((uid) => {
              const upg = getUpgrade(uid);
              if (!upg) return null;
              const cost = inflated(upg.cost ?? 0, inflationMultiplier);
              const bizBal = biz.balance ?? 0;
              const slotFull = activeUpgradeCount >= upgradeSlotLimit;
              const affordable = bizBal >= cost && !slotFull;
              const reason = slotFull ? 'Upgrade slots full' : bizBal < cost ? 'Insufficient balance' : '';
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
                    <Text style={styles.upgradeBoost}>+{Number(((upg.revenueBoost ?? 0) * 100).toFixed(2))}% revenue • +{upg.reputationBoost ?? 0} rep · 12–23 weeks</Text>
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

        <GameCard title="Expansion & Locations">
          <Text style={styles.sectionHint}>Open new locations to increase capacity. Every branch adds revenue and recurring operating costs. Reputation and business level unlock larger markets.</Text>
          {biz.activeExpansion && (() => {
            const active = locationTemplates.find((location) => location.id === biz.activeExpansion?.templateId);
            return <View style={styles.expansionActive}><Text style={styles.expansionActiveTitle}>🏗️ Opening {active?.name ?? 'new location'}</Text><Text style={styles.rivalMeta}>{biz.activeExpansion.weeksRemaining} weeks remaining</Text></View>;
          })()}
          {(biz.locations ?? []).map((location) => (
            <View key={location.id} style={styles.locationOwned}>
              <View style={{ flex: 1 }}><Text style={styles.upgradeName}>{location.name}</Text><Text style={styles.upgradeDesc}>{location.region}</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={styles.upgradeBoost}>+{Math.round(location.revenueBoost * 100)}% capacity</Text><Text style={styles.rivalMeta}>-{formatCurrency(location.weeklyOperatingCost)}/wk</Text></View>
            </View>
          ))}
          {locationTemplates.filter((template) => !(biz.locations ?? []).some((location) => location.templateId === template.id)).map((template) => {
            const costs = getScaledLocationCosts(biz, template.id, inflationMultiplier);
            const requirementsMet = canStartBusinessExpansion(biz, template.id);
            const affordable = !!costs && biz.balance >= costs.purchaseCost;
            const enabled = requirementsMet && affordable && !biz.activeExpansion;
            return <Pressable key={template.id} style={[styles.upgradeRow, !enabled && styles.disabledRow]} disabled={!enabled} onPress={() => confirmAction('Open New Location', `Invest ${formatCurrency(costs?.purchaseCost ?? 0)} from the business balance to open ${template.name}? It will add ${Math.round(template.revenueBoost * 100)}% revenue capacity and ${formatCurrency(costs?.weeklyOperatingCost ?? 0)} weekly operating costs.`, () => startBusinessExpansion(biz.id, template.id))}>
              <View style={styles.upgradeInfo}>
                <Text style={styles.upgradeName}>{template.name} · {template.region}</Text>
                <Text style={styles.upgradeDesc}>Requires level {template.requiredLevel + 1} and {template.requiredReputation} reputation · {template.buildWeeks} weeks</Text>
                <Text style={styles.upgradeBoost}>+{Math.round(template.revenueBoost * 100)}% capacity · -{formatCurrency(costs?.weeklyOperatingCost ?? 0)}/wk</Text>
              </View>
              <Text style={[styles.upgradeCost, { color: enabled ? Colors.warning : Colors.textMuted }]}>{formatCurrency(costs?.purchaseCost ?? 0)}</Text>
            </Pressable>;
          })}
        </GameCard>

          </>
        )}

        {activeSection === 'capital' && (
          <>
        <View collapsable={false} onLayout={(event) => recordManagementSection('finance', event)} />
        {corporateScaleTier !== 'local' && (
          <>
            <View collapsable={false} />
            <GameCard title="Corporate Financing">
              <View style={styles.creditHeader}>
                <View style={styles.creditRatingBox}>
                  <Text style={styles.creditRating}>{corporateCredit.rating}</Text>
                  <Text style={styles.creditScore}>Score {corporateCredit.score}/100</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.creditTitle}>Corporate Credit Profile</Text>
                  <Text style={styles.creditMeta}>
                    Debt / value {(corporateCredit.debtToValue * 100).toFixed(1)}% • Coverage {corporateCredit.interestCoverage >= 9.9 ? '10+' : corporateCredit.interestCoverage.toFixed(1)}×
                  </Text>
                  <Text style={styles.creditMeta}>
                    Remaining debt capacity {formatCurrency(corporateCredit.remainingDebtCapacity)}
                  </Text>
                </View>
              </View>

              {(corporateCredit.debtToValue > 0.35 || corporateCredit.interestCoverage < 1.5) && (
                <View style={styles.creditWarning}>
                  <Ionicons name="warning-outline" size={14} color={Colors.warning} />
                  <Text style={styles.creditWarningText}>
                    Leverage is becoming restrictive. New financing may be limited if earnings weaken further.
                  </Text>
                </View>
              )}

            <View style={styles.financeSection}>
              <View style={styles.financeSectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.financeSectionTitle}>Revolving Credit Facility</Text>
                  <Text style={styles.financeSectionMeta}>
                    Limit {formatCurrency(corporateCredit.revolverLimit)} • Used {formatCurrency(corporateCredit.revolverOutstanding)} • Available {formatCurrency(corporateCredit.revolverAvailable)}
                  </Text>
                </View>
                <Ionicons name="repeat-outline" size={17} color={Colors.info} />
              </View>
              <Text style={styles.financeDescription}>
                Flexible 60-week liquidity for maintenance, working capital or short-term needs. More expensive than bonds.
              </Text>
              <View style={styles.financeButtons}>
                {REVOLVER_DRAWS.map((amount) => {
                  const quote = getRevolverDrawQuote(biz, amount, loanRateReduction);
                  return (
                    <Pressable
                      key={amount}
                      disabled={!quote.allowed}
                      style={[styles.financeButton, quote.allowed && styles.financeButtonActive, !quote.allowed && styles.disabledAction]}
                      onPress={() => confirmAction(
                        'Draw Revolving Credit',
                        `Draw ${formatCurrency(amount)}? Fee ${formatCurrency(quote.arrangementFee)} • rate ${(quote.interestRate * 100).toFixed(1)}% • ${formatCurrency(quote.weeklyPayment)}/wk for ${quote.durationWeeks} weeks.`,
                        () => drawCorporateRevolver(biz.id, amount),
                      )}
                    >
                      <Text style={[styles.financeButtonTitle, quote.allowed && { color: Colors.info }]}>{formatCurrency(amount)}</Text>
                      <Text style={styles.financeButtonMeta}>{quote.allowed ? `${(quote.interestRate * 100).toFixed(1)}%` : 'Locked'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.financeSection}>
              <View style={styles.financeSectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.financeSectionTitle}>Corporate Bonds</Text>
                  <Text style={styles.financeSectionMeta}>200-week funding • lower spread • BBB or better • €75M+ company value</Text>
                </View>
                <Ionicons name="document-text-outline" size={17} color={Colors.warning} />
              </View>
              <Text style={styles.financeDescription}>
                Long-duration funding for major investments. Maximum two bond tranches can be outstanding.
              </Text>
              <View style={styles.financeButtons}>
                {BOND_ISSUES.map((amount) => {
                  const quote = getBondQuote(biz, amount, loanRateReduction);
                  return (
                    <Pressable
                      key={amount}
                      disabled={!quote.allowed}
                      style={[styles.financeButton, quote.allowed && styles.bondButtonActive, !quote.allowed && styles.disabledAction]}
                      onPress={() => confirmAction(
                        'Issue Corporate Bond',
                        `Issue ${formatCurrency(amount)} of bonds? Fee ${formatCurrency(quote.arrangementFee)} • rate ${(quote.interestRate * 100).toFixed(1)}% • ${formatCurrency(quote.weeklyPayment)}/wk for ${quote.durationWeeks} weeks.`,
                        () => issueCorporateBond(biz.id, amount),
                      )}
                    >
                      <Text style={[styles.financeButtonTitle, quote.allowed && { color: Colors.warning }]}>{formatCurrency(amount)}</Text>
                      <Text style={styles.financeButtonMeta}>{quote.allowed ? `${(quote.interestRate * 100).toFixed(1)}%` : 'Locked'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {(() => {
                const sample = getBondQuote(biz, BOND_ISSUES[0], loanRateReduction);
                return !sample.allowed
                  ? <Text style={styles.financeLocked}>{sample.reason}</Text>
                  : null;
              })()}
            </View>
            </GameCard>
          </>
        )}

        {corporateScaleTier === 'local' && (
          <View collapsable={false} />
        )}
        {/* Business Loans */}
        <GameCard title="Business Loans">
          {(biz.businessLoans ?? []).map((loan) => {
            const debtLabel = loan.purpose === 'acquisition'
              ? 'Acquisition debt'
              : loan.purpose === 'corporate_revolver'
                ? 'Revolving credit'
                : loan.purpose === 'project_finance'
                  ? 'Project finance'
                  : loan.purpose === 'corporate_bond'
                    ? 'Corporate bond'
                    : 'Business loan';
            const quarterRepayment = Math.min(loan.remainingAmount ?? 0, Math.max(0, Math.round((loan.remainingAmount ?? 0) * 0.25)));
            return (
              <View key={loan.id} style={styles.loanRow}>
                <View style={styles.loanHeaderRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loanAmount}>{formatCurrency(loan.remainingAmount)} remaining</Text>
                    <Text style={styles.loanPayment}>
                      {debtLabel} • {(Math.max(0, loan.interestRate ?? 0) * 100).toFixed(1)}% • {formatCurrency(loan.weeklyPayment)}/wk • {loan.weeksRemaining}wk
                    </Text>
                  </View>
                  {(loan.purpose === 'corporate_revolver' || loan.purpose === 'project_finance' || loan.purpose === 'corporate_bond') && (
                    <View style={styles.loanRepayButtons}>
                      <Pressable
                        disabled={(biz.balance ?? 0) <= 0 || quarterRepayment <= 0}
                        style={[styles.loanRepayButton, ((biz.balance ?? 0) <= 0 || quarterRepayment <= 0) && styles.disabledAction]}
                        onPress={() => repayBusinessLoan(biz.id, loan.id, quarterRepayment)}
                      >
                        <Text style={styles.loanRepayText}>Repay 25%</Text>
                      </Pressable>
                      <Pressable
                        disabled={(biz.balance ?? 0) < (loan.remainingAmount ?? 0)}
                        style={[styles.loanRepayButton, (biz.balance ?? 0) < (loan.remainingAmount ?? 0) && styles.disabledAction]}
                        onPress={() => repayBusinessLoan(biz.id, loan.id, loan.remainingAmount ?? 0)}
                      >
                        <Text style={styles.loanRepayText}>Pay off</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          {(biz.businessLoans?.length ?? 0) < 3 && (
            <View style={styles.loanOptions}>
              {LOAN_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.amount}
                  style={styles.loanBtn}
                  onPress={() => takeBusinessLoan(biz.id, opt.amount, opt.rate, opt.weeks)}
                >
                  <Text style={styles.loanBtnText}>{formatCurrency(opt.amount)} · {(Math.max(0, opt.rate - loanRateReduction) * 100).toFixed(0)}% · {opt.weeks}wk</Text>
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

          </>
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
                  <Image source={employeeRoleImages[role.id]} style={styles.roleArtwork} resizeMode="contain" accessibilityLabel={`${role.name} pixel art`} />
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
              onChangeText={(value) => { setTransferAmount(value); setTransferError(''); }}
              keyboardType="numeric"
            />
            {!!transferError && <Text style={styles.transferError}>{transferError}</Text>}
            <Pressable style={styles.transferBtn} onPress={handleTransfer}>
              <Text style={styles.transferBtnText}>Confirm</Text>
            </Pressable>
            <Pressable style={styles.modalClose} onPress={() => setShowTransferModal(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showFundingNotice} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fund your new business</Text>
            <Text style={styles.modalSubtitle}>Recruitment, training, projects, morale actions, and upgrades are paid only from the business balance. Inject personal cash first or use a business loan.</Text>
            <Pressable style={[styles.modalClose, { backgroundColor: '#047857', borderRadius: 10 }]} onPress={() => { setShowFundingNotice(false); setShowTransferModal('inject'); setTransferError(''); }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Inject cash</Text>
            </Pressable>
            <Pressable style={[styles.modalClose, { backgroundColor: '#1D4ED8', borderRadius: 10 }]} onPress={() => { takeBusinessLoan(biz.id, 50000, 0.10, 52); setShowFundingNotice(false); }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Take €50K business loan</Text>
            </Pressable>
            <Pressable style={[styles.modalClose, { backgroundColor: Colors.cardBorder }]} onPress={() => setShowFundingNotice(false)}>
              <Text style={styles.modalCloseText}>Not now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!dialog} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{dialog?.title}</Text>
            <Text style={styles.modalSubtitle}>{dialog?.message}</Text>
            <Pressable style={styles.modalClose} onPress={() => { const action = dialog?.action; setDialog(null); action?.(); }}>
              <Text style={styles.modalCloseText}>Confirm</Text>
            </Pressable>
            <Pressable style={[styles.modalClose, { backgroundColor: Colors.cardBorder }]} onPress={() => setDialog(null)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
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

function corporateKpiColor(status: CorporateKpiStatus): string {
  if (status === 'critical') return Colors.negative;
  if (status === 'watch') return Colors.warning;
  if (status === 'healthy') return Colors.primary;
  return Colors.textMuted;
}

function corporateVarianceColor(direction: 'positive' | 'negative' | 'neutral'): string {
  if (direction === 'positive') return Colors.primary;
  if (direction === 'negative') return Colors.negative;
  return Colors.textMuted;
}

function formatSignedPercent(value: number | null): string {
  if (value == null) return 'Baseline';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`;
}

function formatSignedPoints(value: number | null): string {
  if (value == null) return 'Baseline';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} pts`;
}

function managementTargetStatusColor(status: BusinessManagementTargetStatus): string {
  if (status === 'met') return Colors.primary;
  if (status === 'near') return Colors.warning;
  if (status === 'missed') return Colors.negative;
  return Colors.textMuted;
}

function formatManagementTargetValue(id: string, value: number): string {
  if (id === 'revenue' || id === 'debt') return formatCurrency(value);
  if (id === 'margin' || id === 'payroll') return `${(value * 100).toFixed(1)}%`;
  if (id === 'maintenance') return `${value.toFixed(0)}%`;
  return value.toFixed(1);
}

function managementYearComparisonColor(
  value: number | null,
  lowerIsBetter = false,
): string {
  if (value == null || Math.abs(value) < 0.0001) return Colors.textMuted;
  const improved = lowerIsBetter ? value < 0 : value > 0;
  return improved ? Colors.primary : Colors.negative;
}

function formatManagementYearComparison(
  value: number | null,
  unit: 'percent' | 'points',
): string {
  if (value == null) return '—';
  const suffix = unit === 'percent' ? '%' : ' pts';
  const scaled = unit === 'percent' ? value * 100 : value;
  return `${scaled >= 0 ? '+' : ''}${scaled.toFixed(1)}${suffix}`;
}

function managementQuarterScopeLabel(quarters: number[]): string {
  if (quarters.length === 0) return 'No comparable quarters';
  const sorted = [...quarters].sort((a, b) => a - b);
  const sequential = sorted.every((quarter, index) =>
    index === 0 || quarter === sorted[index - 1] + 1
  );
  return sequential && sorted.length > 1
    ? `Q${sorted[0]}–Q${sorted[sorted.length - 1]}`
    : sorted.map((quarter) => `Q${quarter}`).join(' + ');
}

function CorporateKpiCell({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: string;
  status: CorporateKpiStatus;
}) {
  const color = corporateKpiColor(status);
  return (
    <View style={styles.managementKpiCell}>
      <View style={styles.managementKpiLabelRow}>
        <View style={[styles.managementKpiDot, { backgroundColor: color }]} />
        <Text style={styles.managementKpiLabel}>{label}</Text>
      </View>
      <Text style={[styles.managementKpiValue, { color }]}>{value}</Text>
      {!!detail && <Text style={styles.managementKpiDetail}>{detail}</Text>}
    </View>
  );
}

function CorporateManagementReportPanel({
  quarterlyReport,
  annualReport,
  quarterlyActions,
  annualActions,
  targetProgress,
  reviewYears,
  period,
  onPeriodChange,
  onTargetProfileChange,
  onActionPress,
}: {
  quarterlyReport: CorporateManagementReport;
  annualReport: CorporateManagementReport;
  quarterlyActions: CorporateManagementAction[];
  annualActions: CorporateManagementAction[];
  targetProgress: BusinessManagementTargetProgress | null;
  reviewYears: BusinessManagementYearReview[];
  period: CorporateReportPeriod;
  onPeriodChange: (period: CorporateReportPeriod) => void;
  onTargetProfileChange: (profile: BusinessManagementTargetProfile) => void;
  onActionPress: (target: CorporateManagementActionTarget) => void;
}) {
  const report = period === 'quarter' ? quarterlyReport : annualReport;
  const actions = period === 'quarter' ? quarterlyActions : annualActions;
  const [historyYearIndex, setHistoryYearIndex] = useState(0);
  const safeHistoryYearIndex = Math.min(
    historyYearIndex,
    Math.max(0, reviewYears.length - 1),
  );
  const selectedHistoryYear = reviewYears[safeHistoryYearIndex] ?? null;
  const statusColor = corporateKpiColor(report.overallStatus);
  const revenueTrend = report.revenuePerEmployeeChangePct == null
    ? 'Baseline forming'
    : `${report.revenuePerEmployeeChangePct >= 0 ? '+' : ''}${(report.revenuePerEmployeeChangePct * 100).toFixed(1)}% vs prior`;
  const turnoverDetail = report.turnoverTrend === 'baseline'
    ? 'Baseline forming'
    : `${report.turnoverTrend} vs prior`;
  const debtCoverValue = report.debtCoverage == null ? 'No debt' : `${report.debtCoverage.toFixed(2)}×`;
  const projectRoiValue = report.projectOperatingRoi == null
    ? 'No projects'
    : `${(report.projectOperatingRoi * 100).toFixed(1)}%`;
  const projectRoiDetail = report.projectOperatingRoi == null
    ? 'Complete corporate investments to track ROI'
    : `${formatCurrency(report.projectAnnualOperatingBenefit)}/yr direct benefit`;

  return (
    <>
      <View style={styles.managementReportHeader}>
        <View style={styles.managementPeriodTabs}>
          <Pressable
            style={[styles.managementPeriodTab, period === 'quarter' && styles.managementPeriodTabActive]}
            onPress={() => onPeriodChange('quarter')}
          >
            <Text style={[styles.managementPeriodTabText, period === 'quarter' && { color: Colors.info }]}>Quarter</Text>
          </Pressable>
          <Pressable
            style={[styles.managementPeriodTab, period === 'annual' && styles.managementPeriodTabActive]}
            onPress={() => onPeriodChange('annual')}
          >
            <Text style={[styles.managementPeriodTabText, period === 'annual' && { color: Colors.info }]}>Annual</Text>
          </Pressable>
        </View>
        <View style={styles.managementReportStatus}>
          <View style={[styles.managementStatusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.managementReportStatusText, { color: statusColor }]}>
            {report.overallStatus === 'critical' ? 'Action needed' : report.overallStatus === 'watch' ? 'Watch' : 'Healthy'}
          </Text>
        </View>
      </View>

      <View style={styles.managementReportMetaRow}>
        <Text style={styles.managementReportPeriod}>{report.label}</Text>
        <Text style={styles.managementReportCoverage}>
          {report.weeksTracked}/{report.expectedWeeks} weeks tracked
        </Text>
      </View>

      <View style={styles.managementVarianceSummary}>
        <View style={styles.managementVarianceMetric}>
          <Text style={styles.managementVarianceLabel}>Revenue / wk</Text>
          <Text style={[styles.managementVarianceValue, {
            color: report.revenueChangePct == null
              ? Colors.textMuted
              : report.revenueChangePct >= 0 ? Colors.primary : Colors.negative,
          }]}>
            {formatSignedPercent(report.revenueChangePct)}
          </Text>
        </View>
        <View style={styles.managementVarianceMetric}>
          <Text style={styles.managementVarianceLabel}>Expenses / wk</Text>
          <Text style={[styles.managementVarianceValue, {
            color: report.expensesChangePct == null
              ? Colors.textMuted
              : report.expensesChangePct <= 0 ? Colors.primary : Colors.negative,
          }]}>
            {formatSignedPercent(report.expensesChangePct)}
          </Text>
        </View>
        <View style={styles.managementVarianceMetric}>
          <Text style={styles.managementVarianceLabel}>Profit margin</Text>
          <Text style={[styles.managementVarianceValue, {
            color: report.profitMarginChangePctPoints == null
              ? Colors.textMuted
              : report.profitMarginChangePctPoints >= 0 ? Colors.primary : Colors.negative,
          }]}>
            {formatSignedPoints(report.profitMarginChangePctPoints)}
          </Text>
          <Text style={styles.managementVarianceMeta}>{(report.profitMargin * 100).toFixed(1)}% now</Text>
        </View>
      </View>

      <View style={styles.managementVarianceBox}>
        <View style={styles.managementVarianceHeader}>
          <Text style={styles.managementVarianceTitle}>What changed vs prior period</Text>
          <Text style={styles.managementVarianceCoverage}>
            {report.varianceHistoryCoverage === 'full'
              ? 'Tracked'
              : report.varianceHistoryCoverage === 'partial'
                ? 'Partial history'
                : 'Baseline forming'}
          </Text>
        </View>
        {report.varianceDrivers.length === 0 ? (
          <Text style={styles.managementVarianceEmpty}>
            {report.varianceHistoryCoverage === 'baseline'
              ? 'A prior comparable period is needed before trend drivers can be ranked.'
              : 'No tracked operating driver moved enough to stand out this period.'}
          </Text>
        ) : (
          <>
            {report.varianceDrivers.slice(0, 4).map((driver) => {
              const color = corporateVarianceColor(driver.direction);
              const icon = driver.direction === 'positive'
                ? 'trending-up-outline'
                : driver.direction === 'negative'
                  ? 'trending-down-outline'
                  : 'remove-outline';
              return (
                <View key={driver.id} style={styles.managementVarianceDriver}>
                  <View style={[styles.managementVarianceIcon, { borderColor: `${color}55` }]}>
                    <Ionicons name={icon} size={13} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.managementVarianceDriverTitle, { color }]}>{driver.title}</Text>
                    <Text style={styles.managementVarianceDriverDetail}>{driver.detail}</Text>
                  </View>
                </View>
              );
            })}
            {report.varianceHistoryCoverage === 'partial' && (
              <Text style={styles.managementVarianceFootnote}>
                Older saved weeks contain core KPI history only. Skill, morale, integration and detailed upkeep attribution becomes more complete as new weeks are recorded.
              </Text>
            )}
          </>
        )}
      </View>

      {period === 'quarter' && targetProgress && (
        <View style={styles.managementTargetBox}>
          <View style={styles.managementTargetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.managementTargetTitle}>
                Q{targetProgress.plan.quarter} management targets
              </Text>
              <Text style={styles.managementTargetMeta}>
                {BUSINESS_MANAGEMENT_TARGET_PROFILES[targetProgress.plan.profile].label} • {targetProgress.metCount}/{targetProgress.totalCount} met
                {targetProgress.nearCount > 0 ? ` • ${targetProgress.nearCount} near` : ''}
              </Text>
            </View>
            <View style={[
              styles.managementTargetScore,
              {
                borderColor: targetProgress.missedCount > 0
                  ? `${Colors.warning}55`
                  : `${Colors.primary}55`,
              },
            ]}>
              <Text style={[
                styles.managementTargetScoreText,
                { color: targetProgress.missedCount > 0 ? Colors.warning : Colors.primary },
              ]}>
                {targetProgress.metCount}/{targetProgress.totalCount}
              </Text>
            </View>
          </View>

          <Text style={styles.managementTargetDescription}>
            {BUSINESS_MANAGEMENT_TARGET_PROFILES[targetProgress.plan.profile].description}
          </Text>

          <View style={styles.managementTargetProfileGrid}>
            {(Object.keys(BUSINESS_MANAGEMENT_TARGET_PROFILES) as BusinessManagementTargetProfile[]).map((profile) => {
              const definition = BUSINESS_MANAGEMENT_TARGET_PROFILES[profile];
              const active = targetProgress.plan.profile === profile;
              return (
                <Pressable
                  key={profile}
                  style={[styles.managementTargetProfileChip, active && styles.managementTargetProfileChipActive]}
                  onPress={() => !active && onTargetProfileChange(profile)}
                >
                  <Text style={[
                    styles.managementTargetProfileText,
                    active && { color: Colors.primary },
                  ]}>
                    {definition.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.managementTargetRows}>
            {targetProgress.results.map((result) => {
              const color = managementTargetStatusColor(result.status);
              return (
                <View key={result.id} style={styles.managementTargetRow}>
                  <View style={[styles.managementTargetDot, { backgroundColor: color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.managementTargetLabel}>{result.label}</Text>
                    <Text style={styles.managementTargetActual}>
                      {formatManagementTargetValue(result.id, result.actual)}
                    </Text>
                  </View>
                  <View style={styles.managementTargetRight}>
                    <Text style={styles.managementTargetGoal}>
                      {result.direction === 'lower' ? '≤ ' : '≥ '}
                      {formatManagementTargetValue(result.id, result.target)}
                    </Text>
                    {result.id === 'debt' && result.scheduleBenchmark != null && (
                      <Text style={styles.managementTargetPace}>
                        Pace ≤ {formatManagementTargetValue(result.id, result.scheduleBenchmark)}
                      </Text>
                    )}
                    <Text style={[styles.managementTargetStatus, { color }]}>
                      {result.status === 'met'
                        ? 'MET'
                        : result.status === 'near'
                          ? 'NEAR'
                          : result.status === 'missed'
                            ? 'MISSED'
                            : '—'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={styles.managementTargetFootnote}>
            Outcome targets do not change company behavior automatically. Use the Annual Cash Plan, workforce, financing and upkeep controls to work toward them.
          </Text>
        </View>
      )}

      {period === 'annual' && (
        <View style={styles.managementHistoryBox}>
          <View style={styles.managementHistoryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.managementHistoryTitle}>Management history</Text>
              <Text style={styles.managementHistoryMeta}>
                Frozen quarter closes • latest 5 game years
              </Text>
            </View>
            {selectedHistoryYear && (
              <View style={styles.managementHistoryNav}>
                <Pressable
                  disabled={safeHistoryYearIndex >= reviewYears.length - 1}
                  style={[
                    styles.managementHistoryNavButton,
                    safeHistoryYearIndex >= reviewYears.length - 1 && styles.disabledAction,
                  ]}
                  onPress={() => setHistoryYearIndex((index) => Math.min(reviewYears.length - 1, index + 1))}
                >
                  <Ionicons name="chevron-back" size={13} color={Colors.textSecondary} />
                </Pressable>
                <Text style={styles.managementHistoryYear}>Year {selectedHistoryYear.year}</Text>
                <Pressable
                  disabled={safeHistoryYearIndex <= 0}
                  style={[
                    styles.managementHistoryNavButton,
                    safeHistoryYearIndex <= 0 && styles.disabledAction,
                  ]}
                  onPress={() => setHistoryYearIndex((index) => Math.max(0, index - 1))}
                >
                  <Ionicons name="chevron-forward" size={13} color={Colors.textSecondary} />
                </Pressable>
              </View>
            )}
          </View>

          {!selectedHistoryYear ? (
            <Text style={styles.managementHistoryEmpty}>
              The first historical review is saved when the current quarter closes.
            </Text>
          ) : (
            <>
              <View style={styles.managementHistorySummary}>
                <View style={styles.managementHistorySummaryItem}>
                  <Text style={styles.managementHistorySummaryValue}>
                    {selectedHistoryYear.targetHitRate == null
                      ? '—'
                      : `${Math.round(selectedHistoryYear.targetHitRate * 100)}%`}
                  </Text>
                  <Text style={styles.managementHistorySummaryLabel}>Targets met</Text>
                </View>
                <View style={styles.managementHistorySummaryItem}>
                  <Text style={styles.managementHistorySummaryValue}>
                    {formatCurrency(selectedHistoryYear.averageWeeklyRevenue)}
                  </Text>
                  <Text style={styles.managementHistorySummaryLabel}>Avg revenue/wk</Text>
                </View>
                <View style={styles.managementHistorySummaryItem}>
                  <Text style={styles.managementHistorySummaryValue}>
                    {(selectedHistoryYear.profitMargin * 100).toFixed(1)}%
                  </Text>
                  <Text style={styles.managementHistorySummaryLabel}>Profit margin</Text>
                </View>
              </View>

              <Text style={styles.managementHistoryAnnualMeta}>
                {selectedHistoryYear.complete
                  ? 'Full year'
                  : `${selectedHistoryYear.quarterCount}/4 quarters closed`}
                {' • '}Payroll {(selectedHistoryYear.payrollToRevenueRatio * 100).toFixed(1)}%
                {' • '}Debt {formatCurrency(selectedHistoryYear.endingDebtBalance)}
                {' • '}Upkeep {selectedHistoryYear.averageMaintenanceCondition.toFixed(0)}%
                {selectedHistoryYear.revenueChangePct != null
                  ? ` • Revenue Q1→Q${selectedHistoryYear.quarters[selectedHistoryYear.quarters.length - 1]?.quarter ?? 1} ${selectedHistoryYear.revenueChangePct >= 0 ? '+' : ''}${(selectedHistoryYear.revenueChangePct * 100).toFixed(1)}%`
                  : ''}
              </Text>

              {selectedHistoryYear.yearOverYear && (
                <View style={styles.managementYearCompareBox}>
                  <View style={styles.managementYearCompareHeader}>
                    <Text style={styles.managementYearCompareTitle}>
                      vs Year {selectedHistoryYear.yearOverYear.comparisonYear}
                    </Text>
                    <Text style={styles.managementYearCompareScope}>
                      Same {managementQuarterScopeLabel(selectedHistoryYear.yearOverYear.quartersCompared)}
                    </Text>
                  </View>
                  <View style={styles.managementYearCompareGrid}>
                    {[
                      {
                        key: 'revenue',
                        label: 'Revenue / wk',
                        value: selectedHistoryYear.yearOverYear.averageWeeklyRevenueChangePct,
                        unit: 'percent' as const,
                        lower: false,
                      },
                      {
                        key: 'margin',
                        label: 'Profit margin',
                        value: selectedHistoryYear.yearOverYear.profitMarginChangePctPoints,
                        unit: 'points' as const,
                        lower: false,
                      },
                      {
                        key: 'payroll',
                        label: 'Payroll / revenue',
                        value: selectedHistoryYear.yearOverYear.payrollToRevenueChangePctPoints,
                        unit: 'points' as const,
                        lower: true,
                      },
                      {
                        key: 'debt',
                        label: 'Debt balance',
                        value: selectedHistoryYear.yearOverYear.endingDebtChangePct,
                        unit: 'percent' as const,
                        lower: true,
                      },
                      {
                        key: 'maintenance',
                        label: 'Upkeep condition',
                        value: selectedHistoryYear.yearOverYear.maintenanceConditionChangePoints,
                        unit: 'points' as const,
                        lower: false,
                      },
                      {
                        key: 'targets',
                        label: 'Target hit rate',
                        value: selectedHistoryYear.yearOverYear.targetHitRateChangePctPoints,
                        unit: 'points' as const,
                        lower: false,
                      },
                    ].map((item) => (
                      <View key={item.key} style={styles.managementYearCompareMetric}>
                        <Text style={styles.managementYearCompareLabel}>{item.label}</Text>
                        <Text style={[
                          styles.managementYearCompareValue,
                          { color: managementYearComparisonColor(item.value, item.lower) },
                        ]}>
                          {formatManagementYearComparison(item.value, item.unit)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.managementHistoryQuarterList}>
                {[1, 2, 3, 4].map((quarterNumber) => {
                  const quarter = selectedHistoryYear.quarters.find((item) => item.quarter === quarterNumber);
                  if (!quarter) {
                    return (
                      <View key={quarterNumber} style={styles.managementHistoryQuarterRow}>
                        <View style={styles.managementHistoryQuarterBadge}>
                          <Text style={styles.managementHistoryQuarterBadgeText}>Q{quarterNumber}</Text>
                        </View>
                        <Text style={styles.managementHistoryQuarterMissing}>Not closed</Text>
                      </View>
                    );
                  }
                  const profileLabel = BUSINESS_MANAGEMENT_TARGET_PROFILES[quarter.profile]?.label ?? quarter.profile;
                  const quarterColor = quarter.targetMissedCount > 0
                    ? Colors.warning
                    : quarter.targetMetCount === quarter.targetTotalCount
                      ? Colors.primary
                      : Colors.textSecondary;
                  return (
                    <View key={quarterNumber} style={styles.managementHistoryQuarterRow}>
                      <View style={styles.managementHistoryQuarterBadge}>
                        <Text style={styles.managementHistoryQuarterBadgeText}>Q{quarterNumber}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.managementHistoryQuarterTitle}>
                          {profileLabel}
                          {quarter.partial ? ' • Partial' : ''}
                        </Text>
                        <Text style={styles.managementHistoryQuarterMeta}>
                          {formatCurrency(quarter.averageWeeklyRevenue)}/wk
                          {' • '}Margin {(quarter.profitMargin * 100).toFixed(1)}%
                          {' • '}Debt {formatCurrency(quarter.endingDebtBalance)}
                        </Text>
                      </View>
                      <View style={styles.managementHistoryQuarterScore}>
                        <Text style={[styles.managementHistoryQuarterScoreValue, { color: quarterColor }]}>
                          {quarter.targetMetCount}/{quarter.targetTotalCount}
                        </Text>
                        <Text style={styles.managementHistoryQuarterScoreLabel}>targets</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      )}

      <View style={styles.managementKpiGrid}>
        <CorporateKpiCell
          label="Productivity"
          value={`${report.productivityIndex.toFixed(0)}%`}
          detail="Department capacity index"
          status={report.productivityStatus}
        />
        <CorporateKpiCell
          label="Revenue / employee"
          value={`${formatCurrency(report.revenuePerEmployee)}/wk`}
          detail={revenueTrend}
          status={report.revenuePerEmployeeStatus}
        />
        <CorporateKpiCell
          label="Payroll / revenue"
          value={`${(report.payrollToRevenueRatio * 100).toFixed(1)}%`}
          detail="Watch >32% • Critical >45%"
          status={report.payrollStatus}
        />
        <CorporateKpiCell
          label="Turnover"
          value={`${(report.annualizedTurnoverRate * 100).toFixed(1)}%`}
          detail={turnoverDetail}
          status={report.turnoverStatus}
        />
        <CorporateKpiCell
          label="Debt coverage"
          value={debtCoverValue}
          detail={report.debtCoverage == null ? 'No scheduled debt service' : 'Watch <1.5× • Critical <1.0×'}
          status={report.debtCoverageStatus}
        />
        <CorporateKpiCell
          label="Maintenance"
          value={`${report.averageMaintenanceCondition.toFixed(0)}%`}
          detail={`${formatCurrency(report.maintenanceBacklog)} estimated backlog`}
          status={report.maintenanceStatus}
        />
        <CorporateKpiCell
          label="Project ROI"
          value={projectRoiValue}
          detail={projectRoiDetail}
          status={report.projectRoiStatus}
        />
      </View>

      <Text style={styles.managementSubheading}>Department productivity</Text>
      <View style={styles.managementDepartmentRow}>
        {(Object.keys(CORPORATE_DEPARTMENT_DEFINITIONS) as CorporateDepartmentId[]).map((departmentId) => {
          const definition = CORPORATE_DEPARTMENT_DEFINITIONS[departmentId];
          const value = report.departmentProductivity[departmentId] ?? 100;
          const status: CorporateKpiStatus = value < 85 ? 'critical' : value < 95 ? 'watch' : 'healthy';
          return (
            <View key={departmentId} style={styles.managementDepartmentChip}>
              <Text style={styles.managementDepartmentIcon}>{definition.icon}</Text>
              <Text style={styles.managementDepartmentName}>{definition.name}</Text>
              <Text style={[styles.managementDepartmentValue, { color: corporateKpiColor(status) }]}>
                {value.toFixed(0)}%
              </Text>
            </View>
          );
        })}
      </View>

      {actions.length > 0 && (
        <View style={styles.managementActions}>
          <View style={styles.managementActionsHeader}>
            <Text style={styles.managementActionsTitle}>Suggested next actions</Text>
            <Text style={styles.managementActionsHint}>Advisory only</Text>
          </View>
          {actions.map((item) => {
            const actionColor = corporateKpiColor(item.severity);
            return (
              <View key={item.id} style={styles.managementActionRow}>
                <View style={[styles.managementActionBar, { backgroundColor: actionColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.managementActionTitle}>{item.title}</Text>
                  <Text style={styles.managementActionDetail}>{item.detail}</Text>
                </View>
                <Pressable
                  style={[styles.managementActionButton, { borderColor: `${actionColor}66` }]}
                  onPress={() => onActionPress(item.target)}
                >
                  <Text style={[styles.managementActionButtonText, { color: actionColor }]}>{item.cta}</Text>
                  <Ionicons name="arrow-down-outline" size={11} color={actionColor} />
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.managementWarnings}>
        <View style={styles.managementWarningsHeader}>
          <Text style={styles.managementWarningsTitle}>Management flags</Text>
          <Text style={[styles.managementWarningsCount, { color: statusColor }]}>
            {report.warnings.length === 0 ? 'None' : report.warnings.length}
          </Text>
        </View>
        {report.warnings.length === 0 ? (
          <Text style={styles.managementAllClear}>
            No KPI has crossed a management warning threshold in this reporting period.
          </Text>
        ) : (
          <>
            {report.warnings.slice(0, 3).map((warning) => (
              <View key={warning.id} style={styles.managementWarningRow}>
                <View style={[styles.managementWarningBar, { backgroundColor: corporateKpiColor(warning.severity) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.managementWarningTitle}>{warning.title}</Text>
                  <Text style={styles.managementWarningDetail}>{warning.detail}</Text>
                </View>
              </View>
            ))}
            {report.warnings.length > 3 && (
              <Text style={styles.managementMoreWarnings}>+{report.warnings.length - 3} more flags in this report</Text>
            )}
          </>
        )}
      </View>

      <Text style={styles.managementFootnote}>
        Project ROI estimates direct revenue and operating-cost effects only; retained asset value, reputation and crisis protection stay separate.
      </Text>
    </>
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
  topArtwork: { width: 70, height: 70 },
  topDetails: {},
  levelBadge: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  industry: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  topStats: { flexDirection: 'row', marginTop: 14, gap: 8 },
  topStatItem: { flex: 1 },
  topStatLabel: { color: Colors.textMuted, fontSize: 11 },
  topStatValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
  automationRow: { marginTop: 12 },
  healthPanel: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: Colors.elevated },
  healthScore: { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  strategyPanel: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: Colors.elevated },
  strategyText: { color: Colors.textPrimary, fontSize: 13, marginTop: 4 },
  identityList: { gap: 9 },
  identityRow: { gap: 5, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  identityDescription: { color: Colors.textSecondary, fontSize: 10, lineHeight: 15 },
  identityEmpty: { color: Colors.textMuted, fontSize: 11, lineHeight: 16 },
  nextActionCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12 },
  nextActionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  nextActionEyebrow: { fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  nextActionTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '900', marginTop: 2 },
  nextActionDetail: { color: Colors.textSecondary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  sectionTabShell: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder, backgroundColor: Colors.background, paddingHorizontal: 16, paddingBottom: 8 },
  businessContextRow: { flexDirection: 'row', gap: 6, marginBottom: 9 },
  businessContextItem: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 },
  businessContextLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  businessContextValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900', marginTop: 2 },
  sectionJumpRow: { gap: 7, paddingRight: 10 },
  sectionJumpChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  sectionJumpChipActive: { borderColor: `${Colors.business}66`, backgroundColor: `${Colors.business}14` },
  sectionJumpText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800' },
  sectionJumpTextActive: { color: Colors.business },
  automationLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  automationTrack: { height: 6, backgroundColor: Colors.elevated, borderRadius: 3 },
  automationFill: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  delegationStatus: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#10382D', borderRadius: 8, padding: 8, marginTop: 9 },
  delegationStatusTitle: { color: Colors.primary, fontSize: 10, fontWeight: '800' },
  delegationStatusText: { color: Colors.textSecondary, fontSize: 9, lineHeight: 13, marginTop: 2 },
  delegationStatusLast: { color: Colors.textMuted, fontSize: 8, lineHeight: 12, marginTop: 3, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  statRowLabel: { color: Colors.textSecondary, fontSize: 14 },
  statRowValue: { fontSize: 14, fontWeight: '600' },
  managementReportHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  managementPeriodTabs: { flexDirection: 'row', padding: 2, borderRadius: 9, backgroundColor: Colors.elevated },
  managementPeriodTab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  managementPeriodTabActive: { backgroundColor: Colors.card, borderWidth: 1, borderColor: `${Colors.info}55` },
  managementPeriodTabText: { color: Colors.textMuted, fontSize: 8, fontWeight: '900' },
  managementReportStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  managementStatusDot: { width: 7, height: 7, borderRadius: 4 },
  managementReportStatusText: { fontSize: 9, fontWeight: '900' },
  managementReportMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 },
  managementReportPeriod: { color: Colors.textPrimary, fontSize: 11, fontWeight: '900' },
  managementReportCoverage: { color: Colors.textMuted, fontSize: 8, fontWeight: '700' },
  managementVarianceSummary: { flexDirection: 'row', gap: 6, marginTop: 9 },
  managementVarianceMetric: { flex: 1, minHeight: 48, borderRadius: 8, backgroundColor: Colors.elevated, paddingHorizontal: 7, paddingVertical: 7 },
  managementVarianceLabel: { color: Colors.textMuted, fontSize: 7, fontWeight: '700' },
  managementVarianceValue: { fontSize: 11, fontWeight: '900', marginTop: 3 },
  managementVarianceMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  managementVarianceBox: { marginTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 8 },
  managementVarianceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  managementVarianceTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  managementVarianceCoverage: { color: Colors.textMuted, fontSize: 7, fontWeight: '800' },
  managementVarianceEmpty: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 6 },
  managementVarianceDriver: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingVertical: 6 },
  managementVarianceIcon: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  managementVarianceDriverTitle: { fontSize: 8, fontWeight: '900' },
  managementVarianceDriverDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 1 },
  managementVarianceFootnote: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 4, fontStyle: 'italic' },
  managementTargetBox: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 9 },
  managementTargetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  managementTargetTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  managementTargetMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 2 },
  managementTargetScore: { minWidth: 35, borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5, alignItems: 'center' },
  managementTargetScoreText: { fontSize: 10, fontWeight: '900' },
  managementTargetDescription: { color: Colors.textSecondary, fontSize: 7, lineHeight: 10, marginTop: 5 },
  managementTargetProfileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  managementTargetProfileChip: { minWidth: '31%', flexGrow: 1, borderRadius: 7, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 6, paddingVertical: 6, alignItems: 'center' },
  managementTargetProfileChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  managementTargetProfileText: { color: Colors.textSecondary, fontSize: 7, fontWeight: '800' },
  managementTargetRows: { marginTop: 7 },
  managementTargetRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  managementTargetDot: { width: 7, height: 7, borderRadius: 4 },
  managementTargetLabel: { color: Colors.textMuted, fontSize: 7 },
  managementTargetActual: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900', marginTop: 1 },
  managementTargetRight: { alignItems: 'flex-end' },
  managementTargetGoal: { color: Colors.textSecondary, fontSize: 7, fontWeight: '700' },
  managementTargetPace: { color: Colors.textMuted, fontSize: 6, marginTop: 1 },
  managementTargetStatus: { fontSize: 7, fontWeight: '900', marginTop: 2 },
  managementTargetFootnote: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 6, fontStyle: 'italic' },
  managementHistoryBox: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 9 },
  managementHistoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  managementHistoryTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  managementHistoryMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 2 },
  managementHistoryNav: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  managementHistoryNavButton: { width: 25, height: 25, borderRadius: 7, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  managementHistoryYear: { minWidth: 47, textAlign: 'center', color: Colors.info, fontSize: 8, fontWeight: '900' },
  managementHistoryEmpty: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 7 },
  managementHistorySummary: { flexDirection: 'row', gap: 6, marginTop: 8 },
  managementHistorySummaryItem: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 6, alignItems: 'center' },
  managementHistorySummaryValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900' },
  managementHistorySummaryLabel: { color: Colors.textMuted, fontSize: 6, marginTop: 2, textAlign: 'center' },
  managementHistoryAnnualMeta: { color: Colors.textSecondary, fontSize: 7, lineHeight: 11, marginTop: 7 },
  managementYearCompareBox: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  managementYearCompareHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  managementYearCompareTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '900' },
  managementYearCompareScope: { color: Colors.textMuted, fontSize: 7, fontWeight: '700' },
  managementYearCompareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  managementYearCompareMetric: { width: '48.8%', minHeight: 40, backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 6 },
  managementYearCompareLabel: { color: Colors.textMuted, fontSize: 7 },
  managementYearCompareValue: { fontSize: 9, fontWeight: '900', marginTop: 2 },
  managementHistoryQuarterList: { marginTop: 6 },
  managementHistoryQuarterRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  managementHistoryQuarterBadge: { width: 29, height: 25, borderRadius: 7, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  managementHistoryQuarterBadgeText: { color: Colors.info, fontSize: 8, fontWeight: '900' },
  managementHistoryQuarterTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800' },
  managementHistoryQuarterMeta: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 1 },
  managementHistoryQuarterMissing: { color: Colors.textMuted, fontSize: 8, fontStyle: 'italic' },
  managementHistoryQuarterScore: { alignItems: 'flex-end' },
  managementHistoryQuarterScoreValue: { fontSize: 9, fontWeight: '900' },
  managementHistoryQuarterScoreLabel: { color: Colors.textMuted, fontSize: 6, marginTop: 1 },
  managementKpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  managementKpiCell: { width: '48.8%', minHeight: 66, borderRadius: 9, backgroundColor: Colors.elevated, paddingHorizontal: 9, paddingVertical: 8 },
  managementKpiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  managementKpiDot: { width: 6, height: 6, borderRadius: 3 },
  managementKpiLabel: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800' },
  managementKpiValue: { fontSize: 13, fontWeight: '900', marginTop: 4 },
  managementKpiDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  managementSubheading: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900', marginTop: 11, marginBottom: 6 },
  managementDepartmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  managementDepartmentChip: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: '31%', borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 7, paddingVertical: 6 },
  managementDepartmentIcon: { fontSize: 11 },
  managementDepartmentName: { color: Colors.textSecondary, fontSize: 7, flex: 1 },
  managementDepartmentValue: { fontSize: 8, fontWeight: '900' },
  managementActions: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 8 },
  managementActionsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  managementActionsTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  managementActionsHint: { color: Colors.textMuted, fontSize: 7, fontWeight: '700' },
  managementActionRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7 },
  managementActionBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  managementActionTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800' },
  managementActionDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  managementActionButton: { maxWidth: 86, borderWidth: 1, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  managementActionButtonText: { fontSize: 7, fontWeight: '900', textAlign: 'center' },
  managementWarnings: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 8 },
  managementWarningsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  managementWarningsTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '900' },
  managementWarningsCount: { fontSize: 8, fontWeight: '900' },
  managementAllClear: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 6 },
  managementWarningRow: { flexDirection: 'row', gap: 7, marginTop: 7 },
  managementWarningBar: { width: 3, borderRadius: 2 },
  managementWarningTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800' },
  managementWarningDetail: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 1 },
  managementMoreWarnings: { color: Colors.warning, fontSize: 7, fontWeight: '800', marginTop: 6 },
  managementFootnote: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 8, fontStyle: 'italic' },
  budgetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  budgetProfileName: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  budgetProfileDesc: { color: Colors.textSecondary, fontSize: 9, lineHeight: 13, marginTop: 2 },
  budgetReviewBadge: { borderRadius: 9, backgroundColor: Colors.elevated, paddingHorizontal: 7, paddingVertical: 5 },
  budgetReviewBadgeDue: { backgroundColor: `${Colors.warning}12`, borderWidth: 1, borderColor: `${Colors.warning}33` },
  budgetReviewText: { color: Colors.textMuted, fontSize: 8, fontWeight: '800' },
  budgetAllocationGrid: { flexDirection: 'row', gap: 6, marginTop: 10 },
  budgetAllocationItem: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  budgetAllocationPct: { color: Colors.info, fontSize: 12, fontWeight: '900' },
  budgetAllocationLabel: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  budgetReserveBox: { marginTop: 9, backgroundColor: Colors.elevated, borderRadius: 9, padding: 9 },
  budgetReserveHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  budgetReserveTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  budgetReserveValue: { color: Colors.textSecondary, fontSize: 8, fontWeight: '700' },
  budgetReserveTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.cardBorder, overflow: 'hidden', marginTop: 6 },
  budgetReserveFill: { height: 5, borderRadius: 3, backgroundColor: Colors.primary },
  budgetEarmarkRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  budgetEarmark: { flex: 1 },
  budgetEarmarkLabel: { color: Colors.textMuted, fontSize: 7 },
  budgetEarmarkValue: { color: Colors.textSecondary, fontSize: 8, fontWeight: '700', marginTop: 2 },
  budgetProfileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  budgetProfileChip: { width: '31.5%', minHeight: 43, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 7 },
  budgetProfileChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  budgetProfileChipTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  budgetProfileChipMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 2 },
  budgetLastWeek: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, marginTop: 9, paddingTop: 8 },
  budgetLastWeekTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  budgetLastWeekText: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 2 },
  chartWrap: { alignItems: 'center', marginVertical: 4 },
  rivalRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  rivalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rivalName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  rivalCompany: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  rivalStrength: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  rivalMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 5 },
  rivalAction: { color: Colors.info, fontSize: 12, marginTop: 4 },
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
  familyBusinessHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  familyBusinessTitle: { color: Colors.warning, fontSize: 15, fontWeight: '800' },
  familyBusinessStats: { flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 8 },
  familyBusinessStat: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 8, padding: 8 },
  bizStatLabel: { color: Colors.textMuted, fontSize: 10 },
  bizStatValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  familyBusinessButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: `${Colors.warning}66`, borderRadius: 10, paddingVertical: 11, marginTop: 10 },
  familyBusinessButtonText: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  longTermButton: { backgroundColor: '#33270F' },
  acquisitionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  acquisitionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  acquisitionReturn: { fontSize: 16, fontWeight: '900' },
  acquisitionProfile: { backgroundColor: Colors.elevated, borderRadius: 9, padding: 10, marginTop: 9 },
  acquisitionProfileHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  acquisitionProfileTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  acquisitionProfileText: { color: Colors.textSecondary, fontSize: 9, lineHeight: 13, marginTop: 2 },
  acquisitionCostText: { color: Colors.warning, fontSize: 9, fontWeight: '800', textAlign: 'right' },
  acquisitionTraitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  acquisitionTraitChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 11, paddingHorizontal: 7, paddingVertical: 4 },
  acquisitionTraitStrength: { borderColor: `${Colors.primary}55`, backgroundColor: `${Colors.primary}0D` },
  acquisitionTraitRisk: { borderColor: `${Colors.warning}55`, backgroundColor: `${Colors.warning}0D` },
  acquisitionTraitText: { fontSize: 8, fontWeight: '800' },
  acquisitionFindings: { gap: 7, marginTop: 9, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  acquisitionFindingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  acquisitionFindingTitle: { fontSize: 9, fontWeight: '800' },
  acquisitionFindingText: { color: Colors.textMuted, fontSize: 8, lineHeight: 12, marginTop: 1 },
  acquisitionOperatingProfile: { color: Colors.info, fontSize: 8, marginTop: 8 },
  integrationPrompt: { color: Colors.warning, fontSize: 11, lineHeight: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  integrationChoice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingVertical: 10 },
  integrationChoiceTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  integrationChoiceDesc: { color: Colors.textSecondary, fontSize: 9, lineHeight: 13, marginTop: 2 },
  integrationChoiceMeta: { color: Colors.info, fontSize: 9, marginTop: 4 },
  integrationActive: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#33270F', borderRadius: 9, padding: 10, marginTop: 8 },
  integrationActiveTitle: { color: Colors.warning, fontSize: 12, fontWeight: '800' },
  integrationActiveText: { color: Colors.textSecondary, fontSize: 9, marginTop: 2 },
  integrationResult: { backgroundColor: Colors.elevated, borderRadius: 9, padding: 10, marginTop: 8 },
  integrationResultTitle: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
  integrationResultText: { color: Colors.textSecondary, fontSize: 9, marginTop: 3 },
  decisionBanner: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 10, backgroundColor: `${Colors.warning}10`, borderWidth: 1, borderColor: `${Colors.warning}35`, marginBottom: 9 },
  crisisBanner: { backgroundColor: `${Colors.negative}10`, borderColor: `${Colors.negative}35` },
  decisionIcon: { fontSize: 24 },
  decisionEyebrow: { color: Colors.warning, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  decisionTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 2 },
  decisionDesc: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  decisionDeadline: { color: Colors.warning, fontSize: 9, fontWeight: '800', marginTop: 5 },
  decisionInsurance: { color: Colors.info, fontSize: 8, fontWeight: '700', marginTop: 4 },
  decisionInsurancePayout: { color: Colors.primary, fontSize: 8, lineHeight: 12, marginTop: 4 },
  decisionChoice: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  decisionChoiceTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  decisionChoiceDesc: { color: Colors.textSecondary, fontSize: 10, lineHeight: 14, marginTop: 2 },
  decisionEffects: { color: Colors.info, fontSize: 9, marginTop: 4 },
  decisionCost: { color: Colors.warning, fontSize: 11, fontWeight: '800' },
  strategyStatusGrid: { flexDirection: 'row', gap: 7, marginTop: 9 },
  strategyStatusCard: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 8 },
  strategyStatusLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.35 },
  strategyStatusValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '900', marginTop: 3 },
  strategyStatusMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  strategyEffectMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  autoStrategyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, padding: 10, marginTop: 9, marginBottom: 10 },
  autoStrategyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoStrategyTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '900' },
  autoStrategyDesc: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 4 },
  autoStrategyToggle: { width: 46, height: 26, borderRadius: 13, padding: 3, backgroundColor: Colors.cardBorder, justifyContent: 'center' },
  autoStrategyToggleOn: { backgroundColor: Colors.primary },
  autoStrategyThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.white },
  autoStrategyThumbOn: { alignSelf: 'flex-end' },
  strategyFocusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  strategyFocus: { width: '48%', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 9 },
  strategyFocusActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  strategyFocusTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  strategyFocusDesc: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  activeStrategyBox: { marginTop: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  activeStrategyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 4 },
  summaryLabel: { color: Colors.textMuted, fontSize: 10 },
  summaryValue: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 2 },
  ownershipSummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  controlNote: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginBottom: 7 },
  ownershipValue: { color: Colors.info, fontSize: 15, fontWeight: '800' },
  lockedEquity: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.elevated, borderRadius: 8, padding: 8, marginVertical: 7 },
  lockedEquityText: { color: Colors.textMuted, fontSize: 9, flex: 1 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  ownerName: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  ownerType: { color: Colors.textMuted, fontSize: 9, textTransform: 'capitalize', marginTop: 2 },
  ownerPct: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  shareActions: { flexDirection: 'row', gap: 7, marginTop: 7 },
  shareButton: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 8 },
  shareButtonTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  shareButtonMeta: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },
  shareInfo: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  shareInfoText: { color: Colors.warning, fontSize: 10 },
  childShareRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  smallShareButton: { borderWidth: 1, borderColor: `${Colors.info}55`, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 },
  smallShareText: { color: Colors.info, fontSize: 10, fontWeight: '700' },
  buybackButton: { borderWidth: 1, borderColor: `${Colors.primary}66`, borderRadius: 9, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  buybackText: { color: Colors.primary, fontSize: 11, fontWeight: '800' },
  trustReserveBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: `${Colors.warning}0D`, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: `${Colors.warning}28` },
  trustCapitalButtons: { flexDirection: 'row', gap: 5 },
  governanceChild: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  governanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  governanceButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  governanceButton: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
  governanceButtonActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  governanceButtonText: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  governanceWarning: { color: Colors.negative, fontSize: 9, marginTop: 3 },
  workforceLocked: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: `${Colors.warning}0D`, borderRadius: 9, padding: 10 },
  workforceLockedTitle: { color: Colors.warning, fontSize: 11, fontWeight: '800' },
  workforceLockedText: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 2 },
  workforceSummary: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  workforceSummaryMain: { minWidth: 66, backgroundColor: '#17263A', borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  workforceSummaryStat: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 9, paddingVertical: 8, alignItems: 'center' },
  workforceSummaryValue: { color: Colors.info, fontSize: 17, fontWeight: '900' },
  workforceSummarySmall: { color: Colors.textPrimary, fontSize: 12, fontWeight: '900' },
  workforceSummaryLabel: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  workforcePayrollText: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12 },
  workforceEffectText: { color: Colors.info, fontSize: 8, lineHeight: 12, marginTop: 3, marginBottom: 5 },
  hrSummary: { flexDirection: 'row', gap: 5, marginTop: 5, marginBottom: 8 },
  hrSummaryItem: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  hrSummaryValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '900' },
  hrSummaryLabel: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  hrPolicySection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 8, marginTop: 5 },
  hrPolicyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  hrPolicyTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  hrPolicyDesc: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  hrPolicyCurrent: { color: Colors.info, fontSize: 8, fontWeight: '900' },
  hrPolicyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  hrPolicyChip: { width: '48.5%', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 7 },
  hrPolicyChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  hrPolicyChipTitle: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800' },
  hrPolicyChipMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 2 },
  hrPolicyCooldown: { color: Colors.warning, fontSize: 8, marginTop: 6 },
  workforceDepartment: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  workforceDepartmentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  workforceDepartmentIcon: { width: 31, height: 31, borderRadius: 8, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  workforceDepartmentEmoji: { fontSize: 16 },
  workforceTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  workforceDepartmentName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  workforceCapacity: { fontSize: 8, fontWeight: '900' },
  workforceDepartmentMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  workforceLeader: { color: Colors.textSecondary, fontSize: 8, lineHeight: 11, marginTop: 3 },
  workforceTargetControls: { flexDirection: 'row', gap: 5, marginTop: 7, paddingLeft: 39 },
  workforceTargetButton: { minWidth: 48, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 6, alignItems: 'center' },
  workforceRecommendedButton: { flex: 1, borderColor: `${Colors.info}44`, backgroundColor: '#17263A' },
  workforceTargetButtonText: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800' },
  workforcePlanNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: Colors.elevated, borderRadius: 8, padding: 8, marginTop: 8 },
  workforcePlanText: { flex: 1, color: Colors.textMuted, fontSize: 8, lineHeight: 12 },
  workforceLastChange: { color: Colors.textSecondary, fontSize: 8, fontStyle: 'italic', marginTop: 5 },
  execEffectGrid: { flexDirection: 'row', gap: 5, marginBottom: 7 },
  execEffectItem: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 8, paddingVertical: 7, alignItems: 'center' },
  execEffectValue: { color: Colors.info, fontSize: 10, fontWeight: '900' },
  execEffectLabel: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  execPayroll: { color: Colors.textSecondary, fontSize: 8, marginBottom: 5 },
  execRoleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  execRoleBadge: { width: 43, height: 31, borderRadius: 8, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  execRoleBadgeText: { color: Colors.info, fontSize: 8, fontWeight: '900' },
  execRoleName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  execName: { color: Colors.primary, fontSize: 9, fontWeight: '800', marginTop: 2 },
  execVacant: { color: Colors.warning, fontSize: 8, fontWeight: '800', marginTop: 2 },
  execMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2, textTransform: 'capitalize' },
  execSmallButton: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 6 },
  execSearchButton: { borderColor: `${Colors.info}55`, backgroundColor: '#17263A' },
  execSmallButtonText: { color: Colors.textSecondary, fontSize: 7, fontWeight: '900' },
  execSearchBox: { backgroundColor: Colors.elevated, borderRadius: 9, padding: 9, marginTop: 8 },
  execSearchHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  execSearchTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  execSearchMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  execCandidateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  execCandidateName: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  execCandidateMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2, textTransform: 'capitalize' },
  execHireButton: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 7, backgroundColor: `${Colors.primary}0D`, paddingHorizontal: 8, paddingVertical: 6 },
  execHireButtonText: { color: Colors.primary, fontSize: 8, fontWeight: '900' },
  boardSection: { borderTopWidth: 1, borderTopColor: Colors.cardBorder, marginTop: 10, paddingTop: 10 },
  boardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  boardTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  boardMeta: { color: Colors.info, fontSize: 8, marginTop: 2 },
  boardReview: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 6 },
  boardMandateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  boardMandateChip: { width: '48.5%', minHeight: 52, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 7 },
  boardMandateChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  boardMandateTitle: { color: Colors.textPrimary, fontSize: 8, fontWeight: '800' },
  boardMandateDesc: { color: Colors.textMuted, fontSize: 7, lineHeight: 10, marginTop: 2 },
  boardCooldown: { color: Colors.warning, fontSize: 8, marginTop: 6 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 12, paddingVertical: 10, minWidth: '45%', flex: 1 },
  optionChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}15` },
  optionChipLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  optionChipLabelActive: { color: Colors.primary },
  optionChipDesc: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  empRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  employeeArtwork: { width: 52, height: 52, marginRight: 8 },
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
  insuranceSummary: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 8 },
  insuranceScoreBox: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  insuranceScore: { color: Colors.info, fontSize: 17, fontWeight: '900' },
  insuranceScoreLabel: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  insuranceSummaryTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  insuranceSummaryText: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 3 },
  insuranceGapText: { color: Colors.warning, fontSize: 8, fontWeight: '700', marginTop: 4 },
  insuranceAreaRow: { paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  insuranceAreaHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  insuranceIcon: { fontSize: 17 },
  insuranceAreaName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  insuranceAreaDesc: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  insuranceAreaMeta: { color: Colors.info, fontSize: 8, lineHeight: 11, marginTop: 4 },
  insuranceTierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  insuranceTierChip: { minWidth: 62, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 6 },
  insuranceTierChipActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}0D` },
  insuranceTierLabel: { color: Colors.textSecondary, fontSize: 8, fontWeight: '800' },
  insuranceTierLabelActive: { color: Colors.primary },
  insuranceTierMeta: { color: Colors.textMuted, fontSize: 7, marginTop: 2 },
  claimHistory: { marginTop: 8, paddingTop: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6 },
  claimIcon: { fontSize: 15 },
  claimTitle: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  claimMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 2 },
  claimNet: { color: Colors.warning, fontSize: 9, fontWeight: '800' },
  reinvestmentWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, backgroundColor: `${Colors.warning}10`, borderRadius: 8, padding: 8, marginBottom: 8 },
  reinvestmentWarningText: { flex: 1, color: Colors.warning, fontSize: 9, lineHeight: 13, fontWeight: '700' },
  reinvestmentActive: { backgroundColor: '#17263A', borderRadius: 8, padding: 9, marginBottom: 8 },
  reinvestmentActiveTitle: { color: Colors.info, fontSize: 11, fontWeight: '800' },
  reinvestmentActiveMeta: { color: Colors.textSecondary, fontSize: 8, marginTop: 2 },
  reinvestmentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  reinvestmentIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  reinvestmentIconText: { fontSize: 16 },
  reinvestmentTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  reinvestmentName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800', flex: 1 },
  reinvestmentCondition: { fontSize: 8, fontWeight: '900' },
  reinvestmentDesc: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  reinvestmentTrack: { height: 4, borderRadius: 2, backgroundColor: Colors.elevated, marginTop: 6, overflow: 'hidden' },
  reinvestmentFill: { height: 4, borderRadius: 2 },
  reinvestmentMeta: { color: Colors.textSecondary, fontSize: 8, marginTop: 4 },
  reinvestmentLocked: { color: Colors.warning, fontSize: 8, lineHeight: 11, marginTop: 3 },
  reinvestmentButton: { minWidth: 56, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 7, alignItems: 'center' },
  reinvestmentButtonActive: { borderColor: `${Colors.primary}66`, backgroundColor: `${Colors.primary}0D` },
  reinvestmentButtonText: { color: Colors.textMuted, fontSize: 7, fontWeight: '900' },
  corporateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  corporateScaleBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#17263A', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5 },
  corporateScaleText: { color: Colors.info, fontSize: 9, fontWeight: '900' },
  corporateBookValue: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  corporateLocked: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', backgroundColor: `${Colors.warning}10`, borderRadius: 9, padding: 10 },
  corporateLockedTitle: { color: Colors.warning, fontSize: 11, fontWeight: '800' },
  corporateLockedText: { color: Colors.textSecondary, fontSize: 9, lineHeight: 13, marginTop: 2 },
  corporateEffectSummary: { color: Colors.info, fontSize: 9, lineHeight: 13, marginBottom: 8 },
  corporateActive: { backgroundColor: `${Colors.warning}10`, borderWidth: 1, borderColor: `${Colors.warning}35`, borderRadius: 9, padding: 10, marginBottom: 10 },
  corporateActiveHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  corporateActiveTitle: { color: Colors.warning, fontSize: 11, fontWeight: '800', flex: 1 },
  corporateActiveWeeks: { color: Colors.warning, fontSize: 10, fontWeight: '900' },
  corporateProgressTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.elevated, marginTop: 7, overflow: 'hidden' },
  corporateProgressFill: { height: 5, borderRadius: 3, backgroundColor: Colors.warning },
  corporateConstructionText: { color: Colors.textMuted, fontSize: 8, marginTop: 6 },
  corporateCompletedWrap: { marginBottom: 8 },
  corporateCompletedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  corporateCompletedIcon: { fontSize: 16 },
  corporateCompletedName: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  corporateCompletedMeta: { color: Colors.textMuted, fontSize: 8, marginTop: 1 },
  corporateProjectRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  corporateProjectIconWrap: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#17263A', alignItems: 'center', justifyContent: 'center' },
  corporateProjectIcon: { fontSize: 16 },
  corporateProjectName: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  corporateProjectDesc: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 2 },
  corporateProjectReq: { color: Colors.textMuted, fontSize: 8, marginTop: 4 },
  corporateProjectEffect: { color: Colors.primary, fontSize: 8, lineHeight: 12, marginTop: 3 },
  corporateProjectLocked: { color: Colors.warning, fontSize: 8, lineHeight: 12, marginTop: 4 },
  capexFundingRow: { flexDirection: 'row', gap: 6, marginTop: 7 },
  capexFundingButton: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 7 },
  capexFundingButtonCash: { borderColor: `${Colors.primary}55`, backgroundColor: `${Colors.primary}0D` },
  capexFundingButtonFinance: { borderColor: `${Colors.info}55`, backgroundColor: '#17263A' },
  capexFundingTitle: { color: Colors.textMuted, fontSize: 8, fontWeight: '900' },
  capexFundingMeta: { color: Colors.textSecondary, fontSize: 7, lineHeight: 10, marginTop: 2 },
  corporateCostWrap: { alignItems: 'flex-end', paddingLeft: 4 },
  corporateCost: { color: Colors.warning, fontSize: 9, fontWeight: '900' },
  slotAccessRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 6, marginBottom: 7 },
  slotAccessStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, flexGrow: 1 },
  slotAccessText: { color: Colors.textSecondary, fontSize: 9, fontWeight: '800' },
  slotMiniButton: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: `${Colors.info}55`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  slotMiniButtonText: { color: Colors.info, fontSize: 8, fontWeight: '900' },
  slotGemButton: { borderColor: `${Colors.warning}55`, backgroundColor: `${Colors.warning}08` },
  slotGemButtonText: { color: Colors.warning, fontSize: 8, fontWeight: '900' },
  slotTemporaryLabel: { color: Colors.info, fontSize: 8, fontWeight: '800' },
  slotPermanentLabel: { color: Colors.primary, fontSize: 8, fontWeight: '800' },
  slotMessage: { color: Colors.textMuted, fontSize: 8, marginBottom: 7 },
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
  expansionActive: { padding: 10, backgroundColor: `${Colors.warning}18`, borderRadius: 8, marginBottom: 8 },
  expansionActiveTitle: { color: Colors.warning, fontWeight: '700', fontSize: 13 },
  locationOwned: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  creditHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  creditRatingBox: { minWidth: 58, alignItems: 'center', backgroundColor: '#17263A', borderRadius: 9, paddingHorizontal: 8, paddingVertical: 7 },
  creditRating: { color: Colors.info, fontSize: 18, fontWeight: '900' },
  creditScore: { color: Colors.textMuted, fontSize: 7, marginTop: 1 },
  creditTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800' },
  creditMeta: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 2 },
  creditWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: `${Colors.warning}10`, borderRadius: 8, padding: 8, marginBottom: 8 },
  creditWarningText: { flex: 1, color: Colors.warning, fontSize: 8, lineHeight: 12 },
  financeSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder, paddingTop: 9, marginTop: 8 },
  financeSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  financeSectionTitle: { color: Colors.textPrimary, fontSize: 10, fontWeight: '800' },
  financeSectionMeta: { color: Colors.textMuted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  financeDescription: { color: Colors.textSecondary, fontSize: 8, lineHeight: 12, marginTop: 5 },
  financeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  financeButton: { minWidth: 88, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 7 },
  financeButtonActive: { borderColor: `${Colors.info}55`, backgroundColor: '#17263A' },
  bondButtonActive: { borderColor: `${Colors.warning}55`, backgroundColor: `${Colors.warning}0D` },
  financeButtonTitle: { color: Colors.textMuted, fontSize: 9, fontWeight: '900' },
  financeButtonMeta: { color: Colors.textSecondary, fontSize: 7, marginTop: 2 },
  financeLocked: { color: Colors.warning, fontSize: 8, lineHeight: 11, marginTop: 6 },
  disabledAction: { opacity: 0.35 },
  loanRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  loanHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loanRepayButtons: { flexDirection: 'row', gap: 4 },
  loanRepayButton: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 5 },
  loanRepayText: { color: Colors.textSecondary, fontSize: 7, fontWeight: '800' },
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
  modalSubtitle: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  roleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  roleArtwork: { width: 52, height: 52, marginRight: 10 },
  roleName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  roleDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2, maxWidth: 200 },
  roleSalary: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  modalClose: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  modalCloseText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '600' },
  transferInfo: { color: Colors.textSecondary, fontSize: 14, marginBottom: 12 },
  transferInput: { backgroundColor: Colors.elevated, borderRadius: 10, padding: 14, color: Colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: Colors.cardBorder, marginBottom: 12 },
  transferError: { color: Colors.negative, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  transferBtn: { backgroundColor: Colors.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
  transferBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
