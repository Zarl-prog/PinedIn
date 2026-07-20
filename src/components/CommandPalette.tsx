import { MagnifyingGlass } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

export interface Command {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Extra searchable text (aliases, synonyms) not shown in the UI. */
  keywords?: string;
  group: string;
  perform: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Lightweight subsequence fuzzy match — returns a score, or -1 for no match. */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  // Fast path: direct substring is the strongest signal.
  const idx = t.indexOf(q);
  if (idx !== -1) return 1000 - idx;

  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      streak++;
      score += streak; // reward consecutive matches
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : -1;
}

export default function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state each time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus after the enter animation begins.
      const id = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(id);
    }
  }, [open]);

  const results = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((c) => ({
        c,
        score: Math.max(
          fuzzyScore(query, c.title),
          fuzzyScore(query, c.subtitle ?? "") - 2,
          fuzzyScore(query, c.keywords ?? "") - 4,
          fuzzyScore(query, c.group) - 6,
        ),
      }))
      .filter((r) => r.score > -1)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.c);
  }, [query, commands]);

  // Keep the active index in range as results change.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Group results in their sorted order (groups appear as their first hit does).
  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of results) {
      const arr = map.get(c.group) ?? [];
      arr.push(c);
      map.set(c.group, arr);
    }
    // Flatten to a display order + index lookup so keyboard nav is linear.
    const flat: Command[] = [];
    const sections: { group: string; items: Command[] }[] = [];
    for (const [group, items] of map) {
      sections.push({ group, items });
      flat.push(...items);
    }
    return { flat, sections };
  }, [results]);

  const run = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    // Defer so the palette closes before the action (e.g. opening a modal).
    setTimeout(() => cmd.perform(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(grouped.flat.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (i) => (i - 1 + grouped.flat.length) % Math.max(grouped.flat.length, 1),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(grouped.flat[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Scroll the active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const spring = REDUCED_MOTION
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 400, damping: 32 };

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "12vh",
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: REDUCED_MOTION ? 0 : 0.15 }}
            onClick={onClose}
            style={{ position: "absolute", inset: 0, background: "var(--bg-overlay)" }}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={spring}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onKeyDown={onKeyDown}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 540,
              margin: "0 16px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-menu)",
              overflow: "hidden",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {/* Search input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                borderBottom: "1px solid var(--divider)",
              }}
            >
              <MagnifyingGlass size={16} color="var(--text-muted)" weight="bold" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Type a command or search…"
                aria-label="Command palette search"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  fontFamily: "'Geist Mono', monospace",
                }}
              />
              <kbd
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: 5,
                  padding: "2px 6px",
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div
              ref={listRef}
              style={{ maxHeight: 380, overflowY: "auto", padding: "6px 6px 8px" }}
            >
              {grouped.flat.length === 0 ? (
                <div
                  style={{
                    padding: "28px 16px",
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No results for “{query}”
                </div>
              ) : (
                grouped.sections.map((section) => (
                  <div key={section.group} style={{ marginBottom: 4 }}>
                    <div
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        color: "var(--text-muted)",
                        padding: "8px 10px 4px",
                      }}
                    >
                      {section.group}
                    </div>
                    {section.items.map((cmd) => {
                      const index = grouped.flat.indexOf(cmd);
                      const active = index === activeIndex;
                      return (
                        <button
                          key={cmd.id}
                          type="button"
                          data-cmd-index={index}
                          onMouseMove={() => setActiveIndex(index)}
                          onClick={() => run(cmd)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 11,
                            width: "100%",
                            textAlign: "left",
                            padding: "9px 10px",
                            border: "none",
                            borderRadius: 8,
                            background: active ? "var(--bg-hover)" : "transparent",
                            color: "var(--text-primary)",
                            cursor: "pointer",
                            fontFamily: "'Geist Mono', monospace",
                          }}
                        >
                          <span
                            style={{
                              width: 26,
                              height: 26,
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: 7,
                              background: "var(--bg-badge)",
                              color: "var(--text-secondary)",
                            }}
                          >
                            {cmd.icon}
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                display: "block",
                                fontSize: 13,
                                color: "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {cmd.title}
                            </span>
                            {cmd.subtitle && (
                              <span
                                style={{
                                  display: "block",
                                  fontSize: 11,
                                  color: "var(--text-muted)",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {cmd.subtitle}
                              </span>
                            )}
                          </span>
                          {active && (
                            <kbd
                              style={{
                                fontSize: 10,
                                color: "var(--text-muted)",
                                border: "1px solid var(--border)",
                                borderRadius: 5,
                                padding: "2px 6px",
                                flexShrink: 0,
                              }}
                            >
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
