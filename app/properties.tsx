import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { inflated } from '../src/engine/economyEngine';
import { getTotalPropertyValue } from '../src/engine/propertyEngine';
import propertiesData from '../src/data/properties.json';
import { showGameDialog } from '../src/components/GameDialog';
import { getInspectionCost } from '../src/engine/auctionEngine';

export default function PropertiesScreen() {
  const router = useRouter();
  const cash = useGameStore((s) => s?.cash ?? 0);
  const properties = useGameStore((s) => s?.properties ?? []);
  const inflationMultiplier = useGameStore((s) => s?.inflationMultiplier ?? 1);
  const week = useGameStore((s) => s?.week ?? 1);
  const year = useGameStore((s) => s?.year ?? 1);
  const activeAuctions = useGameStore((s) => s?.activeAuctions ?? []);
  const buyProperty = useGameStore((s) => s?.buyProperty);
  const sellProperty = useGameStore((s) => s?.sellProperty);
  const togglePropertyRental = useGameStore((s) => s?.togglePropertyRental);
  const renovatePropertyAction = useGameStore((s) => s?.renovatePropertyAction);
  const placePropertyAuctionBid = useGameStore((s) => s?.placePropertyAuctionBid);
  const inspectPropertyAuction = useGameStore((s) => s?.inspectPropertyAuction);
  const leavePropertyAuction = useGameStore((s) => s?.leavePropertyAuction);
  const [tab, setTab] = useState<'listings' | 'auctions'>('listings');
  const [expandedAuctionId, setExpandedAuctionId] = useState<string | null>(null);
  const globalWeek = ((year - 1) * 20) + week;

  const totalValue = getTotalPropertyValue(properties);
  const weeklyIncome = properties.filter((p) => p.isRentedOut).reduce((t, p) => t + (p.weeklyIncome ?? 0), 0);

  const confirmAction = (title: string, msg: string, action: () => void) => {
    showGameDialog({ title, message: msg, onConfirm: action });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Real Estate</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Portfolio Summary */}
        <GameCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Portfolio Value</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.summaryCaption}>{properties.length} properties | {formatCurrency(weeklyIncome)}/week income</Text>
        </GameCard>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, tab === 'listings' && styles.tabActive]} onPress={() => setTab('listings')}>
            <Text style={[styles.tabText, tab === 'listings' && styles.tabTextActive]}>Listings</Text>
          </Pressable>
          <Pressable style={[styles.tab, tab === 'auctions' && styles.tabActive]} onPress={() => setTab('auctions')}>
            <Text style={[styles.tabText, tab === 'auctions' && styles.tabTextActive]}>Auctions ({activeAuctions.length})</Text>
          </Pressable>
        </View>

        {/* Owned Properties */}
        {properties.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Properties</Text>
            {properties.map((prop) => (
              <GameCard key={prop.id} style={styles.propCard}>
                <View style={styles.propHeader}>
                  <View>
                    <Text style={styles.propName}>{prop.name}</Text>
                    <Text style={styles.propType}>{prop.isRenovated ? '✨ Renovated' : ''} {prop.isRentedOut ? '🔑 Rented Out' : '🏠 Vacant'}</Text>
                    {prop.acquisitionType === 'auction' && <Text style={styles.auctionBadge}>Acquired at auction · Condition {prop.conditionScore ?? '?'} / 100</Text>}
                  </View>
                  <Text style={styles.propValue}>{formatCurrency(prop.currentValue)}</Text>
                </View>
                {prop.hiddenIssue && !prop.isRenovated && <Text style={styles.issueText}>⚠ Hidden issue discovered: {prop.hiddenIssue}</Text>}
                <View style={styles.propStats}>
                  <Text style={styles.propStat}>Bought: {formatCurrency(prop.purchasePrice)}</Text>
                  <Text style={[styles.propStat, { color: Colors.primary }]}>
                    {prop.isRentedOut ? `+${formatCurrency(prop.weeklyIncome)}/wk` : 'Not rented'}
                  </Text>
                  <Text style={styles.propStat}>Maint: {formatCurrency(prop.weeklyMaintenance)}/wk</Text>
                </View>
                {prop.acquisitionType === 'auction' && <Text style={styles.helpText}>Total invested so far: {formatCurrency(prop.purchasePrice + (prop.inspectionCostPaid ?? 0))} · Unrealized equity: {formatCurrency(prop.currentValue - prop.purchasePrice - (prop.inspectionCostPaid ?? 0))}</Text>}
                <View style={styles.propActions}>
                  <Pressable style={styles.actionBtn} onPress={() => togglePropertyRental?.(prop.id)}>
                    <Text style={styles.actionBtnText}>{prop.isRentedOut ? 'Stop Renting' : 'Rent Out'}</Text>
                  </Pressable>
                  {!prop.isRenovated && (
                    <Pressable
                      style={[styles.actionBtn, styles.renovateBtn]}
                      onPress={() => {
                        const typeData = (propertiesData as any[]).find((p) => p?.id === prop.typeId);
                        const cost = prop.acquisitionType === 'auction' && (prop.auctionCosts ?? 0) > 0
                          ? prop.auctionCosts ?? 0
                          : inflated(typeData?.renovationCost ?? 0, inflationMultiplier);
                        confirmAction('Renovate', `Cost: ${formatCurrency(cost)}`, () => renovatePropertyAction?.(prop.id));
                      }}
                    >
                      <Text style={styles.actionBtnText}>Renovate</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[styles.actionBtn, styles.sellBtn]}
                    onPress={() => confirmAction('Sell Property', `Sell for ${formatCurrency(prop.currentValue)}?`, () => sellProperty?.(prop.id))}
                  >
                    <Text style={styles.actionBtnText}>Sell</Text>
                  </Pressable>
                </View>
              </GameCard>
            ))}
          </>
        )}

        {tab === 'listings' && <>
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Buy Property</Text>
        {(propertiesData as any[]).map((prop) => {
          const price = inflated(prop.purchasePrice, inflationMultiplier);
          const canAfford = cash >= price;
          return (
            <GameCard key={prop.id} style={styles.propCard}>
              <View style={styles.propHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{prop.name}</Text>
                  <Text style={styles.propDesc}>{prop.description}</Text>
                </View>
              </View>
              <View style={styles.propStats}>
                <Text style={styles.propStat}>Price: {formatCurrency(price)}</Text>
                <Text style={[styles.propStat, { color: Colors.primary }]}>Income: {formatCurrency(prop.weeklyRentalIncome)}/wk</Text>
                <Text style={styles.propStat}>Maint: {formatCurrency(prop.weeklyMaintenance)}/wk</Text>
              </View>
              <Pressable
                style={[styles.buyBtn, !canAfford && styles.buyBtnDisabled]}
                onPress={() => canAfford && confirmAction('Buy Property', `Purchase ${prop.name} for ${formatCurrency(price)}?`, () => buyProperty?.(prop.id))}
                disabled={!canAfford}
              >
                <Text style={styles.buyBtnText}>{canAfford ? `Buy ${formatCurrency(price)}` : 'Cannot Afford'}</Text>
              </Pressable>
            </GameCard>
          );
        })}
        </>}

        {tab === 'auctions' && <>
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Live Auctions</Text>
          <Text style={styles.helpText}>Inspection fees are not refunded. Your winning bid is paid when the auction ends.</Text>
          {activeAuctions.map((auction) => {
            const expanded = expandedAuctionId === auction.id;
            const remaining = Math.max(0, auction.auctionEndWeek - globalWeek);
            const minimumBid = auction.currentBid + auction.minimumBidIncrease;
            const strongBid = minimumBid + auction.minimumBidIncrease * 2;
            const aggressiveBid = minimumBid + auction.minimumBidIncrease * 6;
            const inspectCost = getInspectionCost(auction);
            const bid = (amount: number) => confirmAction('Place Auction Bid', `Bid ${formatCurrency(amount)} on ${auction.propertyName}? AI investors may counter immediately.`, () => placePropertyAuctionBid?.(auction.id, amount));
            return <GameCard key={auction.id} style={styles.propCard}>
              <View style={styles.propHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.propName}>{auction.rareOpportunity ? '⭐ ' : ''}{auction.propertyName}</Text>
                  <Text style={styles.propDesc}>{auction.location} · {auction.auctionType}</Text>
                </View>
                <Text style={styles.endsText}>{remaining} wk left</Text>
              </View>
              <View style={styles.auctionMainStats}>
                <View><Text style={styles.miniLabel}>Estimated value</Text><Text style={styles.miniValue}>{formatCurrency(auction.estimatedValueMin)} – {formatCurrency(auction.estimatedValueMax)}</Text></View>
                <View><Text style={styles.miniLabel}>Current bid</Text><Text style={styles.bidValue}>{formatCurrency(auction.currentBid)}</Text></View>
              </View>
              <Text style={[styles.bidStatus, { color: auction.playerIsHighestBidder ? Colors.primary : auction.playerHighestBid > 0 ? Colors.negative : Colors.textMuted }]}>
                {auction.playerIsHighestBidder ? 'You are the highest bidder' : auction.playerHighestBid > 0 ? 'You have been outbid' : `${auction.aiBidders.length} Bidders`}
              </Text>
              <View style={styles.propActions}>
                <Pressable style={styles.actionBtn} onPress={() => setExpandedAuctionId(expanded ? null : auction.id)}><Text style={styles.actionBtnText}>{expanded ? 'Hide' : 'View'}</Text></Pressable>
                <Pressable style={[styles.actionBtn, styles.renovateBtn]} onPress={() => bid(minimumBid)}><Text style={styles.actionBtnText}>Bid {formatCurrency(minimumBid)}</Text></Pressable>
              </View>
              {expanded && <View style={styles.detailsBox}>
                <Text style={styles.detailText}>Expected rent: {formatCurrency(auction.expectedWeeklyRent * 4)}/month</Text>
                <Text style={styles.detailText}>Condition: {auction.conditionKnown ? `${auction.conditionScore} / 100` : 'Unknown'}</Text>
                <Text style={styles.detailText}>Tenant: {auction.tenantStatusKnown ? auction.tenantStatus : 'Unknown'}</Text>
                <Text style={styles.detailText}>Renovation: {auction.inspectionPurchased ? `${formatCurrency(auction.estimatedRenovationCostMin)} – ${formatCurrency(auction.estimatedRenovationCostMax)}` : 'Unknown'}</Text>
                {auction.hiddenIssueKnown && auction.hiddenIssue && <Text style={styles.issueText}>Inspection warning: {auction.hiddenIssue}</Text>}
                <Text style={styles.detailText}>Minimum increase: {formatCurrency(auction.minimumBidIncrease)}</Text>
                {!auction.inspectionPurchased && <Pressable style={styles.inspectBtn} disabled={cash < inspectCost} onPress={() => confirmAction('Property Inspection', `Spend ${formatCurrency(inspectCost)} to reveal condition, tenant status and a narrower estimate?`, () => inspectPropertyAuction?.(auction.id))}><Text style={styles.inspectBtnText}>{cash >= inspectCost ? `Inspect · ${formatCurrency(inspectCost)}` : 'Cannot afford inspection'}</Text></Pressable>}
                <View style={styles.bidOptions}>
                  <Pressable style={styles.bidOption} disabled={cash < strongBid} onPress={() => bid(strongBid)}><Text style={styles.bidOptionText}>Strong{`\n`}{formatCurrency(strongBid)}</Text></Pressable>
                  <Pressable style={styles.bidOption} disabled={cash < aggressiveBid} onPress={() => bid(aggressiveBid)}><Text style={styles.bidOptionText}>Aggressive{`\n`}{formatCurrency(aggressiveBid)}</Text></Pressable>
                </View>
                {auction.playerHighestBid > 0 && <Pressable style={styles.leaveBtn} onPress={() => leavePropertyAuction?.(auction.id)}><Text style={styles.leaveText}>Leave Auction</Text></Pressable>}
              </View>}
            </GameCard>;
          })}
        </>}
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
  summaryCard: { marginBottom: 16 },
  summaryLabel: { color: Colors.textSecondary, fontSize: 13 },
  summaryValue: { color: Colors.primary, fontSize: 28, fontWeight: '700', marginTop: 4 },
  summaryCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 10, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: '700' },
  tabTextActive: { color: Colors.white },
  propCard: { marginBottom: 12 },
  propHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  propName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600' },
  propType: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  auctionBadge: { color: Colors.warning, fontSize: 11, marginTop: 4 },
  issueText: { color: Colors.negative, fontSize: 12, marginTop: 8 },
  propDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  propValue: { color: Colors.primary, fontSize: 18, fontWeight: '700' },
  propStats: { flexDirection: 'row', gap: 12, marginTop: 8, flexWrap: 'wrap' },
  propStat: { color: Colors.textSecondary, fontSize: 12 },
  propActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  renovateBtn: { borderColor: '#F59E0B' },
  sellBtn: { borderColor: Colors.negative },
  actionBtnText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  buyBtn: { backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buyBtnDisabled: { backgroundColor: Colors.cardBorder, opacity: 0.5 },
  buyBtnText: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  helpText: { color: Colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  endsText: { color: Colors.warning, fontSize: 12, fontWeight: '700' },
  auctionMainStats: { gap: 9, marginTop: 12 },
  miniLabel: { color: Colors.textMuted, fontSize: 11 },
  miniValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  bidValue: { color: Colors.primary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  bidStatus: { fontSize: 12, fontWeight: '700', marginTop: 10 },
  detailsBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 12, gap: 7 },
  detailText: { color: Colors.textSecondary, fontSize: 12 },
  inspectBtn: { backgroundColor: Colors.info, borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 5 },
  inspectBtnText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  bidOptions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  bidOption: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  bidOptionText: { color: Colors.textPrimary, textAlign: 'center', fontWeight: '700', fontSize: 12 },
  leaveBtn: { alignItems: 'center', paddingVertical: 8 },
  leaveText: { color: Colors.negative, fontWeight: '700', fontSize: 12 },
});
