import { auctionToProperty, ensureAuctions, getInspectionCost, inspectAuction, placeAuctionBid } from '../auctionEngine';

describe('real-estate auctions', () => {
  test('generates a playable early-game auction set', () => {
    const auctions = ensureAuctions([], 1, 1, 10_000);
    expect(auctions).toHaveLength(3);
    for (const auction of auctions) {
      expect(auction.currentBid).toBe(auction.startingBid);
      expect(auction.currentBid).toBeLessThan(auction.marketValue);
      expect(auction.aiBidders.length).toBeGreaterThanOrEqual(2);
      expect(auction.aiBidders.length).toBeLessThanOrEqual(5);
      expect(auction.auctionEndWeek).toBeGreaterThan(1);
    }
  });

  test('inspection narrows estimates and reveals property information', () => {
    const auction = ensureAuctions([], 10, 1, 100_000)[0];
    const inspected = inspectAuction(auction);
    expect(getInspectionCost(auction)).toBe(Math.round(Math.max(500, auction.marketValue * 0.003)));
    expect(inspected.inspectionPurchased).toBe(true);
    expect(inspected.conditionKnown).toBe(true);
    expect(inspected.tenantStatusKnown).toBe(true);
    expect(inspected.estimatedValueMax - inspected.estimatedValueMin).toBeLessThan(auction.estimatedValueMax - auction.estimatedValueMin);
  });

  test('records a valid player bid and transfers a win into the shared property model', () => {
    const auction = ensureAuctions([], 5, 1, 1_000_000)[0];
    const amount = auction.currentBid + auction.minimumBidIncrease;
    const bidAuction = placeAuctionBid({ ...auction, aiBidders: [] }, amount);
    expect(bidAuction.playerIsHighestBidder).toBe(true);
    expect(bidAuction.playerHighestBid).toBe(amount);

    const property = auctionToProperty(bidAuction, 6, 1);
    expect(property.acquisitionType).toBe('auction');
    expect(property.purchasePrice).toBe(amount);
    expect(property.auctionCosts).toBeGreaterThanOrEqual(bidAuction.actualRenovationCost);
    expect(property.isRentedOut).toBe(false);
  });

  test('expands the late-game auction pool to six auctions and advanced asset types', () => {
    let seed = 717;
    const random = jest.spyOn(Math, 'random').mockImplementation(() => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
    const auctions = ensureAuctions([], 500, 1.5, 10_000_000);
    const generatedTypes = new Set(Array.from({ length: 120 }, () => ensureAuctions([], 500, 1.5, 10_000_000)[0].auctionType));
    random.mockRestore();
    expect(auctions).toHaveLength(6);
    expect(generatedTypes.has('Luxury Auction')).toBe(true);
    expect(generatedTypes.has('Commercial Auction')).toBe(true);
    expect(generatedTypes.has('Development Land Auction')).toBe(true);
  });
});
