// Ad configuration — swap test IDs for production IDs when releasing
// Using Google AdMob test ad unit IDs
export const AD_CONFIG = {
  // Test IDs from Google — safe for development
  REWARDED_AD_UNIT_ID_ANDROID: 'ca-app-pub-3940256099942544/5224354917',
  REWARDED_AD_UNIT_ID_IOS: 'ca-app-pub-3940256099942544/1712485313',
  // Reward settings
  REWARD_AMOUNT: 500,
  DAILY_AD_LIMIT: 5,
} as const;
