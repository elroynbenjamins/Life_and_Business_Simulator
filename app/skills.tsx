import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import skillCategoriesData from '../src/data/skill_categories.json';
import knowledgeCategoriesData from '../src/data/knowledge_categories.json';
import { getMasteryLevel } from '../src/engine/skillEngine';

export default function SkillsScreen() {
  const router = useRouter();
  const skills = useGameStore((s) => s?.skills ?? {});
  const knowledge = useGameStore((s) => s?.knowledge ?? {});

  const renderStars = (count: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Ionicons
        key={i}
        name={i < count ? 'star' : 'star-outline'}
        size={14}
        color={i < count ? '#F59E0B' : Colors.textMuted}
      />
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Skills & Knowledge</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Skills Section */}
        <Text style={styles.sectionTitle}>Skills (from experience)</Text>
        <Text style={styles.sectionDesc}>Skills grow slowly as you work. Higher positions accelerate growth.</Text>
        {(skillCategoriesData as any[]).map((cat) => {
          const val = Math.round(skills[cat.id] ?? 0);
          const mastery = getMasteryLevel(val);
          return (
            <GameCard key={cat.id} style={styles.skillCard}>
              <View style={styles.skillRow}>
                <View style={styles.skillInfo}>
                  <Text style={styles.skillName}>{cat.name}</Text>
                  <Text style={styles.skillDesc}>{cat.description}</Text>
                </View>
                <View style={styles.skillRight}>
                  <View style={styles.starsRow}>{renderStars(mastery.stars)}</View>
                  <Text style={styles.skillValue}>{val}/100</Text>
                  <Text style={styles.masteryLabel}>{mastery.label}</Text>
                </View>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${val}%` }]} />
              </View>
            </GameCard>
          );
        })}

        {/* Knowledge Section */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Knowledge (from education)</Text>
        <Text style={styles.sectionDesc}>Complete courses to gain knowledge. Required for career advancement.</Text>
        {(knowledgeCategoriesData as any[]).map((cat) => {
          const val = Math.round(knowledge[cat.id] ?? 0);
          const mastery = getMasteryLevel(val);
          return (
            <GameCard key={cat.id} style={styles.skillCard}>
              <View style={styles.skillRow}>
                <View style={styles.skillInfo}>
                  <Text style={styles.skillName}>{cat.name}</Text>
                  <Text style={styles.skillDesc}>{cat.description}</Text>
                </View>
                <View style={styles.skillRight}>
                  <View style={styles.starsRow}>{renderStars(mastery.stars)}</View>
                  <Text style={[styles.skillValue, { color: '#3B82F6' }]}>{val}/100</Text>
                  <Text style={styles.masteryLabel}>{mastery.label}</Text>
                </View>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${val}%`, backgroundColor: '#3B82F6' }]} />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  sectionDesc: { color: Colors.textMuted, fontSize: 13, marginBottom: 12 },
  skillCard: { marginBottom: 8 },
  skillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  skillInfo: { flex: 1, marginRight: 12 },
  skillName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  skillDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  skillRight: { alignItems: 'flex-end' },
  starsRow: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  skillValue: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  masteryLabel: { color: Colors.textSecondary, fontSize: 11 },
  progressBg: { height: 4, backgroundColor: Colors.cardBorder, borderRadius: 2, marginTop: 8 },
  progressFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
});
