import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import useGameStore from '../src/store/gameStore';
import { Colors } from '../src/theme/colors';

export default function NewsScreen() {
  const history = useGameStore((st: any) => st.newsHistory) ?? [];
  const currentHeadline = useGameStore((st: any) => st.currentHeadline);
  const items = [...history].reverse().slice(0, 5);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>← Back</Text></Pressable>
        <Text style={styles.title}>News Feed</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {items.length === 0 ? (
          <Text style={styles.empty}>{currentHeadline ?? 'No news yet — advance a week to see headlines.'}</Text>
        ) : (
          items.map((headline: string, idx: number) => (
            <View key={idx} style={styles.card}>
              <Text style={styles.weekLabel}>{idx === 0 ? 'This week' : `${idx} week${idx === 1 ? '' : 's'} ago`}</Text>
              <Text style={styles.headline}>📰 {headline}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  back: { marginRight: 12 },
  backText: { color: Colors.primary, fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  card: { backgroundColor: Colors.card, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10 },
  weekLabel: { fontSize: 11, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  headline: { color: Colors.textPrimary, fontSize: 15, lineHeight: 21 },
  empty: { color: Colors.textMuted, textAlign: 'center', fontSize: 15, marginTop: 40 },
});
