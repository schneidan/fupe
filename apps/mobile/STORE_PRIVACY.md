# FUPE — App Store / Play privacy draft

Fill these into **App Store Connect → App Privacy** and **Google Play → App content → Data safety** when submitting. Revisit whenever you add analytics, ads, or IAP.

## Current product (accounts on; no ads / no IAP yet)

| Data | Collected? | Linked to identity? | Used for tracking? | Purpose |
|------|------------|---------------------|--------------------|---------|
| Search / lookup queries (brand name, barcode) | Yes (sent to FUPE API) | No for guests; yes if signed in | No | App functionality |
| Photos / camera (barcode or packaging) | Transient — used for lookup, not stored in-app as a gallery. Packaging photos may be sent via FUPE → OpenRouter vision (ZDR); barcode-only paths stay on-device/FUPE. | No | No | App functionality |
| Email / account credentials | Yes (Contribute: register, login, verify, password reset) | Yes | No | Account / App functionality |
| Trust score, edit submissions, API keys (if created on web) | Yes (server-side) | Yes | No | App functionality |
| Device ID / Advertising ID | No | — | No | — |
| Location | No | — | No | — |
| Crash / analytics SDKs | No | — | No | — |

**Apple “Used for Tracking”:** No  
**Apple “Privacy Nutrition Label” tracking:** None today  
**Google Data safety — “Data is collected”:** Yes (product interaction + account email when the user registers)  
**Google — “Data is shared with third parties”:** Only as needed to run the product (your API; email via Resend for verify/reset; OpenRouter + model hosts for optional AI image identify / API speech-to-text under ZDR). No ad networks. Say “not shared for advertising” until ads ship. Point to `https://fupe.app/legal/privacy` for AI / ZDR detail.

**User rights:** Export and delete account from Contribute (matches web GDPR panel). Privacy Policy: `https://fupe.app/legal/privacy`.

Permission strings already in the binary:
- Camera — barcode / packaging lookup  
- Photo library — packaging photo lookup  

## Future: advertising (likely)

When ads are added, update store forms **before** release:

1. Declare **Advertising Data** / **Device ID** (IDFA / AAID) if used.
2. Set **Used for Tracking** = Yes on Apple if you (or an SDK) link data across apps/sites for ads.
3. Add ATT prompt (`NSUserTrackingUsageDescription`) if you use IDFA on iOS.
4. Update this file + `PrivacyInfo.xcprivacy` (`NSPrivacyTracking`, tracking domains, collected types).
5. Confirm public Privacy Policy URL still accurate.

Until then, keep `NSPrivacyTracking` = false in `PrivacyInfo.xcprivacy`.

## Future: billing / Pro IAP

Held — no StoreKit / Play Billing yet. When added, declare purchase history only if you collect it beyond Apple/Google’s own receipts.

## Still required before public store submit (Phase 9)

- [ ] Real bundle ID (replace `com.example.fupeMobile` / `com.example.fupe_mobile`)
- [ ] Apple Developer + Google Play developer accounts
- [ ] Production API / web hosting + domain — done (`fupe.app`)
- [ ] Privacy Policy URL — `https://fupe.app/legal/privacy`
- [ ] Screenshots + store listing copy
- [ ] App Privacy / Data safety forms filed in Connect / Play Console (include **email / account**)
- [ ] Re-check this questionnaire after any SDK change
