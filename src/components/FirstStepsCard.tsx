import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import GameCard from './GameCard';
import ProgressBar from './ProgressBar';
import useGameStore from '../store/gameStore';
import { getFirstLifeJourney } from '../engine/firstLifeJourney';
import { Colors } from '../theme/colors';

export default function FirstStepsCard() {
  const router = useRouter();
  const state = useGameStore(useShallow((s) => ({
    year: s.year,
    week: s.week,
    cash: s.cash,
    currentCourseId: s.currentCourseId,
    completedCourses: s.completedCourses,
    partTimeJob: s.partTimeJob,
    currentJobId: s.currentJobId,
    career: s.career,
    currentCarId: s.currentCarId,
    pendingCarDelivery: s.pendingCarDelivery,
  })));
  const journey = getFirstLifeJourney(state);

  if (!journey.visible) return null;

  const current = journey.current;
  const progress = journey.total > 0 ? journey.completed / journey.total : 0;

  return (
    <GameCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="compass-outline" size={21} color={Colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>FIRST LIFE JOURNEY</Text>
          <Text style={styles.title}>Your First Steps</Text>
          <Text style={styles.subtitle}>Guidance only — every system remains open to explore in your own order.</Text>
        </View>
        <Text style={styles.counter}>{journey.completed}/{journey.total}</Text>
      </View>

      <ProgressBar progress={progress} />

      {current && (
        <View style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextLabel}>NEXT STEP</Text>
            <Text style={styles.nextTitle}>{current.title}</Text>
          </View>
          <Text style={styles.nextDetail}>{current.detail}</Text>
          {current.route ? (
            <Pressable
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
              onPress={() => router.push(current.route as any)}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>{current.actionLabel}</Text>
              <Ionicons name="arrow-forward" size={17} color={Colors.white} />
            </Pressable>
          ) : (
            <Text style={styles.homeHint}>Use “Advance to Next Week” on Home when you are ready.</Text>
          )}
        </View>
      )}

      <View style={styles.steps}>
        {journey.steps.map((step, index) => {
          const active = current?.id === step.id;
          return (
            <View key={step.id} style={[styles.stepRow, active && styles.stepRowActive]}>
              <View style={[styles.stepIcon, step.complete && styles.stepIconComplete, active && styles.stepIconActive]}>
                {step.complete ? (
                  <Ionicons name="checkmark" size={13} color={Colors.white} />
                ) : (
                  <Text style={[styles.stepNumber, active && styles.stepNumberActive]}>{index + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepTitle, step.complete && styles.stepTitleComplete, active && styles.stepTitleActive]}>
                {step.title}
              </Text>
              <Text style={[styles.stepStatus, step.complete && styles.stepStatusComplete]}>
                {step.complete ? 'DONE' : active ? 'NOW' : 'LATER'}
              </Text>
            </View>
          );
        })}
      </View>
    </GameCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderColor: `${Colors.primary}55`,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${Colors.primary}18`,
    borderWidth: 1,
    borderColor: `${Colors.primary}44`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  subtitle: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  counter: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  nextCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.elevated,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  nextHeader: { gap: 2 },
  nextLabel: { color: Colors.warning, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  nextTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  nextDetail: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 6 },
  actionButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 11,
  },
  actionText: { color: Colors.white, fontSize: 14, fontWeight: '800' },
  homeHint: { color: Colors.primary, fontSize: 12, fontWeight: '700', marginTop: 9 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  steps: { marginTop: 10 },
  stepRow: {
    minHeight: 31,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  stepRowActive: { backgroundColor: `${Colors.primary}10` },
  stepIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIconComplete: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepIconActive: { borderColor: Colors.primary },
  stepNumber: { color: Colors.textMuted, fontSize: 10, fontWeight: '800' },
  stepNumberActive: { color: Colors.primary },
  stepTitle: { flex: 1, color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  stepTitleComplete: { color: Colors.textMuted },
  stepTitleActive: { color: Colors.textPrimary, fontWeight: '800' },
  stepStatus: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  stepStatusComplete: { color: Colors.primary },
});
