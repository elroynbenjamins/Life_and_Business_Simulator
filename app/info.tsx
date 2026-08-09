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
    content: 'Tap "Advance to Next Week" to process income, expenses, careers, education, investments, businesses, properties and events. Every 20 weeks equals one in-game year; your age increases and inflation is updated.',
  },
  {
    title: 'Taxes',
    icon: '🧾',
    content: 'A tax bill is charged every 20 weeks based on the career salary earned during that period. The Dashboard shows a countdown to the next assessment. Keep cash available: the bill is deducted automatically and appears in the 20-week report.',
  },
  {
    title: 'Career',
    icon: '💼',
    content: 'Complete a matching course and meet skill, knowledge, experience and vehicle requirements to apply. Performance checks occur every 5 weeks and successful D20 rolls increase promotion progress. At 100%, you are promoted if you meet the vehicle requirement; level 3 and above require an SUV or better.',
  },
  {
    title: 'Education',
    icon: '📚',
    content: 'Courses unlock career paths and award skills and knowledge. Basic courses are available immediately; advanced courses require 75 worked weeks and expert courses require 150. Advanced and expert courses also require their preceding course. A part-time job slows study progress by 50%.',
  },
  {
    title: 'Skills & Knowledge',
    icon: '🧠',
    content: 'Education provides large skill and knowledge gains, while working develops abilities related to your career. Higher positions check these values. Review the Skills screen for your progress and the Career screen for each position’s requirements.',
  },
  {
    title: 'Stock Market',
    icon: '📈',
    content: 'Buy and sell stocks, ETFs and commodities. Prices update weekly based on volatility, sectors, news and market events. ETFs generally have smaller swings. Some finance assets pay dividends every 20 weeks. Portfolio reports show realized and unrealized profit or loss.',
  },
  {
    title: 'Market Events',
    icon: '📰',
    content: 'Market sentiment and temporary events can affect sectors and individual assets for several weeks. Check News before trading: a broad event can help one industry while hurting another.',
  },
  {
    title: 'Businesses',
    icon: '🏢',
    content: 'Found a business, hire employees, choose pricing and advertising, and buy unique upgrades. Every new business starts with 10% market share and three competitors. Revenue, reputation, market share, staffing costs, rent, morale and random events all affect weekly results.',
  },
  {
    title: 'Business Morale & Reputation',
    icon: '👥',
    content: 'Employee morale affects your team. When average morale is at least 55, negative morale events can occur with a 10% chance and reduce morale by no more than 20. Team morale actions cost cash. Reputation and market share influence business performance, event choices and valuation.',
  },
  {
    title: 'Business Value',
    icon: '🏷️',
    content: 'A business is valued from annualized revenue using a reputation-dependent multiple between 7× and 15×, plus its available business cash. Strong reputation, market share, profitability and cash reserves make a company more valuable.',
  },
  {
    title: 'Lifestyle',
    icon: '🚗',
    content: 'Housing, food and vehicles create weekly expenses. Better vehicles can unlock career promotions. Changing vehicles applies the purchase cost and any eligible trade-in value. Keep enough cash for recurring rent, utilities, food and running costs.',
  },
  {
    title: 'Properties',
    icon: '🏠',
    content: 'Buy investment properties, renovate them to increase value, and rent them out for weekly income. Property values can appreciate, but maintenance remains a weekly cost, so compare net rental income rather than rent alone.',
  },
  {
    title: 'Loans',
    icon: '💳',
    content: 'Take up to three personal loans at once while employed. Payments are deducted weekly and loans can be repaid early. Business loans are separate and belong to the business. Debt increases weekly expenses and reduces financial flexibility.',
  },
  {
    title: 'Prestige & Achievements',
    icon: '⭐',
    content: 'Achievements award Prestige Points and sometimes gems. Spend PP on permanent, multi-level bonuses such as salary, study speed, business performance and tax reduction. Connected nodes unlock in order, and effects from unlocked levels are cumulative.',
  },
  {
    title: 'Gems',
    icon: '💎',
    content: 'Earn gems from difficult achievements. Gems can be converted to cash at €100 per gem or obtained through the Support screen.',
  },
  {
    title: 'Inflation',
    icon: '📉',
    content: 'Inflation updates every 20 weeks. Many prices, recurring costs and salaries rise with the inflation multiplier, so both income and expenses change as the game progresses.',
  },
  {
    title: 'Cash, Net Worth & Statistics',
    icon: '📊',
    content: 'Cash pays immediate bills; net worth also includes investments, properties and businesses, minus debts. The Statistics tab tracks lifetime results such as income, taxes, stock purchases and business performance.',
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
