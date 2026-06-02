# Changelog

All notable changes to PinedIn will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive README.md with detailed documentation
- MIT License file
- CONTRIBUTING.md guidelines
- CHANGELOG.md for tracking changes

### Changed
- Added window dragging permission (`core:window:allow-start-dragging`) for improved UX

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