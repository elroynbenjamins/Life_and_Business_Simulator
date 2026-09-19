import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameStatusBar from '../src/components/StatusBar';
import useGameStore from '../src/store/gameStore';
import { syncFamilyTree } from '../src/engine/familyTreeEngine';
import { FamilyTreePerson } from '../src/types/game';
import { formatCurrency } from '../src/utils/format';

export default function FamilyTreeScreen() {
  const router = useRouter();
  const state = useGameStore();
  const tree = useMemo(() => syncFamilyTree(state), [
    state.familyTree,
    state.relationshipState,
    state.playerName,
    state.age,
    state.year,
    state.generation,
    state.lifecycle,
  ]);

  const peopleById = useMemo(
    () => Object.fromEntries((tree.people ?? []).map((person) => [person.id, person])),
    [tree.people],
  );
  const generations = useMemo(() => {
    const values = [...new Set((tree.people ?? []).map((person) => person.generation))];
    return values.sort((a, b) => a - b);
  }, [tree.people]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Family Tree</Text>
          <Text style={styles.headerMeta}>
            {generations.length} generation{generations.length === 1 ? '' : 's'} • {(tree.people ?? []).length} people
          </Text>
        </View>
      </View>
      <GameStatusBar />

      <ScrollView contentContainerStyle={styles.content}>
        {(tree.people ?? []).length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="git-network-outline" size={44} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Your dynasty starts here</Text>
            <Text style={styles.emptyText}>Partners, children and future generations will appear as your family grows.</Text>
          </View>
        ) : (
          generations.map((generation) => {
            const people = (tree.people ?? [])
              .filter((person) => person.generation === generation)
              .sort((a, b) => {
                if (a.id === tree.currentPlayerId) return -1;
                if (b.id === tree.currentPlayerId) return 1;
                return a.name.localeCompare(b.name);
              });

            return (
              <View key={generation} style={styles.generationBlock}>
                <View style={styles.generationHeader}>
                  <View style={styles.generationDot} />
                  <Text style={styles.generationTitle}>Generation {generation}</Text>
                </View>
                <View style={styles.generationRail}>
                  {people.map((person) => (
                    <PersonNode
                      key={person.id}
                      person={person}
                      current={person.id === tree.currentPlayerId}
                      peopleById={peopleById}
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}

        {(state.familyLegacy ?? []).length > 0 && (
          <View style={styles.legacyBox}>
            <Text style={styles.legacyTitle}>Dynasty Legacy</Text>
            {[...(state.familyLegacy ?? [])].reverse().map((entry) => (
              <View key={entry.generation} style={styles.legacyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nodeName}>Generation {entry.generation} • {entry.name}</Text>
                  <Text style={styles.nodeMeta}>Died age {entry.deathAge} • Year {entry.deathYear}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.legacyValue}>{formatCurrency(entry.finalNetWorth)}</Text>
                  {entry.successorName && <Text style={styles.nodeMeta}>→ {entry.successorName}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PersonNode({
  person,
  current,
  peopleById,
}: {
  person: FamilyTreePerson;
  current: boolean;
  peopleById: Record<string, FamilyTreePerson>;
}) {
  const parents = (person.parentIds ?? []).map((id) => peopleById[id]?.name).filter(Boolean);
  const partners = (person.partnerIds ?? []).map((id) => peopleById[id]?.name).filter(Boolean);
  const childCount = person.childIds?.length ?? 0;

  return (
    <View style={[styles.node, current && styles.currentNode, person.status === 'deceased' && styles.deceasedNode]}>
      <View style={styles.nodeTop}>
        <View style={[styles.avatar, current && styles.currentAvatar]}>
          <Ionicons
            name={person.status === 'deceased' ? 'leaf-outline' : 'person'}
            size={19}
            color={current ? Colors.white : person.status === 'deceased' ? Colors.textMuted : Colors.happiness}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.nodeName}>{person.name}</Text>
            {current && <Text style={styles.currentBadge}>YOU</Text>}
            {person.playableGeneration && <Text style={styles.playableBadge}>G{person.playableGeneration}</Text>}
          </View>
          <Text style={styles.nodeMeta}>
            {person.status === 'deceased'
              ? `Died age ${person.deathAge ?? person.age}`
              : `Age ${person.age}`}
            {person.occupationTitle ? ` • ${person.occupationTitle}` : ''}
          </Text>
        </View>
      </View>

      {parents.length > 0 && (
        <View style={styles.relationRow}>
          <Ionicons name="arrow-up-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.relationText}>Parents: {parents.join(' & ')}</Text>
        </View>
      )}
      {partners.length > 0 && (
        <View style={styles.relationRow}>
          <Ionicons name="heart-outline" size={13} color={Colors.happiness} />
          <Text style={styles.relationText}>Partner: {partners.join(', ')}</Text>
        </View>
      )}
      {childCount > 0 && (
        <View style={styles.relationRow}>
          <Ionicons name="people-outline" size={13} color={Colors.info} />
          <Text style={styles.relationText}>{childCount} child{childCount === 1 ? '' : 'ren'}</Text>
        </View>
      )}
      {(person.liquidWealth ?? 0) > 0 && person.status === 'living' && (
        <View style={styles.relationRow}>
          <Ionicons name="cash-outline" size={13} color={Colors.primary} />
          <Text style={styles.relationText}>Tracked family wealth: {formatCurrency(person.liquidWealth ?? 0)}</Text>
        </View>
      )}
      {person.finalNetWorth != null && person.status === 'deceased' && (
        <View style={styles.relationRow}>
          <Ionicons name="wallet-outline" size={13} color={Colors.primary} />
          <Text style={styles.relationText}>Final estate: {formatCurrency(person.finalNetWorth)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800' },
  headerMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  content: { padding: 16, paddingBottom: 48 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  generationBlock: { marginBottom: 20 },
  generationHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  generationDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.happiness },
  generationTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  generationRail: { borderLeftWidth: 2, borderLeftColor: Colors.cardBorder, marginLeft: 4, paddingLeft: 14, gap: 9 },
  node: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, padding: 12 },
  currentNode: { borderColor: Colors.happiness, backgroundColor: `${Colors.happiness}0D` },
  deceasedNode: { opacity: 0.78 },
  nodeTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' },
  currentAvatar: { backgroundColor: Colors.happiness },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  nodeName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  nodeMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  currentBadge: { color: Colors.white, backgroundColor: Colors.happiness, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: '900' },
  playableBadge: { color: Colors.warning, backgroundColor: `${Colors.warning}18`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, fontSize: 9, fontWeight: '800' },
  relationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  relationText: { color: Colors.textSecondary, fontSize: 11, flex: 1 },
  legacyBox: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, padding: 13 },
  legacyTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 7 },
  legacyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.cardBorder },
  legacyValue: { color: Colors.primary, fontSize: 12, fontWeight: '800' },
});
