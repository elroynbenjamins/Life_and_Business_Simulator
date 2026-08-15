# Google Play closed-testing checklist

## Before uploading

- Confirm the permanent Android package name in `app.json` before creating the Play Console app.
- Replace the AdMob test app and ad-unit IDs with production IDs.
- Create and activate the consumable products `gems_100`, `gems_250`, `gems_500`, `gems_1000`, and `gems_2500`.
- Create `remove_ads` as a non-consumable product with a €2.99 base price.
- Host `PRIVACY_POLICY.md` at a public URL and enter it in Play Console.
- Complete Data safety, Ads, Content rating, Target audience, App access, and store-listing sections.
- Run `yarn validate` and `yarn doctor`.

## Build and upload

```powershell
npx.cmd eas-cli login
npx.cmd eas-cli build --platform android --profile production
npx.cmd eas-cli submit --platform android --profile production
```

The production profile creates an Android App Bundle and increments the remote build version. Submission is configured as a draft on the internal track so it can be reviewed before rollout. Promote a verified build to the closed-testing track in Play Console.

## Tester instructions

Ask all 12 testers to opt in and remain opted in continuously for at least 14 days. Give them the opt-in link and the feedback link from the Profile screen.

Each tester should try several of these areas:

- Create, load, rename through gameplay, and delete save slots.
- Advance at least 20 weeks and verify taxes and the period report.
- Complete education, obtain a job, and test promotion requirements.
- Buy and sell stocks and verify realized profit, dividends, and statistics.
- Start a business, inject cash, hire three employees, and run several weeks.
- Test business loans, upgrades, training, morale events, and valuation changes.
- Buy housing and vehicles and verify recurring expenses.
- Test rewarded ads, the scheduled interstitial, gem purchases, and Remove Ads restoration.
- Close the app during normal play, reopen it, and verify the current save.
- Try airplane mode and temporarily unavailable ads/store connections.

Report the device model, Android version, save slot, in-game year/week, expected result, actual result, and reproduction steps with every issue.
