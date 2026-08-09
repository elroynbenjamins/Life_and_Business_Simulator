import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';

const CATEGORY_COLORS: Record<string, string> = {
  career: '#3B82F6',
  financial: '#10B981',
  health: '#EF4444',
  lifestyle: '#F59E0B',
  social: '#8B5CF6',
  investment: '#06B6D4',
  vehicle: '#F97316',
  housing: '#6366F1',
  education: '#14B8A6',
  opportunity: '#EC4899',
  business: '#F59E0B',
};

export default function EventModal() {
  const showEventModal = useGameStore((s) => s?.showEventModal);
  const event = useGameStore((s) => s?.pendingEvent);
  const dismissEventModal = useGameStore((s) => s?.dismissEventModal);
  const handleEventChoice = useGameStore((s) => s?.handleEventChoice);
  const cash = useGameStore((s) => s?.cash ?? 0);
  const businesses = useGameStore((s) => s?.businesses ?? []);

  if (!showEventModal || !event) return null;

  const catColor = CATEGORY_COLORS[event.category] ?? Colors.primary;
  const isOpportunity = event.type === 'opportunity';

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={[styles.iconCircle, { backgroundColor: `${catColor}22` }]}>
            <Text style={styles.icon}>{event.icon}</Text>
          </View>
          <View style={[styles.categoryPill, { backgroundColor: `${catColor}22` }]}>
            <Text style={[styles.categoryText, { color: catColor }]}>
              {event.category.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.description}>{event.description}</Text>

          {isOpportunity && (
            <View style={styles.opportunityBadge}>
              <Text style={styles.opportunityText}>📈 Investment Opportunity</Text>
            </View>
          )}

          {/* Choices */}
          <ScrollView style={styles.choicesScroll} showsVerticalScrollIndicator={false}>
            {(event.choices ?? []).map((choice, idx) => {
              const cost = choice.cost ?? 0;
              const cashGain = choice.cash ?? 0;
              const business = event.businessId ? businesses.find((item) => item.id === event.businessId) : null;
              const businessCost = Math.max(0, -(choice.businessCash ?? 0));
              const canAfford = (cost <= 0 || cash >= cost) && (businessCost <= 0 || (business?.balance ?? 0) >= businessCost);
              return (
                <Pressable
                  key={idx}
                  style={[styles.choiceBtn, !canAfford && styles.disabledChoice]}
                  onPress={() => handleEventChoice?.(idx)}
                  disabled={!canAfford}
                >
                  <Text style={styles.choiceText}>{choice.text}</Text>
                  <View style={styles.choiceEffects}>
                    {cost > 0 && (
                      <Text style={[styles.effectTag, { color: Colors.negative }]}>
                        -{formatCurrency(cost)}
                      </Text>
                    )}
                    {cashGain > 0 && (
                      <Text style={[styles.effectTag, { color: Colors.primary }]}>
                        +{formatCurrency(cashGain)}
                      </Text>
                    )}
                    {(choice.businessCash ?? 0) !== 0 && (
                      <Text style={[styles.effectTag, { color: (choice.businessCash ?? 0) > 0 ? Colors.primary : Colors.negative }]}>
                        Business {choice.businessCash! > 0 ? '+' : '-'}{formatCurrency(Math.abs(choice.businessCash!))}
                      </Text>
                    )}
                    {(choice.reputation ?? 0) !== 0 && <Text style={[styles.effectTag, { color: choice.reputation! > 0 ? Colors.primary : Colors.negative }]}>Reputation {choice.reputation! > 0 ? '+' : ''}{choice.reputation}</Text>}
                    {(choice.marketShare ?? 0) !== 0 && <Text style={[styles.effectTag, { color: choice.marketShare! > 0 ? Colors.primary : Colors.negative }]}>Share {choice.marketShare! > 0 ? '+' : ''}{choice.marketShare}%</Text>}
                    {choice.investmentId && (
                      <Text style={[styles.effectTag, { color: '#EC4899' }]}>
                        📈 Investment
                      </Text>
                    )}
                    {!canAfford && (
                      <Text style={[styles.effectTag, { color: Colors.textMuted }]}>
                        Can't afford
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
  iconCircle: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  icon: { fontSize: 32 },
  categoryPill: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12 },
  categoryText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  description: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  opportunityBadge: { backgroundColor: '#EC489922', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  opportunityText: { color: '#EC4899', fontSize: 12, fontWeight: '600' },
  choicesScroll: { width: '100%', maxHeight: 250 },
  choiceBtn: { backgroundColor: Colors.elevated, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  disabledChoice: { opacity: 0.4 },
  choiceText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  choiceEffects: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effectTag: { fontSize: 12, fontWeight: '600' },
});
