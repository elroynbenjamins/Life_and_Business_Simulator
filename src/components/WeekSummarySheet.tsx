import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable } from 'react-native';
import { Colors } from '../theme/colors';
import { formatCurrency, formatPercent } from '../utils/format';
import useGameStore from '../store/gameStore';
import achievementsData from '../data/achievements.json';
import GameButton from './GameButton';
import StatusPill from './StatusPill';

export default function WeekSummarySheet() {
  const showSummary = useGameStore((s) => s?.showSummary);
  const summary = useGameStore((s) => s?.lastSummary);
  const dismissSummary = useGameStore((s) => s?.dismissSummary);
  const [showFinancialDetails, setShowFinancialDetails] = useState(false);

  if (!showSummary || !summary) return null;

  const topGainer = [...(summary?.stockChanges ?? [])].sort((a, b) => (b?.change ?? 0) - (a?.change ?? 0))?.[0];
  const topLoser = [...(summary?.stockChanges ?? [])].sort((a, b) => (a?.change ?? 0) - (b?.change ?? 0))?.[0];
  const totalExpenses = (summary?.rentPaid ?? 0) + (summary?.utilityCost ?? 0) + (summary?.foodCost ?? 0) + (summary?.carCost ?? 0) + (summary?.courseCost ?? 0) + (summary?.loanPayments ?? 0) + (summary?.relationshipHouseholdCost ?? 0) + (summary?.familyCost ?? 0) + (summary?.relationshipObligationCost ?? 0);
  const totalIncome = (summary?.salaryEarned ?? 0) + (summary?.partTimeIncome ?? 0) + (summary?.dividendIncome ?? 0) + (summary?.partnerContribution ?? 0) + (summary?.partnerInheritance ?? 0);
  const netFlow = totalIncome - totalExpenses - (summary?.taxAmount ?? 0);

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.eyebrow}>WEEKLY RESULT</Text>
              <Text style={styles.title}>Week {summary?.newWeek ?? 0} Summary</Text>
            </View>
            <StatusPill
              compact
              icon={netFlow >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
              label={netFlow >= 0 ? 'Positive week' : 'Negative week'}
              color={netFlow >= 0 ? Colors.primary : Colors.negative}
            />
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.resultHero}>
              <Text style={styles.resultLabel}>NET CASH FLOW</Text>
              <Text style={[styles.resultValue, { color: netFlow >= 0 ? Colors.primary : Colors.negative }]}>
                {netFlow >= 0 ? '+' : ''}{formatCurrency(netFlow)}
              </Text>
              {!!summary?.headline && <Text style={styles.headline}>"{summary.headline}"</Text>}

              <View style={styles.resultMetrics}>
                <View style={styles.resultMetric}>
                  <Text style={styles.resultMetricLabel}>Income</Text>
                  <Text style={[styles.resultMetricValue, { color: Colors.primary }]}>{formatCurrency(totalIncome)}</Text>
                </View>
                <View style={styles.resultMetric}>
                  <Text style={styles.resultMetricLabel}>Expenses</Text>
                  <Text style={[styles.resultMetricValue, { color: Colors.negative }]}>{formatCurrency(totalExpenses)}</Text>
                </View>
                <View style={styles.resultMetric}>
                  <Text style={styles.resultMetricLabel}>Tax</Text>
                  <Text style={[styles.resultMetricValue, { color: (summary?.taxAmount ?? 0) > 0 ? Colors.warning : Colors.textMuted }]}>
                    {formatCurrency(summary?.taxAmount ?? 0)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Inflation / Macro Event */}
            {summary?.inflationEvent && (
              <View style={styles.inflationBox}>
                <Text style={styles.inflationText}>
                  📈 Yearly Inflation: +{((summary?.inflationRate ?? 0) * 100).toFixed(0)}% — Costs & salaries adjusted
                </Text>
              </View>
            )}
            {summary?.crashEvent && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.negative}18`, borderColor: `${Colors.negative}44` }]}>
                <Text style={styles.eventTitle}>📉 {summary.crashEvent.title}</Text>
                <Text style={styles.eventDesc}>
                  {(summary.crashEvent.inflationReduction ?? 0) > 0
                    ? `Price pressure eased by ${((summary.crashEvent.inflationReduction ?? 0) * 100).toFixed(1)}%. `
                    : ''}
                  Recession pressure: −{Math.abs((summary.crashEvent.stockShock ?? 0) * 100).toFixed(1)}% this week. Individual returns also reflect other events and asset sensitivity.
                  {(summary.crashEvent.weeksRemaining ?? 0) > 0
                    ? ` Analysts expect ${summary.crashEvent.weeksRemaining} more market wave${summary.crashEvent.weeksRemaining === 1 ? '' : 's'}.`
                    : ''}
                </Text>
              </View>
            )}

            <Pressable
              style={styles.financeToggle}
              onPress={() => setShowFinancialDetails((value) => !value)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.financeToggleTitle}>Financial Breakdown</Text>
                <Text style={styles.financeToggleSub}>Income, recurring expenses and tax details</Text>
              </View>
              <Text style={styles.financeToggleIcon}>{showFinancialDetails ? '−' : '+'}</Text>
            </Pressable>

            {showFinancialDetails && (
              <View style={styles.financeDetails}>
                <Text style={styles.sectionLabel}>Income</Text>
                <Row label="Salary" value={summary?.salaryEarned ?? 0} positive />
                {(summary?.partTimeIncome ?? 0) > 0 && <Row label="Student work income (tax-free)" value={summary.partTimeIncome} positive />}
                {(summary?.partnerContribution ?? 0) > 0 && <Row label="Partner household contribution" value={summary.partnerContribution} positive />}
                {(summary?.partnerInheritance ?? 0) > 0 && <Row label="Inheritance from spouse" value={summary.partnerInheritance} positive />}
                {summary?.salaryReduced && (
                  <View style={styles.salaryWarning}>
                    <Text style={styles.salaryWarningText}>Salary was reduced this week while studying.</Text>
                  </View>
                )}

                <Text style={styles.sectionLabel}>Expenses</Text>
                <Row label="Total Expenses" value={totalExpenses} />
                {(summary?.relationshipHouseholdCost ?? 0) > 0 && (
                  <Text style={styles.eventPending}>Includes {formatCurrency(summary.relationshipHouseholdCost)} in additional household costs.</Text>
                )}
                {(summary?.familyCost ?? 0) > 0 && (
                  <Text style={styles.eventPending}>Includes {formatCurrency(summary.familyCost)} in child/family costs.</Text>
                )}
                {(summary?.relationshipObligationCost ?? 0) > 0 && (
                  <Text style={styles.eventPending}>Includes {formatCurrency(summary.relationshipObligationCost)} in relationship legal/settlement payments.</Text>
                )}

                {summary?.isTaxWeek && (
                  <>
                    <Text style={styles.sectionLabel}>Tax Assessment</Text>
                    <View style={styles.taxBox}>
                      <Row label="Total Earnings" value={summary?.earningsForTaxPeriod ?? 0} positive neutral />
                      <Row label="Tax Owed" value={summary?.taxAmount ?? 0} />
                    </View>
                  </>
                )}
              </View>
            )}

            <Text style={styles.sectionLabel}>Important This Week</Text>
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

            {(summary?.auctionResults?.length ?? 0) > 0 && summary.auctionResults.map((result) => (
              <View key={result.auctionId} style={[styles.eventBox, { backgroundColor: result.won ? `${Colors.primary}22` : `${Colors.negative}22`, borderColor: result.won ? `${Colors.primary}44` : `${Colors.negative}44` }]}>
                <Text style={styles.eventTitle}>{result.won ? '🔑 Auction Won' : '🏠 Auction Lost'}</Text>
                <Text style={styles.eventDesc}>{result.propertyName}</Text>
                <Text style={styles.eventDesc}>Winning bid: {formatCurrency(result.winningBid)}</Text>
                {result.won ? (
                  <Text style={[styles.eventEffect, { color: Colors.primary }]}>Potential equity: {formatCurrency(result.estimatedMarketValue - result.winningBid)} (unrealized)</Text>
                ) : (
                  <Text style={[styles.eventEffect, { color: Colors.negative }]}>{result.reason === 'insufficient_cash' ? 'Purchase failed: insufficient available cash.' : `Your highest bid: ${formatCurrency(result.playerBid)}`}</Text>
                )}
              </View>
            ))}

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

            {(summary?.marketCompanyEvents ?? []).map((event, index) => {
              const color = event.kind === 'delisted'
                ? Colors.negative
                : event.kind === 'matured' || event.kind === 'acquired'
                  ? Colors.primary
                  : Colors.info;
              const heading = event.kind === 'ipo' ? '🚀 New IPO'
                : event.kind === 'matured' ? '🏢 Company Matures'
                  : event.kind === 'company_event' ? `📰 ${event.title ?? 'Company News'}`
                    : event.kind === 'acquired' ? '🤝 Public Company Acquisition'
                      : '📉 Company Delisted';
              return (
                <View
                  key={`${event.ticker}_${event.kind}_${index}`}
                  style={[styles.eventBox, { backgroundColor: `${color}12`, borderColor: `${color}44` }]}
                >
                  <Text style={styles.eventTitle}>{heading}</Text>
                  <Text style={styles.eventDesc}>{event.description}</Text>
                  {typeof event.impactPercent === 'number' && event.kind === 'company_event' && (
                    <Text style={[styles.eventEffect, { color: event.impactPercent >= 0 ? Colors.primary : Colors.negative }]}>
                      Immediate move: {event.impactPercent >= 0 ? '+' : ''}{event.impactPercent.toFixed(1)}%
                    </Text>
                  )}
                  {(event.kind === 'delisted' || event.kind === 'acquired') && (event.settlementCash ?? 0) > 0 && (
                    <Text style={[styles.eventEffect, { color: event.kind === 'acquired' ? Colors.primary : Colors.warning }]}>
                      {event.kind === 'acquired' ? 'Takeover payout' : 'Recovery paid'}: {formatCurrency(event.settlementCash ?? 0)}
                    </Text>
                  )}
                  {(event.kind === 'delisted' || event.kind === 'acquired') && (event.realizedProfitLoss ?? 0) !== 0 && (
                    <Text style={[styles.eventEffect, { color: (event.realizedProfitLoss ?? 0) >= 0 ? Colors.primary : Colors.negative }]}>
                      Position result: {(event.realizedProfitLoss ?? 0) >= 0 ? '+' : ''}{formatCurrency(event.realizedProfitLoss ?? 0)}
                    </Text>
                  )}
                </View>
              );
            })}

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
                <Text style={styles.rowLabel}>Dividends / Staking</Text>
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


            {summary?.childBornName && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.happiness}12`, borderColor: `${Colors.happiness}33` }]}>
                <Text style={styles.eventTitle}>👶 Family Expanded</Text>
                <Text style={styles.eventDesc}>{summary.childBornName} joined your family.</Text>
              </View>
            )}

            {summary?.relationshipEventTitle && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.happiness}12`, borderColor: `${Colors.happiness}33` }]}>
                <Text style={styles.eventTitle}>❤️ Personal Life Decision</Text>
                <Text style={styles.eventDesc}>{summary.relationshipEventTitle} — a choice is waiting after this summary.</Text>
              </View>
            )}

            {(summary?.familyMilestones?.length ?? 0) > 0 && (
              <>
                {(summary.familyMilestones ?? []).map((milestone, index) => (
                  <View key={index} style={[styles.eventBox, { backgroundColor: `${Colors.info}12`, borderColor: `${Colors.info}33` }]}>
                    <Text style={styles.eventTitle}>🎓 Family Milestone</Text>
                    <Text style={styles.eventDesc}>{milestone}</Text>
                  </View>
                ))}
              </>
            )}

            {summary?.partnerDiedName && (
              <View style={[styles.eventBox, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: Colors.cardBorder }]}>
                <Text style={styles.eventTitle}>🕯️ Loss in the Family</Text>
                <Text style={styles.eventDesc}>{summary.partnerDiedName} passed away.</Text>
                {(summary?.partnerInheritance ?? 0) > 0 && (
                  <Text style={[styles.eventEffect, { color: Colors.primary }]}>
                    Estate received: +{formatCurrency(summary.partnerInheritance)}
                  </Text>
                )}
                <Text style={styles.eventPending}>Bereavement temporarily lowers happiness.</Text>
              </View>
            )}

            {summary?.partnerCareerEvent && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.info}12`, borderColor: `${Colors.info}33` }]}>
                <Text style={styles.eventTitle}>💼 Partner Career</Text>
                <Text style={styles.eventDesc}>{summary.partnerCareerEvent}</Text>
              </View>
            )}

            {summary?.relationshipGoalCompleted && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.primary}12`, borderColor: `${Colors.primary}33` }]}>
                <Text style={styles.eventTitle}>🎯 Shared Goal Completed</Text>
                <Text style={styles.eventDesc}>{summary.relationshipGoalCompleted}</Text>
              </View>
            )}

            {(summary?.relationshipHeadline || (summary?.relationshipChange ?? 0) !== 0) && (
              <View style={[styles.eventBox, { backgroundColor: `${Colors.happiness}12`, borderColor: `${Colors.happiness}33` }]}>
                <Text style={styles.eventTitle}>❤️ Personal Life</Text>
                {summary?.relationshipHeadline && <Text style={styles.eventDesc}>{summary.relationshipHeadline}</Text>}
                {(summary?.relationshipChange ?? 0) !== 0 && (
                  <Text style={[styles.eventEffect, { color: (summary.relationshipChange ?? 0) >= 0 ? Colors.happiness : Colors.negative }]}>
                    Relationship {(summary.relationshipChange ?? 0) > 0 ? '+' : ''}{summary.relationshipChange}
                  </Text>
                )}
              </View>
            )}

            {summary?.diedThisWeek && (
              <View style={[styles.eventBox, { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: Colors.cardBorder }]}>
                <Text style={styles.eventTitle}>🕯️ Life Complete</Text>
                <Text style={styles.eventDesc}>This was your final week. Your legacy summary will open after continuing.</Text>
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

          <GameButton label="Continue" trailingIcon="arrow-forward" onPress={dismissSummary} />
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
  sheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '84%' },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  eyebrow: { color: Colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { color: Colors.textPrimary, fontSize: 21, fontWeight: '900', marginTop: 2 },
  scroll: { marginBottom: 14 },
  resultHero: { backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginBottom: 10 },
  resultLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  resultValue: { fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 1 },
  headline: { color: Colors.textSecondary, fontSize: 11, lineHeight: 16, fontStyle: 'italic', marginTop: 3, marginBottom: 11 },
  resultMetrics: { flexDirection: 'row', gap: 7 },
  resultMetric: { flex: 1, minWidth: 0, backgroundColor: Colors.card, borderRadius: 9, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 8, paddingVertical: 7 },
  resultMetricLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  resultMetricValue: { fontSize: 11, fontWeight: '900', marginTop: 2 },
  inflationBox: { backgroundColor: `${Colors.warning}22`, borderRadius: 8, padding: 10, marginBottom: 8 },
  inflationText: { color: Colors.warning, fontSize: 13, fontWeight: '600' },
  sectionLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '900', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  financeToggle: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.elevated, paddingHorizontal: 11, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  financeToggleTitle: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
  financeToggleSub: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
  financeToggleIcon: { color: Colors.textMuted, fontSize: 18, fontWeight: '800', width: 18, textAlign: 'center' },
  financeDetails: { paddingHorizontal: 2, paddingBottom: 2 },
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
});
