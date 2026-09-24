import ScrollView from '../../src/components/TutorialScrollView';
import { useTutorialHighlight } from '../../src/store/tutorialStore';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import GameCard from '../../src/components/GameCard';
import ProgressBar from '../../src/components/ProgressBar';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import { getCareerSalary, getCompaniesForPath, getCareerPath, getCompany } from '../../src/engine/careerEngine';
import { meetsPositionRequirements } from '../../src/engine/skillEngine';
import careerPathsData from '../../src/data/career_paths.json';
import companiesData from '../../src/data/companies.json';
import coursesData from '../../src/data/courses.json';
import { showGameDialog } from '../../src/components/GameDialog';
import { disciplineImages } from '../../src/assets/progressionImages';
import { getPromotionAssetNotice } from '../../src/engine/playerNotificationEngine';
import { getStudentWorkTier, STUDENT_WORK_OPTIONS } from '../../src/engine/studentWork';

export default function CareerScreen() {
  const career = useGameStore((s) => s?.career);
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const skills = useGameStore((s) => s?.skills ?? {});
  const knowledge = useGameStore((s) => s?.knowledge ?? {});
  const totalWeeksWorked = useGameStore((s) => s?.totalWeeksWorked ?? 0);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const currentHousingId = useGameStore((s) => s?.currentHousingId ?? 'cheap_apartment');
  const currentCarId = useGameStore((s) => s?.currentCarId ?? 'none');
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const careerHistory = useGameStore((s) => s?.careerHistory ?? []);
  const applyForCareerJob = useGameStore((s) => s?.applyForCareerJob);
  const quitCareerJob = useGameStore((s) => s?.quitCareerJob);
  // Legacy
  const applyForJob = useGameStore((s) => s?.applyForJob);
  const quitJob = useGameStore((s) => s?.quitJob);

  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const hasCareerV2 = !!career?.companyId;
  const isEmployed = hasCareerV2 || !!currentJobId;

  const currentCompany = career?.companyId ? getCompany(career.companyId) : null;
  const currentPath = career?.careerPathId ? getCareerPath(career.careerPathId) : null;
  const currentPosition = currentPath?.positions?.find((p: any) => p?.level === career?.positionLevel);
  const currentSalary = hasCareerV2 ? getCareerSalary(career!, inflationMultiplier) : 0;
  const promotionAssetNotice = getPromotionAssetNotice({
    career,
    completedCourses,
    currentCarId,
    currentHousingId,
  });

  // Get completed course base IDs for filtering available paths
  const completedBases = new Set(
    completedCourses.map((c) => {
      const cd = (coursesData as any[]).find((d) => d?.id === c.courseId);
      return cd?.baseId;
    }).filter(Boolean)
  );

  const confirmAction = (title: string, msg: string, action: () => void) => {
    showGameDialog({ title, message: msg, onConfirm: action, destructive: title === 'Quit Job' });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Career</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {promotionAssetNotice.blocked && (
          <GameCard>
            <Text style={[styles.currentLabel, { color: Colors.negative }]}>PROMOTION READY</Text>
            <Text style={styles.hint}>{promotionAssetNotice.message}</Text>
          </GameCard>
        )}
        {/* Current Position */}
        {hasCareerV2 ? (
          <GameCard style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current Position</Text>
            <Text style={styles.currentTitle}>{currentPosition?.title ?? 'Unknown'}</Text>
            <Text style={styles.currentCompany}>{currentPath?.name ?? ''}</Text>
            <Text style={styles.currentSalary}>{formatCurrency(currentSalary)}/week</Text>
            <View style={styles.perfRow}>
              <Text style={styles.perfLabel}>Performance</Text>
              <ProgressBar progress={(career?.performance ?? 50) / 100} />
              <Text style={styles.perfValue}>{Math.round(career?.performance ?? 50)}%</Text>
            </View>
            {/* Promotion Progress */}
            <View style={styles.perfRow}>
              <Text style={styles.perfLabel}>Promotion Progress</Text>
              <ProgressBar progress={(career?.promotionProgress ?? 0) / 100} color="#F59E0B" />
              <Text style={styles.perfValue}>{Math.round(career?.promotionProgress ?? 0)}%</Text>
            </View>
            <View style={styles.statsRow}>
              <Text style={styles.statItem}>📅 {career?.weeksInPosition ?? 0}w in role</Text>
              <Text style={styles.statItem}>🏢 {career?.weeksAtCompany ?? 0}w employed</Text>
              <Text style={styles.statItem}>🤝 Network: {Math.round(career?.networkingScore ?? 0)}</Text>
            </View>
            <Pressable style={styles.quitBtn} onPress={() => confirmAction('Quit Job', 'Are you sure?', () => quitCareerJob?.())}>
              <Text style={styles.quitBtnText}>Quit Job</Text>
            </Pressable>
          </GameCard>
        ) : currentJobId ? (
          <GameCard style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current Position (Legacy)</Text>
            <Text style={styles.currentTitle}>{currentJobId}</Text>
            <Text style={styles.hint}>Apply for a career position below to use the new career system.</Text>
            <Pressable style={styles.quitBtn} onPress={() => quitJob?.()}>
              <Text style={styles.quitBtnText}>Quit Job</Text>
            </Pressable>
          </GameCard>
        ) : (
          <GameCard style={styles.currentCard}>
            <Text style={styles.currentLabel}>Unemployed</Text>
            <Text style={styles.hint}>Complete a course to unlock a career path, then apply below.</Text>
          </GameCard>
        )}

        {/* Part-Time Job */}
        <PartTimeCard />

        {/* Career Paths */}
        <Text style={styles.sectionTitle}>Career Paths</Text>
        {(careerPathsData as any[]).map((path) => {
          const hasBase = completedBases.has(path.requiredCourseBase);
          const companies = getCompaniesForPath(path.id);
          const isSelected = selectedPath === path.id;

          return (
            <GameCard key={path.id} style={[styles.pathCard, !hasBase && styles.lockedCard]}>
              <Pressable onPress={() => hasBase && setSelectedPath(isSelected ? null : path.id)}>
                <View style={styles.pathHeader}>
                  <Image source={disciplineImages[path.requiredCourseBase]} style={[styles.pathArtwork, !hasBase && styles.lockedArtwork]} resizeMode="contain" accessibilityLabel={`${path.name} pixel art`} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pathName, !hasBase && styles.lockedText]}>{path.name}</Text>
                    <Text style={styles.pathLevels}>{path.positions.length} career levels</Text>
                  </View>
                  {hasBase ? (
                    <Ionicons name={isSelected ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
                  ) : (
                    <Text style={styles.lockBadge}>🔒 Need {path.requiredCourseBase} course</Text>
                  )}
                </View>
              </Pressable>

              {isSelected && hasBase && (
                <View style={styles.pathDetails}>
                  {/* Positions */}
                  <Text style={styles.subTitle}>Positions</Text>
                  {(path.positions as any[]).map((pos: any) => {
                    const meets = meetsPositionRequirements(pos, knowledge, skills, totalWeeksWorked);
                    const reachedInCurrentCareer = career?.careerPathId === path.id && (career?.positionLevel ?? 0) >= pos.level;
                    const isCurrentPosition = career?.careerPathId === path.id && career?.positionLevel === pos.level;
                    const reqCourseLvl = pos.level >= 5 ? 3 : pos.level >= 3 ? 2 : 1;
                    const carLabel = pos.level >= 5 ? 'SUV+' : pos.level >= 3 ? 'Sedan+' : 'Used Car+';
                    const housingLabel = pos.level >= 7 ? 'Luxury Villa+' : pos.level >= 6 ? 'Family House+' : pos.level >= 5 ? 'Small House+' : pos.level >= 3 ? 'Studio Apartment+' : 'Any Housing';
                    const housingTiers: Record<string, number> = { cheap_apartment: 0, studio_apartment: 1, small_house: 2, family_house: 3, luxury_villa: 4, mansion: 5 };
                    const requiredHousingTier = pos.level >= 7 ? 4 : pos.level >= 6 ? 3 : pos.level >= 5 ? 2 : pos.level >= 3 ? 1 : 0;
                    const hasLevelHousing = (housingTiers[currentHousingId] ?? 0) >= requiredHousingTier;
                    const hasLevelCourse = completedCourses.some(completed => (coursesData as any[]).some(course => course.id === completed.courseId && course.baseId === path.requiredCourseBase && course.level >= reqCourseLvl));
                    const carTiers: Record<string, number> = { none: 0, used_car: 1, sedan: 2, suv: 3, sports_car: 4, luxury_car: 5 };
                    const hasLevelCar = (carTiers[currentCarId ?? 'none'] ?? 0) >= (pos.level >= 5 ? 3 : pos.level >= 3 ? 2 : 1);
                    const requirementsMet = hasLevelCourse && hasLevelCar && hasLevelHousing;
                    const reqParts: string[] = [];
                    const humanize = (key: string) => key.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    Object.entries(pos.reqSkills ?? {}).forEach(([k, v]) => reqParts.push(`${humanize(k)} ${v}`));
                    Object.entries(pos.reqKnowledge ?? {}).forEach(([k, v]) => reqParts.push(`${humanize(k)} ${v}`));
                    return (
                      <View key={pos.level} style={styles.positionRow}>
                        <Text style={[styles.posLevel, (requirementsMet || reachedInCurrentCareer) && { color: Colors.primary }]}>L{pos.level}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.posTitle}>{pos.title}{isCurrentPosition ? ' • Current' : ''}</Text>
                          <Text style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                            Course lvl {reqCourseLvl} · {carLabel} · Housing: {housingLabel}
                          </Text>
                          {!hasLevelCourse && !reachedInCurrentCareer && <Text style={{ color: Colors.warning, fontSize: 11, marginTop: 2 }}>Required education not completed</Text>}
                          {!hasLevelHousing && !reachedInCurrentCareer && pos.level >= 3 && (
                            <Text style={{ color: Colors.warning, fontSize: 11, marginTop: 2 }}>Housing requirement not met</Text>
                          )}
                        </View>
                        {requirementsMet || reachedInCurrentCareer ? (
                          <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                        ) : (
                          <Ionicons name="lock-closed" size={16} color={Colors.textMuted} />
                        )}
                      </View>
                    );
                  })}

                  {/* Companies */}
                  <Text style={[styles.subTitle, { marginTop: 12 }]}>Career Application</Text>
                  {companies.map((company: any) => {
                    // Re-applying after resigning should restore the highest position
                    // previously reached in this career path, rather than forcing the
                    // player to start at level 1 again. History stores the path and
                    // level in the legacy job id: company_path_level.
                    const highestReachedLevel = (careerHistory ?? []).reduce((highest, entry: any) => {
                      const match = String(entry?.jobId ?? '').match(new RegExp(`_${path.id}_(\\d+)$`));
                      const historyLevel = match ? Number(match[1]) : 0;
                      return historyLevel > 0 ? Math.max(highest, historyLevel) : highest;
                    }, 0);
                    const entryPos = (path.positions as any[]).find((position: any) => position.level === Math.max(1, highestReachedLevel))
                      ?? (path.positions as any[])[0];
                    const meetsEntry = meetsPositionRequirements(entryPos, knowledge, skills, totalWeeksWorked);
                    const isCurrentCompany = career?.companyId === company.id && career?.careerPathId === path.id;

                    // Check car requirement
                    const CAR_TIER: Record<string, number> = { none: 0, used_car: 1, sedan: 2, suv: 3, sports_car: 4, luxury_car: 5 };
                    const currentCarTier = CAR_TIER[useGameStore.getState()?.currentCarId ?? 'none'] ?? 0;
                    const minCarTier = entryPos.level >= 5 ? 3 : entryPos.level >= 3 ? 2 : 1;
                    const hasCar = currentCarTier >= minCarTier;
                    const HOUSING_TIER: Record<string, number> = { cheap_apartment: 0, studio_apartment: 1, small_house: 2, family_house: 3, luxury_villa: 4, mansion: 5 };
                    const minHousingTier = entryPos.level >= 7 ? 4 : entryPos.level >= 6 ? 3 : entryPos.level >= 5 ? 2 : entryPos.level >= 3 ? 1 : 0;
                    const hasHousing = (HOUSING_TIER[currentHousingId] ?? 0) >= minHousingTier;

                    // Check course level
                    const reqCourseLvl = entryPos.level >= 5 ? 3 : entryPos.level >= 3 ? 2 : 1;
                    const hasCourse = (completedCourses ?? []).some((c) => {
                      const cd = (coursesData as any[]).find((x) => x?.id === c.courseId);
                      return cd?.baseId === path.requiredCourseBase && (cd?.level ?? 1) >= reqCourseLvl;
                    });

                    // Check not studying level 1 course
                    const studyingBasic = (() => {
                      const ccId = useGameStore.getState()?.currentCourseId;
                      if (!ccId) return false;
                      const cc = (coursesData as any[]).find((c) => c?.id === ccId);
                      return (cc?.level ?? 1) === 1;
                    })();

                    const canApply = meetsEntry && hasCar && hasHousing && hasCourse && !studyingBasic;
                    const blockReason = !hasCourse ? `Need ${path.requiredCourseBase} course (lvl ${reqCourseLvl})`
                      : !hasCar ? `Need ${minCarTier >= 3 ? 'an SUV' : minCarTier >= 2 ? 'a Sedan' : 'a car'} first`
                      : !hasHousing ? `Need ${minHousingTier >= 4 ? 'a Luxury Villa' : minHousingTier >= 3 ? 'a Family House' : minHousingTier >= 2 ? 'a Small House' : 'a Studio Apartment'} first`
                      : studyingBasic ? 'Finish basic course first'
                      : !meetsEntry ? 'Skills too low' : '';

                    return (
                      <View key={company.id} style={styles.companyRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.companyName}>{path.name}</Text>
                          <Text style={styles.companyIndustry}>Standard career position</Text>
                          {!canApply && blockReason ? (
                            <Text style={{ color: Colors.negative, fontSize: 11, marginTop: 2 }}>⚠ {blockReason}</Text>
                          ) : null}
                        </View>
                        {isCurrentCompany ? (
                          <View style={styles.currentBadge}><Text style={styles.currentBadgeText}>Current</Text></View>
                        ) : canApply && !isEmployed ? (
                          <Pressable
                            style={styles.applyBtn}
                            onPress={() => applyForCareerJob?.(company.id, path.id, entryPos.level)}
                          >
                            <Text style={styles.applyBtnText}>Apply</Text>
                          </Pressable>
                        ) : canApply && isEmployed ? (
                          <Pressable
                            style={[styles.applyBtn, { backgroundColor: '#F59E0B' }]}
                            onPress={() => confirmAction('Switch Jobs', `Leave your current position for ${path.name}?`, () => {
                              if (hasCareerV2) quitCareerJob?.();
                              else quitJob?.();
                              setTimeout(() => applyForCareerJob?.(company.id, path.id, entryPos.level), 100);
                            })}
                          >
                            <Text style={styles.applyBtnText}>Switch</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </GameCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function PartTimeCard() {
  const partTimeJob = useGameStore((s) => s?.partTimeJob ?? false);
  const studentWorkTier = useGameStore((s) => s?.studentWorkTier ?? null);
  const setStudentWorkTier = useGameStore((s) => s?.setStudentWorkTier);
  const hasCareerV2 = !!useGameStore((s) => s?.career?.companyId);
  const hasLegacyJob = !!useGameStore((s) => s?.currentJobId);
  const hasFullTimeJob = hasCareerV2 || hasLegacyJob;
  const activeTier = getStudentWorkTier({ partTimeJob, studentWorkTier });
  const guidedWork = useTutorialHighlight('career.studentWork', hasFullTimeJob);

  return (
    <GameCard tutorialId={hasFullTimeJob ? undefined : 'career.studentWork'}>
      <Text style={{ color: Colors.textPrimary, fontSize: 16, fontWeight: '800' }}>Student Work</Text>
      <Text style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3, marginBottom: 10 }}>
        Both options are tax-free and end automatically when you start a full-time career. More work means more income, but less time to study.
      </Text>

      {(['flexible', 'high_hours'] as const).map((tier) => {
        const option = STUDENT_WORK_OPTIONS[tier];
        const active = activeTier === tier;
        return (
          <View key={tier} style={{ marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.cardBorder }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: Colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                  {tier === 'flexible' ? '🕒' : '💼'} {option.name}
                </Text>
                <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 3 }}>
                  €{option.minWeeklyIncome}–{option.maxWeeklyIncome}/week • Tax-free
                </Text>
                <Text style={{ color: Colors.warning, fontSize: 11, marginTop: 2 }}>
                  Study duration +{Math.round((option.studyDurationMultiplier - 1) * 100)}%
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 3 }}>{option.description}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${active ? 'Quit' : 'Start'} ${option.name}`}
                accessibilityState={{ disabled: hasFullTimeJob }}
                accessibilityHint={guidedWork ? 'Optional student-work choice. Compare income and study time before choosing.' : undefined}
                testID={`student-work-${tier}`}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: guidedWork ? Colors.warning : 'transparent',
                  backgroundColor: hasFullTimeJob ? Colors.textMuted : active ? Colors.negative : Colors.primary,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 8,
                  opacity: hasFullTimeJob ? 0.55 : 1,
                }}
                onPress={() => setStudentWorkTier?.(active ? null : tier)}
                disabled={hasFullTimeJob}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {hasFullTimeJob ? 'Unavailable' : active ? 'Quit' : 'Start'}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {hasFullTimeJob && <Text style={{ color: Colors.warning, fontSize: 11, marginTop: 9 }}>Student work is unavailable while working a full-time career.</Text>}
    </GameCard>
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
  currentTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700' },
  currentCompany: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  currentSalary: { color: Colors.primary, fontSize: 20, fontWeight: '700', marginTop: 8 },
  hint: { color: Colors.textMuted, fontSize: 13, marginTop: 8 },
  perfRow: { marginTop: 12, gap: 4 },
  perfLabel: { color: Colors.textSecondary, fontSize: 12 },
  perfValue: { color: Colors.textSecondary, fontSize: 12, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  statItem: { color: Colors.textMuted, fontSize: 12, backgroundColor: Colors.card, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  quitBtn: { marginTop: 12, backgroundColor: Colors.negative + '20', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  quitBtnText: { color: Colors.negative, fontSize: 14, fontWeight: '600' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  pathCard: { marginBottom: 12 },
  lockedCard: { opacity: 0.5 },
  pathHeader: { flexDirection: 'row', alignItems: 'center' },
  pathArtwork: { width: 58, height: 58, marginRight: 10 },
  lockedArtwork: { opacity: 0.35 },
  pathName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  lockedText: { color: Colors.textMuted },
  pathLevels: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  lockBadge: { color: Colors.textMuted, fontSize: 11 },
  pathDetails: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 12 },
  subTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  positionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  posLevel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', width: 28 },
  posTitle: { color: Colors.textPrimary, fontSize: 14 },
  posSalary: { color: Colors.textSecondary, fontSize: 11 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  companyName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  companyIndustry: { color: Colors.textMuted, fontSize: 12 },
  companySalary: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 },
  applyBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  applyBtnText: { color: Colors.white, fontSize: 13, fontWeight: '700' },
  currentBadge: { backgroundColor: Colors.primary + '20', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  currentBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
});
