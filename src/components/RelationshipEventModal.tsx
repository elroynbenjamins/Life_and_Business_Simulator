import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';
import ConsequenceChip from './ConsequenceChip';
import StatusPill from './StatusPill';

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
          <View style={styles.heroIcon}><Text style={styles.icon}>{event.icon}</Text></View>
          <Text style={styles.eyebrow}>PERSONAL LIFE</Text>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.description}>{event.description}</Text>

          <ScrollView style={styles.choices} showsVerticalScrollIndicator={false}>
            {(event.choices ?? []).map((choice, index) => {
              const cost = choice.cost ?? 0;
              const canAfford = cost <= cash;
              const displayText = choice.text.replace(/\s*\(€[\d,.]+\)/g, '').trim();
              const consequences = [
                choice.relationship ? {
                  label: `Relationship ${choice.relationship > 0 ? '+' : ''}${choice.relationship}`,
                  icon: 'heart-outline' as const,
                  tone: choice.relationship > 0 ? 'positive' as const : 'negative' as const,
                } : null,
                choice.childRelationship ? {
                  label: `Child bond ${choice.childRelationship > 0 ? '+' : ''}${choice.childRelationship}`,
                  icon: 'people-outline' as const,
                  tone: choice.childRelationship > 0 ? 'positive' as const : 'negative' as const,
                } : null,
                choice.happiness ? {
                  label: `Happiness ${choice.happiness > 0 ? '+' : ''}${choice.happiness}`,
                  icon: 'happy-outline' as const,
                  tone: choice.happiness > 0 ? 'positive' as const : 'negative' as const,
                } : null,
                choice.careerPerformanceDelta ? {
                  label: `Career ${choice.careerPerformanceDelta > 0 ? '+' : ''}${choice.careerPerformanceDelta}`,
                  icon: 'briefcase-outline' as const,
                  tone: choice.careerPerformanceDelta > 0 ? 'positive' as const : 'negative' as const,
                } : null,
                choice.businessReputationDelta ? {
                  label: `Business rep ${choice.businessReputationDelta > 0 ? '+' : ''}${choice.businessReputationDelta}`,
                  icon: 'business-outline' as const,
                  tone: choice.businessReputationDelta > 0 ? 'positive' as const : 'negative' as const,
                } : null,
                choice.businessMoraleDelta ? {
                  label: `Team morale ${choice.businessMoraleDelta > 0 ? '+' : ''}${choice.businessMoraleDelta}`,
                  icon: 'people-circle-outline' as const,
                  tone: choice.businessMoraleDelta > 0 ? 'positive' as const : 'negative' as const,
                } : null,
                choice.childDevelopment ? {
                  label: `Development +${choice.childDevelopment}`,
                  icon: 'compass-outline' as const,
                  tone: 'info' as const,
                } : null,
                choice.childEducationFund ? {
                  label: `Education +${formatCurrency(choice.childEducationFund)}`,
                  icon: 'school-outline' as const,
                  tone: 'info' as const,
                } : null,
                choice.childSavings ? {
                  label: `Child savings +${formatCurrency(choice.childSavings)}`,
                  icon: 'wallet-outline' as const,
                  tone: 'info' as const,
                } : null,
                choice.travelWeeks ? {
                  label: `${choice.travelWeeks}w unpaid travel`,
                  icon: 'earth-outline' as const,
                  tone: 'warning' as const,
                } : null,
              ].filter(Boolean) as Array<{
                label: string;
                icon: React.ComponentProps<typeof ConsequenceChip>['icon'];
                tone: React.ComponentProps<typeof ConsequenceChip>['tone'];
              }>;

              return (
                <Pressable
                  key={index}
                  disabled={!canAfford}
                  style={({ pressed }) => [
                    styles.choice,
                    !canAfford && styles.disabled,
                    pressed && canAfford && styles.choicePressed,
                  ]}
                  onPress={() => handleChoice(index)}
                >
                  <View style={styles.choiceHeader}>
                    <Text style={styles.choiceText}>{displayText}</Text>
                    {cost > 0 && (
                      <StatusPill
                        compact
                        label={canAfford ? formatCurrency(cost) : `Need ${formatCurrency(cost)}`}
                        color={canAfford ? Colors.warning : Colors.negative}
                      />
                    )}
                  </View>

                  {choice.personalityHint && (
                    <View style={styles.fitRow}>
                      <Ionicons name="sparkles-outline" size={12} color={Colors.info} />
                      <Text style={styles.fitHint}>{choice.personalityHint}</Text>
                    </View>
                  )}

                  {consequences.length > 0 && (
                    <View style={styles.consequenceRow}>
                      {consequences.map((effect) => (
                        <ConsequenceChip
                          key={effect.label}
                          label={effect.label}
                          icon={effect.icon}
                          tone={effect.tone}
                        />
                      ))}
                    </View>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 430, maxHeight: '84%', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, padding: 18 },
  heroIcon: { width: 50, height: 50, borderRadius: 16, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', backgroundColor: `${Colors.family}12`, borderWidth: 1, borderColor: `${Colors.family}44` },
  icon: { fontSize: 27, textAlign: 'center' },
  eyebrow: { color: Colors.family, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center', marginTop: 8 },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  description: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 14 },
  choices: { maxHeight: 380 },
  choice: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, borderRadius: 12, padding: 12, marginBottom: 9 },
  choicePressed: { opacity: 0.86, transform: [{ scale: 0.992 }] },
  choiceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  choiceText: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 18, fontWeight: '800' },
  fitRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  fitHint: { flex: 1, color: Colors.info, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  consequenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 },
  disabled: { opacity: 0.42 },
  later: { alignItems: 'center', paddingVertical: 10, marginTop: 2 },
  laterText: { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
});
