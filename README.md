     
<div align="center">

   
# PinedIn

### 🎯 Always-on-top focus reminder app for desktop productivity

[![Tauri](https://img.shields.io/badge/Built%20with-Tauri-2C2D72?style=for-the-badge&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Backend-Rust-000000?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

*A persistent always-on-top task overlay that keeps you focused on what matters most*

</div>

## ✨ Features

### 🎨 **Clean, Distraction-Free Interface**
- **Dark/Light/System Theme** – Seamlessly integrates with your desktop
- **Custom Titlebar** – Frameless window with native window controls (minimize, maximize, close)
- **Bottom Action Bar** – Fixed footer with Pause, Zen mode, and Align to Grid controls
- **Smooth Animations** – Powered by Framer Motion for delightful interactions
- **Floating Task Cards** – Cards that shake gently at configurable intervals to keep tasks top-of-mind

### 📝 **Task Management**
- **Workspaces** – Organize tasks into separate workspaces with their own views
- **Pre-Schedule** – Plan tasks ahead and have them appear at their scheduled time
- **Priority-Based Sorting** – Tasks sorted by urgency (Critical → Medium → Low)
- **Due Date Tracking** – Visual indicators for overdue/upcoming tasks
- **Search & Filter** – Quickly find tasks by title or description
- **Full CRUD** – Create, read, update, and delete tasks with undo support

### 🚀 **Advanced Features**
- **Zen Mode** – Hide the main window while floating task cards remain visible
- **Snap to Grid** – Align all floating cards to a clean grid layout
- **Configurable Shake Interval** – Cards nudge at intervals from 10s to 5m (configurable in Settings)
- **Auto-Start** – Optionally launch PinedIn when your computer starts
- **Auto-Updater** – Checks for updates and can auto-install new versions
- **System Tray** – Quick access from the system tray
- **SQLite Database** – Persistent local storage for all tasks and settings
- **Cross-Platform** – Windows, macOS, and Linux

## 📸 Screenshots

| Main Window | Workspace View | Floating Cards |
|---|---|---|
| *(screenshot coming soon)* | *(screenshot coming soon)* | *(screenshot coming soon)* |

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Modern, type-safe UI development |
| **Styling** | CSS variables + Inline styles | Monochrome design system with theme support |
| **Animations** | Framer Motion | Smooth transitions and micro-interactions |
| **State** | Zustand | Lightweight global state management |
| **Backend** | Rust + Tauri v2 | High-performance desktop backend |
| **Database** | SQLite (via rusqlite) | Persistent local data storage |
| **Build** | Vite | Fast development and optimized production builds |

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Rust** (latest stable)
- **Tauri CLI** (v2+)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Zarl-prog/PinedIn.git
   cd PinedIn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Tauri CLI** (if not already installed)
   ```bash
   npm install -g @tauri-apps/cli
   ```

4. **Run in development mode**
   ```bash
   npm run tauri dev
   ```

### Building for Production

```bash
# Build for current platform
npm run tauri build
```

Pre-built installers are available for each [release](https://github.com/Zarl-prog/PinedIn/releases).

## 📁 Project Structure

```
pinedin/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── AddTaskModal.tsx      # Create/edit task form
│   │   ├── DailyDigest.tsx       # Daily task summary overlay
│   │   ├── PreScheduleModal.tsx  # Schedule future tasks
│   │   ├── SettingsPanel.tsx     # Settings (theme, shake interval, autostart, updates)
│   │   ├── TaskCard.tsx          # Floating always-on-top task card
│   │   ├── TaskList.tsx          # Main task listing with search
│   │   ├── UpdateBanner.tsx      # Update notification banner
│   │   ├── UrgencyBadge.tsx      # Urgency indicator (Critical/Medium/Low)
│   │   ├── WorkspaceDetailView.tsx # Individual workspace task view
│   │   ├── WorkspacesView.tsx    # Workspace list and management
│   │   └── ui/                   # Shared UI primitives
│   ├── hooks/
│   │   ├── useReminders.ts       # Task polling and reminder hook
│   │   └── useSettings.ts        # Theme/settings hook
│   ├── lib/
│   │   ├── tauriCommands.ts      # Type-safe Tauri command wrappers
│   │   └── updater.ts            # Update check and install logic
│   ├── store/
│   │   └── reminderStore.ts      # Zustand global state
│   ├── App.tsx                   # Main app with layout, tabs, bottom bar
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Global styles and CSS variables
├── src-tauri/                    # Backend Rust code
│   ├── src/
│   │   ├── commands.rs           # Tauri IPC commands
│   │   ├── db.rs                 # SQLite database layer
│   │   ├── lib.rs                # Plugin registration
│   │   ├── main.rs               # Entry point
│   │   ├── notifications.rs      # Native notification handling
│   │   ├── scheduler.rs          # Task scheduling engine
│   │   ├── tray.rs               # System tray setup
│   │   └── window.rs             # Window management
│   └── tauri.conf.json           # Tauri configuration
├── public/
│   └── pinedin-icon.png          # App icon
└── package.json                  # Frontend dependencies
```

## 🧩 Core Components

### 🎯 **Task Management**
- **`TaskList.tsx`** – Main task listing with search, filtering, and inline actions
- **`TaskCard.tsx`** – Floating always-on-top card with shake animation and actions
- **`AddTaskModal.tsx`** – Form for creating and editing tasks
- **`PreScheduleModal.tsx`** – Schedule tasks for future activation
- **`UrgencyBadge.tsx`** – Visual urgency indicator (Critical/Medium/Low)

### 📂 **Workspaces**
- **`WorkspacesView.tsx`** – Workspace listing with create/rename/delete
- **`WorkspaceDetailView.tsx`** – Scoped task view within a workspace

### ⚙️ **System Features**
- **`SettingsPanel.tsx`** – Settings: theme, launch at login, shake interval, updates
- **`UpdateBanner.tsx`** – In-app update notification
- **`DailyDigest.tsx`** – Daily task summary overlay

### 🔧 **Backend Integration**
- **`tauriCommands.ts`** – Type-safe Tauri command definitions
- **`commands.rs`** – Rust command implementations
- **`db.rs`** – SQLite database layer with migrations
- **`scheduler.rs`** – Background scheduling for reminders
- **`tray.rs`** – System tray icon and context menu

## 💡 Usage

### Creating a Task
```typescript
import { createTask } from "@/lib/tauriCommands";
const task = await createTask(
  "Finish report",
  "Complete Q4 financial analysis",
  "critical",
  "2024-12-15",
  null,         // recurrence
  null,         // tags
  null,         // time limit (minutes)
  null          // workspace id
);
```

### Pre-Scheduling a Task
```typescript
import { createTask } from "@/lib/tauriCommands";
await createTask(
  "Team standup",
  "",
  "medium",
  "",
  null, null, null, null,
  new Date("2024-12-16T09:00").toISOString() // scheduled_at
);
```

### Toggle Zen Mode
```typescript
import { setZenMode } from "@/lib/tauriCommands";
await setZenMode(true);  // hides main window, keeps floating cards
```

### Changing Theme
```typescript
const saveSetting = useReminderStore((s) => s.saveSetting);
await saveSetting("theme", "dark"); // light, dark, or system
```

## 🚀 Development

### Available Scripts

```bash
npm run dev           # Start Vite dev server (frontend only)
npm run build         # Build frontend assets
npm run tauri dev     # Start full Tauri development environment
npm run tauri build   # Build production desktop application
```

### Database Schema

```sql
-- Tasks
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT 'medium'
    CHECK(urgency IN ('low', 'medium', 'critical')),
  due_time TEXT NOT NULL DEFAULT '',
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  recurrence TEXT DEFAULT NULL,
  tags TEXT DEFAULT NULL,
  time_limit_minutes INTEGER DEFAULT NULL,
  started_at TEXT DEFAULT NULL,
  is_presceduled INTEGER DEFAULT 0,
  scheduled_at TEXT DEFAULT NULL
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('theme', 'dark'),
  ('shake_interval', '30');

-- Workspaces
CREATE TABLE workspaces (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## 📱 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **Windows** | ✅ Fully Supported | NSIS installer, tested on Windows 10/11 |
| **macOS** | ✅ Supported | DMG, requires macOS 12+ |
| **Linux** | ✅ Supported | AppImage + Deb, tested on Ubuntu 22.04+ |

## Linux

### Requirements
- WebKitGTK 2.44 or higher
- libappindicator3 (for system tray)

### Known Issues

**Wayland:** Always-on-top floating cards require the X11 backend on GNOME. Run with `GDK_BACKEND=x11 pinedin`, or install the [Always on Top](https://extensions.gnome.org/extension/8324/always-on-top) GNOME extension and pin PinedIn windows manually.

**GNOME:** System tray requires the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support).

**KDE:** Fully supported on both X11 and Wayland.

### Running on Wayland
```bash
GDK_BACKEND=x11 ./PinedIn.AppImage
```

Alternatively, install the [Always on Top](https://extensions.gnome.org/extension/8324/always-on-top) GNOME extension and pin PinedIn windows manually.

### Crash on launch
If the app crashes immediately try:
```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 WEBKIT_DISABLE_DMABUF_RENDERER=1 ./PinedIn.AppImage
```

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md).

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License — see [LICENSE](LICENSE).

## 🚧 Roadmap

- [x] **v0.1.0** — Core task management with CRUD and urgency sorting
- [x] **v0.2.0** — System tray, auto-start, theme support, floating task cards
- [x] **v0.3.0** — Workspaces, pre-scheduling, Zen mode, snap-to-grid
- [ ] **v0.4.0** — Recurring tasks with cron-like scheduling
- [ ] **v0.5.0** — Task categories, tags, and advanced filtering
- [ ] **v1.0.0** — Plugin system for extensions

---

<div align="center">

**Made with ❤️ for productive developers everywhere**

[Report Bug](https://github.com/Zarl-prog/PinedIn/issues) · [Request Feature](https://github.com/Zarl-prog/PinedIn/issues)

</div>
