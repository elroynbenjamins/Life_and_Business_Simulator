# Life Empire app-ads.txt setup

Life Empire uses this authorized AdMob seller record:

    google.com, pub-2222059903000796, DIRECT, f08c47fec0942fa0

The record is stored in two locations:

- /app-ads.txt is the canonical repository copy.
- /public/app-ads.txt is copied to the root of an Expo web export.

## Publishing requirement

The file must be publicly reachable from the root of the developer website hostname entered in the Google Play listing:

    https://your-domain.example/app-ads.txt

The response should contain the seller record as plain text and return HTTP status 200.

Do not use a GitHub repository or blob URL as the Developer website. AdMob derives the root hostname from that field, so a github.com URL would make it look for https://github.com/app-ads.txt.

A GitHub Pages project URL such as https://elroynbenjamins.github.io/Life_and_Business_Simulator/ has the same root-hostname consideration: AdMob checks https://elroynbenjamins.github.io/app-ads.txt. To use that hostname, publish the file from the root user-site repository named elroynbenjamins.github.io, or use a custom domain.

## Verification

1. Deploy the website and open its root app-ads.txt URL in a private browser window.
2. In Google Play Console, set that hostname as the Developer website under the store-listing contact details.
3. Wait at least 24 hours for the listing update and AdMob crawler.
4. Return to AdMob and check the app-ads.txt status.

This is a website configuration. It does not require a new Android App Bundle by itself.
