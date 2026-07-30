# Pinned Mobile Companion — Planning Doc (v1)

## 1. Goal

Pinned currently lives only on desktop (Windows, Tauri/Rust, local SQLite). The goal is
a lightweight **Android companion app** that lets you jot down tasks/ideas while away from
your laptop, then sync them into Pinned's desktop database when you're back home —
**via QR code**, no cloud, no accounts, no background services.

## 2. v1 Scope

- **Capture-only.** The mobile app is for adding tasks quickly — not viewing, editing, or
  completing existing Pinned tasks. This avoids sync-conflict problems entirely (data
  only flows one direction: phone → laptop).
- **Android only** for v1.
- **QR-based sync**, no persistent pairing, no local network auto-discovery, no server.

## 3. How Sync Works

1. User opens the **desktop app** and clicks "Sync Phone."
2. Desktop generates a **QR code** encoding:
   - Its local network IP address
   - A **short-lived pairing token** (expires in ~60–120 seconds)
3. User opens the **Android app** and scans the QR code.
4. Android app sends all locally-captured, unsynced tasks as a single HTTP POST request
   directly to the laptop's IP (both devices must be on the same WiFi network).
5. Desktop app receives the payload, verifies the token hasn't expired, inserts the tasks
   into its existing SQLite database, and displays them as new floating cards.
6. The temporary HTTP listener and token are discarded after the sync completes.

No background syncing, no persistent connection, no stored device pairing — every sync
is a deliberate, one-time action.

## 4. Tech Stack

### Android App
| Purpose | Choice |
|---|---|
| UI | Kotlin + Jetpack Compose |
| Local storage | Room (SQLite) — mirrors desktop's SQLite approach |
| QR scanning | CameraX + ML Kit Barcode Scanning (or ZXing as alternative) |
| Networking | Ktor Client or OkHttp (simple POST request) |

### Desktop App (additions to existing Tauri/Rust app)
| Purpose | Choice |
|---|---|
| QR generation | `qrcode` Rust crate |
| Local HTTP listener | `tiny_http` or `axum` (lightweight, temporary — only active during sync) |
| Storage | Existing SQLite layer — add an "insert synced tasks" function |

### Data Format (sync payload)
Simple JSON array, sent as the POST body:

```json
[
  {
    "id": "local-uuid-1",
    "text": "Follow up with design team on mockups",
    "created_at": "2026-07-26T14:32:00Z",
    "workspace": "work"
  },
  {
    "id": "local-uuid-2",
    "text": "Buy birthday gift for mom",
    "created_at": "2026-07-26T09:10:00Z",
    "workspace": "personal"
  }
]
```

## 5. Security Considerations

- Pairing token must be **short-lived** (60–120 seconds) so an old/screenshotted QR code
  can't be reused later.
- Since this stays on the local network only, full TLS isn't strictly required for v1,
  but the token-expiry safeguard is a must.
- No task data is ever sent anywhere except directly between the two devices on the same
  WiFi network — consistent with Pinned's "zero telemetry, fully local" positioning.

## 6. Explicitly Out of Scope (v1)

- iOS app
- Viewing/editing/completing tasks from mobile
- Any cloud relay, account system, or internet-based sync
- Automatic/background sync — every sync is a manual, deliberate QR scan

## 7. Open Questions / Future Enhancements

- Should synced tasks be tagged with their originating workspace, or land in a default
  "Inbox" workspace on desktop?
- Worth adding a lightweight "voice-to-text quick capture" on mobile down the line?
- If cross-network sync (e.g. syncing from outside the house over the internet) is ever
  wanted, that would require revisiting the "no server" constraint — likely a v2
  consideration, not v1.
- Portable/no-install version of the Android app, or is Play Store distribution fine?
