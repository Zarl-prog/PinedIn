# Graph Report - /home/asim/Desktop/Projects/PinedIn  (2026-07-29)

## Corpus Check
- 180 files · ~93,320 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 780 nodes · 1728 edges · 46 communities (42 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Task/Workspace Commands
- MCP Server Protocol
- Database Layer
- Compact UI Components
- App Bundling Targets
- NPM Dependencies
- Biome/Linter Config
- Tauri Capabilities
- App Shell UI
- Window Management
- Tauri Command Bridge
- Dev Dependencies
- TypeScript Config
- Tauri App Config
- Schedule/Workspace Detail
- Settings Panel
- Add/Customize Task Modal
- Task List UI
- Notifications
- Video Dependencies
- Workspaces View
- App Lifecycle
- Vite Node Config
- HyperFrames Config
- Image Generation Scripts
- System Tray
- Icon Generation
- Agent Memory Seed
- AppRun (root)
- AppRun (bin)
- Task Scheduler
- HITL Loop
- OpenCode Plugin Config
- Vercel Deployment
- Graphify Plugin
- QuickAdd UI
- Git Guardrails
- Tailwind Config

## God Nodes (most connected - your core abstractions)
1. `DbHandle` - 82 edges
2. `McpState` - 45 edges
3. `handle_tool_call()` - 45 edges
4. `permissions` - 30 edges
5. `useReminderStore` - 21 edges
6. `update_setting()` - 20 edges
7. `emit_tasks_updated()` - 18 edges
8. `compilerOptions` - 18 edges
9. `get_incomplete_tasks()` - 16 edges
10. `Task` - 16 edges

## Surprising Connections (you probably didn't know these)
- `main()` --references--> `react-dom`  [EXTRACTED]
  src/task-card-main.tsx → package.json
- `AddTaskModalProps` --references--> `Task`  [EXTRACTED]
  src/components/AddTaskModal.tsx → src/lib/tauriCommands.ts
- `emit_tasks_updated()` --references--> `DbHandle`  [EXTRACTED]
  src-tauri/src/commands.rs → src-tauri/src/db.rs
- `check_edge_peek_visibility()` --references--> `DbHandle`  [EXTRACTED]
  src-tauri/src/commands.rs → src-tauri/src/db.rs
- `create_task()` --references--> `DbHandle`  [EXTRACTED]
  src-tauri/src/commands.rs → src-tauri/src/db.rs

## Import Cycles
- None detected.

## Communities (46 total, 4 thin omitted)

### Community 0 - "Task/Workspace Commands"
Cohesion: 0.11
Nodes (83): AppSettings, activate_workspace(), activate_workspace_inner(), add_presceduled_task(), add_task_to_workspace(), advance_due_date(), bump_task_gen(), check_edge_peek_visibility() (+75 more)

### Community 1 - "MCP Server Protocol"
Cohesion: 0.16
Nodes (58): Event, Infallible, Item, Json, Map, Sender, handle_initialize(), handle_tool_call() (+50 more)

### Community 2 - "Database Layer"
Cohesion: 0.13
Nodes (19): Connection, Default, MutexGuard, PathBuf, Row, AppSettings, column_exists(), DbHandle (+11 more)

### Community 3 - "Compact UI Components"
Cohesion: 0.08
Nodes (31): CompactPill(), DailyDigest(), DigestData, chevronButtonStyle, chipMetaStyle, chipStyle, chipTextStyle, chipTitleStyle (+23 more)

### Community 4 - "App Bundling Targets"
Cohesion: 0.05
Nodes (41): appimage, deb, dmg, English, icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns (+33 more)

### Community 5 - "NPM Dependencies"
Cohesion: 0.05
Nodes (39): class-variance-authority, clsx, framer-motion, motion, dependencies, class-variance-authority, clsx, framer-motion (+31 more)

### Community 6 - "Biome/Linter Config"
Cohesion: 0.06
Nodes (35): source, assist, actions, enabled, noImportantStyles, noUnusedImports, useExhaustiveDependencies, files (+27 more)

### Community 7 - "Tauri Capabilities"
Cohesion: 0.06
Nodes (35): autostart:allow-disable, autostart:allow-enable, autostart:allow-is-enabled, core:default, core:event:allow-emit, core:event:allow-listen, core:event:default, core:window:allow-center (+27 more)

### Community 8 - "App Shell UI"
Cohesion: 0.10
Nodes (27): App(), AppTab, Command, CommandPalette(), CommandPaletteProps, fuzzyScore(), McpPanel(), McpPanelProps (+19 more)

### Community 9 - "Window Management"
Cohesion: 0.14
Nodes (33): F, apply_edge_peek_geometry(), build_with_retry(), bump_edge_peek_gen(), close_compact_pill_window(), close_edge_peek_window(), close_task_card(), collapse_edge_peek() (+25 more)

### Community 10 - "Tauri Command Bridge"
Cohesion: 0.09
Nodes (13): UndoToast(), addPrescheduledTask(), AppSettings, createTask(), DigestData, getAllTasks(), getAllWorkspaceTasks(), getPrescheduledTasks() (+5 more)

### Community 11 - "Dev Dependencies"
Cohesion: 0.06
Nodes (31): async-icns, autoprefixer, @biomejs/biome, icns-lib, devDependencies, async-icns, autoprefixer, @biomejs/biome (+23 more)

### Community 12 - "TypeScript Config"
Cohesion: 0.08
Nodes (24): DOM, DOM.Iterable, ES2020, src, compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules (+16 more)

### Community 13 - "Tauri App Config"
Cohesion: 0.09
Nodes (21): https://github.com/Zarl-prog/PinedIn-Releases/releases/latest/download/latest.json, app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl (+13 more)

### Community 14 - "Schedule/Workspace Detail"
Cohesion: 0.16
Nodes (15): PreScheduleModal(), PreScheduleModalProps, TaskCardItemProps, formatScheduledTime(), ScheduledRow(), ScheduledRowProps, TaskRowProps, WorkspaceDetailView() (+7 more)

### Community 15 - "Settings Panel"
Cohesion: 0.20
Nodes (11): SettingsPanel(), SettingsPanelProps, SHAKE_OPTIONS, disableAutostart(), enableAutostart(), getShakeInterval(), isAutostartEnabled(), setShakeInterval() (+3 more)

### Community 16 - "Add/Customize Task Modal"
Cohesion: 0.19
Nodes (11): AddTaskModal(), AddTaskModalProps, RECURRENCE_OPTIONS, TIME_LIMIT_UNITS, TimeLimitUnit, UnitDropdown(), CustomizeCardModal(), HANDLE_POS (+3 more)

### Community 17 - "Task List UI"
Cohesion: 0.19
Nodes (10): formatScheduledTime(), formatTaskDate(), ScheduledRow(), TaskCardItem(), TaskList(), TaskListProps, Skeleton(), SkeletonProps (+2 more)

### Community 18 - "Notifications"
Cohesion: 0.24
Nodes (9): check_due_notifications(), notification_state(), NotificationState, AppHandle, HashSet, Mutex, Self, String (+1 more)

### Community 19 - "Video Dependencies"
Cohesion: 0.17
Nodes (11): @ffmpeg-installer/linux-x64, devDependencies, @ffmpeg-installer/linux-x64, name, private, scripts, check, dev (+3 more)

### Community 20 - "Workspaces View"
Cohesion: 0.24
Nodes (10): formatDate(), getWorkspaceIcon(), WORKSPACE_ICONS, WorkspacesView(), WorkspacesViewProps, deleteWorkspace(), getWorkspaces(), loadWorkspace() (+2 more)

### Community 21 - "App Lifecycle"
Cohesion: 0.33
Nodes (8): AtomicBool, check_for_updates(), QuitFlag, AppHandle, Arc, run(), set_linux_webkit_env(), wait_for_display()

### Community 22 - "Vite Node Config"
Cohesion: 0.22
Nodes (8): vite.config.ts, compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 23 - "HyperFrames Config"
Cohesion: 0.22
Nodes (8): media, autoProxy, paths, assets, blocks, components, registry, $schema

### Community 24 - "Image Generation Scripts"
Cohesion: 0.32
Nodes (7): fs, generate(), iconsDir, path, sharp, svgPath, writeBmp()

### Community 25 - "System Tray"
Cohesion: 0.29
Nodes (5): Box, AppHandle, Error, Result, setup_tray()

### Community 26 - "Icon Generation"
Cohesion: 0.33
Nodes (6): fs, generateIcons(), path, pngToIco, sharp, sizes

### Community 27 - "Agent Memory Seed"
Cohesion: 0.53
Nodes (5): BASE, main(), readFileSafe(), remember(), walk()

### Community 28 - "AppRun (root)"
Cohesion: 0.40
Nodes (4): AppRun script, GDK_BACKEND, WEBKIT_DISABLE_COMPOSITING_MODE, WEBKIT_DISABLE_DMABUF_RENDERER

### Community 29 - "AppRun (bin)"
Cohesion: 0.40
Nodes (4): AppRun script, GDK_BACKEND, WEBKIT_DISABLE_COMPOSITING_MODE, WEBKIT_DISABLE_DMABUF_RENDERER

### Community 30 - "Task Scheduler"
Cohesion: 0.60
Nodes (3): check_and_spawn_due_tasks(), AppHandle, start_scheduler()

### Community 31 - "HITL Loop"
Cohesion: 0.83
Nodes (3): capture(), hitl-loop.template.sh script, step()

### Community 32 - "OpenCode Plugin Config"
Cohesion: 0.50
Nodes (3): plugin, $schema, .opencode/plugins/graphify.js

### Community 33 - "Vercel Deployment"
Cohesion: 0.50
Nodes (3): builds, rewrites, version

## Knowledge Gaps
- **234 isolated node(s):** `block-dangerous-git.sh script`, `$schema`, `.opencode/plugins/graphify.js`, `$schema`, `enabled` (+229 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `Compact UI Components` to `NPM Dependencies`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `react-dom` connect `NPM Dependencies` to `Compact UI Components`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `block-dangerous-git.sh script`, `$schema`, `.opencode/plugins/graphify.js` to the rest of the system?**
  _234 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Task/Workspace Commands` be split into smaller, more focused modules?**
  _Cohesion score 0.1078600114744693 - nodes in this community are weakly interconnected._
- **Should `Database Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.12844611528822056 - nodes in this community are weakly interconnected._
- **Should `Compact UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07770582793709528 - nodes in this community are weakly interconnected._
- **Should `App Bundling Targets` be split into smaller, more focused modules?**
  _Cohesion score 0.04878048780487805 - nodes in this community are weakly interconnected._