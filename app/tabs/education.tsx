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
  const enrollCourse = useGameStore((s) => s?.enrollCourse);

  const currentCourse = (coursesData ?? []).find((c) => c?.id === currentCourseId);

  const handleEnroll = (course: typeof coursesData[0]) => {
    Alert.alert(
      'Enroll in Course',
      `Enroll in ${course?.name} for ${formatCurrency(course?.cost)}? This will take ${course?.duration} weeks.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Enroll', onPress: () => enrollCourse?.(course?.id) },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.headerTitle}>Education</Text>
      <GameStatusBar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Current Course */}
        {currentCourse ? (
          <GameCard title="Currently Studying">
            <Text style={styles.courseName}>{currentCourse?.name}</Text>
            <ProgressBar progress={courseWeeksCompleted / (currentCourse?.duration ?? 1)} />
            <Text style={styles.progressText}>
              Week {courseWeeksCompleted}/{currentCourse?.duration}
            </Text>
          </GameCard>
        ) : null}

        <Text style={styles.sectionHeader}>Courses</Text>

        {(coursesData ?? []).map((course) => {
          const isCompleted = (completedCourses ?? []).some((c) => c?.courseId === course?.id);
          const isInProgress = currentCourseId === course?.id;
          const canAfford = cash >= (course?.cost ?? 0);
          const hasOtherCourse = currentCourseId !== null && !isInProgress;

          let status = 'Available';
          let statusColor = Colors.textPrimary;
          if (isCompleted) { status = '✅ Completed'; statusColor = Colors.primary; }
          else if (isInProgress) { status = '📖 In Progress'; statusColor = Colors.info; }
          else if (!canAfford) { status = '💰 Can\'t Afford'; statusColor = Colors.negative; }

          return (
            <GameCard key={course?.id}>
              <View style={styles.courseRow}>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseTitle}>{course?.name}</Text>
                  <Text style={styles.courseMeta}>
                    {course?.duration} weeks • {formatCurrency(course?.cost)}
                  </Text>
                </View>
                <StatusPill label={status} color={statusColor} />
              </View>
              {isInProgress ? (
                <View style={styles.progressWrap}>
                  <ProgressBar progress={courseWeeksCompleted / (course?.duration ?? 1)} />
                  <Text style={styles.progressSmall}>
                    Week {courseWeeksCompleted}/{course?.duration}
                  </Text>
                </View>
              ) : null}
              {!isCompleted && !isInProgress && canAfford && !hasOtherCourse ? (
                <Pressable style={styles.enrollButton} onPress={() => handleEnroll(course)}>
                  <Text style={styles.enrollText}>Enroll — {formatCurrency(course?.cost)}</Text>
                </Pressable>
              ) : null}
              {hasOtherCourse && !isCompleted ? (
                <Text style={styles.disabledText}>Finish current course first</Text>
              ) : null}
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
  courseName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  progressText: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
  sectionHeader: { color: Colors.textSecondary, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 12 },
  courseRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseInfo: { flex: 1 },
  courseTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  courseMeta: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  progressWrap: { marginTop: 10 },
  progressSmall: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  enrollButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  enrollText: { color: Colors.white, fontWeight: '600', fontSize: 14 },
  disabledText: { color: Colors.textMuted, fontSize: 12, marginTop: 8, fontStyle: 'italic' },
});
