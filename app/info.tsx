import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import TutorialLauncher from '../src/components/TutorialLauncher';
import TutorialChapterLauncher from '../src/components/TutorialChapterLauncher';
import useGameStore from '../src/store/gameStore';

const sections = [
  { title: 'Your First Steps', content: 'The optional guided introduction teaches one weekly loop on the real screens. Completed lessons stay completed; replaying never changes your game. During Year 1, Home also shows a separate live journey covering education, income, a cash buffer, graduation, transport and your first career. These are suggestions, not restrictions.' },
  { title: 'Time, reports and taxes', content: 'Advance to Next Week processes income, costs, education, careers, investments, businesses and events. Every 20 weeks is an in-game year. Age and inflation change as years pass. Tax is assessed on applicable earnings separately from recurring weekly costs. Keep cash available. Annual reports are saved and can be opened from Home instead of requiring another pop-up.' },
  { title: 'Cash, net worth and Statistics', content: 'Cash pays immediate bills. Net worth also includes investments, property and business interests, minus debts. A high net worth does not mean that amount is available to spend. Statistics tracks results such as earnings, taxes and business performance.' },
  { title: 'Education and student work', content: 'Choose a Basics course that matches a career direction. Compare its upfront cost, recurring cost and duration. Advanced and Expert courses require their preceding course and employment experience. Career offers Flexible Part-Time and higher-paying High-Hours Part-Time: compare the displayed pay and extra study time. Both are tax-free in this game. Education boosts are optional; normal weekly study always remains available.' },
  { title: 'Career and promotion requirements', content: 'Complete matching education and meet the displayed skill, knowledge, experience, vehicle and housing requirements before applying. Open a career path to review its positions and application options. Better positions may require further education and upgraded transport or housing. Performance checks and promotion progress are shown on Career.' },
  { title: 'Lifestyle: Housing and Transport', content: 'Housing, food and vehicles create recurring costs. Use Housing and Transport to compare their separate options. Vehicles may unlock career positions, but also cost money to run. Purchased vehicles arrive after advancing a week; purchase and eligible trade-in amounts apply immediately. Review recurring costs as well as the sticker price.' },
  { title: 'Market, news and your portfolio', content: 'Inspect assets before buying. Market prices change weekly with volatility, sectors, news and events; gains are not guaranteed. Some assets pay dividends. Your portfolio distinguishes realized results from gains or losses on positions you still hold. News can help explain moves. You do not need to make a trade to complete the introductory guide.' },
  { title: 'Investment properties', content: 'Investment properties are separate from your personal housing. Inspect purchase costs, rental income and maintenance. Renovation and rental decisions affect their results. Compare net income rather than rent alone, and keep cash available for ongoing costs.' },
  { title: 'Loans and deposits', content: 'Personal loans have eligibility requirements and weekly payments. Taking a loan is optional, not a tutorial requirement. Business debt belongs to the business and should be reviewed separately. Deposits commit cash for their displayed term, so keep enough available for bills.' },
  { title: 'Your first business', guide: 'business' as const, content: 'Starting a business is only the beginning. Review its balance, staffing, demand and recurring costs before expanding. Pricing, advertising, morale, reputation, upgrades and projects affect results. Company cash is not the same as personal spending money. Business slots and project or upgrade slots are different limits.' },
  { title: 'Business strategy, automation and value', content: 'Strategic decisions can affect several weeks of results. Review costs, duration and consequences before choosing. Where available, automatic decisions and delegation reduce manual choices; they do not remove business risks. Valuation is an estimate of business value, not cash that can be spent immediately. Compare operating results and debt as well as the valuation.' },
  { title: 'Acquisitions and Holdings', guide: 'holding' as const, content: 'Acquisitions include financing and integration considerations. A Holding groups subsidiaries and maintains its own cash reserve. Treasury settings control protected reserves, management fees, distributions and capital allocation. Review the available amount and the transaction preview before moving money. Management fees move money within the group; they are not free new income.' },
  { title: 'Achievements and Prestige', content: 'Achievements recognize progress across the available systems. Inspect each achievement for its rewards and requirements, and pin goals you want to work toward. Prestige bonuses are permanent progression; review their level requirements and PP or gem costs before spending. Replaying a tutorial does not grant any additional rewards.' },
  { title: 'Gems and optional boosts', content: 'Support shows available gem rewards, purchases and benefits. Education and business screens explain their own optional boosts and slot options. Costs, availability and daily limits are displayed with those actions. The guided introduction never requires watching an ad, spending gems or making a purchase.' },
  { title: 'Personal Life and succession', personal: true, content: 'Personal Life adds optional relationships, household decisions and family progression. Choices can affect shared costs, time and future plans. Later, review estate assets, successor choices and settlement costs carefully during succession. These systems are introduced separately from the basic education-and-income opening.' },
];

export default function InfoScreen() {
  const router = useRouter();
  const personalLife = useGameStore((state) => state.relationshipModeEnabled);
  const firstBusinessId = useGameStore((state) => state.businesses?.[0]?.id);
  const firstHoldingId = useGameStore((state) => state.holdingCompanies?.[0]?.id);
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>How To Play</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>Build a career, invest, run businesses or explore Personal Life. Start with one loop; learn other systems when you need them.</Text>
        <TutorialLauncher />
        <Text style={styles.chapterHint}>Open a chapter for its explanation. These chapters are reference help; the guided opening uses the real screens.</Text>
        {sections.filter((section) => !section.personal || personalLife).map((section) => {
          const open = expanded === section.title;
          return <GameCard key={section.title} compact>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.chapterHeader} onPress={() => setExpanded(open ? null : section.title)}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
            </Pressable>
            {open && (
              <>
                <Text style={styles.sectionContent}>{section.content}</Text>
                {'guide' in section && section.guide && (
                  <TutorialChapterLauncher
                    chapter={section.guide}
                    subjectId={section.guide === 'business' ? firstBusinessId : firstHoldingId}
                  />
                )}
              </>
            )}
          </GameCard>;
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  back: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  chapterHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  chapterHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  sectionContent: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 6 },
});
