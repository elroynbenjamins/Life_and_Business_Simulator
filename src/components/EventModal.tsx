import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import useGameStore from '../store/gameStore';
import ConsequenceChip from './ConsequenceChip';
import StatusPill from './StatusPill';
import GameButton from './GameButton';

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
  const inject = useGameStore((s) => s.injectCashIntoBusiness);

  if (!showEventModal || !event) return null;

  const catColor = CATEGORY_COLORS[event.category] ?? Colors.primary;
  const isOpportunity = event.type === 'opportunity';
  const business = businesses.find(item => item.id === event.businessId);
  const cheapestChoice = Math.min(...(event.choices ?? []).map(choice => Math.max(0, -(choice.businessCash ?? 0))));
  const fundingNeeded = business ? Math.ceil(Math.max(0, cheapestChoice - business.balance)) : 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={event.businessId ? dismissEventModal : undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Header */}
          <View style={[styles.iconCircle, { backgroundColor: `${catColor}22` }]}>
            <Text style={styles.icon}>{event.icon}</Text>
          </View>
          <StatusPill compact label={event.category.toUpperCase()} color={catColor} />
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.description}>{event.description}</Text>

          {isOpportunity && (
            <View style={styles.opportunityBadge}>
              <Text style={styles.opportunityText}>Investment Opportunity</Text>
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
                    {cost > 0 && <ConsequenceChip icon="cash-outline" label={`-${formatCurrency(cost)}`} tone="negative" />}
                    {cashGain > 0 && <ConsequenceChip icon="cash-outline" label={`+${formatCurrency(cashGain)}`} tone="positive" />}
                    {(choice.businessCash ?? 0) !== 0 && (
                      <ConsequenceChip
                        icon="business-outline"
                        label={`Business ${choice.businessCash! > 0 ? '+' : '-'}${formatCurrency(Math.abs(choice.businessCash!))}`}
                        tone={choice.businessCash! > 0 ? 'positive' : 'negative'}
                      />
                    )}
                    {(choice.reputation ?? 0) !== 0 && (
                      <ConsequenceChip
                        icon="star-outline"
                        label={`Reputation ${choice.reputation! > 0 ? '+' : ''}${choice.reputation}`}
                        tone={choice.reputation! > 0 ? 'positive' : 'negative'}
                      />
                    )}
                    {(choice.marketShare ?? 0) !== 0 && (
                      <ConsequenceChip
                        icon="pie-chart-outline"
                        label={`Share ${choice.marketShare! > 0 ? '+' : ''}${choice.marketShare}%`}
                        tone={choice.marketShare! > 0 ? 'positive' : 'negative'}
                      />
                    )}
                    {choice.investmentId && <ConsequenceChip icon="trending-up-outline" label="Investment" tone="info" />}
                    {!canAfford && <ConsequenceChip icon="lock-closed-outline" label="Can't afford" tone="neutral" />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          {business && <>
            {fundingNeeded > 0 && Number.isFinite(fundingNeeded) && (
              <GameButton
                compact
                variant="secondary"
                accentColor={Colors.business}
                icon="wallet-outline"
                label={cash < fundingNeeded ? `Need ${formatCurrency(fundingNeeded)} personal cash` : `Inject ${formatCurrency(fundingNeeded)} personal cash`}
                onPress={() => inject(business.id, fundingNeeded)}
                disabled={cash < fundingNeeded}
                style={styles.modalAction}
              />
            )}
            <GameButton compact variant="ghost" label="Skip this opportunity" onPress={dismissEventModal} style={styles.modalAction} />
          </>}
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
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', textAlign: 'center', marginTop: 10, marginBottom: 8 },
  description: { color: Colors.textSecondary, fontSize: 15, textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  opportunityBadge: { backgroundColor: `${Colors.family}18`, borderWidth: 1, borderColor: `${Colors.family}33`, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16 },
  opportunityText: { color: Colors.family, fontSize: 12, fontWeight: '600' },
  choicesScroll: { width: '100%', maxHeight: 250 },
  choiceBtn: { backgroundColor: Colors.elevated, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.cardBorder },
  disabledChoice: { opacity: 0.4 },
  choiceText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  choiceEffects: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  modalAction: { width: '100%', marginTop: 6 },
});
