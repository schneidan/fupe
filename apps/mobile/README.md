# FUPE Mobile

Flutter app for PE ownership lookup — mirrors the web YES/NO flow.

## Prerequisites

- API running on port **3000** (`./restart.sh` from repo root)
- Flutter SDK 3.29+ (tested on 3.47)
- **CocoaPods** for iOS (`brew install cocoapods`)
- `mobile_scanner` **7.x** (Apple Vision on iOS — works on Apple Silicon simulators; v6 used ML Kit and excluded arm64 simulators)

If `pod install` fails with encoding errors, run:

```bash
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
```

## Run

```bash
cd apps/mobile
flutter pub get
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8   # if pod install complains
flutter run -d iPhone
```

The app uses a **dark grey UI**. If you see a white screen with `{"message":"Cannot GET /"...}`, you're viewing the **API** in a browser (port 3000), not the Flutter app.

## API URL

| Platform | Default API base |
|----------|------------------|
| iOS Simulator / macOS | `http://localhost:3000` |
| Android Emulator | `http://10.0.2.2:3000` |

Override:

```bash
flutter run --dart-define=API_URL=http://192.168.1.10:3000 \
  --dart-define=FIRST_PARTY_LOOKUP_SECRET=same-as-api-env
```

Production IMAGE lookup needs `FIRST_PARTY_LOOKUP_SECRET` matching the API (anonymous third-party IMAGE is blocked). Local API with unset secret still allows IMAGE when `NODE_ENV` is not `production`.

## Tabs

- **Ask** — “Is ___ owned by PE?” + barcode/photo lookup
- **Browse** — searchable directory; tap opens the YES/NO result for that entity
- **Contribute** — sign in, suggest edits, propose entities; staff see **Admin** (full hub on device)

## Deep links

Open the YES/NO result for an entity:

```
fupe://entity/panera-bread
```

Open the staff admin hub (role-gated; non-staff see no Contribute Admin button):

```
fupe://admin
fupe://admin/contributions
```

Simulator test (iOS):

```bash
xcrun simctl openurl booted "fupe://entity/panera-bread"
xcrun simctl openurl booted "fupe://admin"
```
## Store prep

See [`STORE_PRIVACY.md`](STORE_PRIVACY.md) for App Store / Play privacy questionnaire answers (including notes for future ads). Billing / IAP is deferred.
