const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidLargeHeap(config) {
  return withAndroidManifest(config, (config) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    application.$['android:largeHeap'] = 'true';
    return config;
  });
};
