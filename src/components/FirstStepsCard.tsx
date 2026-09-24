import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useShallow } from 'zustand/react/shallow';
import GameCard from './GameCard';
import ProgressBar from './ProgressBar';
import TutorialLauncher from './TutorialLauncher';
import useGameStore from '../store/gameStore';
import { getFirstLifeJourney } from '../engine/firstLifeJourney';
import { Colors } from '../theme/colors';

export default function FirstStepsCard() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const state = useGameStore(useShallow((s) => ({
    year: s.year, week: s.week, cash: s.cash, currentCourseId: s.currentCourseId,
    completedCourses: s.completedCourses, partTimeJob: s.partTimeJob,
    currentJobId: s.currentJobId, career: s.career, currentCarId: s.currentCarId,
    pendingCarDelivery: s.pendingCarDelivery,
  })));
  const journey = getFirstLifeJourney(state);
  // Guided lessons do not expire at Year 2, unlike the live Year-1 goal card.
  if (!journey.visible) return <TutorialLauncher resumeOnly />;
  const current = journey.current;
  return (
    <>
      <TutorialLauncher resumeOnly />
      <GameCard style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="compass-outline" size={22} color={Colors.primary} />
          <View style={styles.heading}>
            <Text style={styles.eyebrow}>FIRST LIFE JOURNEY</Text>
            <Text style={styles.title}>Your First Steps</Text>
          </View>
          <Text style={styles.counter}>{journey.completed}/{journey.total}</Text>
        </View>
        <ProgressBar progress={journey.total ? journey.completed / journey.total : 0} />
        {current && <View style={styles.next}>
          <Text style={styles.nextTitle}>{current.title}</Text>
          <Text style={styles.detail}>{current.detail}</Text>
          {current.route ? <Pressable
            accessibilityRole="button" style={styles.action}
            onPress={() => { if (current.route) router.push(current.route); }}
          >
            <Text style={styles.actionText}>{current.actionLabel}</Text>
            <Ionicons name="arrow-forward" size={17} color={Colors.white} />
          </Pressable> : <Text style={styles.detail}>Use “Advance to Next Week” on Home when you are ready.</Text>}
        </View>}
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} style={styles.disclosure} onPress={() => setExpanded((value) => !value)}>
          <Text style={styles.disclosureText}>{expanded ? 'Hide journey goals' : 'View journey goals'}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
        </Pressable>
        {expanded && <View style={styles.steps}>
          <Text style={styles.detail}>Live goals, not required lessons. Explore in any order; a cash-buffer goal can change when you spend money.</Text>
          {journey.steps.map((step) => <View key={step.id} style={styles.step}>
            <Ionicons name={step.complete ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={step.complete ? Colors.primary : Colors.textMuted} />
            <Text style={styles.stepText}>{step.title}</Text>
          </View>)}
        </View>}
      </GameCard>
    </>
  );
}
const styles = StyleSheet.create({
  card: { borderColor: `${Colors.primary}55`, borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { color: Colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 2 },
  counter: { color: Colors.primary, fontSize: 13, fontWeight: '800' },
  next: { marginTop: 12 },
  nextTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  detail: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  action: { minHeight: 44, borderRadius: 10, backgroundColor: Colors.primary, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 10, marginTop: 10 },
  actionText: { color: Colors.white, fontSize: 13, fontWeight: '800' },
  disclosure: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 5 },
  disclosureText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
  steps: { gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepText: { flex: 1, color: Colors.textSecondary, fontSize: 12, lineHeight: 17 },
});
