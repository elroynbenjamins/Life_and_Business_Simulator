import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';

const sections = [
  {
    title: 'Time System',
    icon: '⏰',
    content: 'Each game week advances when you tap "Advance to Next Week". Every 20 weeks equals 1 year of in-game time. Your age increases by 1 each year. A yearly summary with tax assessment appears every 20 weeks.',
  },
  {
    title: 'Career',
    icon: '💼',
    content: 'Complete courses to unlock career paths, then apply at companies. Performance reviews (D20 dice rolls) happen every 10 weeks — succeed to boost promotion progress. At 100% promotion progress, you advance to the next level. Higher positions earn more salary.',
  },
  {
    title: 'Education',
    icon: '📚',
    content: 'Enroll in courses to gain skills and unlock career paths. Basic courses are available immediately. Advanced courses require 75 weeks of work experience. Expert courses require 150 weeks. Studying full-time prevents working.',
  },
  {
    title: 'Stock Market',
    icon: '📈',
    content: 'Buy and sell stocks, ETFs, and commodities. Prices update weekly based on sector performance and news events. ETFs have smaller price swings than individual stocks. Banking and finance stocks pay yearly dividends. Track your realized and unrealized profit/loss in reports.',
  },
  {
    title: 'Market Events',
    icon: '📰',
    content: 'Random market sentiment events (Oil Crisis, Tech Boom, etc.) affect entire sectors for several weeks. Historical market events from 2005-2015 can also trigger, impacting specific stocks and sectors.',
  },
  {
    title: 'Businesses',
    icon: '🏢',
    content: 'Found businesses, hire employees, set pricing and advertising strategies. Businesses generate weekly profit or loss. You can inject cash, withdraw profits, and take business loans separately from personal loans.',
  },
  {
    title: 'Properties',
    icon: '🏠',
    content: 'Buy investment properties, renovate them to increase value, and rent them out for weekly income. Property values appreciate over time.',
  },
  {
    title: 'Loans',
    icon: '💳',
    content: 'Take up to 3 personal loans at once. You must be employed (company job) to qualify. Loans are repaid weekly over their duration. You can pay off loans early if you have enough cash.',
  },
  {
    title: 'Prestige Points',
    icon: '⭐',
    content: 'Earn Prestige Points (PP) by unlocking achievements. Spend PP on permanent bonuses in the Prestige Tree: salary boosts, study speed and more. Some bonuses require prerequisites.',
  },
  {
    title: 'Gems',
    icon: '💎',
    content: 'Earn gems from difficult achievements. Convert gems to cash (100€ per gem) or get them through the Support page.',
  },
  {
    title: 'Inflation',
    icon: '📊',
    content: 'The economy inflates yearly (every 20 weeks). Costs and salaries increase by the inflation rate. The inflation rate is expressed as a yearly percentage.',
  },
];

export default function InfoScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>How To Play</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          Life & Business Simulator is an economic life simulation. Start at age 20 with €10,000 and build your career, invest in stocks, start businesses, and grow your wealth.
        </Text>

        {sections.map((s) => (
          <GameCard key={s.title}>
            <Text style={styles.sectionTitle}>{s.icon} {s.title}</Text>
            <Text style={styles.sectionContent}>{s.content}</Text>
          </GameCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  sectionContent: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
});
