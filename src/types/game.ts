
// ── Personal Life / Relationships ──
export type DatingPreference = 'women' | 'men' | 'everyone';
export type FinancialStyle = 'frugal' | 'balanced' | 'luxury';
export type RiskTolerance = 'cautious' | 'balanced' | 'risk_taking';
export type AmbitionLevel = 'relaxed' | 'career_minded' | 'driven';
export type FamilyGoal = 'no_children' | 'unsure' | 'wants_children';
export type FamilyPlan = 'not_discussed' | 'no_children' | 'later' | 'trying';
export type FamilyWorkArrangement =
  | 'full_time'
  | 'both_80'
  | 'partner_80'
  | 'partner_primary';
export type RelationshipStage = 'dating' | 'partner' | 'living_together' | 'engaged' | 'married';
export type HouseholdSplit = 'equal' | 'proportional' | 'player_pays_most';
export type MarriageAgreement = 'separate' | 'shared_future';

export interface RelationshipCandidate {
  id: string;
  name: string;
  gender: 'woman' | 'man';
  age: number;
  occupationId: string;
  occupationTitle: string;
  weeklyIncome: number;
  /** Career seniority generated before dating so established adults do not all begin at level 1. */
  careerLevel?: number;
  savings: number;
  financialStyle: FinancialStyle;
  riskTolerance: RiskTolerance;
  ambition: AmbitionLevel;
  familyGoal: FamilyGoal;
  visibleTraits: Array<'financialStyle' | 'riskTolerance' | 'ambition' | 'familyGoal'>;
}

export interface RelationshipConnection extends RelationshipCandidate {
  stage: RelationshipStage;
  connection: number;
  relationship: number;
  dates: number;
  weeksKnown: number;
  becamePartnerWeek?: number;
  movedInWeek?: number;
  engagedWeek?: number;
  marriedWeek?: number;
  householdSplit?: HouseholdSplit;
  isCohabiting?: boolean;
  marriageAgreement?: MarriageAgreement;
  netWorthAtMarriage?: number;
  endedWeek?: number;
  endedReason?: 'breakup' | 'divorce' | 'death';
  employmentStatus?: 'employed' | 'unemployed';
  unemploymentWeeks?: number;
  careerLevel?: number;
  /** Employed weeks accumulated since the last promotion. */
  careerProgressWeeks?: number;
  /** Last salary before unemployment, used as the re-employment baseline. */
  lastEmployedWeeklyIncome?: number;
  lastCareerEventWeek?: number;
  /** One-time migration marker for the age-aware partner career model. */
  careerSystemVersion?: number;
  familyTreePersonId?: string;
}

export type ChildIndependence = 'close' | 'balanced' | 'independent';
export type ChildResilience = 'fragile' | 'balanced' | 'resilient';
export type ChildLifePath = 'balanced' | 'academic' | 'creative' | 'athletic' | 'entrepreneurial' | 'practical';
export type AdultChildStatus = 'employed' | 'unemployed' | 'entrepreneur';

export interface ChildPersonality {
  ambition: AmbitionLevel;
  financialStyle: FinancialStyle;
  riskTolerance: RiskTolerance;
  independence: ChildIndependence;
  resilience: ChildResilience;
}

export interface RelationshipDescendant {
  id: string;
  name: string;
  gender: 'girl' | 'boy';
  birthGlobalWeek: number;
  age: number;
}

export interface RelationshipChild {
  id: string;
  name: string;
  gender: 'girl' | 'boy';
  birthGlobalWeek: number;
  age: number;
  educationFund: number;
  status?: 'dependent' | 'independent';
  occupationTitle?: string | null;
  weeklyIncome?: number;
  educationOutcome?: 'limited' | 'solid' | 'strong' | 'elite';
  launchedGlobalWeek?: number;
  savings?: number;
  homeStatus?: 'renting' | 'homeowner';
  partnerName?: string | null;
  partnerGender?: 'woman' | 'man' | null;
  childrenCount?: number;
  descendants?: RelationshipDescendant[];
  otherParentId?: string | null;
  parentRelationship?: number;
  lastParentInteractionWeek?: number;
  personality?: ChildPersonality;
  adultStatus?: AdultChildStatus;
  debt?: number;
  failureCount?: number;
  businessValue?: number;
  lastAdultEventYear?: number;
  lifePath?: ChildLifePath;
  developmentScore?: number;
  lastLifeArcEventAge?: number;
}

export type RelationshipObligationType = 'divorce_settlement' | 'legal_fees';

export type SharedGoalType = 'cash_buffer' | 'net_worth' | 'better_home' | 'family_fund';
export type EstatePlanType = 'default' | 'spouse_first' | 'children_first' | 'equal_family';
export type EstateStructureType = 'none' | 'will' | 'family_trust';

export interface EstatePlan {
  planType: EstatePlanType;
  structure: EstateStructureType;
  successorId: string | null;
  updatedGlobalWeek: number;
}

export interface EstateBeneficiaryShare {
  id: string;
  name: string;
  relationship: 'spouse' | 'child';
  share: number;
  amount: number;
}

export interface EstateSettlement {
  grossEstate: number;
  outstandingRelationshipObligations: number;
  administrationCost: number;
  netEstate: number;
  beneficiaries: EstateBeneficiaryShare[];
  successorName: string | null;
  successorId?: string | null;
  businessSettlementDebt?: number;
  businessValue: number;
}

export type SuccessionAssetStrategy = 'liquidate' | 'keep_stocks' | 'keep_properties' | 'keep_both';

export interface SuccessionPreview {
  childId: string;
  childName: string;
  childAge: number;
  existingSavings: number;
  existingBusinessStakeValue: number;
  assetStrategy: SuccessionAssetStrategy;
  inheritedCash: number;
  inheritedStockValue: number;
  inheritedPropertyValue: number;
  inheritedPropertyIds: string[];
  inheritedBusinessValue: number;
  inheritanceTaxBase: number;
  inheritanceTax: number;
  taxCashAvailable: number;
  loanNeeded: number;
  parentRelationship: number;
  willingToSucceed: boolean;
  futurePotentialScore: number;
  futurePotentialLabel: 'Developing' | 'Solid' | 'Strong' | 'Exceptional';
}

export interface FamilyTreePerson {
  id: string;
  name: string;
  gender?: 'woman' | 'man' | 'girl' | 'boy' | null;
  generation: number;
  status: 'living' | 'deceased';
  age: number;
  birthYear: number;
  deathYear?: number | null;
  deathAge?: number | null;
  occupationTitle?: string | null;
  parentIds: string[];
  partnerIds: string[];
  childIds: string[];
  playableGeneration?: number | null;
  finalNetWorth?: number | null;
  liquidWealth?: number;
}

export interface FamilyTreeState {
  currentPlayerId: string | null;
  people: FamilyTreePerson[];
}

export const INITIAL_FAMILY_TREE_STATE: FamilyTreeState = {
  currentPlayerId: null,
  people: [],
};

export interface FamilyLegacyEntry {
  generation: number;
  name: string;
  deathAge: number;
  deathYear: number;
  finalNetWorth: number;
  successorName: string | null;
}

export interface RelationshipSharedGoal {
  type: SharedGoalType;
  target: number;
  startedGlobalWeek: number;
  completed: boolean;
}

export interface RelationshipFinancialObligation {
  id: string;
  type: RelationshipObligationType;
  label: string;
  remainingAmount: number;
  weeklyPayment: number;
  weeksRemaining: number;
}

export interface RelationshipTimelineEntry {
  week: number;
  year: number;
  title: string;
}

export type RelationshipMemoryTag =
  | 'intimate_wedding'
  | 'standard_wedding'
  | 'luxury_wedding'
  | 'world_travellers'
  | 'big_family_celebration'
  | 'simple_family_tradition'
  | 'showed_up_for_family'
  | 'balanced_work_family'
  | 'career_first'
  | 'supported_child_path'
  | 'child_independence';

export interface RelationshipMemory {
  id: string;
  tag: RelationshipMemoryTag;
  label: string;
  sentiment: 'positive' | 'mixed' | 'negative';
  globalWeek: number;
  partnerId?: string | null;
  childId?: string | null;
  sourceEventId?: string | null;
}

export interface RelationshipFinancialSnapshot {
  globalWeek: number;
  netWorth: number;
  cash: number;
  personalDebt: number;
  businessValue: number;
  businessCount: number;
  housingId: string;
  carId: string;
}

export interface RelationshipEventChoice {
  text: string;
  personalityHint?: string;
  cost?: number;
  cash?: number;
  relationship?: number;
  happiness?: number;
  happinessDuration?: number;
  childId?: string;
  childSavings?: number;
  childEducationFund?: number;
  childRelationship?: number;
  /** Starts unpaid couple travel for this many weekly ticks. */
  travelWeeks?: number;
  memoryTag?: RelationshipMemoryTag;
  memoryLabel?: string;
  memorySentiment?: RelationshipMemory['sentiment'];
  childLifePath?: ChildLifePath;
  childDevelopment?: number;
  careerPerformanceDelta?: number;
  businessId?: string;
  businessReputationDelta?: number;
  businessMoraleDelta?: number;
  businessCashCost?: number;
}

export interface RelationshipEvent {
  id: string;
  title: string;
  description: string;
  icon: string;
  choices: RelationshipEventChoice[];
  /** Persistent one-time milestone marker. */
  milestoneKey?: string;
}

export interface RelationshipState {
  preferencesSet: boolean;
  preference: DatingPreference;
  minAge: number;
  maxAge: number;
  minAgeOffset: number;
  maxAgeOffset: number;
  weeklyCandidates: RelationshipCandidate[];
  candidateRefreshWeek: number;
  activeConnections: RelationshipConnection[];
  formerPartners: RelationshipConnection[];
  partnerId: string | null;
  personalActionWeek: number;
  timeline: RelationshipTimelineEntry[];
  children: RelationshipChild[];
  financialObligations: RelationshipFinancialObligation[];
  familyPlan: FamilyPlan;
  familyExpansionWeeksRemaining: number;
  /**
   * Household work schedule while the youngest child is under 6.
   * Existing saves default to both_80 through runtime normalization.
   */
  familyWorkArrangement?: FamilyWorkArrangement;
  familyWorkArrangementChangedWeek?: number;
  familySpendingMode: 'normal' | 'reduced';
  familySpendingWeeksRemaining: number;
  lastFamilyAttemptWeek: number;
  lastRelationshipEventWeek: number;
  recentRelationshipEventIds: string[];
  celebratedMilestones?: string[];
  memories?: RelationshipMemory[];
  lastWorkFamilyConflictWeek?: number;
  coupleTripWeeksRemaining?: number;
  lastCoupleTripWeek?: number;
  pendingEvent: RelationshipEvent | null;
  financialSnapshot: RelationshipFinancialSnapshot | null;
  sharedGoal: RelationshipSharedGoal | null;
  lastStabilityWarningWeek: number;
  estatePlan: EstatePlan;
  estateSettlement: EstateSettlement | null;
  familyTrustCash: number;
}

export const INITIAL_RELATIONSHIP_STATE: RelationshipState = {
  preferencesSet: false,
  preference: 'everyone',
  minAge: 18,
  maxAge: 24,
  minAgeOffset: -2,
  maxAgeOffset: 4,
  weeklyCandidates: [],
  candidateRefreshWeek: 0,
  activeConnections: [],
  formerPartners: [],
  partnerId: null,
  personalActionWeek: 0,
  timeline: [],
  children: [],
  financialObligations: [],
  familyPlan: 'not_discussed',
  familyExpansionWeeksRemaining: 0,
  familyWorkArrangement: 'both_80',
  familyWorkArrangementChangedWeek: 0,
  familySpendingMode: 'normal',
  familySpendingWeeksRemaining: 0,
  lastFamilyAttemptWeek: 0,
  lastRelationshipEventWeek: 0,
  recentRelationshipEventIds: [],
  celebratedMilestones: [],
  memories: [],
  lastWorkFamilyConflictWeek: 0,
  coupleTripWeeksRemaining: 0,
  lastCoupleTripWeek: 0,
  pendingEvent: null,
  financialSnapshot: null,
  sharedGoal: null,
  lastStabilityWarningWeek: 0,
  estatePlan: {
    planType: 'default',
    structure: 'none',
    successorId: null,
    updatedGlobalWeek: 0,
  },
  estateSettlement: null,
  familyTrustCash: 0,
};

export interface LifecycleState {
  isDead: boolean;
  deathAge: number | null;
  deathWeek: number | null;
  deathYear: number | null;
  causeOfDeath: string | null;
}

export const INITIAL_LIFECYCLE_STATE: LifecycleState = {
  isDead: false,
  deathAge: null,
  deathWeek: null,
  deathYear: null,
  causeOfDeath: null,
};

export interface ActiveMacroCrash {
  title: string;
  weeksRemaining: number;
  totalWeeks: number;
  weeklyStockShock: number;
}

// ── Skills & Knowledge ──
export interface SkillCategoryData {
  id: string;
  name: string;
  description: string;
}
export interface KnowledgeCategoryData {
  id: string;
  name: string;
  description: string;
}

// ── Career System ──
export interface CompanyData {
  id: string;
  name: string;
  industry: string;
  description: string;
  careerPaths: string[];
  salaryMultiplier: number;
  promotionSpeed: number;
  culture: number;
  layoffRisk: number;
  size: string;
}

export interface CareerPosition {
  level: number;
  title: string;
  baseSalary: number;
  reqKnowledge: Record<string, number>;
  reqSkills: Record<string, number>;
  reqWeeks: number;
}

export interface CareerPathData {
  id: string;
  name: string;
  requiredCourseBase: string;
  positions: CareerPosition[];
}

export interface CareerState {
  companyId: string | null;
  careerPathId: string | null;
  positionLevel: number;
  performance: number;
  weeksInPosition: number;
  weeksAtCompany: number;
  salaryBonus: number;
  performanceRaisesAtLevel?: number;
  lastRaiseWeek: number;
  networkingScore: number;
  promotionProgress: number; // 0-100, promote at 100
  lastPerformanceEventWeek: number;
}

export const INITIAL_CAREER_STATE: CareerState = {
  companyId: null,
  careerPathId: null,
  positionLevel: 0,
  performance: 50,
  weeksInPosition: 0,
  weeksAtCompany: 0,
  salaryBonus: 1.0,
  performanceRaisesAtLevel: 0,
  lastRaiseWeek: 0,
  networkingScore: 0,
  promotionProgress: 0,
  lastPerformanceEventWeek: 0,
};

// ── Market Sentiment ──
export interface ActiveMarketSentiment {
  id: string;
  name: string;
  effects: Record<string, number>;
  volatilityMultiplier: number;
  weeksRemaining: number;
}

export interface ActiveMarketEvent {
  id: string;
  title: string;
  effects: Record<string, number>;
  assetTypes?: Array<'stock' | 'commodity' | 'etf' | 'crypto'>;
  weeksRemaining: number;
}

// ── Real Estate ──
export interface PropertyTypeData {
  id: string;
  name: string;
  type: string;
  purchasePrice: number;
  weeklyRentalIncome: number;
  weeklyMaintenance: number;
  appreciationRate: number;
  renovationCost: number;
  renovationValueBoost: number;
  description: string;
}

export interface OwnedProperty {
  id: string;
  typeId: string;
  name: string;
  purchasePrice: number;
  currentValue: number;
  isRentedOut: boolean;
  isRenovated: boolean;
  purchaseWeek: number;
  purchaseYear: number;
  weeklyIncome: number;
  weeklyMaintenance: number;
  acquisitionType?: 'listing' | 'auction';
  conditionScore?: number;
  hiddenIssue?: string | null;
  auctionCosts?: number;
  inspectionCostPaid?: number;
}

export type AuctionType = 'Foreclosure' | 'Estate Sale' | 'Bank Repossession' | 'Government Auction' | 'Luxury Auction' | 'Commercial Auction' | 'Development Land Auction';
export interface AuctionBidder {
  id: string;
  name: string;
  personality: 'Conservative' | 'Professional' | 'Aggressive' | 'Wealthy Collector';
  maxBid: number;
  active: boolean;
}
export interface RealEstateAuction {
  id: string;
  propertyName: string;
  propertyTypeId: string;
  location: string;
  auctionType: AuctionType;
  marketValue: number;
  estimatedValueMin: number;
  estimatedValueMax: number;
  startingBid: number;
  currentBid: number;
  minimumBidIncrease: number;
  expectedWeeklyRent: number;
  conditionScore: number;
  conditionKnown: boolean;
  estimatedRenovationCostMin: number;
  estimatedRenovationCostMax: number;
  actualRenovationCost: number;
  inspectionPurchased: boolean;
  inspectionCostPaid: number;
  tenantStatus: string;
  tenantStatusKnown: boolean;
  auctionEndWeek: number;
  aiBidders: AuctionBidder[];
  playerHighestBid: number;
  playerIsHighestBidder: boolean;
  hiddenIssue: string | null;
  hiddenIssueKnown?: boolean;
  rareOpportunity: boolean;
}

export interface AuctionResult {
  auctionId: string;
  propertyName: string;
  won: boolean;
  winningBid: number;
  playerBid: number;
  estimatedMarketValue: number;
  reason?: 'outbid' | 'insufficient_cash';
}

// ── Prestige ──
export interface PrestigeBonus {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost: number;
  gemCost?: number;
  tier?: number;
  requires?: string | string[];
  effect: { type: string; value: number; stacking?: 'additive' | 'highest' };
}

// ── Competitor AI ──
export interface BusinessCompetitor {
  id: string;
  /** Company name retained for backwards compatibility with existing saves. */
  name: string;
  strength: number; // 0-100
  enteredWeek: number;
  ceoName?: string;
  personality?: 'conservative' | 'innovator' | 'aggressive' | 'premium' | 'expansionist';
  strategy?: 'cost_leadership' | 'innovation' | 'price_war' | 'premium_brand' | 'expansion';
  cash?: number;
  reputation?: number;
  lastDecisionWeek?: number;
  lastDecision?: string;
  decisionHistory?: { week: number; action: string }[];
}

export interface CourseData {
  id: string;
  baseId: string;
  name: string;
  level: number;
  duration: number;
  cost: number;
  weeklyCost: number;
  prerequisite: string | null;
  category?: string;
  skillRewards?: Record<string, number>;
  knowledgeRewards?: Record<string, number>;
}

export interface JobData {
  id: string;
  baseId: string;
  title: string;
  level: number;
  weeklySalary: number;
  requiredCourse: string;
  requiresCar: boolean;
  requiredExperienceWeeks: number;
}

export type MarketCompanyStage = 'established' | 'emerging' | 'growth' | 'mature' | 'failed';
export type MarketCompanyStatus = 'listed' | 'delisted';

export interface MarketCompanyEvent {
  ticker: string;
  company: string;
  kind: 'ipo' | 'matured' | 'delisted';
  description: string;
  settlementCash?: number;
  realizedProfitLoss?: number;
}

export interface StockData {
  ticker: string;
  company: string;
  sector: string;
  startPrice: number;
  type: string;
  marketRole?: 'core' | 'emerging';
  ipoWeight?: number;
  emergingVolatility?: number;
  cryptoStyle?: 'reserve' | 'utility' | 'speculative';
  annualTrend?: number;
  baseVolatility?: number;
  momentumFactor?: number;
  inflationSensitivity?: number;
  techSensitivity?: number;
  stakingYield?: number;
  macroShockMultiplier?: number;
  maniaChance?: number;
  description?: string;
  mechanic?: string;
}

export interface HousingData {
  id: string;
  name: string;
  weeklyRent: number;
  happiness: number;
  description: string;
}

export interface CarData {
  id: string;
  name: string;
  purchaseCost: number;
  weeklyCost: number;
  happiness: number;
  description: string;
}

export interface FoodData {
  id: string;
  name: string;
  weeklyCost: number;
  happiness: number;
  description: string;
}

export interface HouseUpgradeData {
  id: string;
  name: string;
  cost: number;
  happiness: number;
  description: string;
}

export interface LoanTemplate {
  id: string;
  name: string;
  amount: number;
  interestRate: number;
  durationWeeks: number;
}

export interface AchievementData {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  gemReward?: number;
  icon: string;
}

export interface NewsEvent {
  headline: string;
  effects: Record<string, number>;
}

export interface StockHolding {
  ticker: string;
  shares: number;
  avgBuyPrice: number;
}

export interface StockState {
  ticker: string;
  currentPrice: number;
  priceHistory: number[];
  marketStatus?: MarketCompanyStatus;
  listedWeek?: number;
  delistedWeek?: number;
  companyStage?: MarketCompanyStage;
  companyQuality?: number;
}

export interface CareerHistoryEntry {
  jobId: string;
  title: string;
  startWeek: number;
  endWeek: number | null;
}

export interface CompletedCourse {
  courseId: string;
  name: string;
  completedWeek: number;
}

export interface ActiveLoan {
  loanId: string;
  name: string;
  originalAmount: number;
  remainingAmount: number;
  weeklyPayment: number;
  weeksRemaining: number;
}

export interface BankDeposit {
  id: string;
  amount: number;
  durationWeeks: 20 | 40 | 60;
  weeksRemaining: number;
  interestRate: number;
}

export interface LifetimeStatistics {
  weeksPlayed: number;
  totalSalaryEarned: number;
  totalTaxesPaid: number;
  totalLivingCosts: number;
  highestCash: number;
  highestNetWorth: number;
  largestStockGain: number;
  largestStockLoss: number;
  stocksPurchased: number;
  coursesCompleted: number;
  jobsWorked: number;
  weeksEmployed: number;
  weeksUnemployed: number;
  loansTaken: number;
  loansRepaid: number;
  totalRealizedProfitLoss: number;
  totalDividendsReceived: number;
  highestSoldStockProfitPercent: number;
  highestStockPortfolioValue: number;
}

export const INITIAL_STATISTICS: LifetimeStatistics = {
  weeksPlayed: 0,
  totalSalaryEarned: 0,
  totalTaxesPaid: 0,
  totalLivingCosts: 0,
  highestCash: 10000,
  highestNetWorth: 10000,
  largestStockGain: 0,
  largestStockLoss: 0,
  stocksPurchased: 0,
  coursesCompleted: 0,
  jobsWorked: 0,
  weeksEmployed: 0,
  weeksUnemployed: 0,
  loansTaken: 0,
  loansRepaid: 0,
  totalRealizedProfitLoss: 0,
  totalDividendsReceived: 0,
  highestSoldStockProfitPercent: 0,
  highestStockPortfolioValue: 0,
};

export interface EducationCareerReminder {
  courseLevel?: number;
  courseName: string;
  jobTitle: string;
  missingRequirements: string[];
}

export interface WeekSummary {
  salaryEarned: number;
  rentPaid: number;
  utilityCost: number;
  foodCost: number;
  carCost: number;
  courseCost: number;
  loanPayments: number;
  stockChanges: { ticker: string; change: number }[];
  courseProgress: string | null;
  headline: string;
  newWeek: number;
  happiness: number;
  newAchievements: string[];
  isTaxWeek: boolean;
  taxAmount: number;
  earningsForTaxPeriod: number;
  inflationEvent: boolean;
  inflationRate: number;
  inflationMultiplier: number;
  salaryReduced: boolean;
  lifeEvent: TriggeredEvent | null;
  investmentResult: { name: string; invested: number; returned: number; success: boolean } | null;
  // Business summary
  businessTotalProfit: number;
  businessEvents: { businessName: string; eventTitle: string; icon: string }[];
  // Property summary
  propertyIncome: number;
  auctionResults: AuctionResult[];
  // Career summary
  careerRaise: boolean;
  careerPromotion: string | null;
  promotionBlockedReason: string | null;
  skillGains: Record<string, number>;
  // Market events
  marketSentimentName: string | null;
  marketEventTitle: string | null;
  marketCompanyEvents: MarketCompanyEvent[];
  // D20 performance event
  performanceEventResult: { roll: number; needed: number; success: boolean } | null;
  // Realized P/L this week
  realizedProfitLoss: number;
  // Dividends
  dividendIncome: number;
  // Part-time income
  partTimeIncome: number;
  educationCareerReminder: EducationCareerReminder | null;
  // Personal life
  partnerContribution: number;
  relationshipChange: number;
  relationshipHeadline: string | null;
  relationshipHouseholdCost: number;
  familyCost: number;
  relationshipObligationCost: number;
  relationshipEventTitle: string | null;
  childBornName: string | null;
  relationshipGoalCompleted: string | null;
  partnerCareerEvent: string | null;
  partnerDiedName: string | null;
  partnerInheritance: number;
  familyMilestones: string[];
  // Macro correction
  crashEvent: { title: string; inflationReduction: number; stockShock: number; isAftershock?: boolean; weeksRemaining?: number; totalWeeks?: number } | null;
  // Lifecycle
  diedThisWeek: boolean;
}

/** Yearly summary (every 20 weeks) - combines period report + tax */
export interface PeriodReport {
  fromWeek: number;
  toWeek: number;
  totalIncome: number;
  totalExpenses: number;
  totalTax: number;
  weeksEmployed: number;
  weeksUnemployed: number;
  jobChanges: number;
  coursesCompleted: number;
  stocksPurchased: number;
  loansTaken: number;
  loansRepaid: number;
  currentCash: number;
  currentNetWorth: number;
  currentHappiness: number;
  achievementsUnlocked: number;
  totalRealizedProfitLoss: number;
  totalUnrealizedProfitLoss: number;
  totalDividends: number;
}

/** Temporary happiness modifier (from events) */
export interface TempHappinessEffect {
  amount: number;
  weeksRemaining: number;
  source: string;
}

/** Pending opportunity investment */
export interface PendingInvestment {
  id: string;
  eventId: string;
  investmentId: string;
  amount: number;
  successChance: number;
  returnMultiplier: number;
  failReturnMultiplier: number;
  weeksRemaining: number;
}

/** Rarity tier for employees & candidates */
export type EmployeeTier = 'common' | 'rare' | 'epic' | 'legendary';

/** A small stat buff attached to an employee */
export interface EmployeeBuff {
  type: 'revenue' | 'expense' | 'morale' | 'productivity' | 'reputation';
  value: number; // magnitude — interpreted per type
  label: string; // display label
}

/** Business employee */
export interface BusinessEmployee {
  id: string;
  roleId: string;
  name: string;
  skill: number; // 1-100
  morale: number; // 1-100
  experience: number; // weeks in role/industry
  potential: number; // 1-100 - growth ceiling
  age: number;
  weeksEmployed: number;
  weeklySalary: number;
  inTrainingId?: string | null;
  trainingWeeksRemaining?: number;
  // D&D-style tier + buffs
  tier?: EmployeeTier;
  buffs?: EmployeeBuff[];
}

/** Candidate for hire (not yet employed) */
export interface EmployeeCandidate {
  id: string;
  roleId: string;
  name: string;
  skill: number;
  potential: number;
  experience: number;
  age: number;
  weeklySalary: number;
  archetype: 'young' | 'balanced' | 'veteran';
  tier?: EmployeeTier;
  buffs?: EmployeeBuff[];
}

/** Business timeline event */
export interface BusinessTimelineEntry {
  week: number;
  year: number;
  title: string;
  icon?: string;
  kind?: 'founded' | 'level' | 'project' | 'event' | 'hire' | 'season' | 'upgrade' | 'expansion' | 'corporate_capex';
}

/** Active business project (marketing campaign, R&D, etc.) */
export interface ActiveBusinessProject {
  id: string;
  projectType: string; // 'marketing_campaign' | 'efficiency' | 'product_improvement' | etc.
  requiredRoleId: string;
  cost: number;
  weeksRemaining: number;
  totalWeeks: number;
  revenueMultiplier: number;
  expenseMultiplier: number;
  reputationBonus: number;
  succeeded: boolean;
  resolved: boolean;
  neededRoll?: number;
  actualRoll?: number;
  projectName?: string;
  /** True only for a project started using a one-use rewarded-ad second slot. */
  usesTemporarySlot?: boolean;
}

export type CorporateScaleTier = 'local' | 'corporate' | 'major' | 'global';

export interface ActiveCorporateCapex {
  projectId: string;
  projectName: string;
  costPaid: number;
  startedGlobalWeek: number;
  weeksRemaining: number;
  totalWeeks: number;
}

export interface CompletedCorporateCapex {
  projectId: string;
  projectName: string;
  costPaid: number;
  completedGlobalWeek: number;
}

/** Detailed weekly expense breakdown */
export interface BusinessExpenseBreakdown {
  rent: number;
  salaries: number;
  cogs: number;
  utilities: number;
  marketing: number;
  insurance: number;
  maintenance: number;
  taxes: number;
  loanInterest: number;
  boardFees?: number;
  workforceTraining?: number;
  workforceTransition?: number;
  misc: number;
}

export type CorporateCreditRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B';
export type CorporateFinancingType = 'revolver' | 'project_finance' | 'bond';

export type BusinessReinvestmentArea = 'technology' | 'premises' | 'equipment';

export type BusinessInsuranceArea = 'property' | 'equipment' | 'cyber' | 'liability';
export type BusinessInsuranceTier = 'none' | 'basic' | 'standard' | 'comprehensive';

export type BusinessBudgetProfile =
  | 'standard'
  | 'balanced'
  | 'growth'
  | 'deleveraging'
  | 'resilient'
  | 'shareholder_returns';

export interface BusinessBudgetPlan {
  profile: BusinessBudgetProfile;
  targetReserveWeeks: number;
  dividendPct: number;
  debtPaydownPct: number;
  reinvestmentPct: number;
  growthPct: number;
  reviewYear: number;
}

export type BusinessManagementTargetProfile =
  | 'balanced'
  | 'growth'
  | 'margin'
  | 'deleveraging'
  | 'resilient';

export interface BusinessManagementTargetPlan {
  profile: BusinessManagementTargetProfile;
  year: number;
  quarter: number;
  periodStartGlobalWeek: number;
  createdGlobalWeek: number;
  baselineWeeklyRevenue: number;
  baselineProfitMargin: number;
  baselinePayrollToRevenueRatio: number;
  baselineDebt: number;
  targetWeeklyRevenue: number;
  targetProfitMargin: number;
  maxPayrollToRevenueRatio: number;
  targetDebtBalance: number;
  minMaintenanceCondition: number;
}

export type BusinessManagementTargetReviewStatus = 'met' | 'near' | 'missed' | 'neutral';

export interface BusinessManagementQuarterTargetReview {
  id: 'revenue' | 'margin' | 'payroll' | 'debt' | 'maintenance';
  label: string;
  actual: number;
  target: number;
  status: BusinessManagementTargetReviewStatus;
}

export interface BusinessManagementQuarterReview {
  year: number;
  quarter: number;
  periodStartGlobalWeek: number;
  periodEndGlobalWeek: number;
  closedGlobalWeek: number;
  profile: BusinessManagementTargetProfile;
  weeksTracked: number;
  averageWeeklyRevenue: number;
  profitMargin: number;
  payrollToRevenueRatio: number;
  endingDebtBalance: number;
  averageMaintenanceCondition: number;
  targetMetCount: number;
  targetNearCount: number;
  targetMissedCount: number;
  targetTotalCount: number;
  targetResults: BusinessManagementQuarterTargetReview[];
  partial: boolean;
}

export interface BusinessBudgetReserves {
  reinvestment: number;
  growth: number;
}

export interface BusinessBudgetAllocationSnapshot {
  year: number;
  week: number;
  profitBasis: number;
  operatingReserveTarget: number;
  reinvestmentReserveTarget: number;
  growthReserveTarget: number;
  reinvestmentAllocated: number;
  growthAllocated: number;
  extraDebtPaid: number;
  dividendPaid: number;
  closingReinvestmentReserve: number;
  closingGrowthReserve: number;
}

export interface BusinessInsuranceClaim {
  id: string;
  area: BusinessInsuranceArea;
  policyTier: BusinessInsuranceTier;
  incidentTitle: string;
  globalWeek: number;
  grossLoss: number;
  deductible: number;
  payout: number;
  netLoss: number;
}

export interface BusinessReinvestmentTrack {
  condition: number;
  lastRenewedGlobalWeek: number;
}

export interface BusinessReinvestmentState {
  technology: BusinessReinvestmentTrack;
  premises: BusinessReinvestmentTrack;
  equipment: BusinessReinvestmentTrack;
}

export interface ActiveBusinessReinvestment {
  area: BusinessReinvestmentArea;
  projectName: string;
  costPaid: number;
  startedGlobalWeek: number;
  weeksRemaining: number;
  totalWeeks: number;
}

/** Business loan (separate from personal loans) */
export interface BusinessLoan {
  id: string;
  amount: number;
  remainingAmount: number;
  weeklyPayment: number;
  weeksRemaining: number;
  interestRate: number;
  purpose?: 'operating' | 'acquisition' | 'corporate_revolver' | 'project_finance' | 'corporate_bond';
  financingType?: CorporateFinancingType;
  projectId?: string | null;
  issuedGlobalWeek?: number;
}

/** Active business event effect */
export interface ActiveBusinessEvent {
  eventId: string;
  revenueMultiplier: number;
  expenseMultiplier: number;
  weeksRemaining: number;
}

/** Owned business instance */
export interface FamilyBusinessState {
  isFamilyBusiness: boolean;
  familyName: string;
  founderGeneration: number;
  generationsOwned: number;
  controllerName: string;
  controllerPersonId: string | null;
  familyOwnershipPct: number;
  designatedYear: number;
}

export type BusinessStrategicFocus = 'balanced' | 'growth' | 'margin' | 'premium' | 'automation' | 'rd';
export type BusinessDecisionKind = 'strategy' | 'crisis';
export type BusinessGovernanceRole = 'manager' | 'executive' | 'board' | 'successor';
export type BusinessOwnerType = 'player' | 'child' | 'family_trust' | 'investor';

export type BusinessExecutiveRole = 'cfo' | 'coo' | 'cto' | 'cmo' | 'general_counsel';
export type BusinessExecutiveTrait =
  | 'capital_allocator'
  | 'conservative_financier'
  | 'scale_operator'
  | 'efficiency_expert'
  | 'technologist'
  | 'cyber_specialist'
  | 'brand_builder'
  | 'growth_marketer'
  | 'regulatory_specialist'
  | 'negotiator';

export interface BusinessExecutiveCandidate {
  id: string;
  role: BusinessExecutiveRole;
  name: string;
  performance: number;
  weeklySalary: number;
  signingFee: number;
  trait: BusinessExecutiveTrait;
}

export interface BusinessExecutive extends BusinessExecutiveCandidate {
  appointedGlobalWeek: number;
  tenureWeeks: number;
  nextReviewGlobalWeek: number;
}

export interface BusinessExecutiveSearch {
  role: BusinessExecutiveRole;
  candidates: BusinessExecutiveCandidate[];
  generatedGlobalWeek: number;
}

export type CorporateDepartmentId = 'operations' | 'sales' | 'finance' | 'technology' | 'support';
export type CorporateCompensationPolicy = 'lean' | 'market' | 'competitive' | 'premium';
export type CorporateTrainingPolicy = 'minimal' | 'standard' | 'development' | 'academy';

export interface CorporateDepartmentState {
  id: CorporateDepartmentId;
  headcount: number;
  targetHeadcount: number;
  averageSkill: number;
  morale: number;
  weeklyWage: number;
  lastHeadcountChangeWeek: number;
  turnoverAccumulator?: number;
}

export interface CorporateWorkforceState {
  initializedGlobalWeek: number;
  departments: Record<CorporateDepartmentId, CorporateDepartmentState>;
  lastPlanWeek: number;
  lastChangeSummary: string | null;
  compensationPolicy?: CorporateCompensationPolicy;
  trainingPolicy?: CorporateTrainingPolicy;
  employeeRelations?: number;
  laborMarketPressure?: number;
  nextHrEventWeek?: number;
  lastHrEventWeek?: number;
  recentTurnover?: number;
  lastPolicyChangeWeek?: number;
}

/** Lightweight weekly snapshot used by quarterly / annual management reporting. */
export interface CorporateKpiHistoryPoint {
  globalWeek: number;
  revenue: number;
  expenses: number;
  profit: number;
  headcount: number;
  payroll: number;
  turnover: number;
  productivityIndex: number;
  departmentProductivity: Record<CorporateDepartmentId, number>;
  debtService: number;
  /** Outstanding business debt at the end of this reporting week. */
  debtBalance?: number;
  averageMaintenanceCondition: number;
  /** Optional richer driver history. Older saves can omit these fields safely. */
  averageDepartmentSkill?: number;
  averageDepartmentMorale?: number;
  employeeRelations?: number;
  maintenanceRevenuePenalty?: number;
  maintenanceExpenseIncrease?: number;
  acquisitionRevenueModifier?: number;
  acquisitionExpenseModifier?: number;
  integrationWeeksRemaining?: number;
  reputation?: number;
  marketShareModifier?: number;
}

export type BusinessBoardMandate = 'founder_led' | 'balanced_oversight' | 'growth_mandate' | 'risk_committee';

export interface BusinessBoardGovernance {
  mandate: BusinessBoardMandate;
  confidence: number;
  establishedYear: number;
  lastReviewYear: number;
  lastMandateChangeGlobalWeek: number;
  lastReviewSummary: string;
}

export type AcquisitionRisk = 'low' | 'medium' | 'high';
export type AcquisitionTier = 'regional' | 'national' | 'enterprise';
export type AcquisitionFundingMode = 'cash' | 'balanced' | 'leveraged';
export type AcquisitionIntegrationStrategy = 'pending' | 'independent' | 'integrate' | 'turnaround';
export type AcquisitionIntegrationOutcome = 'pending' | 'success' | 'mixed' | 'failed';
export type AcquisitionTraitKind = 'strength' | 'risk';
export type AcquisitionDiligenceFindingKind = 'strength' | 'risk' | 'neutral';

export interface AcquisitionCompanyTrait {
  id: string;
  name: string;
  kind: AcquisitionTraitKind;
  description: string;
  revenueModifier: number;
  expenseModifier: number;
}

export interface AcquisitionDiligenceFinding {
  id: string;
  title: string;
  kind: AcquisitionDiligenceFindingKind;
  description: string;
}

export type HoldingCapitalPurpose = 'capital' | 'debt';
export type HoldingSharedServiceId = 'finance' | 'hr' | 'procurement' | 'marketing' | 'it';
export type BusinessDelegationPolicy = 'manual' | 'balanced' | 'growth' | 'profit' | 'conservative';

export interface HoldingSharedServices {
  finance: number;
  hr: number;
  procurement: number;
  marketing: number;
  it: number;
}

export type BusinessPortfolioIntent = 'active' | 'long_term_family';

export interface SoldBusinessRecord {
  id: string;
  businessId: string;
  name: string;
  typeId: string;
  soldWeek: number;
  soldYear: number;
  soldGlobalWeek: number;
  foundedWeek: number;
  foundedYear: number;
  heldWeeks: number;
  grossSalePrice: number;
  debtSettlement: number;
  /** Advisory/legal costs paid when the business is sold. */
  saleTransactionCost?: number;
  saleTransactionCostRate?: number;
  netSaleProceeds: number;
  investmentBasis: number | null;
  totalPlayerDistributions: number;
  lifetimeCashResult: number | null;
  lifetimeReturnPct: number | null;
  wasAcquisition: boolean;
  acquisitionPurchasePrice?: number | null;
  acquisitionTransactionCost?: number | null;
  holdingCompanyName?: string | null;
}

export interface BusinessAcquisitionTarget {
  id: string;
  name: string;
  typeId: string;
  industry: string;
  tier: AcquisitionTier;
  askingPrice: number;
  estimatedValue: number;
  weeklyRevenue: number;
  weeklyProfit: number;
  reputation: number;
  diligenceScore: number;
  risk: AcquisitionRisk;
  diligenceNotes: string[];
  /** Generated operating history/personality for established acquisition targets. */
  companyAgeYears?: number;
  sellerReason?: string;
  traits?: AcquisitionCompanyTrait[];
  diligenceFindings?: AcquisitionDiligenceFinding[];
  persistentRevenueModifier?: number;
  persistentExpenseModifier?: number;
  acquisitionTransactionCostRate?: number;
  integrationWeeks: number;
  integrationPenalty: number;
  sellerName: string;
  generatedGlobalWeek: number;
}

export interface BusinessAcquisitionState {
  /** One-time save migration version for mature acquisition assets/baseline. */
  assetBaselineVersion?: number;
  /** One-time migration version for the visible corporate-workforce staffing baseline. */
  workforceBaselineVersion?: number;
  purchasePrice: number;
  cashContribution: number;
  debtFinanced: number;
  fundingMode: AcquisitionFundingMode;
  sellerName: string;
  acquiredGlobalWeek: number;
  estimatedValueAtPurchase: number;
  baseIntegrationWeeks: number;
  baseIntegrationPenalty: number;
  integrationStrategy: AcquisitionIntegrationStrategy;
  integrationOutcome: AcquisitionIntegrationOutcome;
  integrationWeeksRemaining: number;
  integrationPenalty: number;
  integrationSuccessChance: number;
  postIntegrationRevenueBonus: number;
  postIntegrationExpenseReduction: number;
  initialRisk: AcquisitionRisk;
  diligenceScore: number;
  companyAgeYears?: number;
  sellerReason?: string;
  traits?: AcquisitionCompanyTrait[];
  diligenceFindings?: AcquisitionDiligenceFinding[];
  persistentRevenueModifier?: number;
  persistentExpenseModifier?: number;
  acquisitionTransactionCost?: number;
  acquisitionTransactionCostRate?: number;
  additionalCapitalInvested: number;
  quotedWeeklyRevenue?: number;
  quotedWeeklyProfit?: number;
  quoteInflation?: number;
  referenceRevenueCapacity?: number;
  referenceStaffCost?: number;
  referenceExpenseMultiplier?: number;
}

export interface HoldingCompany {
  id: string;
  name: string;
  createdGlobalWeek: number;
  founderGeneration: number;
  generationsOwned: number;
  controllerName: string;
  controllerPersonId: string | null;
  cashReserve: number;
  totalCapitalDeployed: number;
  executiveChildId: string | null;
  executiveChildName: string | null;
  executivePerformance: number;
  designatedSuccessorChildId: string | null;
  designatedSuccessorChildName: string | null;
  sharedServices?: HoldingSharedServices;
}

export interface BusinessOwnershipStake {
  ownerType: BusinessOwnerType;
  ownerId: string;
  ownerName: string;
  percent: number;
  votingPercent: number;
}

export interface BusinessFamilyRole {
  childId: string;
  childName: string;
  role: BusinessGovernanceRole;
  appointedYear: number;
  experienceWeeks: number;
  performance: number;
  weeklySalary: number;
}

export interface BusinessStrategyModifier {
  id: string;
  title: string;
  revenueMultiplier: number;
  expenseMultiplier: number;
  reputationPerWeek: number;
  moralePerWeek: number;
  weeksRemaining: number;
}

export interface BusinessPendingDecisionChoice {
  id: string;
  text: string;
  description: string;
  businessCashCost?: number;
  /** Corporate-scale choices can already be denominated in current euros. */
  cashCostScale?: 'inflation' | 'absolute';
  revenueMultiplier?: number;
  expenseMultiplier?: number;
  reputationDelta?: number;
  moraleDelta?: number;
  marketShareDelta?: number;
  durationWeeks?: number;
  workforceCompensationPolicy?: CorporateCompensationPolicy;
  workforceTrainingPolicy?: CorporateTrainingPolicy;
  workforceRelationsDelta?: number;
  workforceTargetMultiplier?: number;
}

export interface BusinessPendingDecision {
  id: string;
  kind: BusinessDecisionKind;
  title: string;
  description: string;
  icon: string;
  /** Optional insurable operational-loss category, snapshotted when the incident appears. */
  insuranceArea?: BusinessInsuranceArea;
  insuranceTierAtCreation?: BusinessInsuranceTier;
  createdGlobalWeek: number;
  deadlineGlobalWeek: number;
  defaultChoiceId: string;
  choices: BusinessPendingDecisionChoice[];
}

export interface OwnedBusiness {
  id: string; // unique instance id
  typeId: string; // references business_types.json
  name: string;
  foundedWeek: number;
  foundedYear: number;
  // Financials
  balance: number; // business bank account
  totalRevenue: number;
  totalExpenses: number;
  lastWeekRevenue: number;
  lastWeekExpenses: number;
  lastWeekProfit: number;
  // Status
  reputation: number; // 0-100
  level: number; // 0-7 index into levelThresholds
  valuation: number;
  /** Persistent percentage-point adjustment earned or lost through decisions. */
  marketShareModifier?: number;
  // Settings
  pricingStrategy: 'budget' | 'standard' | 'premium' | 'luxury';
  advertisingLevel: 'none' | 'basic' | 'moderate' | 'aggressive';
  // People
  employees: BusinessEmployee[];
  // Upgrades
  purchasedUpgrades: string[];
  activeUpgrade?: { upgradeId: string; weeksRemaining: number } | null;
  /** Optional second concurrent upgrade. Existing saves default to one slot. */
  secondaryActiveUpgrade?: { upgradeId: string; weeksRemaining: number } | null;
  /** Permanent second slots are purchased per business and capped at two total. */
  upgradeSlot2Unlocked?: boolean;
  projectSlot2Unlocked?: boolean;
  /** Rewarded ads grant one temporary second-slot task, consumed on completion. */
  temporaryUpgradeSlot2?: boolean;
  temporaryProjectSlot2?: boolean;
  locations?: BusinessLocation[];
  activeExpansion?: { templateId: string; weeksRemaining: number } | null;
  // Long-horizon corporate capital expenditure
  activeCorporateCapex?: ActiveCorporateCapex | null;
  completedCorporateCapex?: CompletedCorporateCapex[];
  // Recurring upkeep / modernization required to keep operations competitive
  reinvestment?: BusinessReinvestmentState;
  activeReinvestment?: ActiveBusinessReinvestment | null;
  insurancePolicies?: Record<BusinessInsuranceArea, BusinessInsuranceTier>;
  insuranceClaims?: BusinessInsuranceClaim[];
  // Annual cash-flow policy and internally earmarked cash reserves
  budgetPlan?: BusinessBudgetPlan;
  budgetReserves?: BusinessBudgetReserves;
  lastBudgetAllocation?: BusinessBudgetAllocationSnapshot | null;
  /** Quarterly outcome targets used by corporate management reporting. */
  managementTargets?: BusinessManagementTargetPlan;
  /** Frozen quarter-close reviews, capped to the latest five game years. */
  managementReviewHistory?: BusinessManagementQuarterReview[];
  // Loans
  businessLoans: BusinessLoan[];
  // Active events
  activeEvents: ActiveBusinessEvent[];
  // History
  weeklyProfitHistory: number[];
  corporateKpiHistory?: CorporateKpiHistoryPoint[];
  // NEW: candidate pool for pending hire
  pendingCandidates?: EmployeeCandidate[] | null;
  pendingCandidateRoleId?: string | null;
  // NEW: active business projects (marketing, efficiency, etc.)
  activeProjects?: ActiveBusinessProject[];
  // NEW: detailed expense breakdown for last week
  lastExpenseBreakdown?: BusinessExpenseBreakdown | null;
  // NEW: revenue history for market share chart
  weeklyRevenueHistory?: number[];
  // NEW: annual profit tracking for tax refund
  annualProfit?: number;
  annualProfitYear?: number;
  // NEW: pending retention events for player choice
  pendingRetention?: { employeeId: string; type: 'poach' | 'raise' | 'promotion' | 'training' } | null;
  // Recruit system (D&D style charges)
  freeRecruits?: number;        // remaining free recruit attempts (start=3)
  recruitCharges?: number;      // stored paid charges (max 5)
  recruitProgress?: number;     // weeks accrued toward next paid charge (0-5)
  // Business timeline
  timeline?: BusinessTimelineEntry[];
  lastBusinessEventWeek?: number;
  businessEventCooldowns?: Record<string, number>;
  familyBusiness?: FamilyBusinessState | null;
  strategicFocus?: BusinessStrategicFocus;
  strategyModifiers?: BusinessStrategyModifier[];
  pendingDecision?: BusinessPendingDecision | null;
  nextStrategicDecisionWeek?: number;
  nextCrisisCheckWeek?: number;
  ownership?: BusinessOwnershipStake[];
  familyRoles?: BusinessFamilyRole[];
  executives?: BusinessExecutive[];
  pendingExecutiveSearch?: BusinessExecutiveSearch | null;
  executiveSearchCooldowns?: Partial<Record<BusinessExecutiveRole, number>>;
  boardGovernance?: BusinessBoardGovernance | null;
  corporateWorkforce?: CorporateWorkforceState | null;
  /** Optional organizational parent for portfolio-level capital allocation. */
  holdingCompanyId?: string | null;
  /** Scales mature acquired companies beyond startup-size base economics. */
  operatingScaleMultiplier?: number;
  acquisition?: BusinessAcquisitionState | null;
  portfolioIntent?: BusinessPortfolioIntent;
  /** Equity/founding cash committed by the player or holding company. */
  capitalInvested?: number | null;
  /** Lifetime distributions paid specifically to the player from this business. */
  totalPlayerDistributions?: number;
  /** Routine management automation. Strategic decisions/crises always remain manual. */
  delegationPolicy?: BusinessDelegationPolicy;
  delegatedManagerEmployeeId?: string | null;
  delegatedManagerName?: string | null;
  lastDelegationReviewWeek?: number;
  lastDelegationSummary?: string | null;
}

export interface BusinessLocation {
  id: string;
  templateId: string;
  name: string;
  region: string;
  revenueBoost: number;
  weeklyOperatingCost: number;
  openedWeek: number;
}

/** Triggered life event for display */
export interface TriggeredEvent {
  id: string;
  type: 'automatic' | 'choice' | 'opportunity';
  title: string;
  description: string;
  icon: string;
  category: string;
  businessId?: string;
  effects?: { cash?: number; happiness?: number };
  choices?: {
    text: string;
    cost?: number;
    cash?: number;
    happiness?: number;
    happinessDuration?: number;
    investmentId?: string;
    businessCash?: number;
    reputation?: number;
    marketShare?: number;
  }[];
  investmentOutcomes?: Record<string, {
    successChance: number;
    returnMultiplier: number;
    failReturnMultiplier: number;
    weeksToResolve: number;
  }>;
}

export type StudentWorkTier = 'flexible' | 'high_hours';

export interface GameState {
  playerName: string;
  week: number;
  year: number;
  age: number;
  cash: number;
  inflationMultiplier: number;
  currentHousingId: string;
  houseUpgrades: string[];
  housingHistory: string[];
  currentCarId: string;
  pendingCarDelivery: { carId: string; weeksRemaining: number } | null;
  foodLevel: string;
  currentCourseId: string | null;
  courseWeeksCompleted: number;
  completedCourses: CompletedCourse[];
  currentJobId: string | null;
  careerHistory: CareerHistoryEntry[];
  totalWeeksWorked: number;
  stocks: StockState[];
  /** Save-specific emerging companies that are allowed to list during this world. */
  marketCompanyPool: string[];
  holdings: StockHolding[];
  loans: ActiveLoan[];
  bankDeposits: BankDeposit[];
  happiness: number;
  netWorthHistory: number[];
  earningsSinceLastTax: number;
  lastTaxWeek: number;
  totalTaxPaid: number;
  unlockedAchievements: string[];
  statistics: LifetimeStatistics;
  currentHeadline: string;
  initialized: boolean;
  // Life events
  tempHappinessEffects: TempHappinessEffect[];
  pendingInvestments: PendingInvestment[];
  recentEventIds: string[]; // last 10 event IDs to avoid repeats
  // Business
  businesses: OwnedBusiness[];
  soldBusinesses?: SoldBusinessRecord[];
  holdingCompanies: HoldingCompany[];
  acquisitionTargets: BusinessAcquisitionTarget[];
  lastAcquisitionRefreshWeek: number;
  // Skills & Knowledge
  skills: Record<string, number>;
  knowledge: Record<string, number>;
  // Career v2
  career: CareerState;
  // Real Estate
  properties: OwnedProperty[];
  activeAuctions: RealEstateAuction[];
  // Competitor AI
  competitors: Record<string, BusinessCompetitor[]>; // businessId → competitors
  // Market Sentiment & Events
  activeMarketSentiment: ActiveMarketSentiment | null;
  activeMarketEvents: ActiveMarketEvent[];
  // Realized P/L tracking
  totalRealizedProfitLoss: number;
  // News history (last ~40 headlines)
  newsHistory?: string[];
  // Student work remains mutually exclusive with a full-time career.
  // partTimeJob is retained as a backwards-compatible active flag for older saves.
  partTimeJob?: boolean;
  studentWorkTier?: StudentWorkTier | null;
  adWatchedToday: number;
  adLastWatchDate: string; // YYYY-MM-DD
  relationshipModeEnabled: boolean;
  relationshipState: RelationshipState;
  lifecycle: LifecycleState;
  lastMacroCrashWeek: number;
  activeMacroCrash: ActiveMacroCrash | null;
  generation: number;
  familyLegacy: FamilyLegacyEntry[];
  familyTree: FamilyTreeState;
  contentUpdateSeenId: string;
  reviewPromptedWeeks: number[];
}

export const INITIAL_GAME_STATE: GameState = {
  playerName: 'Player',
  week: 1,
  year: 1,
  age: 20,
  cash: 10000,
  inflationMultiplier: 1.0,
  currentHousingId: 'cheap_apartment',
  houseUpgrades: [],
  housingHistory: ['cheap_apartment'],
  currentCarId: 'none',
  pendingCarDelivery: null,
  foodLevel: 'basic',
  currentCourseId: null,
  courseWeeksCompleted: 0,
  completedCourses: [],
  currentJobId: null,
  careerHistory: [],
  totalWeeksWorked: 0,
  stocks: [],
  marketCompanyPool: [],
  holdings: [],
  loans: [],
  bankDeposits: [],
  happiness: 30,
  netWorthHistory: [10000],
  earningsSinceLastTax: 0,
  lastTaxWeek: 0,
  totalTaxPaid: 0,
  unlockedAchievements: [],
  statistics: { ...INITIAL_STATISTICS },
  currentHeadline: 'Welcome to Life & Business Simulator!',
  initialized: true,
  tempHappinessEffects: [],
  pendingInvestments: [],
  recentEventIds: [],
  businesses: [],
  soldBusinesses: [],
  holdingCompanies: [],
  acquisitionTargets: [],
  lastAcquisitionRefreshWeek: 0,
  skills: {},
  knowledge: {},
  career: { ...INITIAL_CAREER_STATE },
  properties: [],
  activeAuctions: [],
  competitors: {},
  activeMarketSentiment: null,
  activeMarketEvents: [],
  totalRealizedProfitLoss: 0,
  newsHistory: [],
  partTimeJob: false,
  studentWorkTier: null,
  adWatchedToday: 0,
  adLastWatchDate: '',
  relationshipModeEnabled: false,
  relationshipState: { ...INITIAL_RELATIONSHIP_STATE },
  lifecycle: { ...INITIAL_LIFECYCLE_STATE },
  lastMacroCrashWeek: 0,
  activeMacroCrash: null,
  generation: 1,
  familyLegacy: [],
  familyTree: { ...INITIAL_FAMILY_TREE_STATE },
  contentUpdateSeenId: '',
  reviewPromptedWeeks: [],
};

/** Player profile — persists prestige points and gems across all games/save slots */
export interface PlayerProfile {
  totalXp: number;
  gems: number;
  adsRemoved: boolean;
  processedPurchaseIds: string[];
  prestigePoints: number;
  unlockedPrestige: string[];
  lastLoginClaimDate: string;
  loginStreak: number;
  /** Account-wide rewarded-gem usage shared by all save slots. */
  rewardedGemClaimDate?: string;
  rewardedGemClaimsToday?: number;
  /** Remove Ads owners receive one ad-free temporary business Slot 2 claim per day. */
  adFreeSlotRewardClaimDate?: string;
  /** Remove Ads owners receive one ad-free instant education completion per day. */
  adFreeEducationRewardClaimDate?: string;
}

export const INITIAL_PROFILE: PlayerProfile = {
  totalXp: 0,
  gems: 0,
  adsRemoved: false,
  processedPurchaseIds: [],
  prestigePoints: 0,
  unlockedPrestige: [],
  lastLoginClaimDate: '',
  loginStreak: 0,
  rewardedGemClaimDate: '',
  rewardedGemClaimsToday: 0,
  adFreeSlotRewardClaimDate: '',
  adFreeEducationRewardClaimDate: '',
};

/** Save slot metadata */
export interface SaveSlotMeta {
  playerName: string;
  week: number;
  year: number;
  age: number;
  cash: number;
  netWorth: number;
  lastSaved: number; // timestamp
}
