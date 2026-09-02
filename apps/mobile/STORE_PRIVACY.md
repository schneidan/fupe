# FUPE — App Store / Play privacy draft

Fill these into **App Store Connect → App Privacy** and **Google Play → App content → Data safety** when submitting. Revisit whenever you add analytics, ads, or accounts.

## Current product (no ads / no IAP yet)

| Data | Collected? | Linked to identity? | Used for tracking? | Purpose |
|------|------------|---------------------|--------------------|---------|
| Search / lookup queries (brand name, barcode) | Yes (sent to FUPE API) | No (no account) | No | App functionality |
| Photos / camera (barcode or packaging) | Transient — used for lookup, not stored in-app as a gallery | No | No | App functionality |
| Device ID / Advertising ID | No | — | No | — |
| Location | No | — | No | — |
| Contact info / account | No | — | No | — |
| Crash / analytics SDKs | No | — | No | — |

**Apple “Used for Tracking”:** No  
**Apple “Privacy Nutrition Label” tracking:** None today  
**Google Data safety — “Data is collected”:** Yes (product interaction / search content to perform lookups)  
**Google — “Data is shared with third parties”:** Only as needed to run the lookup (your API). No ad networks. Say “not shared for advertising” until ads ship.

Permission strings already in the binary:
- Camera — barcode / packaging lookup  
- Photo library — packaging photo lookup  

## Future: advertising (likely)

When ads are added, update store forms **before** release:

1. Declare **Advertising Data** / **Device ID** (IDFA / AAID) if used.
2. Set **Used for Tracking** = Yes on Apple if you (or an SDK) link data across apps/sites for ads.
3. Add ATT prompt (`NSUserTrackingUsageDescription`) if you use IDFA on iOS.
4. Update this file + `PrivacyInfo.xcprivacy` (`NSPrivacyTracking`, tracking domains, collected types).
5. Link a public Privacy Policy URL (Phase 7).

Until then, keep `NSPrivacyTracking` = false in `PrivacyInfo.xcprivacy`.

## Future: billing / Pro IAP

Held — no StoreKit / Play Billing yet. When added, declare purchase history only if you collect it beyond Apple/Google’s own receipts.

## Still required before public store submit

- [ ] Real bundle ID (replace `com.example.fupeMobile` / `com.example.fupe_mobile`)
- [ ] Apple Developer + Google Play developer accounts
- [ ] Privacy Policy URL (Phase 7)
- [ ] Screenshots + store listing copy
- [ ] Re-check this questionnaire after any SDK change
