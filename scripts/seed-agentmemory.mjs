import { execSync } from "child_process";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const BASE = join(import.meta.dirname, "..");
const AGENTMEMORY_URL = "http://localhost:3111";
const VIEWER_URL = "http://localhost:3113";

async function remember(content, tags = []) {
  const res = await fetch(`${AGENTMEMORY_URL}/agentmemory/remember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, tags: ["pinedin", ...tags] }),
  });
  if (!res.ok) console.error("  FAIL:", await res.text());
  else process.stdout.write(".");
}

function readFileSafe(p) {
  try {
    return readFileSync(p, "utf-8").trim();
  } catch {
    return null;
  }
}

function walk(dir, prefix = "") {
  const entries = readdirSync(dir, { withFileTypes: true });
  const lines = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "target") continue;
    const full = join(dir, e.name);
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      lines.push(...walk(full, rel));
    } else {
      lines.push(rel);
    }
  }
  return lines;
}

async function main() {
  console.log("Feeding project context into AgentMemory...\n");

  // 1. Project identity
  const pkg = JSON.parse(readFileSync(join(BASE, "package.json"), "utf-8"));
  await remember(
    `PinedIn v${pkg.version} — A Tauri v2 desktop app built with React 18, TypeScript, Tailwind CSS, framer-motion, and Zustand. ` +
    `It is a pinboard-style task manager with floating cards, reminders, workspaces, and a system tray. ` +
    `The app uses Tauri's window API for draggable, closable card windows and SQL plugin for persistence.`,
    ["project", "overview"]
  );

  // 2. Git history
  console.log("  Reading git history...");
  const gitLog = execSync("git log --oneline --all --max-count=100", { cwd: BASE }).toString().trim();
  await remember(
    `Recent commit history of PinedIn:\n${gitLog}\n\nFull history available via 'git log'.`,
    ["git", "history"]
  );

  // 3. Architecture
  console.log("  Reading key source files...");
  const keyFiles = [
    "src/App.tsx",
    "src-tauri/src/lib.rs",
    "src-tauri/src/main.rs",
    "src-tauri/src/tray.rs",
    "src-tauri/src/window.rs",
    "src-tauri/tauri.conf.json",
    "src-tauri/Cargo.toml",
    "src/index.css",
    "postcss.config.js",
    "tailwind.config.ts",
    "tsconfig.json",
    "vite.config.ts",
    ".github/workflows/release.yml",
  ];
  for (const f of keyFiles) {
    const content = readFileSafe(join(BASE, f));
    if (content) {
      await remember(
        `File: ${f}\n\n${content.slice(0, 4000)}`,
        ["source", f.replace(/[\/\\]/g, "-").replace(/\./g, "_")]
      );
    }
  }

  // 4. Project structure
  console.log("\n  Reading project structure...");
  const structure = walk(join(BASE, "src")).slice(0, 200);
  await remember(
    `Project source structure (src/):\n${structure.join("\n")}`,
    ["structure"]
  );

  const tauriEntries = walk(join(BASE, "src-tauri/src")).map(l => `src-tauri/src/${l}`);
  await remember(
    `Rust source structure (src-tauri/src/):\n${tauriEntries.join("\n")}`,
    ["structure", "rust"]
  );

  // 5. Key decisions (from reading the codebase)
  console.log("  Recording architectural decisions...");
  const decisions = [
    "UI Framework: React 18 + TypeScript with Vite bundler",
    "Desktop Framework: Tauri v2 (Rust backend, webview-based frontend)",
    "Styling: Tailwind CSS with class-variance-authority for component variants",
    "Animations: framer-motion for card animations, shakes, transitions",
    "State Management: Zustand stores for tasks, reminders, workspaces",
    "Window Management: Tauri window API — each task card is a separate webview window with custom decorations (no native titlebar), draggable via startDragging()",
    "Database: SQL plugin (@tauri-apps/plugin-sql) for persistence",
    "Reminders: interval-based check system with shake animation attention-getter on cards",
    "Tray: System tray with show/hide/quit menu, macOS convention (left-click menu)",
    "Close-to-tray: Main window close is intercepted and hidden to tray instead",
    "Workspaces: Full-page card grid view with create/delete, individual task cards scoped to workspace",
    "Updates: Tauri updater plugin pointing to Zarl-prog/PinedIn-Releases public repo",
    "CI/CD: GitHub Actions matrix build (Windows/macOS/Linux), uploads to public releases repo",
    "Platform: macOS min version 12.0, Linux supports AppImage + deb, Windows NSIS installer",
    "Keyboard shortcut: Cmd+Shift+Space (macOS) / Ctrl+Shift+Space (other) to toggle main window",
  ];
  for (const d of decisions) {
    await remember(d, ["architecture", "decision"]);
  }

  // 6. Components
  console.log("\n  Recording component map...");
  const components = [
    "TaskCard — draggable floating card showing task title, tags, notes, reminder timer. Uses framer-motion shake for attention. Close button triggers hide().",
    "MainWindow (App.tsx) — main app with toolbar (view toggle, new card, close), renders either TaskView or WorkspacesView. Has custom titlebar with close/minimize.",
    "WorkspacesView — full-page grid of workspace cards, each showing icon, name, task count, dates. Has shiny +Workspace button.",
    "Toolbar — top bar with view toggle (Tasks/Workspaces), create new card button, close button.",
    "Reminder system — each task has configurable reminder with interval (10s to 24h), pause state, shake animation.",
  ];
  for (const c of components) {
    await remember(c, ["components", "ui"]);
  }

  console.log("\n\nDone! Memories seeded into AgentMemory.");
  console.log(`View at: ${VIEWER_URL}`);
  console.log(`Search from agent with: /recall <query>`);
}

main().catch(console.error);
