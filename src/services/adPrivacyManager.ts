let initialization: Promise<boolean> | null = null;
let adsAllowed = false;

export function initializeAdConsent(): Promise<boolean> {
  if (initialization) return initialization;

  initialization = (async () => {
    try {
      const adsModule = await import('react-native-google-mobile-ads');
      const consentInfo = await adsModule.AdsConsent.gatherConsent();
      adsAllowed = consentInfo.canRequestAds;
      if (adsAllowed) await adsModule.default().initialize();
      return adsAllowed;
    } catch {
      adsAllowed = false;
      return false;
    }
  })();

  return initialization;
}

export async function canRequestAds(): Promise<boolean> {
  if (!initialization) await initializeAdConsent();
  else await initialization;
  return adsAllowed;
}

export async function showAdPrivacyOptions(): Promise<boolean> {
  try {
    const { AdsConsent } = await import('react-native-google-mobile-ads');
    const consentInfo = await AdsConsent.showPrivacyOptionsForm();
    adsAllowed = consentInfo.canRequestAds;
    return true;
  } catch {
    return false;
  }
}
