import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../src/theme/colors';
import GameCard from '../src/components/GameCard';
import ScreenHeader from '../src/components/ScreenHeader';
import ScreenTabs from '../src/components/ScreenTabs';
import StatusPill from '../src/components/StatusPill';
import GameButton from '../src/components/GameButton';
import useGameStore from '../src/store/gameStore';
import { formatCurrency } from '../src/utils/format';
import { inflated } from '../src/engine/economyEngine';
import { getTotalPropertyValue, getPropertyWeeklyRent } from '../src/engine/propertyEngine';
import { getPrestigeEffects } from '../src/engine/prestigeEngine';
import propertiesData from '../src/data/properties.json';
import { showGameDialog } from '../src/components/GameDialog';
import { getInspectionCost } from '../src/engine/auctionEngine';
import { propertyItemImages } from '../src/assets/itemImages';

export default function PropertiesScreen() {
  const router = useRouter();
  const cash = useGameStore((s) => s?.cash ?? 0);
  const profile = useGameStore(s => s.profile);
  const rentBonus = getPrestigeEffects(profile).property_income ?? 0;
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
  const [tab, setTab] = useState<'owned' | 'listings' | 'auctions'>(properties.length > 0 ? 'owned' : 'listings');
  const [expandedAuctionId, setExpandedAuctionId] = useState<string | null>(null);
  const globalWeek = ((year - 1) * 20) + week;

  const totalValue = getTotalPropertyValue(properties);
  const weeklyIncome = properties.filter((p) => p.isRentedOut).reduce((t, p) => t + getPropertyWeeklyRent(p, inflationMultiplier, rentBonus), 0);

  const confirmAction = (title: string, msg: string, action: () => void) => {
    const confirmText = title.includes('Bid') ? 'Bid' : title.includes('Sell') ? 'Sell' : title.includes('Inspect') ? 'Inspect' : title.includes('Renovat') ? 'Renovate' : title.includes('Buy') ? 'Buy' : 'Confirm';
    showGameDialog({ title, message: msg, confirmText, destructive: title.includes('Sell'), onConfirm: action });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Real Estate"
        subtitle="Property portfolio, listings and auctions"
        showBack
        onBack={() => router.back()}
        accentColor={Colors.business}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Portfolio Summary */}
        <GameCard
          variant="hero"
          eyebrow="PROPERTY PORTFOLIO"
          title="Real estate value"
          accentColor={Colors.business}
          titleAccessory={<StatusPill compact icon="home-outline" label={`${properties.length} owned`} color={Colors.business} />}
        >
          <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.summaryCaption}>Rental income {formatCurrency(weeklyIncome)}/week</Text>
        </GameCard>

        <ScreenTabs
          items={[
            { key: 'owned', label: `Owned (${properties.length})`, icon: 'home-outline' },
            { key: 'listings', label: 'Listings', icon: 'search-outline' },
            { key: 'auctions', label: `Auctions (${activeAuctions.length})`, icon: 'hammer-outline' },
          ]}
          activeKey={tab}
          onChange={(next) => {
            setTab(next);
            if (next !== 'auctions') setExpandedAuctionId(null);
          }}
          accentColor={Colors.business}
        />

        <View style={styles.pixelArtCard}>
          <Image
            source={tab === 'auctions' ? require('../assets/pixel-art/auctions.png') : require('../assets/pixel-art/real-estate.png')}
            style={styles.pixelArt}
            resizeMode="contain"
            accessibilityLabel={tab === 'auctions' ? 'Pixel art real estate auction' : 'Pixel art real estate portfolio'}
          />
        </View>

        {/* Owned Properties */}
        {tab === 'owned' && properties.length > 0 && (
          <>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>My Properties</Text>
              <Text style={styles.sectionSub}>Manage rent, condition and exit decisions.</Text>
            </View>
            {properties.map((prop) => {
              const rent = getPropertyWeeklyRent(prop, inflationMultiplier, rentBonus);
              const maintenance = inflated(prop.weeklyMaintenance ?? 0, inflationMultiplier);
              const netRent = rent - maintenance;
              const invested = prop.purchasePrice + (prop.inspectionCostPaid ?? 0);
              return (
                <GameCard key={prop.id} compact style={styles.propCard}>
                  <View style={styles.itemIntro}>
                    <Image source={propertyItemImages[prop.typeId]} style={styles.itemIcon} resizeMode="contain" accessibilityLabel={`${prop.name} pixel art`} />
                    <View style={styles.propHeader}>
                      <Text style={styles.propName} numberOfLines={1}>{prop.name}</Text>
                      <View style={styles.statusRow}>
                        <StatusPill
                          compact
                          icon={prop.isRentedOut ? 'key-outline' : 'home-outline'}
                          label={prop.isRentedOut ? 'Rented' : 'Vacant'}
                          color={prop.isRentedOut ? Colors.primary : Colors.textSecondary}
                        />
                        {prop.isRenovated && <StatusPill compact icon="construct-outline" label="Renovated" color={Colors.warning} />}
                        {prop.acquisitionType === 'auction' && <StatusPill compact icon="hammer-outline" label="Auction" color={Colors.info} />}
                      </View>
                    </View>
                  </View>

                  <View style={styles.metricGrid}>
                    <View style={styles.metricCell}>
                      <Text style={styles.miniLabel}>Value</Text>
                      <Text style={styles.metricValue}>{formatCurrency(prop.currentValue)}</Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.miniLabel}>Net rent</Text>
                      <Text style={[styles.metricValue, { color: prop.isRentedOut ? (netRent >= 0 ? Colors.primary : Colors.negative) : Colors.textMuted }]}>
                        {prop.isRentedOut ? `${netRent >= 0 ? '+' : ''}${formatCurrency(netRent)}/wk` : 'Vacant'}
                      </Text>
                    </View>
                    <View style={styles.metricCell}>
                      <Text style={styles.miniLabel}>Maintenance</Text>
                      <Text style={styles.metricValue}>{formatCurrency(maintenance)}/wk</Text>
                    </View>
                  </View>

                  {prop.hiddenIssue && !prop.isRenovated && (
                    <View style={styles.issueStrip}>
                      <Ionicons name="warning-outline" size={14} color={Colors.negative} />
                      <Text style={styles.issueStripText} numberOfLines={2}>{prop.hiddenIssue}</Text>
                    </View>
                  )}

                  {prop.acquisitionType === 'auction' && (
                    <Text style={styles.investmentMeta}>
                      Invested {formatCurrency(invested)} • Unrealized equity {formatCurrency(prop.currentValue - invested)}
                    </Text>
                  )}

                  <View style={styles.actionGrid}>
                    <GameButton
                      compact
                      variant="secondary"
                      accentColor={Colors.business}
                      icon={prop.isRentedOut ? 'pause-outline' : 'key-outline'}
                      label={prop.isRentedOut ? 'Stop Renting' : 'Rent Out'}
                      onPress={() => togglePropertyRental?.(prop.id)}
                      style={styles.cardAction}
                    />
                    {!prop.isRenovated && (
                      <GameButton
                        compact
                        variant="secondary"
                        accentColor={Colors.warning}
                        icon="construct-outline"
                        label="Renovate"
                        onPress={() => {
                          const typeData = (propertiesData as any[]).find((p) => p?.id === prop.typeId);
                          const cost = prop.acquisitionType === 'auction' && (prop.auctionCosts ?? 0) > 0
                            ? prop.auctionCosts ?? 0
                            : inflated(typeData?.renovationCost ?? 0, inflationMultiplier);
                          confirmAction('Renovate', `Cost: ${formatCurrency(cost)}`, () => renovatePropertyAction?.(prop.id));
                        }}
                        style={styles.cardAction}
                      />
                    )}
                    <GameButton
                      compact
                      variant="danger"
                      icon="trash-outline"
                      label="Sell"
                      onPress={() => confirmAction('Sell Property', `Sell for ${formatCurrency(prop.currentValue)}?`, () => sellProperty?.(prop.id))}
                      style={styles.cardAction}
                    />
                  </View>
                </GameCard>
              );
            })}
          </>
        )}

        {tab === 'owned' && properties.length === 0 && (
          <GameCard variant="subtle">
            <View style={styles.emptyOwned}>
              <Ionicons name="home-outline" size={30} color={Colors.textMuted} />
              <Text style={styles.emptyOwnedTitle}>No properties owned yet</Text>
              <Text style={styles.emptyOwnedText}>Browse listings or auctions when you are ready to start a real-estate portfolio.</Text>
              <GameButton
                compact
                accentColor={Colors.business}
                icon="search-outline"
                label="Browse Listings"
                onPress={() => setTab('listings')}
                style={{ marginTop: 10 }}
              />
            </View>
          </GameCard>
        )}

        {tab === 'listings' && <>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Buy Property</Text>
            <Text style={styles.sectionSub}>Compare price with weekly rental potential.</Text>
          </View>
          {(propertiesData as any[]).map((prop) => {
            const price = inflated(prop.purchasePrice, inflationMultiplier);
            const rent = inflated(prop.weeklyRentalIncome ?? 0, inflationMultiplier);
            const maintenance = inflated(prop.weeklyMaintenance ?? 0, inflationMultiplier);
            const net = rent - maintenance;
            const canAfford = cash >= price;
            const missing = Math.max(0, price - cash);
            return (
              <GameCard key={prop.id} compact style={styles.propCard}>
                <View style={styles.itemIntro}>
                  <Image source={propertyItemImages[prop.id]} style={styles.itemIcon} resizeMode="contain" accessibilityLabel={`${prop.name} pixel art`} />
                  <View style={styles.propHeader}>
                    <Text style={styles.propName} numberOfLines={1}>{prop.name}</Text>
                    <Text style={styles.propDesc} numberOfLines={2}>{prop.description}</Text>
                  </View>
                  <StatusPill
                    compact
                    icon={canAfford ? 'checkmark-circle-outline' : 'wallet-outline'}
                    label={canAfford ? 'Affordable' : `Need ${formatCurrency(missing)}`}
                    color={canAfford ? Colors.primary : Colors.warning}
                  />
                </View>

                <View style={styles.metricGrid}>
                  <View style={styles.metricCell}>
                    <Text style={styles.miniLabel}>Price</Text>
                    <Text style={styles.metricValue}>{formatCurrency(price)}</Text>
                  </View>
                  <View style={styles.metricCell}>
                    <Text style={styles.miniLabel}>Rent</Text>
                    <Text style={[styles.metricValue, { color: Colors.primary }]}>{formatCurrency(rent)}/wk</Text>
                  </View>
                  <View style={styles.metricCell}>
                    <Text style={styles.miniLabel}>Net</Text>
                    <Text style={[styles.metricValue, { color: net >= 0 ? Colors.primary : Colors.negative }]}>
                      {net >= 0 ? '+' : ''}{formatCurrency(net)}/wk
                    </Text>
                  </View>
                </View>

                <GameButton
                  compact
                  accentColor={Colors.business}
                  icon="home-outline"
                  label={canAfford ? `Buy • ${formatCurrency(price)}` : `Need ${formatCurrency(missing)} more`}
                  onPress={() => confirmAction('Buy Property', `Purchase ${prop.name} for ${formatCurrency(price)}?`, () => buyProperty?.(prop.id))}
                  disabled={!canAfford}
                />
              </GameCard>
            );
          })}
        </>}

        {tab === 'auctions' && <>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Live Auctions</Text>
            <Text style={styles.sectionSub}>Inspect selectively and bid only when the spread makes sense.</Text>
          </View>
          {activeAuctions.map((auction) => {
            const expanded = expandedAuctionId === auction.id;
            const remaining = Math.max(0, auction.auctionEndWeek - globalWeek);
            const minimumBid = auction.currentBid + auction.minimumBidIncrease;
            const strongBid = minimumBid + auction.minimumBidIncrease * 2;
            const aggressiveBid = minimumBid + auction.minimumBidIncrease * 6;
            const inspectCost = getInspectionCost(auction);
            const canBid = cash >= minimumBid;
            const bid = (amount: number) => confirmAction('Place Auction Bid', `Bid ${formatCurrency(amount)} on ${auction.propertyName}? Other bidders may counter immediately.`, () => placePropertyAuctionBid?.(auction.id, amount));

            return (
              <GameCard key={auction.id} compact style={styles.propCard}>
                <View style={styles.itemIntro}>
                  <Image source={propertyItemImages[auction.propertyTypeId]} style={styles.itemIcon} resizeMode="contain" accessibilityLabel={`${auction.propertyName} pixel art`} />
                  <View style={styles.propHeader}>
                    <View style={styles.auctionTitleRow}>
                      <Text style={styles.propName} numberOfLines={1}>{auction.propertyName}</Text>
                      {auction.rareOpportunity && <Ionicons name="star" size={13} color={Colors.warning} />}
                    </View>
                    <Text style={styles.propDesc} numberOfLines={1}>{auction.location} • {auction.auctionType}</Text>
                    <View style={styles.statusRow}>
                      <StatusPill compact icon="time-outline" label={`${remaining}w left`} color={Colors.warning} />
                      <StatusPill
                        compact
                        icon={auction.playerIsHighestBidder ? 'checkmark-circle-outline' : auction.playerHighestBid > 0 ? 'alert-circle-outline' : 'people-outline'}
                        label={auction.playerIsHighestBidder ? 'Highest bidder' : auction.playerHighestBid > 0 ? 'Outbid' : `${auction.aiBidders.length} bidders`}
                        color={auction.playerIsHighestBidder ? Colors.primary : auction.playerHighestBid > 0 ? Colors.negative : Colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.auctionMetricRow}>
                  <View style={styles.auctionMetricPrimary}>
                    <Text style={styles.miniLabel}>Current bid</Text>
                    <Text style={styles.bidValue}>{formatCurrency(auction.currentBid)}</Text>
                  </View>
                  <View style={styles.auctionMetricSecondary}>
                    <Text style={styles.miniLabel}>Estimated value</Text>
                    <Text style={styles.miniValue} numberOfLines={1}>{formatCurrency(auction.estimatedValueMin)} – {formatCurrency(auction.estimatedValueMax)}</Text>
                  </View>
                </View>

                <View style={styles.actionGrid}>
                  <GameButton
                    compact
                    variant="secondary"
                    accentColor={Colors.info}
                    icon={expanded ? 'chevron-up-outline' : 'information-circle-outline'}
                    label={expanded ? 'Hide Details' : 'View Details'}
                    onPress={() => setExpandedAuctionId(expanded ? null : auction.id)}
                    style={styles.cardAction}
                  />
                  <GameButton
                    compact
                    accentColor={Colors.business}
                    icon="hammer-outline"
                    label={canBid ? `Bid ${formatCurrency(minimumBid)}` : 'Need cash'}
                    onPress={() => bid(minimumBid)}
                    disabled={!canBid}
                    style={styles.cardAction}
                  />
                </View>

                {expanded && (
                  <View style={styles.detailsBox}>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailCell}><Text style={styles.miniLabel}>Rent / month</Text><Text style={styles.detailValue}>{formatCurrency(auction.expectedWeeklyRent * 4)}</Text></View>
                      <View style={styles.detailCell}><Text style={styles.miniLabel}>Condition</Text><Text style={styles.detailValue}>{auction.conditionKnown ? `${auction.conditionScore}/100` : 'Unknown'}</Text></View>
                      <View style={styles.detailCell}><Text style={styles.miniLabel}>Tenant</Text><Text style={styles.detailValue} numberOfLines={1}>{auction.tenantStatusKnown ? auction.tenantStatus : 'Unknown'}</Text></View>
                      <View style={styles.detailCell}><Text style={styles.miniLabel}>Renovation</Text><Text style={styles.detailValue} numberOfLines={1}>{auction.inspectionPurchased ? `${formatCurrency(auction.estimatedRenovationCostMin)} – ${formatCurrency(auction.estimatedRenovationCostMax)}` : 'Unknown'}</Text></View>
                    </View>

                    {auction.hiddenIssueKnown && auction.hiddenIssue && (
                      <View style={styles.issueStrip}>
                        <Ionicons name="warning-outline" size={14} color={Colors.negative} />
                        <Text style={styles.issueStripText}>{auction.hiddenIssue}</Text>
                      </View>
                    )}

                    {!auction.inspectionPurchased && (
                      <GameButton
                        compact
                        variant="secondary"
                        accentColor={Colors.info}
                        icon="search-outline"
                        label={cash >= inspectCost ? `Inspect • ${formatCurrency(inspectCost)}` : `Need ${formatCurrency(inspectCost)}`}
                        onPress={() => confirmAction('Property Inspection', `Spend ${formatCurrency(inspectCost)} to reveal condition, tenant status and a narrower estimate?`, () => inspectPropertyAuction?.(auction.id))}
                        disabled={cash < inspectCost}
                      />
                    )}

                    <View style={styles.bidOptions}>
                      <GameButton
                        compact
                        variant="secondary"
                        accentColor={Colors.business}
                        label={`Strong • ${formatCurrency(strongBid)}`}
                        onPress={() => bid(strongBid)}
                        disabled={cash < strongBid}
                        style={styles.cardAction}
                      />
                      <GameButton
                        compact
                        variant="secondary"
                        accentColor={Colors.warning}
                        label={`Aggressive • ${formatCurrency(aggressiveBid)}`}
                        onPress={() => bid(aggressiveBid)}
                        disabled={cash < aggressiveBid}
                        style={styles.cardAction}
                      />
                    </View>

                    {auction.playerHighestBid > 0 && (
                      <GameButton compact variant="ghost" label="Leave Auction" icon="exit-outline" onPress={() => leavePropertyAuction?.(auction.id)} />
                    )}
                  </View>
                )}
              </GameCard>
            );
          })}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryValue: { color: Colors.primary, fontSize: 28, fontWeight: '700', marginTop: 4 },
  summaryCaption: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionHeading: { marginTop: 10, marginBottom: 8 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '900' },
  sectionSub: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  emptyOwned: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  emptyOwnedTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 8 },
  emptyOwnedText: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  pixelArtCard: { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  pixelArt: { width: '100%', height: 126 },
  propCard: { marginBottom: 8 },
  itemIntro: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  itemIcon: { width: 60, height: 60, flexShrink: 0 },
  propHeader: { flex: 1, minWidth: 0 },
  propName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
  auctionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  propDesc: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  metricGrid: { flexDirection: 'row', gap: 6, marginTop: 9 },
  metricCell: { flex: 1, minWidth: 0, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 7 },
  metricValue: { color: Colors.textPrimary, fontSize: 11, fontWeight: '800', marginTop: 2 },
  issueStrip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: `${Colors.negative}10`, borderWidth: 1, borderColor: `${Colors.negative}33`, borderRadius: 8, padding: 8, marginTop: 8 },
  issueStripText: { flex: 1, color: Colors.negative, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  investmentMeta: { color: Colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 7 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  cardAction: { flexGrow: 1, flexBasis: '46%' },
  auctionMetricRow: { flexDirection: 'row', gap: 7, marginTop: 9 },
  auctionMetricPrimary: { flex: 0.8, backgroundColor: `${Colors.business}0D`, borderWidth: 1, borderColor: `${Colors.business}33`, borderRadius: 8, padding: 8 },
  auctionMetricSecondary: { flex: 1.2, minWidth: 0, backgroundColor: Colors.elevated, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 8, padding: 8 },
  miniLabel: { color: Colors.textMuted, fontSize: 11 },
  miniValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 },
  bidValue: { color: Colors.primary, fontSize: 18, fontWeight: '800', marginTop: 2 },
  detailsBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: Colors.cardBorder, paddingTop: 12, gap: 7 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailCell: { flexBasis: '47%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: 8, padding: 7 },
  detailValue: { color: Colors.textPrimary, fontSize: 10, fontWeight: '700', marginTop: 2 },
  bidOptions: { flexDirection: 'row', gap: 6, marginTop: 4 },
});
