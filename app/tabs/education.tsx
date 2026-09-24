import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import ScreenHeader from '../../src/components/ScreenHeader';
import ProgressBar from '../../src/components/ProgressBar';
import GameButton from '../../src/components/GameButton';
import StatusPill from '../../src/components/StatusPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { inflated } from '../../src/engine/economyEngine';
import { meetsExperienceRequirement } from '../../src/engine/educationEngine';
import coursesData from '../../src/data/courses.json';
import { loadRewardedAd, showRewardedAd } from '../../src/services/adManager';
import { shouldSimulateNativeFeatures } from '../../src/services/runtimeEnvironment';
import { disciplineImages } from '../../src/assets/progressionImages';
import { getEducationAvailabilityNotice } from '../../src/engine/playerNotificationEngine';
import { getStudentStudyDuration, getStudentWorkOption, getStudentWorkTier } from '../../src/engine/studentWork';

const CATEGORIES = ['Sales', 'Administration', 'Finance', 'Marketing', 'Technology', 'Healthcare', 'Legal', 'Logistics', 'Hospitality'];
const CATEGORY_ICONS: Record<string, string> = {
  Sales: 'cart',
  Administration: 'briefcase',
  Finance: 'calculator',
  Marketing: 'megaphone',
  Technology: 'code-slash',
  Healthcare: 'medkit',
  Legal: 'document-text',
  Logistics: 'cube',
  Hospitality: 'bed',
};

function levelAccent(level: number): string {
  if (level >= 3) return Colors.premium;
  if (level >= 2) return Colors.education;
  return Colors.primary;
}

function levelLabel(level: number): string {
  if (level >= 3) return 'Expert';
  if (level >= 2) return 'Advanced';
  return 'Basics';
}

export default function EducationScreen() {
  const cash = useGameStore((s) => s?.cash ?? 0);
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const courseWeeksCompleted = useGameStore((s) => s?.courseWeeksCompleted ?? 0);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const enrollCourse = useGameStore((s) => s?.enrollCourse);
  const speedUpEducationWithAd = useGameStore((s) => s?.speedUpEducationWithAd);
  const getAdFreeEducationRewardUsage = useGameStore((s) => s.getAdFreeEducationRewardUsage);
  const claimAdFreeEducationReward = useGameStore((s) => s.claimAdFreeEducationReward);
  const [adMessage, setAdMessage] = useState('');
  const [simulatedAdReady, setSimulatedAdReady] = useState(false);
  const [simulatedAdPlaying, setSimulatedAdPlaying] = useState(false);
  const [nativeAdPhase, setNativeAdPhase] = useState<'idle' | 'loading' | 'showing'>('idle');
  const [courseLevel, setCourseLevel] = useState<1 | 2 | 3>(1);
  const [showCompleted, setShowCompleted] = useState(false);
  const weeksEmployed = useGameStore((s) => s?.statistics?.weeksEmployed ?? 0);
  const partTimeJob = useGameStore((s) => s?.partTimeJob ?? false);
  const studentWorkTier = useGameStore((s) => s?.studentWorkTier ?? null);
  const studentWork = getStudentWorkOption(getStudentWorkTier({ partTimeJob, studentWorkTier }));
  const adsRemoved = useGameStore((s) => s.profile?.adsRemoved ?? false);
  const adFreeEducationReward = getAdFreeEducationRewardUsage();
  const educationNotice = getEducationAvailabilityNotice({
    currentCourseId: currentCourseId ?? null,
    completedCourses,
    weeksEmployed,
    cash,
    inflationMultiplier,
  });

  const completedIds = new Set(completedCourses.map((c) => c?.courseId));
  const currentCourse = currentCourseId
    ? (coursesData as any[]).find((c) => c?.id === currentCourseId)
    : null;

  const speedUp = async () => {
    if (adsRemoved) {
      const claimed = claimAdFreeEducationReward();
      setAdMessage(claimed
        ? 'Daily ad-free education boost claimed.'
        : 'Today’s ad-free education boost has already been used.');
      return;
    }

    const grant = () => { speedUpEducationWithAd?.(); setAdMessage('Education completed!'); };
    if (shouldSimulateNativeFeatures()) {
      if (simulatedAdReady) {
        setSimulatedAdReady(false);
        grant();
        return;
      }
      if (simulatedAdPlaying) return;
      setSimulatedAdPlaying(true);
      setAdMessage('Simulated ad playing — watch until the reward becomes available.');
      setTimeout(() => {
        setSimulatedAdPlaying(false);
        setSimulatedAdReady(true);
        setAdMessage('Ad watched. Tap the reward button to complete your education.');
      }, 5000);
      return;
    }

    if (nativeAdPhase !== 'idle') return;
    setNativeAdPhase('loading');
    setAdMessage('Loading advertisement...');
    try {
      const loaded = await loadRewardedAd('education');
      if (!loaded) {
        setAdMessage('Ad unavailable or another rewarded ad is already active. Please try again.');
        return;
      }
      setNativeAdPhase('showing');
      setAdMessage('Advertisement is playing...');
      if (!(await showRewardedAd(grant))) {
        setAdMessage('No reward earned. Watch the complete ad to finish your education.');
      }
    } finally {
      setNativeAdPhase('idle');
    }
  };

  const groupedCourses: Record<string, any[]> = {};
  for (const cat of CATEGORIES) groupedCourses[cat] = [];
  for (const course of coursesData as any[]) {
    const cat = course.category ?? 'Other';
    if (!groupedCourses[cat]) groupedCourses[cat] = [];
    groupedCourses[cat].push(course);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Education"
        subtitle="Build skills and unlock career paths"
        accentColor={Colors.education}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {educationNotice.available && (
          <GameCard
            variant="attention"
            eyebrow="NEW EDUCATION AVAILABLE"
            title={educationNotice.courseName ?? 'New course unlocked'}
            accentColor={educationNotice.level === 3 ? Colors.premium : Colors.education}
            titleAccessory={(
              <StatusPill
                compact
                icon="sparkles-outline"
                label={educationNotice.level === 3 ? 'Expert' : 'Advanced'}
                color={educationNotice.level === 3 ? Colors.premium : Colors.education}
              />
            )}
          >
            <Text style={styles.noticeText}>
              You now meet the requirements and have enough cash to start this course.
            </Text>
          </GameCard>
        )}

        {currentCourse ? (() => {
          const adjDur = getStudentStudyDuration((currentCourse.duration ?? 1), studentWork?.id ?? null);
          const remaining = Math.max(0, adjDur - courseWeeksCompleted);
          const accent = levelAccent(currentCourse.level ?? 1);
          const nativeAdBusy = nativeAdPhase !== 'idle';
          const rewardDisabled = simulatedAdPlaying || nativeAdBusy || (adsRemoved && !adFreeEducationReward.available);
          const rewardLabel = adsRemoved
            ? (adFreeEducationReward.available ? 'Claim Daily Instant Completion' : 'Daily Instant Completion Used')
            : nativeAdPhase === 'loading'
              ? 'Loading Ad...'
              : nativeAdPhase === 'showing'
                ? 'Ad Playing...'
                : simulatedAdReady
                  ? 'Claim Reward • Finish Education'
                  : simulatedAdPlaying
                    ? 'Watching Ad...'
                    : 'Watch Ad • Finish Education';

          return (
            <GameCard
              variant="hero"
              eyebrow="CURRENT EDUCATION"
              title={currentCourse.name}
              accentColor={accent}
              titleAccessory={(
                <StatusPill
                  compact
                  icon="school-outline"
                  label={levelLabel(currentCourse.level ?? 1)}
                  color={accent}
                />
              )}
            >
              <View style={styles.currentHeroRow}>
                <Image
                  source={disciplineImages[currentCourse.baseId] ?? disciplineImages[(currentCourse.category ?? '').toLowerCase()]}
                  style={styles.currentArtwork}
                  resizeMode="contain"
                  accessibilityLabel={`${currentCourse.name} pixel art`}
                />
                <View style={styles.currentHeroCopy}>
                  <Text style={styles.currentCategory}>{currentCourse.category}</Text>
                  <Text style={styles.currentRemaining}>
                    {remaining === 0 ? 'Completes next update' : `${remaining} week${remaining === 1 ? '' : 's'} remaining`}
                  </Text>
                  {studentWork && (
                    <StatusPill
                      compact
                      icon="briefcase-outline"
                      label={`${studentWork.shortName} • +${Math.round((studentWork.studyDurationMultiplier - 1) * 100)}% study time`}
                      color={Colors.warning}
                    />
                  )}
                </View>
              </View>

              <ProgressBar progress={courseWeeksCompleted / adjDur} color={accent} />
              <View style={styles.progressMeta}>
                <Text style={styles.progressText}>Week {courseWeeksCompleted} of {adjDur}</Text>
                <Text style={[styles.progressPercent, { color: accent }]}>
                  {Math.round(Math.max(0, Math.min(1, courseWeeksCompleted / Math.max(1, adjDur))) * 100)}%
                </Text>
              </View>

              <View style={styles.boostPanel}>
                <View style={styles.boostHeader}>
                  <View style={styles.boostIcon}>
                    <Ionicons name={adsRemoved ? 'gift-outline' : 'play-circle-outline'} size={18} color={Colors.education} />
                  </View>
                  <View style={styles.boostCopy}>
                    <Text style={styles.boostTitle}>Daily Education Boost</Text>
                    <Text style={styles.boostText}>
                      {adsRemoved
                        ? 'Remove Ads benefit • one instant completion per day across all save slots.'
                        : 'Optional rewarded ad • instantly completes the current education.'}
                    </Text>
                  </View>
                </View>
                <GameButton
                  accentColor={Colors.education}
                  icon={adsRemoved
                    ? 'gift-outline'
                    : nativeAdPhase !== 'idle'
                      ? 'hourglass-outline'
                      : simulatedAdReady
                        ? 'checkmark-circle-outline'
                        : 'play-circle'}
                  label={rewardLabel}
                  onPress={speedUp}
                  disabled={rewardDisabled}
                  style={styles.boostAction}
                />
                {!!adMessage && <Text style={styles.adMessage}>{adMessage}</Text>}
              </View>
            </GameCard>
          );
        })() : (
          <GameCard
            variant="subtle"
            eyebrow="CURRENT EDUCATION"
            title="Not studying"
            accentColor={Colors.education}
          >
            <View style={styles.emptyCurrentRow}>
              <View style={styles.emptyCurrentIcon}>
                <Ionicons name="school-outline" size={23} color={Colors.education} />
              </View>
              <Text style={styles.hint}>Choose a course below to build skills and unlock better career opportunities.</Text>
            </View>
          </GameCard>
        )}

        {completedCourses.length > 0 && (
          <GameCard variant="subtle" compact>
            <Pressable
              accessibilityRole="button"
              style={styles.completedHeader}
              onPress={() => setShowCompleted((value) => !value)}
            >
              <View style={styles.completedHeaderLeft}>
                <View style={styles.completedIcon}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                </View>
                <View>
                  <Text style={styles.completedTitle}>
                    {completedCourses.length} course{completedCourses.length === 1 ? '' : 's'} completed
                  </Text>
                  <Text style={styles.completedSubtitle}>Education history</Text>
                </View>
              </View>
              <Ionicons name={showCompleted ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </Pressable>
            {showCompleted && (
              <View style={styles.completedList}>
                {completedCourses.map((completed) => (
                  <View key={completed.courseId} style={styles.completedRow}>
                    <Ionicons name="checkmark" size={13} color={Colors.primary} />
                    <Text style={styles.completedItem}>{completed.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </GameCard>
        )}

        <View style={styles.levelTabs}>
          {([
            { level: 1, label: 'Basics', icon: 'leaf-outline' },
            { level: 2, label: 'Advanced', icon: 'school-outline' },
            { level: 3, label: 'Expert', icon: 'diamond-outline' },
          ] as const).map((tab) => {
            const accent = levelAccent(tab.level);
            const active = courseLevel === tab.level;
            return (
              <Pressable
                key={tab.level}
                style={[
                  styles.levelTab,
                  active && { borderColor: accent, backgroundColor: `${accent}14` },
                ]}
                onPress={() => setCourseLevel(tab.level)}
              >
                <Ionicons name={tab.icon} size={15} color={active ? accent : Colors.textMuted} />
                <Text style={[styles.levelTabText, active && { color: accent }]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.catalogHeader}>
          <View>
            <Text style={styles.catalogTitle}>{levelLabel(courseLevel)} Courses</Text>
            <Text style={styles.catalogSubtitle}>Choose a discipline to continue your progression.</Text>
          </View>
          <StatusPill
            compact
            label={`${(coursesData as any[]).filter((course) => course.level === courseLevel).length} courses`}
            color={levelAccent(courseLevel)}
          />
        </View>

        {CATEGORIES.map((cat) => {
          const courses = (groupedCourses[cat] ?? []).filter((course) => course.level === courseLevel);
          if (courses.length === 0) return null;
          const categoryAccent = levelAccent(courseLevel);

          return (
            <View key={cat}>
              <View style={styles.catHeader}>
                <View style={[styles.catIcon, { backgroundColor: `${categoryAccent}12`, borderColor: `${categoryAccent}33` }]}>
                  <Ionicons name={(CATEGORY_ICONS[cat] ?? 'school') as any} size={16} color={categoryAccent} />
                </View>
                <Text style={styles.catTitle}>{cat}</Text>
              </View>

              {courses.map((course: any) => {
                const isDone = completedIds.has(course.id);
                const isCurrent = currentCourseId === course.id;
                const hasPrereq = !course.prerequisite || completedIds.has(course.prerequisite);
                const hasExp = meetsExperienceRequirement(course.level, weeksEmployed);
                const cost = course.cost > 0 ? inflated(course.cost, inflationMultiplier) : 0;
                const canAfford = cost <= cash;
                const canEnroll = !currentCourseId && !isDone && hasPrereq && hasExp && canAfford;
                const accent = levelAccent(course.level);
                const displayDuration = getStudentStudyDuration(course.duration ?? 1, studentWork?.id ?? null);
                const requiredWeeks = course.level === 2 ? 75 : course.level >= 3 ? 150 : 0;
                const missingExperience = Math.max(0, requiredWeeks - weeksEmployed);
                const missingCash = Math.max(0, cost - cash);
                const prereq = course.prerequisite
                  ? (coursesData as any[]).find((item) => item.id === course.prerequisite)
                  : null;

                return (
                  <GameCard
                    key={course.id}
                    compact
                    variant={isDone ? 'subtle' : 'standard'}
                    style={[styles.courseCard, isDone && styles.courseDone]}
                  >
                    <View style={styles.courseRow}>
                      <View style={[styles.artworkWrap, { borderColor: `${accent}33`, backgroundColor: `${accent}0D` }]}>
                        <Image
                          source={disciplineImages[course.baseId] ?? disciplineImages[cat.toLowerCase()]}
                          style={[styles.courseArtwork, isDone && styles.courseArtworkDone]}
                          resizeMode="contain"
                          accessibilityLabel={`${course.name} pixel art`}
                        />
                      </View>

                      <View style={styles.courseCopy}>
                        <View style={styles.courseTitleRow}>
                          <Text style={[styles.courseName, isDone && styles.courseDoneText]} numberOfLines={2}>{course.name}</Text>
                          <StatusPill compact label={levelLabel(course.level)} color={accent} />
                        </View>
                        <View style={styles.courseMetaRow}>
                          <Text style={styles.courseMeta}>{displayDuration}w{studentWork ? ' with work' : ''}</Text>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.courseMeta}>{cost > 0 ? formatCurrency(cost) : 'Free'}</Text>
                          {course.weeklyCost > 0 && (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <Text style={styles.courseMeta}>{formatCurrency(course.weeklyCost)}/wk</Text>
                            </>
                          )}
                        </View>

                        <View style={styles.courseStatusRow}>
                          {isDone ? (
                            <StatusPill compact icon="checkmark-circle-outline" label="Completed" color={Colors.primary} />
                          ) : isCurrent ? (
                            <StatusPill compact icon="book-outline" label="Studying" color={accent} />
                          ) : !hasPrereq ? (
                            <StatusPill compact icon="lock-closed-outline" label={`Need ${prereq?.name ?? 'prerequisite'}`} color={Colors.warning} />
                          ) : !hasExp ? (
                            <StatusPill compact icon="time-outline" label={`Need ${missingExperience}w experience`} color={Colors.warning} />
                          ) : !canAfford ? (
                            <StatusPill compact icon="wallet-outline" label={`Need ${formatCurrency(missingCash)} more`} color={Colors.warning} />
                          ) : currentCourseId ? (
                            <StatusPill compact icon="hourglass-outline" label="Finish current course first" color={Colors.textMuted} />
                          ) : (
                            <StatusPill compact icon="checkmark-outline" label="Ready" color={Colors.primary} />
                          )}
                        </View>
                      </View>

                      {canEnroll && (
                        <GameButton
                          compact
                          accentColor={accent}
                          label="Enroll"
                          onPress={() => enrollCourse?.(course.id)}
                          style={styles.enrollButton}
                        />
                      )}
                    </View>
                  </GameCard>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  noticeText: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
  currentHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 13 },
  currentArtwork: { width: 64, height: 64 },
  currentHeroCopy: { flex: 1, minWidth: 0, gap: 4 },
  currentCategory: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  currentRemaining: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  progressPercent: { fontSize: 11, fontWeight: '900' },
  boostPanel: { marginTop: 13, paddingTop: 11, borderTopWidth: 1, borderTopColor: Colors.cardBorder },
  boostHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  boostIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: `${Colors.education}12`, borderWidth: 1, borderColor: `${Colors.education}33`, alignItems: 'center', justifyContent: 'center' },
  boostCopy: { flex: 1, minWidth: 0 },
  boostTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  boostText: { color: Colors.textMuted, fontSize: 10, lineHeight: 14, marginTop: 2 },
  boostAction: { minHeight: 46 },
  adMessage: { color: Colors.textSecondary, textAlign: 'center', marginTop: 6, fontSize: 10, lineHeight: 14 },
  emptyCurrentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emptyCurrentIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: `${Colors.education}12`, borderWidth: 1, borderColor: `${Colors.education}33`, alignItems: 'center', justifyContent: 'center' },
  hint: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  completedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  completedHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  completedIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: `${Colors.primary}12`, alignItems: 'center', justifyContent: 'center' },
  completedTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  completedSubtitle: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  completedList: { marginTop: 9, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.cardBorder, gap: 5 },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  completedItem: { flex: 1, color: Colors.textSecondary, fontSize: 11 },
  levelTabs: { flexDirection: 'row', gap: 7, marginTop: 4, marginBottom: 14 },
  levelTab: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 6 },
  levelTabText: { color: Colors.textSecondary, fontWeight: '800', fontSize: 11 },
  catalogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 },
  catalogTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900' },
  catalogSubtitle: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 15, marginBottom: 8 },
  catIcon: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  catTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  courseCard: { marginBottom: 8 },
  courseDone: { opacity: 0.65 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  artworkWrap: { width: 54, height: 54, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  courseArtwork: { width: 48, height: 48 },
  courseArtworkDone: { opacity: 0.55 },
  courseCopy: { flex: 1, minWidth: 0 },
  courseTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  courseName: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 16, fontWeight: '800' },
  courseDoneText: { color: Colors.textMuted },
  courseMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  courseMeta: { color: Colors.textSecondary, fontSize: 10, fontWeight: '600' },
  metaDot: { color: Colors.textMuted, fontSize: 8 },
  courseStatusRow: { marginTop: 6 },
  enrollButton: { minWidth: 66 },
});
