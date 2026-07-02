import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  X, ArrowRight, ArrowLeft, CheckCircle,
  Cards, EyeClosed, Rows, SquaresFour, Robot
} from "@phosphor-icons/react";

interface TooltipStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  position: "top" | "bottom" | "left" | "right" | "center";
  demo?: React.ReactNode;
}

const TOUR_STEPS: TooltipStep[] = [
  {
    id: "floating-cards",
    title: "Floating Task Cards",
    description: "Every task you add becomes a small always-on-top card that floats over every app on your screen. Switch tabs, open a game, join a meeting — your tasks follow you everywhere.",
    icon: <Cards size={20} weight="light" />,
    position: "center",
    demo: (
      <div style={{
        background: "#0f0f11",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px",
        padding: "12px 14px",
        width: "220px",
        margin: "12px auto 0"
      }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff", fontFamily: "'Geist Mono', monospace", marginBottom: "4px" }}>
          Fix the auth bug
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.38)", fontFamily: "'Geist Mono', monospace" }}>
          Backend team · Due today
        </div>
        <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
          <div style={{ flex: 1, height: "26px", borderRadius: "6px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "10px", color: "#22c55e", fontFamily: "'Geist Mono', monospace" }}>✓ Done</span>
          </div>
          <div style={{ flex: 1, height: "26px", borderRadius: "6px", border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "10px", color: "#f59e0b", fontFamily: "'Geist Mono', monospace" }}>Snooze</span>
          </div>
          <div style={{ flex: 1, height: "26px", borderRadius: "6px", border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "10px", color: "#a78bfa", fontFamily: "'Geist Mono', monospace" }}>Remind</span>
          </div>
        </div>
      </div>
    )
  },
  {
    id: "compact-mode",
    title: "Compact Mode",
    description: "Too many cards cluttering your screen? Switch to Compact Mode from the toolbar. All cards collapse into a single tiny pill in the corner. Double-click to peek at your current task — it auto-closes in 3 seconds.",
    icon: <Rows size={20} weight="light" />,
    position: "center",
    demo: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "12px" }}>
        <div style={{
          background: "#000",
          border: "1px solid #2a2a2a",
          borderRadius: "999px",
          padding: "8px 18px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#f59e0b", display: "block" }} />
          <span style={{ fontSize: "11px", color: "#fff", fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>3 tasks</span>
        </div>
        <span style={{ fontSize: "10px", color: "#444", fontFamily: "'Geist Mono', monospace" }}>double-click to peek</span>
      </div>
    )
  },
  {
    id: "zen-mode",
    title: "Zen Mode",
    description: "Need to focus without distractions? Press the Zen button in the toolbar to instantly hide all floating cards. Press it again to bring them back. Your tasks are still there — just out of the way.",
    icon: <EyeClosed size={20} weight="light" />,
    position: "center",
    demo: (
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "12px", justifyContent: "center" }}>
        <div style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", padding: "8px 12px", opacity: 1 }}>
          <span style={{ fontSize: "11px", color: "#fff", fontFamily: "'Geist Mono', monospace" }}>Task card</span>
        </div>
        <ArrowRight size={14} color="#444" />
        <div style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "8px", padding: "8px 12px", opacity: 0.08 }}>
          <span style={{ fontSize: "11px", color: "#fff", fontFamily: "'Geist Mono', monospace" }}>Task card</span>
        </div>
      </div>
    )
  },
  {
    id: "workspaces",
    title: "Workspaces",
    description: "Create named workspaces like 'Deep Work' or 'Meetings'. Each workspace has its own set of tasks. Activate a workspace and only those tasks float on your screen — everything else hides.",
    icon: <SquaresFour size={20} weight="light" />,
    position: "center",
    demo: (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px", width: "240px", margin: "12px auto 0" }}>
        {["Deep Work", "Meetings"].map(name => (
          <div key={name} style={{
            background: "#0a0a0a",
            border: "1px solid #1a1a1a",
            borderRadius: "10px",
            padding: "10px",
          }}>
            <div style={{ fontSize: "16px", marginBottom: "6px" }}>⬡</div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#fff", fontFamily: "'Geist Mono', monospace" }}>{name}</div>
            <div style={{ fontSize: "10px", color: "#444", fontFamily: "'Geist Mono', monospace", marginTop: "2px" }}>3 tasks</div>
          </div>
        ))}
      </div>
    )
  },
  {
    id: "mcp",
    title: "AI Integration (MCP)",
    description: "PinedIn runs a local MCP server on port 7890. Connect Claude Desktop, Cursor, or any MCP-compatible AI and say 'Add these tasks from my meeting notes' — cards appear on your screen instantly.",
    icon: <Robot size={20} weight="light" />,
    position: "center",
    demo: (
      <div style={{ marginTop: "12px", width: "260px", margin: "12px auto 0" }}>
        <div style={{
          background: "#0a0a0a",
          border: "1px solid #1a1a1a",
          borderRadius: "8px",
          padding: "10px 12px",
          fontFamily: "'Geist Mono', monospace"
        }}>
          <div style={{ fontSize: "10px", color: "#444", marginBottom: "6px" }}>Claude Desktop config</div>
          <code style={{ fontSize: "10px", color: "#888", display: "block", lineHeight: 1.6 }}>
            {`"pinedin": {`}<br/>
            {`  "url": "http://127.0.0.1`}<br/>
            {`         :7890/sse"`}<br/>
            {`}`}
          </code>
        </div>
        <div style={{ fontSize: "10px", color: "#444", fontFamily: "'Geist Mono', monospace", textAlign: "center", marginTop: "6px" }}>
          Find this in Settings → MCP Server
        </div>
      </div>
    )
  }
];

export default function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"welcome" | "tour" | "done">("welcome");
  const [step, setStep] = useState(0);

  useEffect(() => {
    const unlisten = listen("show_onboarding", () => setVisible(true));
    return () => { unlisten.then(f => f()); };
  }, []);

  async function handleComplete() {
    setPhase("done");
    setVisible(false);
    await invoke("complete_onboarding");
  }

  function handleNext() {
    if (step < TOUR_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      handleComplete();
    }
  }

  function handlePrev() {
    if (step > 0) setStep(s => s - 1);
  }

  const currentStep = TOUR_STEPS[step];

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
            background: "rgba(0,0,0,0.85)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)"
          }}
        >
          <AnimatePresence mode="wait">
            {phase === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                style={{
                  background: "#000",
                  border: "1px solid #1a1a1a",
                  borderRadius: "16px",
                  width: "480px",
                  padding: "40px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0",
                  position: "relative",
                  textAlign: "center"
                }}
              >
                <button
                  onClick={handleComplete}
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    background: "transparent",
                    border: "none",
                    color: "#444",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontFamily: "'Geist Mono', monospace"
                  }}
                >
                  <X size={13} weight="light" /> Skip
                </button>

                <div style={{
                  width: "64px",
                  height: "64px",
                  background: "#fff",
                  borderRadius: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "24px"
                }}>
                  <span style={{ fontSize: "28px", fontWeight: 700, color: "#000", fontFamily: "'Geist Mono', monospace" }}>P</span>
                </div>

                <h1 style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: "#ffffff",
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: "-0.5px",
                  marginBottom: "12px",
                  lineHeight: 1.2
                }}>
                  Welcome to PinedIn
                </h1>

                <p style={{
                  fontSize: "13px",
                  color: "#666",
                  fontFamily: "'Geist Mono', monospace",
                  lineHeight: 1.6,
                  marginBottom: "32px",
                  maxWidth: "340px"
                }}>
                  Your tasks are about to float above every app on your screen. You will never forget a task again.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", justifyContent: "center", marginBottom: "32px" }}>
                  {["Always on top", "No cloud", "Global hotkey", "AI ready", "Open source"].map(tag => (
                    <span key={tag} style={{
                      background: "#0a0a0a",
                      border: "1px solid #1a1a1a",
                      borderRadius: "999px",
                      padding: "4px 12px",
                      fontSize: "11px",
                      color: "#666",
                      fontFamily: "'Geist Mono', monospace"
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => setPhase("tour")}
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
                    marginTop: "12px"
                  }}
                >
                  I'll figure it out myself
                </button>
              </motion.div>
            )}

            {phase === "tour" && (
              <motion.div
                key={`tour-${step}`}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                style={{
                  background: "#000",
                  border: "1px solid #1a1a1a",
                  borderRadius: "16px",
                  width: "420px",
                  padding: "32px",
                  position: "relative"
                }}
              >
                <div style={{
                  position: "absolute",
                  top: "20px",
                  right: "20px",
                  fontSize: "11px",
                  color: "#333",
                  fontFamily: "'Geist Mono', monospace"
                }}>
                  {step + 1} / {TOUR_STEPS.length}
                </div>

                <div style={{ display: "flex", gap: "5px", marginBottom: "24px" }}>
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        height: "2px",
                        flex: 1,
                        borderRadius: "1px",
                        background: i <= step ? "#ffffff" : "#1a1a1a",
                        transition: "background 0.2s"
                      }}
                    />
                  ))}
                </div>

                <div style={{
                  width: "40px",
                  height: "40px",
                  background: "#0a0a0a",
                  border: "1px solid #1a1a1a",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  marginBottom: "16px"
                }}>
                  {currentStep.icon}
                </div>

                <h2 style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "#ffffff",
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: "-0.3px",
                  marginBottom: "10px"
                }}>
                  {currentStep.title}
                </h2>

                <p style={{
                  fontSize: "12px",
                  color: "#666",
                  fontFamily: "'Geist Mono', monospace",
                  lineHeight: 1.7,
                  marginBottom: "0"
                }}>
                  {currentStep.description}
                </p>

                {currentStep.demo && (
                  <div style={{ marginTop: "16px" }}>
                    {currentStep.demo}
                  </div>
                )}

                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "28px"
                }}>
                  <button
                    onClick={handlePrev}
                    disabled={step === 0}
                    style={{
                      background: "transparent",
                      border: "1px solid #1a1a1a",
                      borderRadius: "7px",
                      padding: "8px 16px",
                      color: step === 0 ? "#222" : "#666",
                      fontSize: "11px",
                      cursor: step === 0 ? "not-allowed" : "pointer",
                      fontFamily: "'Geist Mono', monospace",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <ArrowLeft size={12} weight="light" /> Back
                  </button>

                  <button
                    onClick={handleComplete}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#333",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontFamily: "'Geist Mono', monospace"
                    }}
                  >
                    Skip tour
                  </button>

                  <button
                    onClick={handleNext}
                    style={{
                      background: "#ffffff",
                      color: "#000",
                      border: "none",
                      borderRadius: "7px",
                      padding: "8px 16px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Geist Mono', monospace",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {step === TOUR_STEPS.length - 1 ? (
                      <><CheckCircle size={13} weight="bold" /> Get started</>
                    ) : (
                      <>Next <ArrowRight size={12} weight="light" /></>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
