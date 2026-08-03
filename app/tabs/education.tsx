import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../src/theme/colors';
import GameStatusBar from '../../src/components/StatusBar';
import GameCard from '../../src/components/GameCard';
import ProgressBar from '../../src/components/ProgressBar';
import StatusPill from '../../src/components/StatusPill';
import useGameStore from '../../src/store/gameStore';
import { formatCurrency } from '../../src/utils/format';
import coursesData from '../../src/data/courses.json';

export default function EducationScreen() {
  const currentCourseId = useGameStore((s) => s?.currentCourseId);
  const courseWeeksCompleted = useGameStore((s) => s?.courseWeeksCompleted ?? 0);
  const completedCourses = useGameStore((s) => s?.completedCourses ?? []);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const currentJobId = useGameStore((s) => s?.currentJobId);
  const enrollCourse = useGameStore((s) => s?.enrollCourse);

  const currentCourse = (coursesData ?? []).find((c) => c?.id === currentCourseId);

  // Group by baseId
  const groups: Record<string, typeof coursesData> = {};
  for (const course of coursesData ?? []) {
    const base = course?.baseId ?? '';
    if (!groups[base]) groups[base] = [];
    groups[base].push(course);
  }

  const handleEnroll = (course: (typeof coursesData)[0]) => {
    const isBasic = (course?.level ?? 1) === 1;
    const costText = isBasic ? formatCurrency(course?.cost) : `${formatCurrency(course?.weeklyCost)}/week`;
    const jobWarning = isBasic && currentJobId ? '\n\nNote: You will quit your current job to study full-time.' : '';
    Alert.alert(
      'Enroll in Course',
      `Enroll in ${course?.name}? Cost: ${costText}. Duration: ${course?.duration} weeks.${jobWarning}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enroll', onPress: () => enrollCourse?.(course?.id) },
      ]
    );
  };

  const levelColors = ['', Colors.primary, Colors.info, Colors.warning];
  const levelLabels = ['', 'Basic', 'Advanced', 'Expert'];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Education</Text>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current Course */}
        {currentCourse ? (
          <GameCard title="Currently Studying">
            <View style={styles.currentRow}>
              <Text style={styles.courseName}>{currentCourse?.name}</Text>
              <StatusPill label={levelLabels[currentCourse?.level ?? 1]} color={levelColors[currentCourse?.level ?? 1]} />
            </View>
            <ProgressBar progress={courseWeeksCompleted / (currentCourse?.duration ?? 1)} />
            <Text style={styles.progressText}>
              Week {courseWeeksCompleted}/{currentCourse?.duration}
              {(currentCourse?.weeklyCost ?? 0) > 0 ? ` | ${formatCurrency(currentCourse?.weeklyCost)}/week` : ''}
            </Text>
            {(currentCourse?.level ?? 1) >= 2 && (
              <Text style={styles.workableText}>Can work while studying</Text>
            )}
          </GameCard>
        ) : null}

        <Text style={styles.sectionHeader}>Course Paths</Text>

        {Object.entries(groups).map(([baseId, courses]) => {
          const sorted = [...courses].sort((a, b) => (a?.level ?? 0) - (b?.level ?? 0));
          const pathName = sorted[0]?.name?.replace?.(' Basics', '')?.replace?.(' Basic', '') ?? baseId;
          return (
            <GameCard key={baseId} title={pathName}>
              {sorted.map((course) => {
                const isCompleted = completedCourses.some((c) => c?.courseId === course?.id);
                const isInProgress = currentCourseId === course?.id;
                const hasPrereq = !course?.prerequisite || completedCourses.some((c) => c?.courseId === course?.prerequisite);
                const hasOtherCourse = currentCourseId !== null && !isInProgress;
                const isBasic = (course?.level ?? 1) === 1;
                const canAfford = isBasic ? cash >= (course?.cost ?? 0) : true; // Weekly cost checked each tick
                const available = hasPrereq && !isCompleted && !isInProgress && !hasOtherCourse && canAfford;

                let status = 'Available';
                let statusColor = Colors.textPrimary;
                if (isCompleted) { status = '✅ Done'; statusColor = Colors.primary; }
                else if (isInProgress) { status = '📖 In Progress'; statusColor = Colors.info; }
                else if (!hasPrereq) { status = '🔒 Locked'; statusColor = Colors.textMuted; }
                else if (!canAfford) { status = "Can't Afford"; statusColor = Colors.negative; }

                const costText = isBasic ? formatCurrency(course?.cost) : `${formatCurrency(course?.weeklyCost)}/wk`;

                return (
                  <View key={course?.id} style={styles.courseItem}>
                    <View style={styles.courseRow}>
                      <View style={styles.courseInfo}>
                        <View style={styles.courseNameRow}>
                          <Text style={styles.courseTitle}>{levelLabels[course?.level ?? 1]}</Text>
                          <StatusPill label={status} color={statusColor} />
                        </View>
                        <Text style={styles.courseMeta}>
                          {course?.duration} weeks | {costText}
                          {(course?.level ?? 1) >= 2 ? ' | Can work' : ' | Full-time'}
                        </Text>
                      </View>
                    </View>
                    {isInProgress && (
                      <View style={styles.progressWrap}>
                        <ProgressBar progress={courseWeeksCompleted / (course?.duration ?? 1)} />
                        <Text style={styles.progressSmall}>Week {courseWeeksCompleted}/{course?.duration}</Text>
                      </View>
                    )}
                    {available && (
                      <Pressable style={styles.enrollButton} onPress={() => handleEnroll(course)}>
                        <Text style={styles.enrollText}>Enroll — {costText}</Text>
                      </Pressable>
                    )}
                    {hasOtherCourse && !isCompleted && !isInProgress && (
                      <Text style={styles.disabledText}>Finish current course first</Text>
                    )}
                    {!hasPrereq && !isCompleted && (
                      <Text style={styles.disabledText}>Complete previous level first</Text>
                    )}
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
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  courseName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  progressText: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
  workableText: { color: Colors.primary, fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 12 },
  courseItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  courseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseInfo: { flex: 1 },
  courseNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  courseTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  courseMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  progressWrap: { marginTop: 8 },
  progressSmall: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  enrollButton: { backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  enrollText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  disabledText: { color: Colors.textMuted, fontSize: 11, marginTop: 6, fontStyle: 'italic' },
});
