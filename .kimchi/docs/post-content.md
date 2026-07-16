# 🎯 PinedIn — Always-On-Top Focus Task Overlay for Desktop

**PinedIn** is a Tauri v2 + React 18 + Rust desktop app that keeps your tasks **always visible, always on top** — a persistent floating reminder overlay that lives above every window, every app, every game.

---

## ✨ Core Features

### 🃏 Floating Task Cards
Every task you create opens as a **tiny, frameless floating window** that stays pinned above everything. No alt-tabbing needed — it's right there on top.

- **Minimal view** (80×80px) — shows just the title for quick scanning
- **Full view** (122×110px) — title, description, tags, due date, progress bar
- **Drag to move** — grab the card and reposition it anywhere
- **Shake animation** at configurable intervals (10s–5m) — urgent tasks pulse to grab attention

### ⏱️ Time-Limit Progress Bar
Set a **time limit** on any task (e.g., "30 minutes"), and a real-time progress bar counts down visually. When it hits:
- **>50% remaining** → green
- **>25%** → amber
- **<10%** → red flash notification fires: *"Time limit reached"*

### 🎯 Zen Mode
**Ctrl+Shift+Z** → hides the main window. **Floating cards stay** — only the overlay disappears. Perfect when you need full-screen focus but still want task reminders visible.

### 🔄 Pre-Schedule
Schedule a task for **"3pm tomorrow"** → it appears as a floating card **when the time arrives**. The 30-second background scheduler catches up even if the app was closed and reopened.

### 📂 Workspaces
Group tasks into separate **workspaces** with their own views. Activate a workspace → only its tasks appear as floating cards.

### 🛤️ Compact Mode
Replaces individual floating cards with a **single compact pill** that cycles through all your tasks. Great when you have 15+ items.

### 📅 Daily Digest
Opens automatically on startup with a summary:
- *"3 overdue, 2 due today, 5 active — you're all caught up"*

Auto-dismisses in 10 seconds or close it manually.

### 🔧 Bottom Action Bar
Fixed footer with one-click toggles:
- **Pause** — stop all reminders
- **Compact** — collapse into a pill
- **Zen** — hide the main window
- **Align** — snap cards to a clean grid
- **Shake** — toggle card shake animation
- **Digest** — show daily summary

### 🌗 Theme Support
Dark, Light, or System — seamless integration with your desktop theme. Frameless window with custom titlebar (circular min/max/close, red hover on close).

### 🔍 Search & Filter
Real-time search across all tasks by title or description.

---

## 🛠️ Tech Stack

| Layer | What |
|-------|------|
| **Frontend** | React 18 + TypeScript + Vite |
| **State** | Zustand |
| **Animations** | Framer Motion |
| **Desktop** | Tauri v2 (Rust backend) |
| **DB** | SQLite |
| **Build** | `.exe` (NSIS), `.dmg`, `.AppImage`, `.deb`, `.rpm` |

---

## 🚀 Get Started

```bash
git clone https://github.com/Zarl-prog/PinedIn.git
cd PinedIn
npm install
npm run tauri dev
```

**GitHub**: [github.com/Zarl-prog/PinedIn](https://github.com/Zarl-prog/PinedIn)  
**License**: MIT