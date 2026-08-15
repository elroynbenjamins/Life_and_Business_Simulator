import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import ProgressBar from '../../src/components/ProgressBar';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { inflated } from '../../src/engine/economyEngine';
import { meetsExperienceRequirement } from '../../src/engine/educationEngine';
import coursesData from '../../src/data/courses.json';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { loadRewardedAd, showRewardedAd } from '../../src/services/adManager';

const CATEGORIES = ['Sales', 'Administration', 'Finance', 'Marketing', 'Technology'];
const CATEGORY_ICONS: Record<string, string> = {
  Sales: 'cart',
  Administration: 'briefcase',
  Finance: 'calculator',
  Marketing: 'megaphone',
  Technology: 'code-slash',
};

export default function EducationScreen() {
  const cash = useGameStore((s) => s?.cash ?? 0);
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const courseWeeksCompleted = useGameStore((s) => s?.courseWeeksCompleted ?? 0);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const enrollCourse = useGameStore((s) => s?.enrollCourse);
  const speedUpEducationWithAd = useGameStore((s) => s?.speedUpEducationWithAd);
  const [adMessage, setAdMessage] = useState('');
  const [simulatedAdReady, setSimulatedAdReady] = useState(false);
  const [simulatedAdPlaying, setSimulatedAdPlaying] = useState(false);
  const weeksEmployed = useGameStore((s) => s?.statistics?.weeksEmployed ?? 0);
  const partTimeJob = useGameStore((s) => (s as any)?.partTimeJob ?? false);
  const adsRemoved = useGameStore((s) => s.profile?.adsRemoved ?? false);

  const completedIds = new Set(completedCourses.map((c) => c?.courseId));
  const currentCourse = currentCourseId
    ? (coursesData as any[]).find((c) => c?.id === currentCourseId)
    : null;

  const speedUp = async () => {
    setAdMessage('Loading advertisement...');
    const grant = () => { speedUpEducationWithAd?.(); setAdMessage('Education completed!'); };
    if (Platform.OS === 'web' || Constants.expoGoConfig != null) {
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
    const loaded = await loadRewardedAd('education');
    if (!loaded) { setAdMessage('Ad unavailable. Please try again later.'); return; }
    if (!(await showRewardedAd(grant))) setAdMessage('No reward earned. Watch the complete ad to finish your education.');
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Education</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current Course */}
        {currentCourse ? (
          <GameCard style={styles.currentCard}>
            <Text style={styles.currentLabel}>Currently Studying</Text>
            <Text style={styles.currentTitle}>{currentCourse.name}</Text>
            <Text style={styles.currentCategory}>{currentCourse.category} • Level {currentCourse.level}</Text>
            {(() => {
              const adjDur = partTimeJob ? Math.ceil((currentCourse.duration ?? 1) * 1.5) : (currentCourse.duration ?? 1);
              return (<>
                <ProgressBar progress={courseWeeksCompleted / adjDur} />
                <Text style={styles.progressText}>Week {courseWeeksCompleted}/{adjDur}{partTimeJob ? ' (slower — part-time)' : ''}</Text>
                {!adsRemoved && <Pressable style={[styles.adButton, simulatedAdPlaying && { opacity: 0.55 }]} onPress={speedUp} disabled={simulatedAdPlaying}>
                  <Ionicons name="play-circle" size={18} color={Colors.white} />
                  <Text style={styles.enrollBtnText}>{simulatedAdReady ? 'Claim reward: complete education' : simulatedAdPlaying ? 'Watching ad...' : 'Watch ad: complete education'}</Text>
                </Pressable>}
                {!!adMessage && <Text style={styles.adMessage}>{adMessage}</Text>}
              </>);
            })()}
            {/* Show what you'll learn */}
            {(currentCourse.skillRewards || currentCourse.knowledgeRewards) && (
              <View style={styles.rewardsPreview}>
                <Text style={styles.rewardsLabel}>On completion you'll gain:</Text>
                {Object.entries(currentCourse.skillRewards ?? {}).map(([k, v]) => (
                  <Text key={k} style={styles.rewardItem}>⭐ +{v as number} {k.replace(/_/g, ' ')}</Text>
                ))}
                {Object.entries(currentCourse.knowledgeRewards ?? {}).map(([k, v]) => (
                  <Text key={k} style={[styles.rewardItem, { color: '#3B82F6' }]}>📚 +{v as number} {k.replace(/_/g, ' ')}</Text>
                ))}
              </View>
            )}
          </GameCard>
        ) : (
          <GameCard style={styles.currentCard}>
            <Text style={styles.currentLabel}>Not Studying</Text>
            <Text style={styles.hint}>Enroll in a course below to build skills and advance your career.</Text>
          </GameCard>
        )}

        {/* Completed Courses */}
        {completedCourses.length > 0 && (
          <GameCard style={styles.completedCard}>
            <Text style={styles.completedTitle}>✅ {completedCourses.length} Course{completedCourses.length !== 1 ? 's' : ''} Completed</Text>
            {completedCourses.map((c) => (
              <Text key={c.courseId} style={styles.completedItem}>• {c.name}</Text>
            ))}
          </GameCard>
        )}

        {/* Course Categories */}
        {CATEGORIES.map((cat) => {
          const courses = groupedCourses[cat] ?? [];
          if (courses.length === 0) return null;
          return (
            <View key={cat}>
              <View style={styles.catHeader}>
                <Ionicons name={(CATEGORY_ICONS[cat] ?? 'school') as any} size={18} color={Colors.primary} />
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

                return (
                  <GameCard key={course.id} style={[styles.courseCard, isDone && styles.courseDone]}>
                    <View style={styles.courseRow}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.courseTitleRow}>
                          <Text style={[styles.courseName, isDone && styles.courseDoneText]}>{course.name}</Text>
                          <Text style={styles.courseLevel}>Lvl {course.level}</Text>
                        </View>
                        <Text style={styles.courseDuration}>{course.duration} weeks • {cost > 0 ? formatCurrency(cost) : 'Free'}{course.weeklyCost > 0 ? ` + ${formatCurrency(course.weeklyCost)}/wk` : ''}{!hasExp ? ` • Requires ${course.level === 2 ? 75 : 150}wks exp` : ''}</Text>
                        {/* Skill/Knowledge rewards */}
                        <View style={styles.rewardTags}>
                          {Object.entries(course.skillRewards ?? {}).map(([k, v]) => (
                            <Text key={k} style={styles.rewardTag}>+{v as number} {k.replace(/_/g, ' ')}</Text>
                          ))}
                          {Object.entries(course.knowledgeRewards ?? {}).map(([k, v]) => (
                            <Text key={k} style={[styles.rewardTag, styles.knowledgeTag]}>+{v as number} {k.replace(/_/g, ' ')}</Text>
                          ))}
                        </View>
                      </View>
                      <View style={styles.courseRight}>
                        {isDone ? (
                          <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                        ) : isCurrent ? (
                          <Text style={styles.studyingBadge}>Studying</Text>
                        ) : canEnroll ? (
                          <Pressable style={styles.enrollBtn} onPress={() => enrollCourse?.(course.id)}>
                            <Text style={styles.enrollBtnText}>Enroll</Text>
                          </Pressable>
                        ) : !hasPrereq ? (
                          <Text style={styles.lockText}>🔒 Prereq</Text>
                        ) : !hasExp ? (
                          <Text style={styles.lockText}>🔒 Need exp</Text>
                        ) : !canAfford ? (
                          <Text style={styles.lockText}>Can't afford</Text>
                        ) : null}
                      </View>
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
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  currentCard: { marginBottom: 16 },
  currentLabel: { color: Colors.textSecondary, fontSize: 12, marginBottom: 4 },
  currentTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  currentCategory: { color: Colors.textSecondary, fontSize: 13, marginBottom: 8 },
  progressText: { color: Colors.textSecondary, fontSize: 12, marginTop: 6, textAlign: 'right' },
  rewardsPreview: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 8 },
  rewardsLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  rewardItem: { color: Colors.primary, fontSize: 12, marginTop: 2 },
  hint: { color: Colors.textMuted, fontSize: 13 },
  completedCard: { marginBottom: 16, borderColor: Colors.primary, borderWidth: 1 },
  completedTitle: { color: Colors.primary, fontSize: 15, fontWeight: '600', marginBottom: 8 },
  completedItem: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
  catTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  courseCard: { marginBottom: 8 },
  courseDone: { opacity: 0.6 },
  courseRow: { flexDirection: 'row', alignItems: 'center' },
  courseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  courseDoneText: { textDecorationLine: 'line-through' },
  courseLevel: { color: Colors.textMuted, fontSize: 11, backgroundColor: Colors.cardBorder, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  courseDuration: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  rewardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  rewardTag: { color: '#F59E0B', fontSize: 10, backgroundColor: '#F59E0B15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  knowledgeTag: { color: '#3B82F6', backgroundColor: '#3B82F615' },
  courseRight: { marginLeft: 12, alignItems: 'center' },
  enrollBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  enrollBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  studyingBadge: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
  adButton: { marginTop: 10, backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
  adMessage: { color: Colors.textSecondary, textAlign: 'center', marginTop: 6, fontSize: 12 },
  lockText: { color: Colors.textMuted, fontSize: 11 },
});
