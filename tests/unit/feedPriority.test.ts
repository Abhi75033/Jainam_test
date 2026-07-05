import { computeFeedPriorityRank } from '@/engines/visibility/visibility.service';

describe('Feed priority ranking (§5.13)', () => {
  it('orders: followed < community < geo rings < global fallback', () => {
    const followed = computeFeedPriorityRank({ isFollowed: true, isCommunityMatch: false, geoRingIndex: null, isGlobalFallback: false });
    const community = computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: true, geoRingIndex: null, isGlobalFallback: false });
    const geoNear = computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: 1, isGlobalFallback: false });
    const geoFar = computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: 7, isGlobalFallback: false });
    const global = computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex: null, isGlobalFallback: true });

    expect(followed).toBeLessThan(community);
    expect(community).toBeLessThan(geoNear);
    expect(geoNear).toBeLessThan(geoFar);
    expect(geoFar).toBeLessThan(global);
  });

  it('progressive geo expansion: closer rings rank higher', () => {
    const rings = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((geoRingIndex) =>
      computeFeedPriorityRank({ isFollowed: false, isCommunityMatch: false, geoRingIndex, isGlobalFallback: false }),
    );
    const sorted = [...rings].sort((a, b) => a - b);
    expect(rings).toEqual(sorted);
  });
});
