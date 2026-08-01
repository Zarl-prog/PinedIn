import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Command,
  DeviceMobile,
  Eye,
  GridFour,
  List,
  Plus,
  Sparkle,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setCompactMode, setZenMode } from "@/lib/tauriCommands";
import { useReminderStore } from "@/store/reminderStore";

type Placement = "bottom" | "top" | "right" | "left" | "center";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  /** data-onboarding value of the element to spotlight. Omit for centered steps. */
  target?: string;
  placement?: Placement;
  highlightPadding?: number;
  /**
   * "user" = the user must click the highlighted element to advance.
   * "demo" = the tour performs the action itself, then the user clicks Next.
   * undefined = purely informational, advance with Next.
   */
  interaction?: "user" | "demo";
  /** Hint shown in the tooltip footer for "user" steps. */
  actionHint?: string;
}

const STEPS: Step[] = [
  {
    id: "add-task",
    icon: <Plus size={15} weight="bold" />,
    title: "Create your first task",
    description:
      "Tasks live as floating cards that stay above every other window. Go ahead — click “+ Add Task” to make one.",
    target: "add-task",
    placement: "bottom",
    highlightPadding: 8,
    interaction: "user",
    actionHint: "Click the highlighted button to continue",
  },
  {
    id: "task-list",
    icon: <List size={15} weight="bold" />,
    title: "Your command center",
    description:
      "Every task shows up here. Search, filter, and manage them all from this list — even the ones floating on your desktop.",
    target: "task-list",
    placement: "right",
    highlightPadding: 6,
  },
  {
    id: "workspaces",
    icon: <GridFour size={15} weight="bold" />,
    title: "Organize with Workspaces",
    description:
      "Group your tasks into workspaces — one for work, one for personal, whatever you need. Switch between them with the tab above.",
    target: "workspaces",
    placement: "bottom",
    highlightPadding: 8,
    interaction: "user",
    actionHint: "Click the Workspace tab to see it in action",
  },
  {
    id: "create-workspace",
    icon: <Plus size={15} weight="bold" />,
    title: "Create your first workspace",
    description:
      "Click '+ Workspace' to create one. Give it a name like 'Work' or 'Personal' and press Enter to save it. Workspaces save your card positions so you can switch between setups instantly.",
    target: "create-workspace",
    placement: "bottom",
    highlightPadding: 8,
    interaction: "user",
    actionHint: "Click + Workspace above to try it",
  },
  {
    id: "back-to-tasks",
    icon: <List size={15} weight="bold" />,
    title: "Back to your tasks",
    description:
      "Switch back to the Tasks view by clicking the Tasks tab. You can return to your workspaces anytime.",
    target: "tasks-tab",
    placement: "bottom",
    highlightPadding: 8,
    interaction: "user",
    actionHint: "Click the Tasks tab to continue",
  },
  {
    id: "compact",
    icon: <Command size={15} weight="bold" />,
    title: "Compact mode",
    description:
      "When your screen gets busy, Compact collapses every card into a single tidy pill. Watch — I’ll turn it on.",
    target: "compact",
    placement: "top",
    highlightPadding: 8,
    interaction: "demo",
  },
  {
    id: "zen",
    icon: <Eye size={15} weight="bold" />,
    title: "Zen mode",
    description:
      "Need to focus? Zen hides the cards entirely so nothing distracts you. They snap right back when you’re ready.",
    target: "zen",
    placement: "top",
    highlightPadding: 8,
    interaction: "demo",
  },
  {
    id: "align",
    icon: <GridFour size={15} weight="bold" />,
    title: "Align to grid",
    description:
      "Cards scattered everywhere? Align snaps them into a neat grid in one click. Try it yourself.",
    target: "align",
    placement: "top",
    highlightPadding: 8,
    interaction: "user",
    actionHint: "Click Align to tidy your cards",
  },
  {
    id: "mcp-server",
    icon: <Command size={15} weight="bold" />,
    title: "AI-ready MCP Server",
    description:
      "Pinned runs a built-in MCP server on port 7890. Claude, ChatGPT, Cursor, and other AI tools can create and manage your tasks. Open the panel to copy the connection URL and a ready-to-use prompt.",
    target: "mcp-server",
    placement: "left",
    highlightPadding: 8,
  },
  {
    id: "phone-sync",
    icon: <DeviceMobile size={15} weight="bold" />,
    title: "Take Pinned on your phone",
    description:
      "The Android companion app scans a QR code and pushes your captured tasks straight to this desktop — both devices on the same WiFi, nothing goes to the internet. Tap Sync Phone to open the pairing dialog.",
    target: "phone-sync",
    placement: "bottom",
    highlightPadding: 8,
    interaction: "user",
    actionHint: "Click the Sync Phone button to see the QR",
  },
  {
    id: "finish",
    icon: <Sparkle size={15} weight="fill" />,
    title: "You’re all set",
    description:
      "That’s the tour. Start pinning what matters — Pinned keeps it in sight until it’s done.",
    placement: "center",
  },
];

const REDUCED_MOTION =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const SPRING = REDUCED_MOTION
  ? { duration: 0 }
  : { type: "spring" as const, stiffness: 380, damping: 32 };

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** A tiny decorative task-card used in the welcome hero stack. */
function MiniCard({
  delay,
  offset,
  rotate,
  scale,
  accent,
  lines,
  progress,
  pin = false,
}: {
  delay: number;
  offset: number;
  rotate: number;
  scale: number;
  accent: string;
  lines: [number, number];
  progress: number;
  pin?: boolean;
}) {
  const float = REDUCED_MOTION
    ? { y: [0, 0, 0] }
    : { y: [0, -7, 0], rotate: [rotate, rotate + 1, rotate] };
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale }}
      transition={{ ...SPRING, delay: 0.1 + delay }}
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        marginLeft: offset,
        transform: "translate(-50%, -50%)",
        width: 110,
        height: 62,
        borderRadius: 12,
        background: "var(--bg-float)",
        border: "1px solid var(--border)",
        boxShadow: "0 10px 26px rgba(0, 0, 0, 0.14)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
        padding: "0 12px",
      }}
    >
      {pin && (
        <span
          style={{
            position: "absolute",
            top: -5,
            left: "50%",
            transform: "translateX(-50%)",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: accent,
            boxShadow: "0 0 0 3px var(--bg-modal)",
          }}
        />
      )}
      <motion.div
        animate={float}
        transition={{
          duration: 3.4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.15 + delay,
        }}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 6,
          padding: "0 12px",
        }}
      >
        <div
          style={{
            height: 5,
            width: `${lines[0]}%`,
            borderRadius: 3,
            background: "var(--text-primary)",
            opacity: 0.85,
          }}
        />
        <div
          style={{
            height: 4,
            width: `${lines[1]}%`,
            borderRadius: 3,
            background: "var(--text-muted)",
            opacity: 0.55,
          }}
        />
        <div
          style={{
            height: 3,
            width: "100%",
            borderRadius: 2,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              borderRadius: 2,
              background: accent,
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"welcome" | "tour">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tooltipReady, setTooltipReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Tracks live-demo effects so they can be cleaned up if the user skips mid-demo.
  const demoActiveRef = useRef(false);
  // The add-task step waits for the user to actually open the modal and then
  // close it (task created or cancelled) before advancing — advancing on the
  // raw button click would drop the tour backdrop on top of the open modal.
  const isAddTaskOpen = useReminderStore((s) => s.isAddTaskOpen);
  const isPhoneSyncOpen = useReminderStore((s) => s.isPhoneSyncOpen);

  useScrollLock(visible);

  const currentStep = phase === "tour" ? STEPS[stepIndex] : null;
  const isLast = stepIndex === STEPS.length - 1;
  const pad = currentStep?.highlightPadding ?? 6;

  // ─── Listen for the backend's first-launch / replay signal ───────────────
  useEffect(() => {
    const p = listen("show_onboarding", () => {
      setPhase("welcome");
      setStepIndex(0);
      setVisible(true);
    });
    return () => {
      p.then(
        (f) => f(),
        () => {},
      );
    };
  }, []);

  // ─── Revert any live-demo mode we may have turned on ─────────────────────
  const revertDemo = useCallback(async () => {
    if (!demoActiveRef.current) return;
    demoActiveRef.current = false;
    await Promise.allSettled([setCompactMode(false), setZenMode(false)]);
  }, []);

  const finish = useCallback(async () => {
    await revertDemo();
    setVisible(false);
    setPhase("welcome");
    setStepIndex(0);
    await invoke("complete_onboarding").catch(() => {});
  }, [revertDemo]);

  // ─── Locate & track the highlighted element for the current step ─────────
  useEffect(() => {
    if (phase !== "tour" || !currentStep) return;

    if (!currentStep.target) {
      setRect(null);
      setTooltipReady(true);
      return;
    }

    setTooltipReady(false);
    let raf = 0;
    let retry: ReturnType<typeof setTimeout>;

    const measure = () => {
      const el = document.querySelector<HTMLElement>(
        `[data-onboarding="${currentStep.target}"]`,
      );
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        setTooltipReady(true);
      } else {
        retry = setTimeout(measure, 250);
      }
    };
    measure();

    const onScrollResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    const interval = setInterval(measure, 500);

    return () => {
      clearTimeout(retry);
      clearInterval(interval);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onScrollResize);
      window.removeEventListener("scroll", onScrollResize, true);
    };
  }, [phase, stepIndex, currentStep]);

  // ─── Run live demos on entering a "demo" step ────────────────────────────
  useEffect(() => {
    if (phase !== "tour" || !currentStep || currentStep.interaction !== "demo") return;
    let cancelled = false;

    (async () => {
      demoActiveRef.current = true;
      if (currentStep.id === "compact") {
        await setCompactMode(true).catch(() => {});
      } else if (currentStep.id === "zen") {
        await setZenMode(true).catch(() => {});
      }
      // Hold the effect on screen, then revert so the user isn't left changed.
      await new Promise((r) => setTimeout(r, REDUCED_MOTION ? 400 : 2200));
      if (cancelled) return;
      if (currentStep.id === "compact") await setCompactMode(false).catch(() => {});
      else if (currentStep.id === "zen") await setZenMode(false).catch(() => {});
      demoActiveRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, stepIndex, currentStep]);

  // ─── Detect the user completing a "user" interaction step ────────────────
  // The add-task and phone-sync steps open a modal, so we advance when the
  // modal has been opened and then closed again (not on the button click,
  // which would leave the tour backdrop covering the open modal).
  const addTaskWasOpenRef = useRef(false);
  useEffect(() => {
    if (phase !== "tour" || currentStep?.id !== "add-task") return;
    if (isAddTaskOpen) {
      addTaskWasOpenRef.current = true;
    } else if (addTaskWasOpenRef.current) {
      // Modal opened then closed — the user created or cancelled a task.
      addTaskWasOpenRef.current = false;
      const t = setTimeout(() => setStepIndex((s) => Math.min(s + 1, STEPS.length - 1)), 300);
      return () => clearTimeout(t);
    }
  }, [phase, currentStep, isAddTaskOpen]);

  const phoneSyncWasOpenRef = useRef(false);
  useEffect(() => {
    if (phase !== "tour" || currentStep?.id !== "phone-sync") return;
    if (isPhoneSyncOpen) {
      phoneSyncWasOpenRef.current = true;
    } else if (phoneSyncWasOpenRef.current) {
      // Panel opened then closed — the user peeked at the pairing QR.
      phoneSyncWasOpenRef.current = false;
      const t = setTimeout(() => setStepIndex((s) => Math.min(s + 1, STEPS.length - 1)), 300);
      return () => clearTimeout(t);
    }
  }, [phase, currentStep, isPhoneSyncOpen]);

  // Other "user" steps (e.g. Align) advance on a direct click of the target.
  useEffect(() => {
    if (phase !== "tour" || !currentStep || currentStep.interaction !== "user") return;
    if (!currentStep.target || currentStep.id === "add-task" || currentStep.id === "phone-sync") return;

    const el = document.querySelector<HTMLElement>(
      `[data-onboarding="${currentStep.target}"]`,
    );
    if (!el) return;

    const advance = () => {
      setTimeout(() => setStepIndex((s) => Math.min(s + 1, STEPS.length - 1)), 450);
    };
    el.addEventListener("click", advance, { once: true });
    return () => el.removeEventListener("click", advance);
  }, [phase, stepIndex, currentStep]);

  const goNext = useCallback(async () => {
    await revertDemo();
    if (stepIndex < STEPS.length - 1) setStepIndex((s) => s + 1);
    else await finish();
  }, [stepIndex, revertDemo, finish]);

  const goBack = useCallback(async () => {
    await revertDemo();
    setStepIndex((s) => Math.max(0, s - 1));
  }, [revertDemo]);

  // ─── Keyboard navigation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (phase === "tour" && (e.key === "ArrowRight" || e.key === "Enter")) {
        // Don't auto-advance a "user" step — they must perform the action.
        if (currentStep?.interaction === "user") return;
        e.preventDefault();
        goNext();
      } else if (phase === "tour" && e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, phase, currentStep, finish, goNext, goBack]);

  // Move focus into the tooltip when it appears (accessibility).
  useEffect(() => {
    if (phase === "tour" && tooltipReady) tooltipRef.current?.focus();
  }, [phase, tooltipReady, stepIndex]);

  const spring = SPRING;

  const tooltipPos = useMemo<React.CSSProperties>(() => {
    const tW = 340;
    const tH = 240; // approx height, used to keep the tip on-screen vertically
    const gap = 14;
    if (!currentStep || currentStep.placement === "center" || !rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: tW };
    }
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clampX = (x: number) => Math.max(12, Math.min(x, winW - tW - 12));
    const clampY = (y: number) => Math.max(12, Math.min(y, winH - tH - 12));

    switch (currentStep.placement) {
      case "top": {
        // If there isn't room above the target, drop below it instead.
        if (rect.top < tH + gap + pad + 12) {
          return { top: clampY(rect.top + rect.height + gap + pad), left: clampX(cx - tW / 2), width: tW };
        }
        return { bottom: winH - rect.top + gap + pad, left: clampX(cx - tW / 2), width: tW };
      }
      case "left": {
        // If the target is too wide to leave room on its left, center horizontally.
        if (rect.left < tW + gap + pad + 12) {
          return { top: clampY(cy - tH / 2), left: clampX(cx - tW / 2), width: tW };
        }
        return { right: winW - rect.left + gap + pad, top: clampY(cy - 90), width: tW };
      }
      case "right": {
        // If the target is too wide to leave room on its right, center horizontally.
        if (rect.left + rect.width + tW + gap + pad + 12 > winW) {
          return { top: clampY(cy - tH / 2), left: clampX(cx - tW / 2), width: tW };
        }
        return { left: rect.left + rect.width + gap + pad, top: clampY(cy - 90), width: tW };
      }
      default:
        return { top: clampY(rect.top + rect.height + gap + pad), left: clampX(cx - tW / 2), width: tW };
    }
  }, [currentStep, rect, pad]);

  // While the Add Task modal is open, hide the tour visuals entirely so the
  // backdrop/tooltip never cover the form the user is filling in.
  const hiddenForModal = (isAddTaskOpen && currentStep?.id === "add-task") ||
    (isPhoneSyncOpen && currentStep?.id === "phone-sync");
  const showSpotlight = phase === "tour" && rect && currentStep?.target && !hiddenForModal;

  return (
    <AnimatePresence>
      {visible && !hiddenForModal && (
        <motion.div
          key="onboarding-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: REDUCED_MOTION ? 0 : 0.28 }}
          style={{ position: "fixed", inset: 0, zIndex: 9998, pointerEvents: "none" }}
          role="dialog"
          aria-modal="true"
          aria-label={currentStep ? `Onboarding: ${currentStep.title}` : "Welcome to Pinned"}
        >
          {/* ─── Dimmed backdrop with animated spotlight cutout ───────────── */}
          {showSpotlight ? (
            <motion.svg
              style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 9998 }}
              aria-hidden
            >
              <defs>
                <mask id="ob-spotlight">
                  <rect width="100%" height="100%" fill="white" />
                  <motion.rect
                    initial={false}
                    animate={{
                      x: rect.left - pad,
                      y: rect.top - pad,
                      width: rect.width + pad * 2,
                      height: rect.height + pad * 2,
                    }}
                    transition={spring}
                    rx={10}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width="100%"
                height="100%"
                fill="var(--bg-overlay, rgba(0,0,0,0.55))"
                mask="url(#ob-spotlight)"
              />
            </motion.svg>
          ) : (
            <div
              style={{
                position: "fixed",
                inset: 0,
                background: "var(--bg-overlay, rgba(0,0,0,0.55))",
                zIndex: 9998,
              }}
            />
          )}

          {/* ─── Glowing ring around the spotlight target ─────────────────── */}
          {showSpotlight && (
            <motion.div
              initial={false}
              animate={{
                left: rect.left - pad,
                top: rect.top - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
              }}
              transition={spring}
              style={{
                position: "fixed",
                borderRadius: 12,
                border: "2px solid var(--text-primary)",
                boxShadow: "0 0 0 4px var(--bg-overlay), 0 0 32px 4px rgba(120,120,255,0.25)",
                zIndex: 9999,
                pointerEvents: "none",
              }}
            >
              {/* Pulse for interactive steps to invite the click */}
              {currentStep?.interaction === "user" && !REDUCED_MOTION && (
                <motion.div
                  animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.12, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    position: "absolute",
                    inset: -2,
                    borderRadius: 12,
                    border: "2px solid var(--text-primary)",
                  }}
                />
              )}
            </motion.div>
          )}

          {/* ─── Welcome card ─────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {phase === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: REDUCED_MOTION ? 0 : 0.28 }}
                style={{
                  position: "fixed",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 24,
                  zIndex: 10001,
                  pointerEvents: "none",
                }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -16 }}
                  transition={spring}
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 480,
                    background: "var(--bg-modal)",
                    border: "1px solid var(--border)",
                    borderRadius: 22,
                    padding: "34px 36px 28px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    boxShadow: "var(--shadow-menu)",
                    fontFamily: "'Geist Mono', monospace",
                    pointerEvents: "auto",
                    overflow: "hidden",
                  }}
                >
                  {/* Dot-grid backdrop inside the card */}
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage:
                        "radial-gradient(circle, var(--bg-dot) 1px, transparent 1px)",
                      backgroundSize: "22px 22px",
                      opacity: 0.6,
                      pointerEvents: "none",
                    }}
                  />

                  {/* ─── Animated hero: floating task cards ─────────────── */}
                  <div
                    aria-hidden
                    style={{
                      position: "relative",
                      width: "100%",
                      height: 128,
                      marginBottom: 6,
                    }}
                  >
                    {/* Soft accent glow behind the stack */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ ...spring, delay: 0.15 }}
                      style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 220,
                        height: 220,
                        borderRadius: "50%",
                        background: "var(--accent-soft)",
                        filter: "blur(40px)",
                      }}
                    />

                    {/* Back card */}
                    <MiniCard
                      delay={0.18}
                      offset={0}
                      rotate={-7}
                      scale={0.92}
                      accent="var(--text-muted)"
                      lines={[70, 45]}
                      progress={0.9}
                    />
                    {/* Middle card */}
                    <MiniCard
                      delay={0.1}
                      offset={0}
                      rotate={7}
                      scale={0.96}
                      accent="var(--accent)"
                      lines={[60, 85]}
                      progress={0.55}
                      pin
                    />
                    {/* Front card */}
                    <MiniCard
                      delay={0}
                      offset={0}
                      rotate={0}
                      scale={1.02}
                      accent="var(--text-primary)"
                      lines={[80, 55]}
                      progress={0.25}
                      pin
                    />
                  </div>

                  {/* ─── Title ────────────────────────────────────────────── */}
                  <motion.h1
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.28 }}
                    style={{
                      fontSize: 30,
                      fontWeight: 700,
                      letterSpacing: "-0.8px",
                      margin: 0,
                      marginBottom: 12,
                      lineHeight: 1.15,
                      backgroundImage:
                        "linear-gradient(115deg, var(--text-primary) 35%, var(--accent) 60%, var(--text-primary) 90%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      color: "var(--text-primary)",
                    }}
                  >
                    Tasks that never let go
                  </motion.h1>

                  <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.34 }}
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      lineHeight: 1.7,
                      margin: "0 0 24px",
                      maxWidth: 340,
                    }}
                  >
                    Pin a task, and it stays floating above every window until
                    it’s done. Take the 60-second tour — I’ll show you around, live.
                  </motion.p>

                  {/* ─── Feature highlights ──────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.4 }}
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 26,
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}
                  >
                    {[
                      { icon: <Plus size={12} weight="bold" />, label: "Create tasks" },
                      { icon: <GridFour size={12} weight="bold" />, label: "Workspaces" },
                      { icon: <DeviceMobile size={12} weight="bold" />, label: "Phone sync" },
                      { icon: <Command size={12} weight="bold" />, label: "AI-ready" },
                    ].map((f) => (
                      <span
                        key={f.label}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--text-secondary)",
                          background: "var(--bg-badge)",
                          border: "1px solid var(--border)",
                          borderRadius: 999,
                          padding: "6px 12px",
                        }}
                      >
                        <span style={{ color: "var(--accent)" }}>{f.icon}</span>
                        {f.label}
                      </span>
                    ))}
                  </motion.div>

                  {/* ─── CTAs ────────────────────────────────────────────── */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: 0.46 }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setPhase("tour");
                        setStepIndex(0);
                      }}
                      style={{
                        background: "var(--btn-primary-bg)",
                        color: "var(--btn-primary-text)",
                        border: "none",
                        borderRadius: 12,
                        padding: "14px 40px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Geist Mono', monospace",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        boxShadow: "0 6px 20px var(--accent-ring)",
                        transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                          "0 10px 28px var(--accent-ring)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow =
                          "0 6px 20px var(--accent-ring)";
                      }}
                    >
                      Take the tour <ArrowRight size={14} weight="bold" />
                    </button>
                    <button
                      type="button"
                      onClick={finish}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      I’ll figure it out myself
                    </button>
                  </motion.div>
                </motion.div>
              </motion.div>
            )}

            {/* ─── Tour tooltip ───────────────────────────────────────────── */}
            {phase === "tour" && currentStep && tooltipReady && (
              <motion.div
                key={`tip-${stepIndex}`}
                ref={tooltipRef}
                tabIndex={-1}
                initial={{ opacity: 0, scale: 0.97, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: -6 }}
                transition={{ ...spring, delay: REDUCED_MOTION ? 0 : 0.08 }}
                style={{
                  position: "fixed",
                  zIndex: 10002,
                  background: "var(--bg-modal)",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  padding: 20,
                  boxShadow: "var(--shadow-menu)",
                  outline: "none",
                  fontFamily: "'Geist Mono', monospace",
                  pointerEvents: "auto",
                  ...tooltipPos,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      background: "var(--bg-badge)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-primary)",
                      flexShrink: 0,
                    }}
                  >
                    {currentStep.icon}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                    {currentStep.title}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    lineHeight: 1.7,
                    margin: "0 0 16px",
                  }}
                >
                  {currentStep.description}
                </p>

                {/* Progress rail */}
                <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
                  {STEPS.map((s, i) => (
                    <span
                      key={s.id}
                      style={{
                        height: 3,
                        flex: 1,
                        borderRadius: 2,
                        background:
                          i <= stepIndex ? "var(--text-primary)" : "var(--border)",
                        transition: "background 0.3s ease",
                      }}
                    />
                  ))}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {stepIndex > 0 && (
                      <button
                        type="button"
                        onClick={goBack}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          fontSize: 11,
                          fontFamily: "'Geist Mono', monospace",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <ArrowLeft size={12} /> Back
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={finish}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 11,
                        fontFamily: "'Geist Mono', monospace",
                        padding: "0 6px",
                      }}
                    >
                      Skip
                    </button>
                  </div>

                  {currentStep.interaction === "user" ? (
                    <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>
                      {currentStep.actionHint ?? "Try it above"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={goNext}
                      style={{
                        background: "var(--btn-primary-bg)",
                        color: "var(--btn-primary-text)",
                        border: "none",
                        borderRadius: 7,
                        padding: "8px 16px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Geist Mono', monospace",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {isLast ? (
                        <>
                          <CheckCircle size={13} weight="bold" /> Done
                        </>
                      ) : (
                        <>
                          Next <ArrowRight size={12} weight="bold" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
