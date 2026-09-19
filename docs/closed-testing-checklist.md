# Android closed-testing checklist

## Before the first build

- [x] App name is Life Empire.
- [x] Android package is `com.elroybenjamins.lifeempire`.
- [x] Production AdMob app and placement IDs are configured.
- [x] Consent gathering and an in-game advertising privacy-options button are implemented.
- [x] Google Play Billing product IDs are implemented.
- [x] Privacy policy identifies Snelroy, Elroy N Benjamins, and the privacy contact.
- [x] Add the AdMob seller record to /app-ads.txt and /public/app-ads.txt.
- [ ] Deploy a developer website that serves /app-ads.txt at its hostname root, add that website to the Google Play store-listing contact details, and verify it in AdMob.
- [x] Support email set to `Developerelroy@gmail.com` in the policy and app.
- [x] Verify the public privacy policy at https://elroynbenjamins.github.io/life-empire/privacy/ without signing in, and add that URL in Play Console.
- [ ] Create and activate Play products: `remove_ads`, `gems_100`, `gems_250`, `gems_500`, `gems_1000`, and `gems_2500`.
- [ ] Set `remove_ads` to €2.99 or the desired regional base price; Google Play supplies localized prices.
- [ ] Complete App access, Ads, Content rating, Target audience, Data safety, and Financial features declarations.
- [x] Upload a 1024 × 500 feature graphic and at least two phone screenshots.

## Build profiles

- Direct-install APK for a few devices: `eas build --platform android --profile preview`
- Google Play internal-test AAB: `eas build --platform android --profile play-internal`
- Google Play closed-test AAB: `eas build --platform android --profile closed-testing`

The first Google Play upload may need to be completed manually in Play Console. After a Google service account is configured for EAS Submit, use:

- Internal: `eas submit --platform android --profile play-internal`
- Closed test: `eas submit --platform android --profile closed-testing`

## Twelve-tester test plan

- [ ] Create a closed-testing email list containing at least 12 Google accounts.
- [ ] Publish the closed-test release and share its opt-in link.
- [ ] Confirm all 12 testers opt in and remain opted in continuously for at least 14 days.
- [ ] Ask every tester to install, open, and meaningfully test the game.
- [ ] Keep at least one backup tester enrolled in case someone leaves.
- [ ] Record device model, Android version, tested systems, defects, and feedback.
- [ ] Publish fixes to the same closed track without ending the test.
- [ ] After the requirement is met, answer Play Console's production-access questions using the recorded evidence.

## Core acceptance test

- [ ] New game, tutorial, saves, load, delete save, and restart.
- [ ] Education completion, rewarded completion, part-time work, car delivery, job application, housing-gated promotions.
- [ ] Weekly and 20-week reports, tax bill, negative-cash recovery, statistics.
- [ ] Stocks: buy, sell, dividends, realized P/L, market news and long-session behavior.
- [ ] Bank: loans, deposits, maturity, interest, and Prestige modifiers.
- [ ] Business: purchase, funding notice, recruitment cancellation/retry, employees, training, upgrades, events, loans, reputation, competitors, and locations.
- [ ] Properties and auctions: inspection, 2–5 bidders, bid, win/loss, rent, renovation, and sale.
- [ ] Ads: consent, five-per-day gem reward cap, education reward only after completion, scheduled interstitial, and Remove Ads behavior.
- [ ] Billing: each gem product, duplicate protection, Remove Ads, and restore purchase.
- [ ] Offline launch, app background/restore, orientation, Android back action, and multiple screen sizes.
