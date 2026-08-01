# Pinned Mobile (Android companion)

Capture-only companion to the Pinned desktop app. Jot tasks on your phone, then
push them to the laptop over local WiFi by scanning a QR code. No cloud, no
accounts, no background services — every sync is a deliberate, one-time action.

## Status

| Phase | What | State |
| --- | --- | --- |
| 1 | Gradle + Android project scaffold, Room store | done |
| 2 | `mobile.html` UI preview (mobile-elevated dark) | done |
| 3 | Compose screens (capture, quick add, QR scan, syncing, result, settings) | done |
| 4 | OkHttp sync client + desktop Rust receiver & QR generation | partial (client done) |

## Previewing the UI

`mobile.html` is a standalone, phone-framed replica of the app's screens using the
desktop app's own design tokens. Open it in any browser — no build step:

```
xdg-open mobile/mobile.html
```

## Building the APK

This project has **not been compiled** — there is no Gradle, Android SDK, or `adb`
available in the environment it was authored in, so treat the Kotlin sources as
unverified until you build them yourself.

`gradle/wrapper/gradle-wrapper.jar` is a binary and is **not** included. Generate it
before the first build, or skip it by opening `mobile/` in Android Studio (it will
create the wrapper and sync automatically):

```bash
cd mobile
gradle wrapper --gradle-version 8.9   # one time, needs a system Gradle
./gradlew assembleDebug
./gradlew installDebug                # with a device attached
```

Requirements: JDK 17+, Android SDK with platform 34, minSdk 26 device or emulator.

## Layout

```
mobile/
  app/src/main/
    AndroidManifest.xml            CAMERA + INTERNET, cleartext for LAN POST
    java/com/pinned/mobile/
      MainActivity.kt              single-activity Compose host
      data/                        Room: CapturedTask, DAO, database
      sync/                        OkHttp client + pairing codec
      ui/                          Capture, QuickAdd, Scan, Syncing, Result, Settings
      ui/theme/Theme.kt            mobile-elevated dark tokens (not desktop near-black)
    res/values/                    strings, colors, theme
  mobile.html                      browser preview matching Compose UI
```

## Sync contract

The phone POSTs a JSON array to `http://<laptop-ip>:<port>/sync` with the pairing
token from the QR code:

```json
[
  {"id":"local-uuid-1","text":"Follow up with design team","created_at":"2026-07-26T14:32:00Z","workspace":"work"}
]
```

The desktop rejects the request if the token has expired (60–120s lifetime), so a
screenshotted QR code can't be replayed later. Traffic is plain HTTP but never
leaves the local network.
