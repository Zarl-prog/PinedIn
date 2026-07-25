# Windows Bug Report — PinedIn

## Overview

The app works on Linux but crashes / fails to expand EdgePeek on Windows.
Root cause: the Windows-specific `SetWindowPos` code path bypasses Tauri's
internal webview state tracking and runs synchronously from a tokio thread.

---

## 🔴 CRITICAL

### B1 — `SetWindowPos` bypasses Tauri webview state tracking

**`src-tauri/src/window.rs:466–496`** (`set_edge_peek_bounds`)

On Windows the function calls `SetWindowPos` directly on the raw `HWND` then
does an unconditional `return;` (line 495).  This **skips** Tauri's
`set_size()` / `set_position()` calls at lines 500–501, so Tauri's internal
metadata about the webview bounds is never updated.

**Consequence:** the WebView2 content layout doesn't match the native window
size.  When `expand_edge_peek` fires the native window grows but the webview
stays at the old size — the pill appears not to expand.  Also causes flicker
and mis-clicks.

**Fix:** call Tauri's `set_size` / `set_position` *first*, then use
`SetWindowPos` as a redundant reinforcement (or remove the Windows branch
entirely).

---

### B2 — `SetWindowPos` from tokio thread without `SWP_ASYNCWINDOWPOS`

**`src-tauri/src/window.rs:482–494`**

Commands run on tokio threads, not the Windows UI thread.  `SetWindowPos`
sends `WM_WINDOWPOSCHANGING` / `WM_WINDOWPOSCHANGED` to the window message
queue and **waits synchronously**.  If the UI thread is blocked (modal,
SendMessage callback, another SetWindowPos) the calling tokio thread
**deadlocks**.

**Fix:** add `SWP_ASYNCWINDOWPOS` to the flags so the call returns immediately
without waiting for the UI thread.

---

### B3 — `SetWindowPos` return value silently discarded

**`src-tauri/src/window.rs:483`**

```rust
let _ = SetWindowPos(…);
```

Return value (`BOOL`) is discarded with no error log and **no fallback** to
Tauri's cross-platform path.  On Windows this silently fails under:
- RDP / remote desktop
- UIPI (privilege-level separation)
- Window being destroyed concurrently

The frontend gets `Ok(())` but nothing happened.

**Fix:** check the return value; if it fails, log the OS error and fall
through to the cross-platform `set_size` / `set_position` path instead of
the early `return`.

---

## 🟠 HIGH

### B4 — `window_state` plugin denylist missing programmatic windows

**`src-tauri/src/lib.rs:113–119`**

```rust
.with_denylist(&["main", "quick_add"])
```

`edge_peek`, `compact_pill`, `daily_digest`, and `task_*` windows are **not**
in the denylist.  The `window_state` plugin saves/restores their geometry
from the registry on startup, which races with `apply_edge_peek_geometry`
and causes:
- Visible position flash on startup
- Race condition between plugin restore and programmatic positioning
- Double `SetWindowPos` calls that increase crash risk

**Fix:** add all programmatically-managed windows to the denylist.

---

### B5 — `apply_edge_peek_geometry` silently exits on monitor failure

**`src-tauri/src/window.rs:527–534`**

```rust
let Some(monitor) = window.current_monitor().ok().flatten()
    .or_else(|| window.primary_monitor().ok().flatten())
else {
    return;  // ← silent, no log
};
```

No geometry change is applied, no error is logged.  The frontend thinks it
sent a successful expand/collapse command.

**Fix:** log a warning when no monitor is available.

---

### B6 — `open_edge_peek_window` uses `primary_monitor()` only

**`src-tauri/src/window.rs:631`**

```rust
if let Some(monitor) = app.primary_monitor().ok().flatten() { … }
```

Hardcodes the primary monitor.  On multi-monitor setups the window appears
on the wrong screen, then `apply_edge_peek_geometry` immediately repositions
it — visible flash.

**Fix:** prefer the current monitor of the `main` window, fall back to
primary monitor.

---

## 🟡 MEDIUM

### B7 — Redundant `apply_edge_peek_geometry` after window creation

**`src-tauri/src/window.rs:665`**

```rust
Ok(window) => {
    apply_edge_peek_geometry(&window, expanded);  // ← redundant
}
```

The builder already receives `.position(x, y)` and `.inner_size(w, h)` at
lines 641/654.  The call at line 665 immediately re-applies identical
geometry, triggering a second `SetWindowPos` while WebView2 is still
initializing.  This is a known contributor to WebView2 startup crashes on
Windows.

**Fix:** remove the redundant call.

---

### B8 — `y=0` indistinguishable from unset (can't drag to screen top)

**`src-tauri/src/window.rs:440–448`**

```rust
fn ensure_edge_peek_anchor(sh: f64, h: f64) -> f64 {
    let mut y = get_anchor_center_y();
    if y == 0.0 {                         // ← 0 is both "unset" and "top of screen"
        y = EDGE_PEEK_TOP_OFFSET;
        set_anchor_center_y(y);
    }
    …
}
```

If the user drags the pill to Y=0 (top of screen), on next restart it is
reset to 100px because 0.0 is the sentinel for "uninitialised".

**Fix:** store `Option<f64>` / NaN sentinel so 0.0 is a valid position.

---

### B9 — Integer truncation instead of rounding in DPI pixel conversion

**`src-tauri/src/window.rs:478–481`**

```rust
let x_px = (x * scale) as i32;
```

Truncates fractional pixels.  At 150% DPI scaling a logical coordinate of
150.5 produces `225` instead of `226`.  Accumulates sub-pixel error.

**Fix:** use `.round() as i32`.

---

### B10 — Redundant `set_always_on_top` blocks on Windows

**`src-tauri/src/window.rs:144, 191, 265, 315, 391`**

```rust
#[cfg(any(target_os = "linux", target_os = "windows"))]
let _ = window.set_always_on_top(true);
```

Every `set_always_on_top` call on Windows internally calls
`SetWindowPos(HWND_TOPMOST)`, generating window messages.  For task cards
(line 191) this happens inside a loop (`restack_task_cards`).  The builder
already sets `.always_on_top(true)` so these re-assertions are redundant on
Windows.

**Fix:** change to `#[cfg(target_os = "linux")]` — only Linux/Wayland needs
the re-assertion (window managers may drop the topmost hint).

---

## ⚪ LOW

### B11 — `enable_edge_peek` / `disable_edge_peek` not registered as commands

**`src/lib/tauriCommands.ts:165–171`** calls `invoke("enable_edge_peek")` /
`invoke("disable_edge_peek")` but these commands are not registered in
`lib.rs`.  No current code calls them (EdgePeek uses `expand`/`collapse`
directly), so this is dead code.

**Fix:** remove the dead wrappers or register the commands.

---

### B12 — `Color(0,0,0,255)` opaque background on transparent quick-add window

**`src-tauri/src/window.rs:329–330`**

```rust
#[cfg(target_os = "windows")]
let _ = window.set_background_color(Some(Color(0, 0, 0, 255)));
```

Alpha = 255 means fully opaque.  For windows created with
`.transparent(true)` this produces a solid black rectangle behind the web
content, breaking rounded corners.

**Fix:** use `Color(0, 0, 0, 0)` or remove the block and let CSS handle the
background.
