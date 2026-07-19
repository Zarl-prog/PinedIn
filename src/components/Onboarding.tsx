import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  ArrowRight,
  X,
  CheckCircle,
  Plus,
  List,
  Command,
  GearSix,
  Sparkle,
} from "@phosphor-icons/react";

interface Step {
  id: string;
  title: string;
  description: string;
  selector?: string;
  placement?: "bottom" | "top" | "right" | "left";
  highlightPadding?: number;
  action?: "click" | "observe" | null;
  observeSelector?: string;
}

const STEPS: Step[] = [
  {
    id: "add-task",
    title: "Create your first task",
    description:
      'Click the "+ Add Task" button to create your first floating task card. Try it now!',
    selector: "button:has(span:contains('+ Add Task'))",
    placement: "bottom",
    highlightPadding: 8,
    action: "click",
  },
  {
    id: "task-list",
    title: "Your tasks, organized",
    description:
      "Every task appears here in the task list. You can search, filter, and manage them all from this view.",
    selector: ".tasks-body",
    placement: "top",
    highlightPadding: 4,
  },
  {
    id: "toolbar",
    title: "Power tools at your fingertips",
    description:
      "Compact mode collapses cards into a pill. Zen mode hides them. Align snaps cards into a grid. Shake makes urgent tasks pulse.",
    selector: ".feature-btn",
    placement: "top",
    highlightPadding: 8,
  },
  {
    id: "settings",
    title: "Tweak everything",
    description:
      "Change themes, adjust card shake intervals, configure autostart, and check for updates — all from Settings.",
    selector: ".feature-btn.ghost",
    placement: "left",
    highlightPadding: 8,
  },
  {
    id: "finish",
    title: "You're all set!",
    description:
      "You now know the essentials. Start adding tasks, try compact mode when things get busy, and use zen mode when you need focus.",
    placement: "bottom",
  },
];

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [locked]);
}

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"welcome" | "tour" | "done">("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [tooltipReady, setTooltipReady] = useState(false);
  const [clickedAddTask, setClickedAddTask] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);

  useScrollLock(visible);

  useEffect(() => {
    const p = listen("show_onboarding", () => setVisible(true));
    return () => {
      p.then(
        (f) => f(),
        () => {},
      );
    };
  }, []);

  useEffect(() => {
    if (phase !== "tour") return;
    if (stepIndex >= STEPS.length) {
      handleComplete();
      return;
    }

    const step = STEPS[stepIndex];
    if (!step.selector) {
      setHighlightRect(null);
      setTooltipReady(true);
      return;
    }

    const update = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (el) {
        const r = el.getBoundingClientRect();
        setHighlightRect(r);
        setTooltipReady(true);
      } else {
        setHighlightRect(null);
        setTooltipReady(false);
        const retry = setTimeout(update, 300);
        return () => clearTimeout(retry);
      }
    };

    update();
    const interval = setInterval(update, 500);
    return () => clearInterval(interval);
  }, [phase, stepIndex]);

  useEffect(() => {
    if (phase !== "tour") return;
    const step = STEPS[stepIndex];
    if (!step.observeSelector) return;
    const check = () => {
      const el = document.querySelector(step.observeSelector!);
      if (el) {
        if (step.id === "add-task") setClickedAddTask(true);
        setTimeout(() => setStepIndex((s) => s + 1), 600);
      }
    };
    const id = setInterval(check, 300);
    return () => clearInterval(id);
  }, [phase, stepIndex]);

  async function handleComplete() {
    setPhase("done");
    setVisible(false);
    setClickedAddTask(false);
    await invoke("complete_onboarding");
  }

  function handleNext() {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((s) => s + 1);
    } else {
      handleComplete();
    }
  }

  const currentStep = stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const isLast = stepIndex === STEPS.length - 1;

  function getTooltipPos(step: Step): React.CSSProperties {
    if (!highlightRect || !step.selector) {
      return { bottom: "40px", left: "50%", transform: "translateX(-50%)" };
    }
    const gap = 12;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const tW = 340;
    const tH = 180;

    switch (step.placement || "bottom") {
      case "bottom": {
        let left = highlightRect.left + highlightRect.width / 2 - tW / 2;
        left = Math.max(12, Math.min(left, winW - tW - 12));
        return { top: `${highlightRect.bottom + gap}px`, left: `${left}px`, width: `${tW}px` };
      }
      case "top": {
        let left = highlightRect.left + highlightRect.width / 2 - tW / 2;
        left = Math.max(12, Math.min(left, winW - tW - 12));
        return {
          bottom: `${winH - highlightRect.top + gap}px`,
          left: `${left}px`,
          width: `${tW}px`,
        };
      }
      case "left": {
        let top = highlightRect.top + highlightRect.height / 2 - tH / 2;
        top = Math.max(12, Math.min(top, winH - tH - 12));
        return { right: `${winW - highlightRect.left + gap}px`, top: `${top}px`, width: `${tW}px` };
      }
      case "right": {
        let top = highlightRect.top + highlightRect.height / 2 - tH / 2;
        top = Math.max(12, Math.min(top, winH - tH - 12));
        return { left: `${highlightRect.right + gap}px`, top: `${top}px`, width: `${tW}px` };
      }
      default:
        return { bottom: "40px", left: "50%", transform: "translateX(-50%)", width: `${tW}px` };
    }
  }

  const handleSpotlightClick = useCallback(
    (e: React.MouseEvent) => {
      const step = STEPS[stepIndex];
      if (!step || !step.selector) return;
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el && el.contains(e.target as Node)) {
        if (step.action === "click") {
          el.click();
          if (step.id === "add-task") {
            setClickedAddTask(true);
          }
        }
      }
    },
    [stepIndex],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            pointerEvents: phase === "welcome" ? "auto" : "auto",
          }}
        >
          {phase === "tour" && highlightRect && currentStep?.selector && (
            <>
              {/* Full backdrop */}
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.7)",
                  zIndex: 9998,
                }}
                onClick={() => {}}
              />

              {/* Cutout highlight */}
              <svg
                style={{
                  position: "fixed",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  zIndex: 9999,
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white" />
                    <rect
                      x={highlightRect.left - (currentStep.highlightPadding || 4)}
                      y={highlightRect.top - (currentStep.highlightPadding || 4)}
                      width={highlightRect.width + (currentStep.highlightPadding || 4) * 2}
                      height={highlightRect.height + (currentStep.highlightPadding || 4) * 2}
                      rx="8"
                      fill="black"
                    />
                  </mask>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill="rgba(0,0,0,0.7)"
                  mask="url(#spotlight-mask)"
                />
              </svg>

              {/* Interactive highlight border */}
              <div
                ref={spotlightRef}
                onClick={handleSpotlightClick}
                style={{
                  position: "fixed",
                  left: highlightRect.left - (currentStep.highlightPadding || 4) - 2,
                  top: highlightRect.top - (currentStep.highlightPadding || 4) - 2,
                  width: highlightRect.width + (currentStep.highlightPadding || 4) * 2 + 4,
                  height: highlightRect.height + (currentStep.highlightPadding || 4) * 2 + 4,
                  borderRadius: "10px",
                  border: "2px solid rgba(255,255,255,0.4)",
                  boxShadow: "0 0 30px rgba(255,255,255,0.1)",
                  zIndex: 10000,
                  pointerEvents: currentStep.action === "click" ? "auto" : "none",
                  cursor: currentStep.action === "click" ? "pointer" : "default",
                  transition: "all 0.3s ease",
                }}
              />
            </>
          )}

          {/* Tooltip card */}
          <AnimatePresence mode="wait">
            {phase === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "#000",
                  border: "1px solid #1a1a1a",
                  borderRadius: "16px",
                  width: "100%",
                  maxWidth: "460px",
                  padding: "36px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  zIndex: 10001,
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    background: "#fff",
                    borderRadius: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "20px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "26px",
                      fontWeight: 700,
                      color: "#000",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    P
                  </span>
                </div>

                <h1
                  style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#ffffff",
                    fontFamily: "'Geist Mono', monospace",
                    marginBottom: "10px",
                  }}
                >
                  Welcome to PinedIn
                </h1>

                <p
                  style={{
                    fontSize: "13px",
                    color: "#666",
                    fontFamily: "'Geist Mono', monospace",
                    lineHeight: 1.6,
                    marginBottom: "28px",
                    maxWidth: "340px",
                  }}
                >
                  Tasks that float above every window, so you never lose track of what's next.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                    justifyContent: "center",
                    marginBottom: "28px",
                  }}
                >
                  {["Always on top", "No cloud", "Global hotkey", "AI ready", "Open source"].map(
                    (tag) => (
                      <span
                        key={tag}
                        style={{
                          background: "#0a0a0a",
                          border: "1px solid #1a1a1a",
                          borderRadius: "999px",
                          padding: "4px 12px",
                          fontSize: "11px",
                          color: "#666",
                          fontFamily: "'Geist Mono', monospace",
                        }}
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>

                <button
                  onClick={() => {
                    setPhase("tour");
                    setStepIndex(0);
                  }}
                  style={{
                    background: "#ffffff",
                    color: "#000000",
                    border: "none",
                    borderRadius: "8px",
                    padding: "12px 32px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Geist Mono', monospace",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Show me around <ArrowRight size={14} weight="bold" />
                </button>

                <button
                  onClick={handleComplete}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#444",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: "'Geist Mono', monospace",
                    marginTop: "12px",
                  }}
                >
                  I'll figure it out myself
                </button>
              </motion.div>
            )}

            {phase === "tour" && currentStep && tooltipReady && (
              <motion.div
                key={`tooltip-${stepIndex}`}
                ref={tooltipRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.1 }}
                style={{
                  position: "fixed",
                  zIndex: 10002,
                  background: "#000",
                  border: "1px solid #1a1a1a",
                  borderRadius: "12px",
                  padding: "20px",
                  ...getTooltipPos(currentStep),
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      background: "#0a0a0a",
                      border: "1px solid #1a1a1a",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "12px",
                      flexShrink: 0,
                    }}
                  >
                    {stepIndex === 0 ? (
                      <Plus size={14} />
                    ) : stepIndex === 1 ? (
                      <List size={14} />
                    ) : stepIndex === 2 ? (
                      <Command size={14} />
                    ) : stepIndex === 3 ? (
                      <GearSix size={14} />
                    ) : (
                      <Sparkle size={14} />
                    )}
                  </span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#fff",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {currentStep.title}
                  </span>
                </div>

                <p
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    fontFamily: "'Geist Mono', monospace",
                    lineHeight: 1.7,
                    margin: 0,
                    marginBottom: "16px",
                  }}
                >
                  {currentStep.description}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#333",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {stepIndex + 1} / {STEPS.length}
                  </span>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      onClick={handleComplete}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#333",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      Skip
                    </button>
                    {currentStep.action === "click" && !isLast ? (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#555",
                          fontFamily: "'Geist Mono', monospace",
                        }}
                      >
                        Click the highlighted button above
                      </span>
                    ) : (
                      <button
                        onClick={handleNext}
                        style={{
                          background: "#ffffff",
                          color: "#000",
                          border: "none",
                          borderRadius: "6px",
                          padding: "7px 14px",
                          fontSize: "11px",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Geist Mono', monospace",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        {isLast ? (
                          <>
                            <CheckCircle size={13} weight="bold" /> Done
                          </>
                        ) : (
                          <>
                            Next <ArrowRight size={12} weight="light" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
