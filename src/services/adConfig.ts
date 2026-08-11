// Ad configuration — swap test IDs for production IDs when releasing
// Using Google AdMob test ad unit IDs
export const AD_CONFIG = {
  // Test IDs from Google — safe for development
  REWARDED_AD_UNIT_ID_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_AD_UNIT_ID_IOS: 'ca-app-pub-3940256099942544/1712485313',
  INTERSTITIAL_AD_UNIT_ID_ANDROID: 'ca-app-pub-3940256099942544/1033173712',
  INTERSTITIAL_AD_UNIT_ID_IOS: 'ca-app-pub-3940256099942544/4411468910',
  // Reward settings
  DAILY_AD_LIMIT: 5,
} as const;
