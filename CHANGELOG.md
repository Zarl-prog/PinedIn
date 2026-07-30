# Changelog

All notable changes to Pinned will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.14] - 2026-07-26

### Changed
- **App icon**: Replaced with new white pin logo (outline-only map marker on transparent background)
- **Scrollbar**: Restored visible thin scrollbar with theme-aware colors (replaces hidden scrollbar)
- **MCP icon**: Replaced Phosphor Plug icon with custom inline SVG
- **Command palette**: Moved ⌘K hint from search field into bottom toolbar
- **Advanced options**: Added badge count showing how many advanced options are selected
- **Dot pattern**: Increased opacity slightly across all themes

### Fixed
- **Compact mode**: Hide/show main window on compact mode toggle removed (simplified behavior)
- **Edge peek / compact mode**: Made mutually exclusive to prevent conflicts
- **macOS icon (.icns)**: Regenerated with correct multi-size PNG entries

## [0.3.0] - 2026-06-09

### Added
- **Workspaces redesign**: Full page view with card grid layout for better organization
- **Cross-platform builds**: macOS/Linux matrix build support with dmg/AppImage/deb installers
- **Auto-update infrastructure**: Public releases repo with signed update archives and latest.json manifest

### Fixed
- **Drag freeze**: Prevent permanent drag freeze on task cards — close handler survives hide() failure
- **macOS tray**: Left-click shows menu, double-click handler excluded
- **Linux window**: Compositor detection for transparency fallback
- **Platform-aware shortcuts**: Wrap hide/show in cfg(windows), add platform-aware shortcut

### Changed
- **CI/CD**: Builds now upload to Zarl-prog/PinedIn-Releases public repo
- **Updater**: Points to public releases repo with proper signing key

## [0.2.1] - 2026-06-07

### Fixed
- **Quick Add**: pressing Enter in the Quick Add window now correctly saves the task to the database, opens the floating card, and closes the window. Previously, the window's blur-to-close handler fired the moment the input became disabled during submit, killing the window before the `create_task` invoke could complete — Enter appeared to do nothing.
- **App icon**: regenerated every icon asset (16/32/48/64/128/256/512 PNG, multi-size ICO, and the NSIS installer header + sidebar BMPs) from the latest `icon.svg`. Header and sidebar BMPs match the original 150×57 and 164×314 dimensions exactly so the NSIS template needs no change.

### Added
- Comprehensive README.md with detailed documentation
- MIT License file
- CONTRIBUTING.md guidelines
- CHANGELOG.md for tracking changes

### Changed
- Added window dragging permission (`core:window:allow-start-dragging`) for improved UX

## [0.2.0] - 2026-06-07

### Added
- **Pre-Schedule**: schedule a task to spawn as an active floating card at a future date and time. New mode toggle in the add-task modal (Immediate / Pre-Schedule) with a Schedule For date+time picker pair. The new Scheduled section in the main list shows pending pre-scheduled tasks with per-row cancel buttons. A 30-second background scheduler activates any pre-scheduled task whose time has arrived, opens a floating card for it, and emits the `tasks-updated` event.
- **Minimize-to-tray**: clicking the close button on the main window hides it to the system tray instead of exiting the process, matching Discord / Spotify behavior. Left click or double click on the tray icon toggles the main window (show+focus if hidden, hide if visible). The tray menu's "Quit Pinned" item now uses `std::process::exit(0)` so the process is guaranteed to die.
- Idempotent DB migrations: `is_presceduled` and `scheduled_at` columns are added automatically to existing v0.1.0 user databases on next launch.

### Changed
- Daily-digest popup and floating-card stack now exclude pre-scheduled tasks (they are surfaced separately in the Scheduled section).
- Tray icon click now toggles the main window instead of always showing it.

## [0.1.0] - Initial Release

### Added
- Basic Tauri application structure
- React frontend with TypeScript
- Task management system with CRUD operations
- SQLite database for persistent storage
- System tray integration
- Floating task card windows
- Priority-based task sorting (Critical/Medium/Low)
- Due date tracking and visual indicators
- Dark/Light/System theme support
- Framer Motion animations
- Tailwind CSS styling
- Zustand state management
- Search and filter functionality
- Keyboard shortcuts
- Responsive design

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Framer Motion
- **State**: Zustand
- **Icons**: Lucide React
- **Backend**: Rust + Tauri 2
- **Database**: SQLite (rusqlite)
- **Build**: Vite + Tauri CLI

### Features
- Always-on-top task overlay windows
- System tray menu for quick access
- Task creation with urgency levels
- Due date reminders
- Complete/edit/delete task operations
- Persistent settings (theme preference)
- Cross-platform support (Windows, macOS, Linux)
