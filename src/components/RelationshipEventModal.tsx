import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';

export default function RelationshipEventModal() {
  const visible = useGameStore((s) => s.showRelationshipEventModal);
  const event = useGameStore((s) => s.relationshipState?.pendingEvent);
  const cash = useGameStore((s) => s.cash ?? 0);
  const handleChoice = useGameStore((s) => s.handleRelationshipEventChoice);
  const dismiss = useGameStore((s) => s.dismissRelationshipEventModal);

  if (!visible || !event) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.icon}>{event.icon}</Text>
          <Text style={styles.eyebrow}>PERSONAL LIFE</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.description}>{event.description}</Text>

          <ScrollView style={styles.choices} showsVerticalScrollIndicator={false}>
            {(event.choices ?? []).map((choice, index) => {
              const cost = choice.cost ?? 0;
              const canAfford = cost <= cash;
              return (
                <Pressable
                  key={index}
                  disabled={!canAfford}
                  style={[styles.choice, !canAfford && styles.disabled]}
                  onPress={() => handleChoice(index)}
                >
                  <Text style={styles.choiceText}>{choice.text}</Text>
                  {cost > 0 && (
                    <Text style={[styles.cost, !canAfford && { color: Colors.negative }]}>
                      {canAfford ? formatCurrency(cost) : `Need ${formatCurrency(cost)}`}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable style={styles.later} onPress={dismiss}>
            <Text style={styles.laterText}>Decide Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  card: { width: '100%', maxWidth: 430, maxHeight: '82%', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, padding: 20 },
  icon: { fontSize: 34, textAlign: 'center' },
  eyebrow: { color: Colors.happiness, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center', marginTop: 6 },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 5 },
  description: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 9, marginBottom: 14 },
  choices: { maxHeight: 330 },
  choice: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, borderRadius: 11, padding: 13, marginBottom: 9 },
  choiceText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cost: { color: Colors.warning, fontSize: 11, marginTop: 5, fontWeight: '600' },
  disabled: { opacity: 0.42 },
  later: { alignItems: 'center', paddingVertical: 11, marginTop: 2 },
  laterText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
});
