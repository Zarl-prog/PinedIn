<div align="center">

<img src="public/pinedin-icon.png" alt="PinedIn" width="96" height="96" />

# PinedIn

**The always-on-top task overlay that refuses to let you forget.**

[![Release](https://img.shields.io/github/v/release/Zarl-prog/PinedIn?style=flat-square&color=6366f1&label=latest)](https://github.com/Zarl-prog/PinedIn/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-6366f1?style=flat-square)](LICENSE)
[![Built with Tauri](https://img.shields.io/badge/tauri-v2-6366f1?style=flat-square&logo=tauri&logoColor=white)](https://tauri.app/)
[![React](https://img.shields.io/badge/react-18-6366f1?style=flat-square&logo=react&logoColor=white)](https://react.dev/)
[![Rust](https://img.shields.io/badge/rust-stable-6366f1?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)

[Download](#-installation) · [Features](#-features) · [Docs](#-getting-started) · [Roadmap](#-roadmap) · [Contributing](#-contributing)

---

*Floating task cards that live above every window. No cloud. No accounts. No distractions.*

</div>

---

## Why PinedIn?

Most task managers hide behind a click. PinedIn doesn't. It pins your most important tasks directly onto your screen as floating, always-on-top cards — and gently shakes them at configurable intervals so nothing slips through the cracks.

- **Zero friction** — tasks are always visible, no alt-tab required
- **Fully local** — SQLite on your machine, zero telemetry, zero accounts
- **Lightweight** — a Rust + Tauri backend means single-digit MB memory overhead
- **Keyboard-first** — command palette, quick-add, and global shortcuts

---

## ✨ Features

### Focus & Visibility
| Feature | Description |
|---|---|
| **Floating Task Cards** | Always-on-top cards that float above every window |
| **Shake Reminders** | Cards nudge at configurable intervals (10 s – 5 min) |
| **Zen Mode** | Hide the main window; keep only the floating cards |
| **Edge Peek** | A screen-edge handle that expands into your task list |
| **Compact Pill** | Minimal always-visible pill showing your active task |

### Task Management
| Feature | Description |
|---|---|
| **Workspaces** | Separate task lists for separate contexts |
| **Priority Sorting** | Critical → Medium → Low, always surfaced in order |
| **Pre-Scheduling** | Tasks activate as floating cards at a future time |
| **Due Date Tracking** | Visual overdue/upcoming indicators |
| **Search & Filter** | Instant full-text search across all tasks |
| **Undo Support** | Recover from accidental deletes |

### Power Features
| Feature | Description |
|---|---|
| **Command Palette** | `⌘K` / `Ctrl+K` for everything |
| **Quick Add** | Global shortcut to capture a task without switching windows |
| **Daily Digest** | Morning overlay summarising what's on your plate |
| **MCP Server** | Expose your tasks to AI tooling via Model Context Protocol |
| **Snap to Grid** | One-click alignment for all floating cards |
| **Auto-Updater** | Silent background updates with in-app banner |
| **System Tray** | Quick access without opening the main window |
| **Auto-Start** | Launch at login, optional |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **UI** | React 18 + TypeScript |
| **Styling** | CSS variables · Tailwind CSS · Framer Motion / Motion |
| **State** | Zustand |
| **Icons** | Phosphor Icons |
| **Desktop shell** | Tauri v2 |
| **Backend** | Rust (tokio · axum · rusqlite · chrono · serde) |
| **Database** | SQLite — local, embedded, zero-config |
| **Build** | Vite · Biome (lint + format) |

---

## 📦 Installation

### Pre-built binaries

Download the latest installer from the [Releases](https://github.com/Zarl-prog/PinedIn/releases) page.

| Platform | Format |
|---|---|
| Windows 10 / 11 | NSIS installer (`.exe`) |
| Linux (Ubuntu 22.04+) | AppImage · `.deb` |

### Build from source

**Prerequisites:** Node.js ≥ 18 · Rust (stable) · Tauri CLI v2

```bash
git clone https://github.com/Zarl-prog/PinedIn.git
cd PinedIn
npm install
npm run tauri dev       # development
npm run tauri build     # production binary
```

---

## 🚀 Getting Started

### Create your first task

Open PinedIn and press `Ctrl+K` to open the command palette, or click **+ New Task**.

Fill in a title, pick a priority, and optionally set a due date. Hit **Save** — a floating card appears immediately.

### Zen Mode

Click the **Zen** button in the bottom bar (or use the command palette). The main window hides; your floating cards stay visible above everything else.

### Pre-schedule a task

In the **New Task** form, toggle **Schedule for later** and pick a date/time. The card will appear automatically when that moment arrives — even if PinedIn is minimised to the tray.

### Workspaces

Use the **Workspaces** tab to create separate task lists for different projects or contexts. Each workspace has its own floating cards.

### MCP integration

PinedIn runs a local MCP server so AI assistants can read and create tasks on your behalf. Enable it in **Settings → MCP Server** and point your AI tool at the displayed endpoint.

---

## 🗂 Project Structure

```
PinedIn/
├── src/                          # React frontend
│   ├── components/
│   │   ├── AddTaskModal.tsx       # Create / edit task form
│   │   ├── CompactPill.tsx        # Minimal always-visible pill
│   │   ├── DailyDigest.tsx        # Morning task summary overlay
│   │   ├── EdgePeek.tsx           # Screen-edge expandable handle
│   │   ├── McpPanel.tsx           # MCP server settings & status
│   │   ├── PreScheduleModal.tsx   # Schedule future task activation
│   │   ├── SettingsPanel.tsx      # Theme · shake interval · autostart · updates
│   │   ├── TaskCard.tsx           # Floating always-on-top card
│   │   ├── TaskList.tsx           # Main list with search & filter
│   │   ├── UpdateBanner.tsx       # In-app update notification
│   │   ├── UrgencyBadge.tsx       # Critical / Medium / Low indicator
│   │   ├── WorkspaceDetailView.tsx
│   │   ├── WorkspacesView.tsx
│   │   └── ui/                    # Shared primitives
│   ├── hooks/
│   │   ├── useReminders.ts        # Task polling & reminder logic
│   │   └── useSettings.ts         # Theme & settings hook
│   ├── lib/
│   │   ├── tauriCommands.ts       # Type-safe Tauri IPC wrappers
│   │   └── updater.ts             # Update check & install
│   ├── store/
│   │   └── reminderStore.ts       # Zustand global state
│   ├── App.tsx                    # Root layout · tabs · bottom bar
│   └── index.css                  # Design tokens & global styles
│
├── src-tauri/                    # Rust backend
│   └── src/
│       ├── commands.rs            # Tauri IPC command handlers
│       ├── db.rs                  # SQLite layer + idempotent migrations
│       ├── mcp_server.rs          # Local MCP HTTP server (axum)
│       ├── notifications.rs       # Native OS notifications
│       ├── scheduler.rs           # Background task activation engine
│       ├── tray.rs                # System tray icon & menu
│       ├── window.rs              # Multi-window management
│       └── lib.rs                 # Plugin registration
│
├── quick-add.html                 # Standalone quick-add window
├── edge-peek.html                 # Edge peek window entry
├── task-card.html                 # Floating card window entry
├── daily-digest.html              # Daily digest window entry
└── package.json
```

> PinedIn uses **Tauri's multi-window model** — each UI surface (main window, floating cards, edge peek, compact pill, quick-add, daily digest) is an independent WebView with its own entry point, keeping each surface minimal and fast.

---

## 🗄 Database Schema

```sql
CREATE TABLE tasks (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  title                TEXT    NOT NULL,
  description          TEXT    NOT NULL DEFAULT '',
  urgency              TEXT    NOT NULL DEFAULT 'medium'
                                CHECK(urgency IN ('low', 'medium', 'critical')),
  due_time             TEXT    NOT NULL DEFAULT '',
  completed            INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL,
  recurrence           TEXT,
  tags                 TEXT,
  time_limit_minutes   INTEGER,
  started_at           TEXT,
  is_presceduled       INTEGER DEFAULT 0,
  scheduled_at         TEXT
);

CREATE TABLE workspaces (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  state_json  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Migrations are idempotent and run automatically on startup — no manual steps needed when upgrading.

---

## 🖥 Platform Support

| Platform | Status | Notes |
|---|---|---|
| **Windows 10 / 11** | ✅ Fully supported | NSIS installer |
| **Linux (X11)** | ✅ Fully supported | AppImage · `.deb` |
| **Linux (Wayland / GNOME)** | ⚠️ Partial | See below |
| **KDE Plasma** | ✅ Fully supported | X11 and Wayland |

### Linux — Wayland notes

Always-on-top floating cards require the X11 backend on GNOME. Either:

```bash
# Force X11 backend
GDK_BACKEND=x11 ./PinedIn.AppImage
```

…or install the [Always on Top](https://extensions.gnome.org/extension/8324/always-on-top) GNOME extension and pin PinedIn windows manually.

**System tray on GNOME** requires the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support).

**Crash on launch?** Try:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 ./PinedIn.AppImage
```

**WebKitGTK requirement:** version 2.44 or higher · `libappindicator3` for system tray.

---

## 🗺 Roadmap

- [x] **v0.1** — Core CRUD, urgency sorting, floating cards
- [x] **v0.2** — System tray, auto-start, themes, shake reminders
- [x] **v0.3** — Workspaces, pre-scheduling, Zen mode, snap-to-grid
- [x] **v0.4** — Command palette, Edge Peek, Compact Pill, MCP server, Daily Digest, onboarding
- [ ] **v0.5** — Recurring tasks with cron-like scheduling
- [ ] **v0.6** — Tags, categories, and advanced filtering
- [ ] **v0.7** — Android companion app (local-network capture → desktop sync)
- [ ] **v1.0** — Plugin / extension system

---

## 🤝 Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

```bash
# Fork, then:
git checkout -b feat/your-feature
# make changes
git commit -m "feat: describe your change"
git push origin feat/your-feature
# open a Pull Request
```

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built with Rust, React, and a deep hatred of forgotten tasks.

[Report a bug](https://github.com/Zarl-prog/PinedIn/issues) · [Request a feature](https://github.com/Zarl-prog/PinedIn/issues)

</div>
