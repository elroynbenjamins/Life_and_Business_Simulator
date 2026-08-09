import React from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency, formatPercent } from '../utils/format';
import useGameStore from '../store/gameStore';
import achievementsData from '../data/achievements.json';

export default function WeekSummarySheet() {
  const showSummary = useGameStore((s) => s?.showSummary);
  const summary = useGameStore((s) => s?.lastSummary);
  const dismissSummary = useGameStore((s) => s?.dismissSummary);

  if (!showSummary || !summary) return null;

  const topGainer = [...(summary?.stockChanges ?? [])].sort((a, b) => (b?.change ?? 0) - (a?.change ?? 0))?.[0];
  const topLoser = [...(summary?.stockChanges ?? [])].sort((a, b) => (a?.change ?? 0) - (b?.change ?? 0))?.[0];
  const totalExpenses = (summary?.rentPaid ?? 0) + (summary?.utilityCost ?? 0) + (summary?.foodCost ?? 0) + (summary?.carCost ?? 0) + (summary?.courseCost ?? 0) + (summary?.loanPayments ?? 0);
  const netFlow = (summary?.salaryEarned ?? 0) + (summary?.dividendIncome ?? 0) - totalExpenses - (summary?.taxAmount ?? 0);

  const formatSkillName = (id: string) =>
    id.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Week {summary?.newWeek ?? 0} Summary</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.headline}>"{summary?.headline ?? ''}"</Text>

            {/* Inflation Event */}
            {summary?.inflationEvent && (
              <View style={styles.inflationBox}>
                <Text style={styles.inflationText}>
                  📈 Yearly Inflation: +{((summary?.inflationRate ?? 0) * 100).toFixed(0)}% — Costs & salaries adjusted (×{(summary?.inflationMultiplier ?? 1).toFixed(2)})
                </Text>
              </View>
            )}

            {/* Income */}
            <Text style={styles.sectionLabel}>Income</Text>
            <Row label="Salary" value={summary?.salaryEarned ?? 0} positive />
            {summary?.salaryReduced && (
              <View style={styles.salaryWarning}>
                <Text style={styles.salaryWarningText}>⚠️ Salary reduced by 20% (studying advanced course)</Text>
              </View>
            )}

            {/* Expenses */}
            <Text style={styles.sectionLabel}>Expenses</Text>
            <Row label="Total Expenses" value={totalExpenses} />

            {/* Tax */}
            {summary?.isTaxWeek && (
              <>
                <Text style={styles.sectionLabel}>Tax Assessment (20 Weeks)</Text>
                <View style={styles.taxBox}>
                  <Row label="Total Earnings" value={summary?.earningsForTaxPeriod ?? 0} positive neutral />
                  <Row label="Tax Owed" value={summary?.taxAmount ?? 0} />
                </View>
              </>
            )}

            {/* Net Flow */}
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={[styles.rowLabel, { fontWeight: '700' }]}>Net Cash Flow</Text>
              <Text style={[styles.rowValue, { color: netFlow >= 0 ? Colors.primary : Colors.negative, fontWeight: '700' }]}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </Text>
            </View>

            {summary?.courseProgress ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Course</Text>
                <Text style={[styles.rowValue, { color: Colors.info }]}>{summary.courseProgress}</Text>
              </View>
            ) : null}

            {topGainer && (topGainer?.change ?? 0) > 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Top Gainer</Text>
                <Text style={[styles.rowValue, { color: Colors.primary }]}>{topGainer?.ticker} {formatPercent(topGainer?.change)}</Text>
              </View>
            ) : null}

            {topLoser && (topLoser?.change ?? 0) < 0 ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Top Loser</Text>
                <Text style={[styles.rowValue, { color: Colors.negative }]}>{topLoser?.ticker} {formatPercent(topLoser?.change)}</Text>
              </View>
            ) : null}

            {/* Property Income */}
            {(summary?.propertyIncome ?? 0) > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Property Income</Text>
                <Text style={[styles.rowValue, { color: Colors.primary }]}>+{formatCurrency(summary?.propertyIncome ?? 0)}</Text>
              </View>
            )}

            {/* Career Events */}
            {summary?.careerRaise && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.primary}22`, borderColor: `${Colors.primary}33` }]}>
                <Text style={styles.eventTitle}>💰 Raise!</Text>
                <Text style={styles.eventDesc}>Your performance earned you a salary increase.</Text>
              </View>
            )}
            {summary?.careerPromotion && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.warning}22`, borderColor: `${Colors.warning}33` }]}>
                <Text style={styles.eventTitle}>🎉 Promotion!</Text>
                <Text style={styles.eventDesc}>You've been promoted to the next level!</Text>
              </View>
            )}
            {summary?.promotionBlockedReason && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.warning}22`, borderColor: `${Colors.warning}55` }]}>
                <Text style={styles.eventTitle}>🚙 Promotion Requirement</Text>
                <Text style={styles.eventDesc}>{summary.promotionBlockedReason}</Text>
              </View>
            )}

            {/* Skill Gains */}
            {/* Market Sentiment */}
            {summary?.marketSentimentName && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.warning}15`, borderColor: `${Colors.warning}33` }]}>
                <Text style={styles.eventTitle}>📊 Market Sentiment</Text>
                <Text style={styles.eventDesc}>{summary.marketSentimentName}</Text>
              </View>
            )}

            {/* Market Event */}
            {summary?.marketEventTitle && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.info}15`, borderColor: `${Colors.info}33` }]}>
                <Text style={styles.eventTitle}>📰 Market Event</Text>
                <Text style={styles.eventDesc}>{summary.marketEventTitle}</Text>
              </View>
            )}

            {/* D20 Performance Event */}
            {summary?.performanceEventResult && (
              <View style={[styles.eventBox, { backgroundColor: summary.performanceEventResult.success ? `${Colors.primary}22` : `${Colors.negative}22`, borderColor: summary.performanceEventResult.success ? `${Colors.primary}33` : `${Colors.negative}33` }]}>
                <Text style={styles.eventTitle}>🎲 Performance Review</Text>
                <Text style={styles.eventDesc}>
                  Rolled {summary.performanceEventResult.roll} (needed {summary.performanceEventResult.needed}) — {summary.performanceEventResult.success ? 'Success!' : 'Failed'}
                </Text>
              </View>
            )}

            {/* Dividends */}
            {(summary?.dividendIncome ?? 0) > 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Dividends</Text>
                <Text style={[styles.rowValue, { color: Colors.primary }]}>+{formatCurrency(summary?.dividendIncome ?? 0)}</Text>
              </View>
            )}

            {/* Realized P/L */}
            {(summary?.realizedProfitLoss ?? 0) !== 0 && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Realized P/L</Text>
                <Text style={[styles.rowValue, { color: (summary?.realizedProfitLoss ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                  {(summary?.realizedProfitLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(summary?.realizedProfitLoss ?? 0)}
                </Text>
              </View>
            )}

            {summary?.skillGains && Object.keys(summary.skillGains).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Skill Growth</Text>
                {Object.entries(summary.skillGains).map(([id, amount]) => (
                  <View key={id} style={styles.row}>
                    <Text style={styles.rowLabel}>{formatSkillName(id)}</Text>
                    <Text style={[styles.rowValue, { color: Colors.info }]}>+{(amount as number).toFixed(1)}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Business Income */}
            {(summary?.businessTotalProfit ?? 0) !== 0 && (
              <>
                <Text style={styles.sectionLabel}>Business Income</Text>
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Total Business P&L</Text>
                  <Text style={[styles.rowValue, { color: (summary?.businessTotalProfit ?? 0) >= 0 ? Colors.primary : Colors.negative, fontWeight: '600' }]}>
                    {(summary?.businessTotalProfit ?? 0) >= 0 ? '+' : ''}{formatCurrency(summary?.businessTotalProfit ?? 0)}
                  </Text>
                </View>
              </>
            )}

            {/* Business Events */}
            {(summary?.businessEvents?.length ?? 0) > 0 && (
              <>
                {(summary?.businessEvents ?? []).map((ev, i) => (
                  <View key={i} style={styles.eventBox}>
                    <Text style={styles.eventTitle}>{ev.icon} {ev.eventTitle}</Text>
                    <Text style={styles.eventDesc}>{ev.businessName}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Life Event */}
            {summary?.lifeEvent && (
              <View style={styles.eventBox}>
                <Text style={styles.eventTitle}>{summary.lifeEvent.icon} {summary.lifeEvent.title}</Text>
                <Text style={styles.eventDesc}>{summary.lifeEvent.description}</Text>
                {summary.lifeEvent.type === 'automatic' && summary.lifeEvent.effects?.cash ? (
                  <Text style={[styles.eventEffect, { color: (summary.lifeEvent.effects.cash ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                    {(summary.lifeEvent.effects.cash ?? 0) >= 0 ? '+' : ''}{formatCurrency(summary.lifeEvent.effects.cash)}
                  </Text>
                ) : null}
                {(summary.lifeEvent.type === 'choice' || summary.lifeEvent.type === 'opportunity') && (
                  <Text style={styles.eventPending}>Choices available after this summary →</Text>
                )}
              </View>
            )}

            {/* Investment Result */}
            {summary?.investmentResult && (
              <View style={[styles.eventBox, { backgroundColor: summary.investmentResult.success ? `${Colors.primary}22` : `${Colors.negative}22` }]}>
                <Text style={styles.eventTitle}>
                  {summary.investmentResult.success ? '📈 Investment Succeeded!' : '📉 Investment Failed'}
                </Text>
                <Text style={styles.eventDesc}>
                  Invested {formatCurrency(summary.investmentResult.invested)} → Returned {formatCurrency(summary.investmentResult.returned)}
                </Text>
              </View>
            )}

            {/* New Achievements */}
            {(summary?.newAchievements?.length ?? 0) > 0 && (
              <>
                <Text style={styles.sectionLabel}>New Achievements!</Text>
                {(summary?.newAchievements ?? []).map((id) => {
                  const ach = (achievementsData ?? []).find((a) => a?.id === id);
                  return (
                    <View key={id} style={styles.achievementRow}>
                      <Text style={styles.achievementName}>{ach?.name ?? id}</Text>
                      <Text style={styles.achievementXp}>+{ach?.xpReward ?? 0} PP</Text>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>

          <Pressable style={styles.button} onPress={dismissSummary}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, positive, neutral }: { label: string; value: number; positive?: boolean; neutral?: boolean }) {
  const color = neutral ? Colors.textPrimary : positive ? Colors.primary : Colors.negative;
  const prefix = positive ? '+' : '-';
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{prefix}{formatCurrency(Math.abs(value))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  scroll: { marginBottom: 16 },
  headline: { color: Colors.warning, fontSize: 14, fontStyle: 'italic', marginBottom: 12 },
  inflationBox: { backgroundColor: `${Colors.warning}22`, borderRadius: 8, padding: 10, marginBottom: 8 },
  inflationText: { color: Colors.warning, fontSize: 13, fontWeight: '600' },
  sectionLabel: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  rowLabel: { color: Colors.textSecondary, fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.cardBorder, marginVertical: 8 },
  taxBox: { backgroundColor: Colors.elevated, borderRadius: 8, padding: 8, marginTop: 4 },
  achievementRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, backgroundColor: `${Colors.warning}22`, borderRadius: 6, paddingHorizontal: 8, marginTop: 4 },
  achievementName: { color: Colors.warning, fontSize: 14, fontWeight: '600' },
  achievementXp: { color: Colors.warning, fontSize: 13 },
  salaryWarning: { backgroundColor: '#F59E0B22', borderRadius: 6, padding: 8, marginTop: 4 },
  salaryWarningText: { color: Colors.warning, fontSize: 12, fontWeight: '500' },
  eventBox: { backgroundColor: `${Colors.info}15`, borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: `${Colors.info}33` },
  eventTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  eventDesc: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  eventEffect: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  eventPending: { color: Colors.info, fontSize: 12, fontWeight: '500', marginTop: 6, fontStyle: 'italic' },
  button: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
});
