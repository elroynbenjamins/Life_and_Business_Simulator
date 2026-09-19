import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import useGameStore from '../../src/store/gameStore';
import { DatingPreference, EstatePlanType, EstateStructureType, MarriageAgreement, RelationshipConnection } from '../../src/types/game';
import { formatCurrency } from '../../src/utils/format';
import {
  getChildAge,
  getChildWeeklyCost,
  getChildFuturePotential,
  getDateCost,
  getFamilyFormationProfile,
  getNormalizedDatingAgeBounds,
  getProposalCost,
  getWeddingCost,
} from '../../src/engine/relationshipEngine';

const TRAIT_LABELS: Record<string, Record<string, string>> = {
  financialStyle: { frugal: 'Frugal', balanced: 'Balanced spender', luxury: 'Luxury-minded' },
  riskTolerance: { cautious: 'Cautious investor', balanced: 'Balanced risk', risk_taking: 'Risk-taking' },
  ambition: { relaxed: 'Relaxed', career_minded: 'Career-minded', driven: 'Highly ambitious' },
  familyGoal: { no_children: 'Does not want children', unsure: 'Unsure about children', wants_children: 'Wants children' },
};

export default function RelationshipsScreen() {
  const router = useRouter();
  const state = useGameStore();
  const relationship = state.relationshipState;
  const enabled = state.relationshipModeEnabled;

  const setDatingPreferences = useGameStore((s) => s.setDatingPreferences);
  const inviteOnDate = useGameStore((s) => s.inviteOnDate);
  const planDate = useGameStore((s) => s.planDate);
  const askBecomePartners = useGameStore((s) => s.askBecomePartners);
  const moveInWithPartner = useGameStore((s) => s.moveInWithPartner);
  const spendTime = useGameStore((s) => s.spendTimeWithPartner);
  const giveGift = useGameStore((s) => s.givePartnerGift);
  const discussFinances = useGameStore((s) => s.discussFinancesWithPartner);
  const propose = useGameStore((s) => s.proposeToPartner);
  const marry = useGameStore((s) => s.marryPartner);
  const setFamilyPlan = useGameStore((s) => s.setFamilyPlan);
  const fundChildEducation = useGameStore((s) => s.fundChildEducation);
  const spendTimeWithChild = useGameStore((s) => s.spendTimeWithChild);
  const endDatingConnection = useGameStore((s) => s.endDatingConnection);
  const endPartnership = useGameStore((s) => s.endPartnership);
  const divorcePartner = useGameStore((s) => s.divorcePartner);
  const relationshipCounseling = useGameStore((s) => s.relationshipCounseling);
  const setSharedGoal = useGameStore((s) => s.setSharedRelationshipGoal);
  const cancelSharedGoal = useGameStore((s) => s.cancelSharedRelationshipGoal);
  const setEstatePlan = useGameStore((s) => s.setEstatePlan);
  const feedback = useGameStore((s) => s.relationshipFeedback);
  const dismissFeedback = useGameStore((s) => s.dismissRelationshipFeedback);
  const datingBounds = getNormalizedDatingAgeBounds(state.age ?? 20);
  const defaultMinAge = relationship?.preferencesSet
    ? (state.age ?? 20) + (relationship.minAgeOffset ?? -3)
    : Math.max(datingBounds.min, (state.age ?? 20) - 3);
  const defaultMaxAge = relationship?.preferencesSet
    ? (state.age ?? 20) + (relationship.maxAgeOffset ?? 4)
    : Math.min(datingBounds.max, (state.age ?? 20) + 4);

  const [preference, setPreference] = useState<DatingPreference>(relationship?.preference ?? 'everyone');
  const [minAge, setMinAge] = useState(defaultMinAge);
  const [maxAge, setMaxAge] = useState(defaultMaxAge);
  const [marriageAgreement, setMarriageAgreement] = useState<MarriageAgreement>('separate');

  const gw = ((state.year ?? 1) - 1) * 20 + (state.week ?? 1);
  const actionUsed = (relationship?.personalActionWeek ?? 0) === gw;
  const partner = useMemo(
    () => (relationship?.activeConnections ?? []).find((item) => item.id === relationship?.partnerId) ?? null,
    [relationship?.activeConnections, relationship?.partnerId]
  );
  const dating = (relationship?.activeConnections ?? []).filter((item) => item.stage === 'dating');
  const cohabiting = !!partner && (partner.isCohabiting || partner.stage === 'living_together' || partner.stage === 'married');
  const financeKnown = !!partner && ['financialStyle', 'riskTolerance', 'ambition', 'familyGoal'].every((trait) => partner.visibleTraits?.includes(trait as any));
  const pendingRelationshipEvent = relationship?.pendingEvent ?? null;
  const sharedGoal = relationship?.sharedGoal ?? null;
  const sharedGoalProgress = getSharedGoalProgress(sharedGoal, state);
  const estatePlan = relationship?.estatePlan;
  const adultChildren = (relationship?.children ?? []).filter((child) => getChildAge(child, gw) >= 18);
  const youngestChildBirthWeek = (relationship?.children ?? []).reduce((latest, child) => Math.max(latest, child.birthGlobalWeek ?? 0), 0);
  const familyProfile = partner
    ? getFamilyFormationProfile(state.age ?? 20, partner.age ?? 20, relationship?.children?.length ?? 0)
    : null;
  const familyLimitReached = !!familyProfile && (relationship?.children?.length ?? 0) >= familyProfile.maxChildren;
  const familySpacingBlocked = youngestChildBirthWeek > 0 && gw - youngestChildBirthWeek < 40;
  const familyAttemptCooldown = (relationship?.lastFamilyAttemptWeek ?? 0) > 0 && gw - (relationship?.lastFamilyAttemptWeek ?? 0) < 10;
  const familyTooYoung = !!partner && ((state.age ?? 20) < 21 || (partner.age ?? 20) < 21);
  const familyWouldCrossAgeLimit = !!partner && !!familyProfile
    && Math.max(state.age ?? 20, partner.age ?? 20) === 42
    && (state.week ?? 1) + familyProfile.durationWeeks > 20;
  const familyAgeBlocked = !!partner && (!familyProfile?.allowedByAge || familyWouldCrossAgeLimit);
  const canGrowFamily = !!familyProfile
    && !familyLimitReached
    && !familySpacingBlocked
    && !familyAgeBlocked
    && !familyAttemptCooldown
    && !familyTooYoung
    && (relationship?.familyExpansionWeeksRemaining ?? 0) <= 0;

  const estateSuccessors = [
    ...(partner?.stage === 'married' ? [{ id: partner.id, name: partner.name, role: 'Spouse' }] : []),
    ...adultChildren.map((child) => ({ id: child.id, name: child.name, role: child.occupationTitle ? `Adult child • ${child.occupationTitle}` : 'Adult child' })),
  ];

  if (!enabled) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <GameStatusBar />
        <ScrollView contentContainerStyle={styles.content}>
          <GameCard>
            <View style={styles.centered}>
              <Ionicons name="heart-outline" size={42} color={Colors.textMuted} />
              <Text style={styles.heroTitle}>Personal Life is Off</Text>
              <Text style={styles.heroText}>This save is currently focused on the economy only. You can enable Personal Life from Profile & Stats at any time.</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => router.push('/profile')}>
              <Text style={styles.secondaryText}>Open Profile Settings</Text>
            </Pressable>
          </GameCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!relationship?.preferencesSet) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} />
        <GameStatusBar />
        <ScrollView contentContainerStyle={styles.content}>
          <GameCard>
            <View style={styles.centered}>
              <Ionicons name="heart-outline" size={42} color={Colors.happiness} />
              <Text style={styles.heroTitle}>Personal Life</Text>
              <Text style={styles.heroText}>Choose who you would like to meet. Deeper traits and financial habits are learned by spending time together.</Text>
            </View>
            <Text style={styles.sectionLabel}>Interested in</Text>
            <View style={styles.choiceRow}>
              {(['women', 'men', 'everyone'] as DatingPreference[]).map((item) => (
                <Pressable key={item} style={[styles.choice, preference === item && styles.choiceSelected]} onPress={() => setPreference(item)}>
                  <Text style={[styles.choiceText, preference === item && styles.choiceTextSelected]}>
                    {item === 'women' ? 'Women' : item === 'men' ? 'Men' : 'Everyone'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Preferred age range</Text>
            <Text style={styles.helper}>
              Matches stay within a normal life-stage range for your age ({datingBounds.min}–{datingBounds.max}), and most generated profiles are much closer to your age.
            </Text>
            <View style={styles.ageRow}>
              <Counter label="Min" value={minAge} onMinus={() => setMinAge(Math.max(datingBounds.min, minAge - 1))} onPlus={() => setMinAge(Math.min(maxAge, minAge + 1))} />
              <Counter label="Max" value={maxAge} onMinus={() => setMaxAge(Math.max(minAge, maxAge - 1))} onPlus={() => setMaxAge(Math.min(datingBounds.max, maxAge + 1))} />
            </View>

            <Pressable style={styles.primaryButton} onPress={() => setDatingPreferences(preference, minAge, maxAge)}>
              <Text style={styles.primaryText}>Start Meeting People</Text>
            </Pressable>
          </GameCard>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} />
      <GameStatusBar />
      <ScrollView contentContainerStyle={styles.content}>
        {feedback && (
          <Pressable style={[styles.feedback, { borderColor: feedback.positive ? `${Colors.primary}55` : `${Colors.negative}55`, backgroundColor: feedback.positive ? `${Colors.primary}12` : `${Colors.negative}12` }]} onPress={dismissFeedback}>
            <Ionicons name={feedback.positive ? 'checkmark-circle' : 'information-circle'} size={20} color={feedback.positive ? Colors.primary : Colors.negative} />
            <View style={{ flex: 1 }}>
              <Text style={styles.feedbackTitle}>{feedback.title}</Text>
              <Text style={styles.feedbackText}>{feedback.message}</Text>
            </View>
            <Ionicons name="close" size={18} color={Colors.textMuted} />
          </Pressable>
        )}

        {actionUsed && (
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={18} color={Colors.warning} />
            <Text style={styles.noticeText}>Your personal action for this week is used. Major life steps can still be available, but dates, gifts and conversations wait until next week.</Text>
          </View>
        )}

        {pendingRelationshipEvent && (
          <Pressable style={styles.pendingEvent} onPress={() => useGameStore.setState({ showRelationshipEventModal: true })}>
            <View style={styles.pendingIcon}><Text style={{ fontSize: 20 }}>{pendingRelationshipEvent.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pendingTitle}>Decision waiting: {pendingRelationshipEvent.title}</Text>
              <Text style={styles.pendingText}>Tap to reopen this Personal Life decision.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.happiness} />
          </Pressable>
        )}

        {partner && (
          <>
            <Text style={styles.sectionTitle}>Relationship</Text>
            <ConnectionCard connection={partner}>
              <View style={styles.statusGrid}>
                <MiniStat label="Status" value={stageLabel(partner.stage)} />
                <MiniStat label="Known" value={`${partner.weeksKnown} wk`} />
                <MiniStat
                  label="Career"
                  value={partner.employmentStatus === 'unemployed'
                    ? 'Unemployed'
                    : formatCurrency(partner.weeklyIncome) + '/wk'}
                />
                <MiniStat label="Home" value={cohabiting ? 'Together' : 'Separate'} />
              </View>

              {financeKnown && (
                <View style={styles.financeBox}>
                  <Text style={styles.financeTitle}>Known finances</Text>
                  <View style={styles.financeRow}>
                    <Text style={styles.meta}>Career</Text>
                    <Text style={[styles.moneyText, partner.employmentStatus === 'unemployed' && { color: Colors.warning }]}>
                      {partner.employmentStatus === 'unemployed'
                        ? `Unemployed • ${partner.unemploymentWeeks ?? 0} wk`
                        : `${formatCurrency(partner.weeklyIncome)}/wk • Level ${partner.careerLevel ?? 1}`}
                    </Text>
                  </View>
                  <View style={styles.financeRow}><Text style={styles.meta}>Personal savings</Text><Text style={styles.moneyText}>{formatCurrency(partner.savings)}</Text></View>
                  {partner.marriageAgreement && (
                    <View style={styles.financeRow}>
                      <Text style={styles.meta}>Marriage finances</Text>
                      <Text style={styles.moneyText}>{partner.marriageAgreement === 'separate' ? 'Separate assets' : 'Share future growth'}</Text>
                    </View>
                  )}
                </View>
              )}

              <Text style={styles.subheading}>This Week</Text>
              <View style={styles.actionGrid}>
                <ActionTile icon="heart-outline" label="Spend Time" disabled={actionUsed} onPress={spendTime} />
                <ActionTile icon="chatbubbles-outline" label="Discuss Finances" disabled={actionUsed} onPress={discussFinances} />
              </View>
              <DateButtons disabled={actionUsed} cash={state.cash} inflation={state.inflationMultiplier} onDate={(kind) => planDate(partner.id, kind)} />

              <Text style={styles.subheading}>Gift</Text>
              <View style={styles.threeRow}>
                {([
                  ['small', 'Small', 100],
                  ['nice', 'Nice', 500],
                  ['luxury', 'Luxury', 2500],
                ] as const).map(([tier, label, base]) => {
                  const cost = Math.round(base * (state.inflationMultiplier ?? 1));
                  const disabled = actionUsed || state.cash < cost;
                  return (
                    <Pressable key={tier} disabled={disabled} style={[styles.compactButton, disabled && styles.disabled]} onPress={() => giveGift(tier)}>
                      <Text style={styles.compactTitle}>{label}</Text>
                      <Text style={styles.dateCost}>{formatCurrency(cost)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {!cohabiting && ['partner', 'engaged'].includes(partner.stage) && partner.relationship >= 75 && partner.weeksKnown >= 8 && (
                <View style={styles.majorBox}>
                  <Text style={styles.majorTitle}>Move In Together</Text>
                  <Text style={styles.meta}>Living together changes household costs and lets your partner contribute toward shared expenses.</Text>
                  <Pressable style={styles.secondaryButton} onPress={() => moveInWithPartner('equal')}><Text style={styles.secondaryText}>50 / 50</Text></Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => moveInWithPartner('proportional')}><Text style={styles.secondaryText}>Proportional to Income</Text></Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => moveInWithPartner('player_pays_most')}><Text style={styles.secondaryText}>You Pay Most</Text></Pressable>
                </View>
              )}

              {['partner', 'living_together'].includes(partner.stage) && partner.relationship >= 82 && partner.weeksKnown >= 12 && (
                <View style={styles.majorBox}>
                  <Text style={styles.majorTitle}>Propose</Text>
                  <Text style={styles.meta}>A stronger relationship improves the chance they say yes. More expensive is not automatically better for a frugal partner.</Text>
                  <View style={styles.threeRow}>
                    {(['simple', 'classic', 'luxury'] as const).map((ring) => {
                      const cost = getProposalCost(ring, state.inflationMultiplier);
                      return (
                        <Pressable key={ring} disabled={actionUsed || state.cash < cost} style={[styles.compactButton, (actionUsed || state.cash < cost) && styles.disabled]} onPress={() => propose(ring)}>
                          <Text style={styles.compactTitle}>{capitalize(ring)}</Text>
                          <Text style={styles.dateCost}>{formatCurrency(cost)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {partner.stage === 'engaged' && (
                <View style={styles.majorBox}>
                  <Text style={styles.majorTitle}>Plan the Wedding</Text>
                  <Text style={styles.meta}>Your partner can cover part of the wedding from their own savings. Choose how a future divorce settlement treats wealth built after marriage. This does not merge your playable cash while married.</Text>

                  <Text style={styles.subheading}>Financial agreement</Text>
                  <View style={styles.choiceRow}>
                    <Pressable style={[styles.choice, marriageAgreement === 'separate' && styles.choiceSelected]} onPress={() => setMarriageAgreement('separate')}>
                      <Text style={[styles.choiceText, marriageAgreement === 'separate' && styles.choiceTextSelected]}>Separate Assets</Text>
                    </Pressable>
                    <Pressable style={[styles.choice, marriageAgreement === 'shared_future' && styles.choiceSelected]} onPress={() => setMarriageAgreement('shared_future')}>
                      <Text style={[styles.choiceText, marriageAgreement === 'shared_future' && styles.choiceTextSelected]}>Share Future Growth</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.agreementHelp}>
                    Separate Assets: only legal fees on divorce. Share Future Growth: 50% of positive net-worth growth since marriage is settled with your spouse.
                  </Text>

                  <Text style={styles.subheading}>Wedding</Text>
                  {(['courthouse', 'standard', 'luxury'] as const).map((wedding) => {
                    const total = getWeddingCost(wedding, state.inflationMultiplier);
                    const partnerShare = Math.min(Math.round(total * 0.25), Math.round((partner.savings ?? 0) * 0.35));
                    const yours = Math.max(0, total - partnerShare);
                    const ready = gw - (partner.engagedWeek ?? gw) >= 3;
                    return (
                      <Pressable key={wedding} disabled={!ready || state.cash < yours} style={[styles.weddingRow, (!ready || state.cash < yours) && styles.disabled]} onPress={() => marry(wedding, marriageAgreement)}>
                        <View>
                          <Text style={styles.compactTitle}>{wedding === 'courthouse' ? 'Courthouse' : capitalize(wedding) + ' Wedding'}</Text>
                          <Text style={styles.meta}>{ready ? `Your share: ${formatCurrency(yours)}` : 'Available 3 weeks after engagement'}</Text>
                        </View>
                        <Text style={styles.moneyText}>{formatCurrency(total)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {(cohabiting || partner.stage === 'married') && partner.relationship >= 70 && (
                <View style={styles.majorBox}>
                  <Text style={styles.majorTitle}>Family Plans</Text>
                  {relationship.familyExpansionWeeksRemaining > 0 ? (
                    <View style={styles.familyProgress}>
                      <Ionicons name="people-outline" size={22} color={Colors.happiness} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactTitle}>Growing the family</Text>
                        <Text style={styles.meta}>About {relationship.familyExpansionWeeksRemaining} week{relationship.familyExpansionWeeksRemaining === 1 ? '' : 's'} remaining.</Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.meta}>Discussing children can strengthen or strain the relationship depending on your partner's goals.</Text>
                      {!canGrowFamily && (
                        <Text style={[styles.meta, { color: Colors.warning, marginTop: 5 }]}>
                          {familyLimitReached
                            ? 'Maximum three children reached for this generation.'
                            : familyAgeBlocked
                              ? 'Family expansion must be completed before age 43.'
                              : familyTooYoung
                                ? 'Family expansion starts from age 21.'
                                : familySpacingBlocked
                                  ? 'Wait about two in-game years between children.'
                                  : familyAttemptCooldown
                                    ? 'Give it some time before trying again.'
                                    : 'Your family is already growing.'}
                        </Text>
                      )}
                      <View style={styles.threeRow}>
                        <Pressable disabled={actionUsed} style={[styles.compactButton, actionUsed && styles.disabled]} onPress={() => setFamilyPlan('no_children')}>
                          <Text style={styles.compactTitle}>No Children</Text>
                        </Pressable>
                        <Pressable disabled={actionUsed} style={[styles.compactButton, actionUsed && styles.disabled]} onPress={() => setFamilyPlan('later')}>
                          <Text style={styles.compactTitle}>Maybe Later</Text>
                        </Pressable>
                        <Pressable
                          disabled={actionUsed || !canGrowFamily || state.cash < Math.round(1000 * state.inflationMultiplier)}
                          style={[
                            styles.compactButton,
                            (actionUsed || !canGrowFamily || state.cash < Math.round(1000 * state.inflationMultiplier)) && styles.disabled,
                          ]}
                          onPress={() => setFamilyPlan('trying')}
                        >
                          <Text style={styles.compactTitle}>Grow Family</Text>
                          <Text style={styles.dateCost}>{formatCurrency(Math.round(1000 * state.inflationMultiplier))}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}

              {partner.relationship < 65 && (
                <View style={styles.majorBox}>
                  <Text style={styles.majorTitle}>Relationship Under Strain</Text>
                  <Text style={styles.meta}>Counseling costs {formatCurrency(Math.round(1200 * state.inflationMultiplier))} and can rebuild part of the relationship.</Text>
                  <Pressable
                    disabled={actionUsed || state.cash < Math.round(1200 * state.inflationMultiplier)}
                    style={[styles.secondaryButton, (actionUsed || state.cash < Math.round(1200 * state.inflationMultiplier)) && styles.disabled]}
                    onPress={relationshipCounseling}
                  >
                    <Text style={styles.secondaryText}>Relationship Counseling</Text>
                  </Pressable>
                </View>
              )}

              {partner.stage !== 'married' && (
                <Pressable style={styles.dangerLink} onPress={endPartnership}>
                  <Text style={styles.dangerText}>End Relationship</Text>
                </Pressable>
              )}
              {partner.stage === 'married' && (
                <View style={styles.divorceBox}>
                  <Text style={styles.divorceTitle}>Divorce</Text>
                  <Text style={styles.meta}>
                    {partner.marriageAgreement === 'shared_future'
                      ? 'A divorce would settle 50% of positive net-worth growth since the wedding, plus legal fees, over a payment schedule.'
                      : 'Your separate-assets agreement preserves your assets; divorce still creates legal fees.'}
                  </Text>
                  <Pressable style={styles.dangerButton} onPress={divorcePartner}>
                    <Text style={styles.dangerButtonText}>File for Divorce</Text>
                  </Pressable>
                </View>
              )}
            </ConnectionCard>
          </>
        )}

        {partner && cohabiting && (
          <>
            <Text style={styles.sectionTitle}>Shared Goals</Text>
            <GameCard>
              {sharedGoal ? (
                <>
                  <View style={styles.goalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compactTitle}>{sharedGoalLabel(sharedGoal.type)}</Text>
                      <Text style={styles.meta}>
                        {sharedGoal.completed ? 'Completed' : sharedGoalTargetText(sharedGoal, state)}
                      </Text>
                    </View>
                    <Text style={[styles.moneyText, sharedGoal.completed && { color: Colors.primary }]}>
                      {sharedGoal.completed ? '✓ Done' : sharedGoalProgressText(sharedGoal, sharedGoalProgress)}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.max(0, Math.min(100, sharedGoal.target > 0 ? (sharedGoalProgress / sharedGoal.target) * 100 : 0))}%`,
                          backgroundColor: sharedGoal.completed ? Colors.primary : Colors.happiness,
                        },
                      ]}
                    />
                  </View>
                  {!sharedGoal.completed && (
                    <Text style={styles.helper}>
                      This goal tracks your normal gameplay automatically. You do not deposit money into a separate account.
                    </Text>
                  )}
                  <Pressable style={styles.dangerLink} onPress={cancelSharedGoal}>
                    <Text style={styles.dangerText}>{sharedGoal.completed ? 'Clear Goal' : 'Cancel Shared Goal'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.helper}>
                    Agree on something to work toward together. Completing a goal strengthens the relationship without creating free income.
                  </Text>
                  <View style={styles.goalGrid}>
                    <ActionTile icon="shield-checkmark-outline" label="Cash Buffer" onPress={() => setSharedGoal('cash_buffer')} />
                    <ActionTile icon="trending-up-outline" label="Net Worth" onPress={() => setSharedGoal('net_worth')} />
                    <ActionTile icon="home-outline" label="Better Home" onPress={() => setSharedGoal('better_home')} />
                    <ActionTile icon="school-outline" label="Family Fund" onPress={() => setSharedGoal('family_fund')} />
                  </View>
                </>
              )}
            </GameCard>
          </>
        )}

        {(partner?.stage === 'married' || (relationship.children ?? []).length > 0) && estatePlan && (
          <>
            <Text style={styles.sectionTitle}>Estate Planning</Text>
            <GameCard>
              <Text style={styles.helper}>
                Decide how your estate is divided when this life ends. These settings do not transfer playable cash during your lifetime.
              </Text>
              <View style={styles.taxInfoBox}>
                <Text style={styles.compactTitle}>Child inheritance tax</Text>
                <Text style={styles.meta}>Game balance rule: first €50k free, then 10% / 15% / 20% / 25% progressive bands.</Text>
                <Text style={styles.meta}>A child can pay from existing savings + inherited cash, or finance the tax over 80 weeks. Spouse inheritance is not taxed by this game system.</Text>
              </View>

              <Text style={styles.subheading}>Inheritance Split</Text>
              <View style={styles.estateOptionGrid}>
                {([
                  ['default', 'Family Default'],
                  ['spouse_first', 'Spouse First'],
                  ['children_first', 'Children First'],
                  ['equal_family', 'Equal Family'],
                ] as Array<[EstatePlanType, string]>).map(([type, label]) => (
                  <Pressable
                    key={type}
                    style={[styles.estateChoice, estatePlan.planType === type && styles.choiceSelected]}
                    onPress={() => setEstatePlan(type, estatePlan.structure, estatePlan.successorId)}
                  >
                    <Text style={[styles.choiceText, estatePlan.planType === type && styles.choiceTextSelected]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.agreementHelp}>{estatePlanDescription(estatePlan.planType, !!(partner?.stage === 'married'), relationship.children?.length ?? 0)}</Text>

              <Text style={styles.subheading}>Estate Structure</Text>
              <View style={styles.estateStructureList}>
                {([
                  ['none', 'No Formal Plan', 0, 'Highest administration cost at death.'],
                  ['will', 'Documented Will', Math.round(2000 * state.inflationMultiplier), 'Lower estate administration cost.'],
                  ['family_trust', 'Family Trust', Math.round(25000 * state.inflationMultiplier), 'Lowest administration cost; expensive to establish.'],
                ] as Array<[EstateStructureType, string, number, string]>).map(([type, label, cost, desc]) => {
                  const rank: Record<EstateStructureType, number> = { none: 0, will: 1, family_trust: 2 };
                  const changing = estatePlan.structure !== type;
                  const isUpgrade = rank[type] > rank[estatePlan.structure];
                  const actualSetupCost = isUpgrade ? cost : 0;
                  const unavailable = changing && state.cash < actualSetupCost;
                  return (
                    <Pressable
                      key={type}
                      disabled={unavailable}
                      style={[styles.estateStructureRow, estatePlan.structure === type && styles.estateStructureSelected, unavailable && styles.disabled]}
                      onPress={() => setEstatePlan(estatePlan.planType, type, estatePlan.successorId)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactTitle}>{label}</Text>
                        <Text style={styles.meta}>{desc}</Text>
                      </View>
                      <Text style={styles.moneyText}>
                        {estatePlan.structure === type ? 'Active' : actualSetupCost > 0 ? formatCurrency(actualSetupCost) : 'Free'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.subheading}>Business Successor</Text>
              {estateSuccessors.length > 0 ? (
                <View style={styles.successorList}>
                  <Pressable
                    style={[styles.successorRow, !estatePlan.successorId && styles.successorSelected]}
                    onPress={() => setEstatePlan(estatePlan.planType, estatePlan.structure, null)}
                  >
                    <Text style={styles.compactTitle}>No named successor</Text>
                  </Pressable>
                  {estateSuccessors.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      style={[styles.successorRow, estatePlan.successorId === candidate.id && styles.successorSelected]}
                      onPress={() => setEstatePlan(estatePlan.planType, estatePlan.structure, candidate.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactTitle}>{candidate.name}</Text>
                        <Text style={styles.meta}>{candidate.role}</Text>
                      </View>
                      {estatePlan.successorId === candidate.id && <Ionicons name="checkmark-circle" size={19} color={Colors.primary} />}
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={styles.helper}>A spouse or adult child is required before you can name a business successor.</Text>
              )}
            </GameCard>
          </>
        )}

        <GameCard>
          <Pressable style={styles.familyTreeLink} onPress={() => router.push('/family-tree')}>
            <View style={styles.familyTreeIcon}>
              <Ionicons name="git-network-outline" size={22} color={Colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.compactTitle}>Family Tree</Text>
              <Text style={styles.meta}>View your full dynasty, previous generations, partners, siblings and grandchildren.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </Pressable>
        </GameCard>

        {(relationship.children ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Family</Text>
            {(relationship.children ?? []).map((child) => {
              const age = getChildAge(child, gw);
              const weeklyCost = getChildWeeklyCost(child, state);
              const personality = child.personality;
              const potential = age >= 18 ? getChildFuturePotential(child) : null;
              const parentRelationship = Math.round(child.parentRelationship ?? 75);
              return (
                <GameCard key={child.id}>
                  <View style={styles.profileTop}>
                    <View style={styles.childAvatar}><Ionicons name="happy-outline" size={23} color={Colors.info} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{child.name}</Text>
                      <Text style={styles.meta}>Age {age} • {child.gender === 'girl' ? 'Daughter' : 'Son'}</Text>
                    </View>
                    {weeklyCost > 0 && <Text style={styles.costText}>-{formatCurrency(weeklyCost)}/wk</Text>}
                  </View>

                  <Text style={styles.progressLabel}>Parent Relationship {parentRelationship}%</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${parentRelationship}%`,
                          backgroundColor: parentRelationship >= 70 ? Colors.happiness : parentRelationship >= 40 ? Colors.warning : Colors.negative,
                        },
                      ]}
                    />
                  </View>

                  {personality && (
                    <View style={styles.childTraits}>
                      <TraitChip label={capitalize(personality.ambition.replace('_', ' '))} />
                      <TraitChip label={capitalize(personality.financialStyle.replace('_', ' '))} />
                      <TraitChip label={capitalize(personality.riskTolerance.replace('_', ' '))} />
                      <TraitChip label={capitalize(personality.independence)} />
                      <TraitChip label={capitalize(personality.resilience)} />
                    </View>
                  )}

                  <Pressable
                    disabled={actionUsed}
                    style={[styles.childTimeButton, actionUsed && styles.disabled]}
                    onPress={() => spendTimeWithChild(child.id)}
                  >
                    <Ionicons name="heart-outline" size={16} color={actionUsed ? Colors.textMuted : Colors.happiness} />
                    <Text style={styles.childTimeText}>Spend Time</Text>
                  </Pressable>

                  {age < 18 ? (
                    <>
                      <View style={styles.financeRow}>
                        <Text style={styles.meta}>Education fund</Text>
                        <Text style={styles.moneyText}>{formatCurrency(child.educationFund ?? 0)}</Text>
                      </View>
                      <View style={styles.threeRow}>
                        {[1000, 5000, 10000].map((amount) => (
                          <Pressable
                            key={amount}
                            disabled={state.cash < amount}
                            style={[styles.compactButton, state.cash < amount && styles.disabled]}
                            onPress={() => fundChildEducation(child.id, amount)}
                          >
                            <Text style={styles.compactTitle}>Add</Text>
                            <Text style={styles.dateCost}>{formatCurrency(amount)}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </>
                  ) : (
                    <View style={styles.financeBox}>
                      <View style={styles.adultHeaderRow}>
                        <View>
                          <Text style={styles.financeTitle}>Independent Life</Text>
                          <Text style={styles.meta}>
                            {child.adultStatus === 'unemployed' ? 'Currently unemployed'
                              : child.adultStatus === 'entrepreneur' ? 'Entrepreneur'
                                : 'Employed'}
                          </Text>
                        </View>
                        {potential && (
                          <View style={styles.potentialBadge}>
                            <Text style={styles.potentialScore}>{potential.score}</Text>
                            <Text style={styles.potentialLabel}>{potential.label}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.financeRow}><Text style={styles.meta}>Career</Text><Text style={styles.moneyText}>{child.occupationTitle ?? 'Getting established'}</Text></View>
                      <View style={styles.financeRow}><Text style={styles.meta}>Income</Text><Text style={styles.moneyText}>{formatCurrency(child.weeklyIncome ?? 0)}/wk</Text></View>
                      <View style={styles.financeRow}><Text style={styles.meta}>Savings</Text><Text style={styles.moneyText}>{formatCurrency(child.savings ?? 0)}</Text></View>
                      {(child.debt ?? 0) > 0 && <View style={styles.financeRow}><Text style={styles.meta}>Debt</Text><Text style={[styles.moneyText, { color: Colors.negative }]}>{formatCurrency(child.debt ?? 0)}</Text></View>}
                      {(child.businessValue ?? 0) > 0 && <View style={styles.financeRow}><Text style={styles.meta}>Own business</Text><Text style={styles.moneyText}>{formatCurrency(child.businessValue ?? 0)}</Text></View>}
                      <View style={styles.financeRow}><Text style={styles.meta}>Housing</Text><Text style={styles.moneyText}>{child.homeStatus === 'homeowner' ? 'Homeowner' : 'Renting'}</Text></View>
                      <View style={styles.financeRow}><Text style={styles.meta}>Partner</Text><Text style={styles.moneyText}>{child.partnerName ?? 'Single'}</Text></View>
                      <View style={styles.financeRow}><Text style={styles.meta}>Children</Text><Text style={styles.moneyText}>{child.descendants?.length ?? child.childrenCount ?? 0}</Text></View>
                      {(child.failureCount ?? 0) > 0 && (
                        <Text style={[styles.meta, { color: Colors.warning, marginTop: 7 }]}>
                          {child.failureCount} major setback{child.failureCount === 1 ? '' : 's'} survived.
                        </Text>
                      )}
                      {(child.descendants ?? []).length > 0 && (
                        <View style={styles.descendantList}>
                          {(child.descendants ?? []).map((descendant) => (
                            <Text key={descendant.id} style={styles.descendantText}>• {descendant.name}, age {descendant.age}</Text>
                          ))}
                        </View>
                      )}
                    </View>
                  )}
                </GameCard>
              );
            })}
          </>
        )}

        {dating.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Dating</Text>
            {dating.map((connection) => (
              <ConnectionCard key={connection.id} connection={connection}>
                <Text style={styles.meta}>{connection.dates} date{connection.dates === 1 ? '' : 's'} • known {connection.weeksKnown} week{connection.weeksKnown === 1 ? '' : 's'}</Text>
                <DateButtons disabled={actionUsed} cash={state.cash} inflation={state.inflationMultiplier} onDate={(kind) => planDate(connection.id, kind)} />
                {connection.connection >= 60 && connection.dates >= 3 && (
                  <Pressable style={styles.primaryButton} onPress={() => askBecomePartners(connection.id)}>
                    <Text style={styles.primaryText}>Ask to Become Partners</Text>
                  </Pressable>
                )}
                <Pressable style={styles.dangerLink} onPress={() => endDatingConnection(connection.id)}>
                  <Text style={styles.dangerText}>Stop Dating</Text>
                </Pressable>
              </ConnectionCard>
            ))}
          </>
        )}

        {!partner && (
          <>
            <Text style={styles.sectionTitle}>Meet People</Text>
            <Text style={styles.helper}>New profiles appear as game weeks advance. Their deeper financial and family preferences are deliberately hidden at first.</Text>
            {(relationship.weeklyCandidates ?? []).map((candidate) => (
              <GameCard key={candidate.id}>
                <View style={styles.profileTop}>
                  <View style={styles.avatar}><Ionicons name="person" size={24} color={Colors.happiness} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{candidate.name}, {candidate.age}</Text>
                    <Text style={styles.meta}>{candidate.occupationTitle}</Text>
                    <Text style={styles.meta}>Looking for a relationship</Text>
                  </View>
                </View>
                <View style={styles.unknownBox}>
                  <Text style={styles.unknownText}>Financial habits ?   Family plans ?   Risk tolerance ?</Text>
                </View>
                <DateButtons disabled={actionUsed} cash={state.cash} inflation={state.inflationMultiplier} onDate={(kind) => inviteOnDate(candidate.id, kind)} firstDate />
              </GameCard>
            ))}
            {(relationship.weeklyCandidates ?? []).length === 0 && (
              <GameCard><Text style={styles.helper}>No new profiles right now. Advance a week to refresh the pool.</Text></GameCard>
            )}
          </>
        )}

        {(relationship.financialObligations ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Financial Obligations</Text>
            <GameCard>
              {(relationship.financialObligations ?? []).map((obligation) => (
                <View key={obligation.id} style={styles.obligationRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compactTitle}>{obligation.label}</Text>
                    <Text style={styles.meta}>{obligation.weeksRemaining} weeks remaining</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.costText}>-{formatCurrency(Math.min(obligation.weeklyPayment, obligation.remainingAmount))}/wk</Text>
                    <Text style={styles.meta}>{formatCurrency(obligation.remainingAmount)} left</Text>
                  </View>
                </View>
              ))}
            </GameCard>
          </>
        )}

        {(relationship.formerPartners ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Former Partners</Text>
            <GameCard>
              {[...(relationship.formerPartners ?? [])].reverse().map((former) => (
                <View key={former.id + '_' + (former.endedWeek ?? 0)} style={styles.obligationRow}>
                  <View style={styles.smallAvatar}><Ionicons name="person-outline" size={18} color={Colors.textMuted} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compactTitle}>{former.name}</Text>
                    <Text style={styles.meta}>{former.stage === 'married' ? 'Former spouse' : 'Former partner'} • Relationship ended</Text>
                  </View>
                </View>
              ))}
            </GameCard>
          </>
        )}

        <Text style={styles.sectionTitle}>Relationship History</Text>
        <GameCard>
          {(relationship.timeline ?? []).length === 0 ? (
            <Text style={styles.helper}>Your personal history will appear here.</Text>
          ) : (
            [...(relationship.timeline ?? [])].reverse().map((entry, index) => (
              <View key={index} style={styles.historyRow}>
                <Text style={styles.historyDate}>Y{entry.year} W{entry.week}</Text>
                <Text style={styles.historyText}>{entry.title}</Text>
              </View>
            ))
          )}
        </GameCard>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return <View style={styles.header}>
    <Pressable onPress={onBack} hitSlop={12}><Ionicons name="arrow-back" size={24} color={Colors.textPrimary} /></Pressable>
    <Text style={styles.headerTitle}>Personal Life</Text>
  </View>;
}

function Counter({ label, value, onMinus, onPlus }: { label: string; value: number; onMinus: () => void; onPlus: () => void }) {
  return <View style={styles.counter}>
    <Text style={styles.meta}>{label}</Text>
    <View style={styles.counterRow}>
      <Pressable onPress={onMinus} style={styles.counterButton}><Text style={styles.counterSymbol}>−</Text></Pressable>
      <Text style={styles.counterValue}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.counterButton}><Text style={styles.counterSymbol}>+</Text></Pressable>
    </View>
  </View>;
}

function ConnectionCard({ connection, children }: { connection: RelationshipConnection; children: React.ReactNode }) {
  const value = connection.stage === 'dating' ? connection.connection : connection.relationship;
  return <GameCard>
    <View style={styles.profileTop}>
      <View style={styles.avatar}><Ionicons name="person" size={24} color={Colors.happiness} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{connection.name}, {connection.age}</Text>
        <Text style={styles.meta}>{connection.occupationTitle}</Text>
      </View>
    </View>
    <Text style={styles.progressLabel}>{connection.stage === 'dating' ? 'Connection' : 'Relationship'} {Math.round(value)}%</Text>
    <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, value))}%` }]} /></View>
    <View style={styles.traits}>
      {(connection.visibleTraits ?? []).map((trait) => (
        <View key={trait} style={styles.trait}><Text style={styles.traitText}>{TRAIT_LABELS[trait]?.[(connection as any)[trait]] ?? (connection as any)[trait]}</Text></View>
      ))}
      {(connection.visibleTraits ?? []).length < 4 && <View style={styles.traitUnknown}><Text style={styles.traitUnknownText}>More to discover</Text></View>}
    </View>
    {children}
  </GameCard>;
}

function DateButtons({ disabled, cash, inflation, onDate, firstDate }: { disabled: boolean; cash: number; inflation: number; onDate: (kind: 'coffee' | 'dinner' | 'activity') => void; firstDate?: boolean }) {
  return <View style={styles.dateArea}>
    <Text style={styles.dateLabel}>{firstDate ? 'Invite on a first date' : 'Plan a date'}</Text>
    <View style={styles.dateRow}>
      {([
        ['coffee', 'Coffee', 'cafe-outline'],
        ['dinner', 'Dinner', 'restaurant-outline'],
        ['activity', 'Activity', 'game-controller-outline'],
      ] as const).map(([kind, label, icon]) => {
        const cost = getDateCost(kind, inflation);
        const unavailable = disabled || cash < cost;
        return <Pressable key={kind} disabled={unavailable} style={[styles.dateButton, unavailable && styles.disabled]} onPress={() => onDate(kind)}>
          <Ionicons name={icon} size={17} color={unavailable ? Colors.textMuted : Colors.happiness} />
          <Text style={styles.dateButtonText}>{label}</Text>
          <Text style={styles.dateCost}>{formatCurrency(cost)}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

function TraitChip({ label }: { label: string }) {
  return <View style={styles.childTraitChip}><Text style={styles.childTraitText}>{label}</Text></View>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <View style={styles.miniStat}><Text style={styles.miniLabel}>{label}</Text><Text style={styles.miniValue} numberOfLines={1}>{value}</Text></View>;
}

function ActionTile({ icon, label, disabled, onPress }: { icon: string; label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} style={[styles.actionTile, disabled && styles.disabled]} onPress={onPress}>
    <Ionicons name={icon as any} size={19} color={disabled ? Colors.textMuted : Colors.happiness} />
    <Text style={styles.actionTileText}>{label}</Text>
  </Pressable>;
}

function childEducationLabel(outcome?: string) {
  if (outcome === 'elite') return 'Elite start';
  if (outcome === 'strong') return 'Strong start';
  if (outcome === 'solid') return 'Solid start';
  if (outcome === 'limited') return 'Basic start';
  return 'Not resolved';
}

function estatePlanDescription(type: EstatePlanType, hasSpouse: boolean, childCount: number) {
  if (!hasSpouse && childCount === 0) return 'No family beneficiaries are currently available.';
  if (!hasSpouse) return 'Your children divide the estate equally.';
  if (childCount === 0) return 'Your spouse receives the estate.';
  if (type === 'spouse_first') return '75% to your spouse; 25% divided equally among children.';
  if (type === 'children_first') return '25% to your spouse; 75% divided equally among children.';
  if (type === 'equal_family') return 'Your spouse and each child receive equal shares.';
  return '50% to your spouse; 50% divided equally among children.';
}

function getSharedGoalProgress(goal: any, state: any): number {
  if (!goal) return 0;
  if (goal.type === 'cash_buffer') return Math.max(0, state.cash ?? 0);
  if (goal.type === 'net_worth') return Math.max(0, state.getNetWorthValue?.() ?? 0);
  if (goal.type === 'better_home') {
    const order = ['cheap_apartment', 'studio_apartment', 'small_house', 'family_house', 'luxury_villa', 'mansion'];
    return Math.max(0, order.indexOf(state.currentHousingId));
  }
  return (state.relationshipState?.children ?? []).reduce((sum: number, child: any) => sum + (child.educationFund ?? 0), 0);
}

function sharedGoalLabel(type: string) {
  if (type === 'cash_buffer') return 'Build a Cash Buffer';
  if (type === 'net_worth') return 'Reach a Net-Worth Milestone';
  if (type === 'better_home') return 'Move to a Better Home';
  return 'Build the Family Education Fund';
}

function sharedGoalTargetText(goal: any, state: any) {
  if (goal.type === 'better_home') {
    const names = ['Cheap Apartment', 'Studio Apartment', 'Small House', 'Family House', 'Luxury Villa', 'Mansion'];
    return `Target: ${names[goal.target] ?? 'next home'}`;
  }
  return `Target: ${formatCurrency(goal.target)}`;
}

function sharedGoalProgressText(goal: any, progress: number) {
  if (goal.type === 'better_home') return `${Math.round(Math.min(100, (progress / Math.max(1, goal.target)) * 100))}%`;
  return formatCurrency(progress);
}

function stageLabel(stage: RelationshipConnection['stage']) {
  if (stage === 'living_together') return 'Living Together';
  if (stage === 'engaged') return 'Engaged';
  if (stage === 'married') return 'Married';
  return stage === 'partner' ? 'Partner' : 'Dating';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48 },
  centered: { alignItems: 'center', marginBottom: 18 },
  heroTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 8 },
  heroText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12, marginBottom: 10 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },
  subheading: { color: Colors.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 14, marginBottom: 7 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 6, alignItems: 'center' },
  choiceSelected: { borderColor: Colors.happiness, backgroundColor: `${Colors.happiness}18` },
  choiceText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12, textAlign: 'center' },
  choiceTextSelected: { color: Colors.happiness },
  ageRow: { flexDirection: 'row', gap: 10 },
  counter: { flex: 1, backgroundColor: Colors.elevated, borderRadius: 10, padding: 10 },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  counterButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  counterSymbol: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  counterValue: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  primaryButton: { backgroundColor: Colors.happiness, borderRadius: 10, minHeight: 46, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  primaryText: { color: Colors.white, fontWeight: '800', fontSize: 14 },
  secondaryButton: { borderWidth: 1, borderColor: Colors.happiness, borderRadius: 9, paddingVertical: 10, alignItems: 'center', marginTop: 7 },
  secondaryText: { color: Colors.happiness, fontWeight: '700', fontSize: 13 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 11, padding: 11, marginBottom: 10 },
  feedbackTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  feedbackText: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: `${Colors.warning}18`, borderWidth: 1, borderColor: `${Colors.warning}40`, padding: 11, borderRadius: 10, marginBottom: 10 },
  noticeText: { color: Colors.warning, fontSize: 12, flex: 1 },
  pendingEvent: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: `${Colors.happiness}44`, backgroundColor: `${Colors.happiness}12`, borderRadius: 12, padding: 12, marginBottom: 10 },
  pendingIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  pendingTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800' },
  pendingText: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  helper: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 10 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: `${Colors.happiness}18`, alignItems: 'center', justifyContent: 'center' },
  childAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: `${Colors.info}18`, alignItems: 'center', justifyContent: 'center' },
  name: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  meta: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 17 },
  moneyText: { color: Colors.primary, fontSize: 12, fontWeight: '700' },
  costText: { color: Colors.negative, fontSize: 12, fontWeight: '700' },
  unknownBox: { backgroundColor: Colors.elevated, borderRadius: 8, padding: 9, marginTop: 10 },
  unknownText: { color: Colors.textMuted, fontSize: 11 },
  progressLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 12 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.elevated, overflow: 'hidden', marginTop: 5 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: Colors.happiness },
  traits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  trait: { backgroundColor: `${Colors.info}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  traitText: { color: Colors.info, fontSize: 11, fontWeight: '600' },
  traitUnknown: { backgroundColor: Colors.elevated, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  traitUnknownText: { color: Colors.textMuted, fontSize: 11 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  miniStat: { width: '48%', backgroundColor: Colors.elevated, borderRadius: 9, padding: 8 },
  miniLabel: { color: Colors.textMuted, fontSize: 10, textTransform: 'uppercase', fontWeight: '700' },
  miniValue: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700', marginTop: 2 },
  financeBox: { backgroundColor: `${Colors.primary}0D`, borderWidth: 1, borderColor: `${Colors.primary}33`, borderRadius: 10, padding: 10, marginTop: 10 },
  financeTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 5 },
  agreementHelp: { color: Colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 5 },
  actionGrid: { flexDirection: 'row', gap: 8 },
  actionTile: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  actionTileText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700' },
  dateArea: { marginTop: 12 },
  dateLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  dateRow: { flexDirection: 'row', gap: 7 },
  dateButton: { flex: 1, minHeight: 64, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, alignItems: 'center', justifyContent: 'center', padding: 6 },
  dateButtonText: { color: Colors.textPrimary, fontSize: 11, fontWeight: '700', marginTop: 2 },
  dateCost: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  disabled: { opacity: 0.35 },
  majorBox: { marginTop: 14, padding: 11, borderRadius: 10, backgroundColor: `${Colors.happiness}0C`, borderWidth: 1, borderColor: `${Colors.happiness}22` },
  majorTitle: { color: Colors.textPrimary, fontWeight: '800', fontSize: 14 },
  threeRow: { flexDirection: 'row', gap: 7, marginTop: 8 },
  compactButton: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 7, alignItems: 'center', justifyContent: 'center' },
  compactTitle: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  weddingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 10, marginTop: 7 },
  familyProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.elevated, borderRadius: 9, padding: 10, marginTop: 8 },
  obligationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  smallAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  divorceBox: { marginTop: 14, padding: 11, borderRadius: 10, borderWidth: 1, borderColor: `${Colors.negative}44`, backgroundColor: `${Colors.negative}0B` },
  divorceTitle: { color: Colors.negative, fontSize: 13, fontWeight: '800' },
  dangerButton: { borderWidth: 1, borderColor: Colors.negative, borderRadius: 9, minHeight: 42, alignItems: 'center', justifyContent: 'center', marginTop: 9 },
  dangerButtonText: { color: Colors.negative, fontSize: 12, fontWeight: '800' },
  dangerLink: { alignItems: 'center', paddingVertical: 11, marginTop: 9 },
  dangerText: { color: Colors.negative, fontSize: 12, fontWeight: '700' },
  taxInfoBox: { backgroundColor: `${Colors.warning}10`, borderRadius: 9, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: `${Colors.warning}28` },
  estateOptionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  estateChoice: { flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  estateStructureList: { gap: 7 },
  estateStructureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 10 },
  estateStructureSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  successorList: { gap: 7 },
  successorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 9, padding: 10 },
  successorSelected: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}10` },
  familyTreeLink: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  familyTreeIcon: { width: 42, height: 42, borderRadius: 10, backgroundColor: `${Colors.info}14`, alignItems: 'center', justifyContent: 'center' },
  childTraits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  childTraitChip: { backgroundColor: `${Colors.info}12`, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4 },
  childTraitText: { color: Colors.info, fontSize: 10, fontWeight: '700' },
  childTimeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: `${Colors.happiness}55`, borderRadius: 9, paddingVertical: 9, marginTop: 10 },
  childTimeText: { color: Colors.happiness, fontSize: 12, fontWeight: '700' },
  adultHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  potentialBadge: { minWidth: 58, alignItems: 'center', backgroundColor: `${Colors.primary}12`, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 8 },
  potentialScore: { color: Colors.primary, fontSize: 16, fontWeight: '900' },
  potentialLabel: { color: Colors.textSecondary, fontSize: 9, fontWeight: '700' },
  descendantList: { marginTop: 7, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.cardBorder },
  descendantText: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  goalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  historyDate: { color: Colors.textMuted, fontSize: 11, width: 52 },
  historyText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
});
