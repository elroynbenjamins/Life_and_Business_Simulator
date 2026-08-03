import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import StatusPill from '../../src/components/StatusPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import jobsData from '../../src/data/jobs.json';
import coursesData from '../../src/data/courses.json';

export default function CareerScreen() {
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const totalWeeksWorked = useGameStore((s) => s?.totalWeeksWorked ?? 0);
  const currentCarId = useGameStore((s) => s?.currentCarId ?? 'none');
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const applyForJob = useGameStore((s) => s?.applyForJob);
  const quitJob = useGameStore((s) => s?.quitJob);

  const currentJob = (jobsData ?? []).find((j) => j?.id === currentJobId);
  const hasCar = currentCarId !== 'none';

  // Check if studying level 1 course
  const studyingBasicCourse = currentCourseId
    ? ((coursesData ?? []).find((c) => c?.id === currentCourseId)?.level ?? 1) === 1
    : false;

  // Group jobs by baseId
  const groups: Record<string, typeof jobsData> = {};
  for (const job of jobsData ?? []) {
    const base = job?.baseId ?? '';
    if (!groups[base]) groups[base] = [];
    groups[base].push(job);
  }

  const handleQuit = () => {
    if (!currentJob) return;
    Alert.alert('Quit Job', `Quit your job as ${currentJob?.title}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: () => quitJob?.() },
    ]);
  };

  const handleApply = (job: (typeof jobsData)[0]) => {
    if (currentJobId) {
      Alert.alert('Switch Jobs', `Quit current job and apply for ${job?.title}?`, [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: () => applyForJob?.(job?.id) },
      ]);
    } else {
      applyForJob?.(job?.id);
    }
  };

  const canApply = (job: (typeof jobsData)[0]) => {
    const hasReq = completedCourses.some((c) => c?.courseId === job?.requiredCourse);
    const hasExp = totalWeeksWorked >= (job?.requiredExperienceWeeks ?? 0);
    const carOk = !job?.requiresCar || hasCar;
    const notStudyingBasic = !studyingBasicCourse;
    return hasReq && hasExp && carOk && notStudyingBasic;
  };

  const getBlockReason = (job: (typeof jobsData)[0]) => {
    const hasReq = completedCourses.some((c) => c?.courseId === job?.requiredCourse);
    if (!hasReq) {
      const courseName = (coursesData ?? []).find((c) => c?.id === job?.requiredCourse)?.name;
      return `Requires: ${courseName ?? job?.requiredCourse}`;
    }
    if (totalWeeksWorked < (job?.requiredExperienceWeeks ?? 0)) {
      return `Need ${job?.requiredExperienceWeeks} weeks exp (have ${totalWeeksWorked})`;
    }
    if (job?.requiresCar && !hasCar) return 'Requires a car';
    if (studyingBasicCourse) return 'Finish basic course first';
    return '';
  };

  const levelLabels = ['', 'Junior', 'Senior', 'Lead'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Career</Text>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current Job */}
        <GameCard title="Current Job">
          {currentJob ? (
            <View>
              <View style={styles.jobHeaderRow}>
                <Text style={styles.jobTitle}>{currentJob?.title}</Text>
                <StatusPill label={`Level ${currentJob?.level ?? 1}`} color={Colors.info} />
              </View>
              <Text style={[styles.salary, { color: Colors.primary }]}>{formatCurrency(currentJob?.weeklySalary)}/week</Text>
              <Text style={styles.expText}>Experience: {totalWeeksWorked} weeks</Text>
              <Pressable style={styles.quitButton} onPress={handleQuit}>
                <Text style={styles.quitText}>Quit Job</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.jobTitle, { color: Colors.warning }]}>Unemployed</Text>
          )}
        </GameCard>

        <Text style={styles.sectionHeader}>Career Paths</Text>

        {Object.entries(groups).map(([baseId, jobs]) => {
          const sorted = [...jobs].sort((a, b) => (a?.level ?? 0) - (b?.level ?? 0));
          const pathName = sorted[0]?.title ?? baseId;
          return (
            <GameCard key={baseId} title={`${pathName} Path`}>
              {sorted.map((job) => {
                const isCurrent = job?.id === currentJobId;
                const available = canApply(job);
                const blockReason = getBlockReason(job);
                const lvl = job?.level ?? 1;

                return (
                  <View key={job?.id} style={styles.jobItem}>
                    <View style={styles.jobRow}>
                      <View style={styles.jobInfo}>
                        <View style={styles.jobNameRow}>
                          <Text style={styles.jobName}>{job?.title}</Text>
                          <Text style={[styles.levelBadge, { color: lvl === 3 ? Colors.warning : lvl === 2 ? Colors.info : Colors.textMuted }]}>
                            {levelLabels[lvl]}
                          </Text>
                        </View>
                        <Text style={styles.jobSalary}>{formatCurrency(job?.weeklySalary)}/week</Text>
                        {job?.requiresCar && <Text style={styles.reqIcon}>🚗 Car required</Text>}
                        {(job?.requiredExperienceWeeks ?? 0) > 0 && <Text style={styles.reqIcon}>📅 {job?.requiredExperienceWeeks} weeks exp</Text>}
                      </View>
                      <View style={styles.jobAction}>
                        {isCurrent ? (
                          <StatusPill label="💼 Current" color={Colors.info} />
                        ) : available ? (
                          <Pressable style={styles.applyButton} onPress={() => handleApply(job)}>
                            <Text style={styles.applyText}>Apply</Text>
                          </Pressable>
                        ) : (
                          <StatusPill label="🔒 Locked" color={Colors.textMuted} />
                        )}
                      </View>
                    </View>
                    {!isCurrent && !available && blockReason ? (
                      <Text style={styles.blockText}>{blockReason}</Text>
                    ) : null}
                  </View>
                );
              })}
            </GameCard>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTitle: { color: Colors.textPrimary, fontSize: 24, fontWeight: '700', padding: 16, paddingBottom: 0 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  jobHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jobTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  salary: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  expText: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  quitButton: { borderWidth: 1, borderColor: Colors.negative, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  quitText: { color: Colors.negative, fontWeight: '600', fontSize: 15 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 12 },
  jobItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  jobRow: { flexDirection: 'row', justifyContent: 'space-between' },
  jobInfo: { flex: 1 },
  jobNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  jobName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  levelBadge: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  jobSalary: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  reqIcon: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  jobAction: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  applyButton: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  applyText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  blockText: { color: Colors.textMuted, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
});
