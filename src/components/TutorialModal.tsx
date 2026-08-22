import React, { useEffect, useState } from 'react';
import { Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useGameStore from '../store/gameStore';
import { Colors } from '../theme/colors';

const STEPS = [
  {
    icon: 'time-outline' as const,
    color: Colors.primary,
    title: 'Build your life, one week at a time',
    text: 'Choose your actions, then use Advance to Next Week on the Dashboard. Income, bills, education, investments, businesses, events and markets are processed each week.',
    tip: 'Every 20 weeks is one year and ends with a financial report and tax bill.',
  },
  {
    icon: 'school-outline' as const,
    color: Colors.info,
    title: 'Learn, then build a career',
    text: 'Start with Education to unlock a career path and gain skills and knowledge. A part-time job can provide income while studying, but you cannot keep it after starting a normal career.',
    tip: 'Higher career levels can require experience, education, an SUV and better housing.',
  },
  {
    icon: 'wallet-outline' as const,
    color: Colors.warning,
    title: 'Protect your cash flow',
    text: 'Housing, utilities, food, vehicles, courses and loans create recurring expenses. Keep cash available before advancing, especially when the 20-week tax bill is approaching.',
    tip: 'Tap Weekly Expenses on the Dashboard for a detailed breakdown in Statistics.',
  },
  {
    icon: 'trending-up-outline' as const,
    color: '#8B5CF6',
    title: 'Invest for the long term',
    text: 'Stocks, ETFs and commodities react to news, sentiment and sector events. Properties can appreciate and earn rent, but maintenance is charged every week.',
    tip: 'Diversification reduces the impact of one poor investment or market event.',
  },
  {
    icon: 'business-outline' as const,
    color: Colors.happiness,
    title: 'Build a business carefully',
    text: 'A new business has its own balance, three competitors and 10% market share. Inject personal cash before recruiting. Employees, pricing, upgrades, reputation and market share determine growth.',
    tip: 'Business purchases use business cash—not your personal cash.',
  },
  {
    icon: 'trophy-outline' as const,
    color: '#D4A843',
    title: 'Create your empire',
    text: 'Balance career income, lifestyle, investments and businesses to grow net worth. Achievements award Prestige Points and sometimes gems for permanent progress.',
    tip: 'You can replay this tutorial from the How To Play screen at any time.',
  },
];

export default function TutorialModal() {
  const visible = useGameStore((state) => state.showTutorial);
  const dismissTutorial = useGameStore((state) => state.dismissTutorial);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (visible) setStep(0);
  }, [visible]);

  if (!visible) return null;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible animationType="fade">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Text style={styles.counter}>{step + 1} / {STEPS.length}</Text>
          <Pressable onPress={dismissTutorial} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>Skip tutorial</Text>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: `${current.color}22`, borderColor: current.color }]}>
            <Ionicons name={current.icon} size={54} color={current.color} />
          </View>
          <Text style={styles.eyebrow}>WELCOME TO LIFE EMPIRE</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.text}>{current.text}</Text>
          <View style={styles.tipCard}>
            <Ionicons name="bulb-outline" size={21} color={Colors.warning} />
            <Text style={styles.tip}>{current.tip}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((_, index) => (
              <View key={index} style={[styles.dot, index === step && styles.activeDot]} />
            ))}
          </View>
          <View style={styles.actions}>
            {step > 0 && (
              <Pressable style={styles.backButton} onPress={() => setStep((value) => value - 1)}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.nextButton, step === 0 && styles.fullButton]}
              onPress={() => isLast ? dismissTutorial() : setStep((value) => value + 1)}
            >
              <Text style={styles.nextText}>{isLast ? 'Start playing' : 'Next'}</Text>
              <Ionicons name={isLast ? 'play' : 'arrow-forward'} size={19} color={Colors.white} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: 24 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 },
  counter: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  skip: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' },
  iconCircle: { width: 106, height: 106, borderRadius: 53, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  eyebrow: { color: Colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  title: { color: Colors.textPrimary, fontSize: 27, lineHeight: 34, fontWeight: '800', textAlign: 'center' },
  text: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 16 },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 15, marginTop: 24 },
  tip: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  footer: { paddingBottom: 20, width: '100%', maxWidth: 480, alignSelf: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.cardBorder },
  activeDot: { width: 22, backgroundColor: Colors.primary },
  actions: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center' },
  backText: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  nextButton: { flex: 2, minHeight: 54, borderRadius: 13, backgroundColor: Colors.primary, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  fullButton: { flex: 1 },
  nextText: { color: Colors.white, fontSize: 16, fontWeight: '800' },
});
