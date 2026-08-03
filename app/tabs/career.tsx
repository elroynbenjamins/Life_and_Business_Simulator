import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import StatusPill from '../../src/components/StatusPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import jobsData from '../../src/data/jobs.json';

export default function CareerScreen() {
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const applyForJob = useGameStore((s) => s?.applyForJob);
  const quitJob = useGameStore((s) => s?.quitJob);

  const currentJob = (jobsData ?? []).find((j) => j?.id === currentJobId);

  const handleQuit = () => {
    if (!currentJob) return;
    Alert.alert(
      'Quit Job',
      `Quit your job as ${currentJob?.title}? You'll lose your weekly income of ${formatCurrency(currentJob?.weeklySalary)}.`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', style: 'destructive', onPress: () => quitJob?.() },
      ]
    );
  };

  const handleApply = (job: typeof jobsData[0]) => {
    if (currentJobId) {
      Alert.alert(
        'Switch Jobs',
        `You'll quit your current job as ${currentJob?.title}. Apply for ${job?.title}?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes', onPress: () => applyForJob?.(job?.id) },
        ]
      );
    } else {
      applyForJob?.(job?.id);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Career</Text>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current Job */}
        <GameCard title="Current Job">
          {currentJob ? (
            <View>
              <Text style={styles.jobTitle}>{currentJob?.title}</Text>
              <Text style={[styles.salary, { color: Colors.primary }]}>
                {formatCurrency(currentJob?.weeklySalary)}/week
              </Text>
              <Pressable style={styles.quitButton} onPress={handleQuit}>
                <Text style={styles.quitText}>Quit Job</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.jobTitle, { color: Colors.warning }]}>Unemployed</Text>
          )}
        </GameCard>

        <Text style={styles.sectionHeader}>Available Positions</Text>

        {(jobsData ?? []).map((job) => {
          const hasReq = (completedCourses ?? []).some((c) => c?.courseId === job?.requiredCourse);
          const isCurrent = job?.id === currentJobId;
          let status = '🔒 Locked';
          let statusColor = Colors.textMuted;
          if (isCurrent) { status = '💼 Current'; statusColor = Colors.info; }
          else if (hasReq) { status = '✅ Available'; statusColor = Colors.primary; }

          return (
            <GameCard key={job?.id}>
              <View style={styles.jobRow}>
                <View style={styles.jobInfo}>
                  <Text style={styles.jobName}>{job?.title}</Text>
                  <Text style={styles.jobSalary}>{formatCurrency(job?.weeklySalary)}/week</Text>
                  {!hasReq && !isCurrent ? (
                    <Text style={styles.reqText}>Requires: {job?.requiredCourse?.replace?.(/_/g, ' ')}</Text>
                  ) : null}
                </View>
                <View style={styles.jobAction}>
                  <StatusPill label={status} color={statusColor} />
                  {hasReq && !isCurrent ? (
                    <Pressable style={styles.applyButton} onPress={() => handleApply(job)}>
                      <Text style={styles.applyText}>Apply</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
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
  jobTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  salary: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  quitButton: {
    borderWidth: 1,
    borderColor: Colors.negative,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  quitText: { color: Colors.negative, fontWeight: '600', fontSize: 15 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 12 },
  jobRow: { flexDirection: 'row', justifyContent: 'space-between' },
  jobInfo: { flex: 1 },
  jobName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  jobSalary: { color: Colors.textSecondary, fontSize: 14, marginTop: 2 },
  reqText: { color: Colors.textMuted, fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  jobAction: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  applyText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
});
