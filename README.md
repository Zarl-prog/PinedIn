<img width="1408" height="768" alt="Gemini_Generated_Image_iowz08iowz08iowz" src="https://github.com/user-attachments/assets/dd300361-89b7-44e7-8c77-34389521dcac" />

<div align="center">

# <img src="public/pinedin-icon.png" alt="PinedIn Logo" width="40" style="vertical-align: middle; margin-right: 10px;"/> PinedIn

### 🎯 Always-on-top focus reminder app for desktop productivity

[![Tauri](https://img.shields.io/badge/Built%20with-Tauri-2C2D72?style=for-the-badge&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Rust](https://img.shields.io/badge/Backend-Rust-000000?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

*A beautiful, persistent task overlay that helps you stay focused on what matters most*

</div>

## ✨ Features

### 🎨 **Modern, Clean Interface**
- **Dark/Light/System Theme** – Seamlessly integrates with your desktop
- **Smooth Animations** – Powered by Framer Motion for delightful interactions
- **Responsive Design** – Elegant UI built with Tailwind CSS
- **System Tray Integration** – Quick access from system tray

### 📝 **Smart Task Management**
- **Priority-Based Sorting** – Tasks sorted by urgency (Critical → Medium → Low)
- **Due Date Tracking** – Visual indicators for overdue/upcoming tasks
- **Task Cards** – Floating, always-on-top windows for important reminders
- **Search & Filter** – Quickly find tasks by title or description
- **Complete/Edit/Delete** – Full CRUD operations with undo support

### 🚀 **Advanced Features**
- **SQLite Database** – Persistent storage for tasks and settings
- **Keyboard Shortcuts** – Escape to close modals, quick task completion
- **Cross-Platform** – Windows, macOS, Linux support via Tauri
- **System Notifications** – Native desktop notifications for reminders
- **Auto-Start** – Configure to launch with system startup

## 📸 Screenshots

> *Screenshots will be added as the project develops*

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Modern, type-safe UI development |
| **Styling** | Tailwind CSS + Framer Motion | Utility-first styling with smooth animations |
| **State** | Zustand | Lightweight state management |
| **Icons** | Lucide React | Beautiful, consistent icon set |
| **Backend** | Rust + Tauri | High-performance desktop backend |
| **Database** | SQLite (via rusqlite) | Persistent data storage |
| **Build** | Vite | Fast development and build tooling |

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Rust** (latest stable)
- **Tauri CLI** (v2+)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pinedin.git
   cd pinedin
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

# Build for specific platform
npm run tauri build -- --target x86_64-pc-windows-msvc
```

## 📁 Project Structure

```
pinedin/
├── src/                    # Frontend source code
│   ├── components/        # React components
│   │   ├── AddTaskModal.tsx
│   │   ├── SettingsPanel.tsx
│   │   ├── TaskCard.tsx
│   │   ├── TaskList.tsx
│   │   ├── TrayMenu.tsx
│   │   └── UrgencyBadge.tsx
│   ├── hooks/            # Custom React hooks
│   │   ├── useReminders.ts
│   │   └── useSettings.ts
│   ├── lib/              # Utility functions
│   │   ├── tauriCommands.ts
│   │   └── utils.ts
│   ├── store/            # State management
│   │   └── reminderStore.ts
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── src-tauri/           # Backend Rust code
│   ├── src/
│   │   ├── commands.rs  # Tauri commands
│   │   ├── db.rs        # Database operations
│   │   ├── tray.rs      # System tray setup
│   │   └── window.rs    # Window management
│   └── tauri.conf.json # Tauri configuration
├── public/              # Static assets
├── dist/               # Build output
└── package.json        # Frontend dependencies
```

## 🧩 Core Components

### 🎯 **Task Management**
- **`TaskList.tsx`** – Main task listing with sorting and filtering
- **`TaskCard.tsx`** – Individual task component with actions
- **`AddTaskModal.tsx`** – Form for creating/editing tasks
- **`UrgencyBadge.tsx`** – Visual urgency indicator (Critical/Medium/Low)

### ⚙️ **System Features**
- **`TrayMenu.tsx`** – System tray menu for quick access
- **`SettingsPanel.tsx`** – Application settings (theme, notifications)
- **`reminderStore.ts`** – Global state management with Zustand

### 🔧 **Backend Integration**
- **`tauriCommands.ts`** – Type-safe Tauri command definitions
- **`commands.rs`** – Rust backend implementations
- **`db.rs`** – SQLite database operations

## 💡 Usage Examples

### Creating a Task
```typescript
// Using the Zustand store
const addTask = useReminderStore((s) => s.addTask);
await addTask("Finish report", "Complete Q4 financial analysis", "critical", "2024-12-15");
```

### Getting Incomplete Tasks
```typescript
// Via Tauri command
import { getIncompleteTasks } from "@/lib/tauriCommands";
const tasks = await getIncompleteTasks();
```

### Changing Theme
```typescript
// Update application theme
const saveSetting = useReminderStore((s) => s.saveSetting);
await saveSetting("theme", "dark"); // light, dark, or system
```

## 🚀 Development

### Available Scripts

```bash
npm run dev           # Start Vite dev server
npm run build         # Build frontend assets
npm run tauri dev     # Start Tauri development
npm run tauri build   # Build desktop application
```

### Database Schema

```sql
-- Tasks table
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  urgency TEXT CHECK(urgency IN ('low', 'medium', 'critical')) NOT NULL,
  due_time TEXT,
  completed BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Settings table
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## 📱 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| **Windows** | ✅ Fully Supported | Tested on Windows 10/11 |
| **macOS** | ✅ Supported | Requires x86_64 or Apple Silicon |
| **Linux** | ✅ Supported | Tested on Ubuntu 22.04+ |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tauri](https://tauri.app/) for the amazing cross-platform framework
- [React](https://react.dev/) for the component architecture
- [Tailwind CSS](https://tailwindcss.com/) for the styling system
- [Lucide](https://lucide.dev/) for the beautiful icons
- [Framer Motion](https://www.framer.com/motion/) for smooth animations

## 🚧 Roadmap

- [ ] **v0.2.0** – Recurring tasks with cron-like scheduling
- [ ] **v0.3.0** – Task categories and tags
- [ ] **v0.4.0** – Team collaboration features
- [ ] **v0.5.0** – Mobile companion app
- [ ] **v1.0.0** – Plugin system for extensions

---

<div align="center">

**Made with ❤️ for productive developers everywhere**

[Report Bug](https://github.com/yourusername/pinedin/issues) · [Request Feature](https://github.com/yourusername/pinedin/issues)

</div>
