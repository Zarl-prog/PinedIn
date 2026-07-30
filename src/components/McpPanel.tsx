import { ArrowDown, CaretDown, CaretUp, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const MCP_PROMPT = `I have a local Pinned task manager running on my machine. It exposes an MCP-compatible HTTP API.

You can manage my tasks by sending POST requests to:
http://127.0.0.1:7890/message

Available tools:
1. add_task — creates a new floating task
2. list_tasks — lists all active tasks
3. complete_task — marks a task as done
4. add_multiple_tasks — bulk adds tasks

To call any tool, POST this JSON-RPC payload:

{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"<tool_name>","arguments":{...}}}

Example to list tasks:
POST http://127.0.0.1:7890/message
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_tasks","arguments":{}}}

Example to add a task:
POST http://127.0.0.1:7890/message
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add_task","arguments":{"title":"Buy groceries"}}}

When I ask you to remember or manage something, use these tools to create/check/complete tasks for me.`;

interface McpPanelProps {
  open: boolean;
  onClose: () => void;
}

const PREVIEW_LINES = 4;

export default function McpPanel({ open, onClose }: McpPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(true);

  useEffect(() => {
    if (expanded && scrollRef.current) {
      const el = scrollRef.current;
      setScrolledToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 10);
    } else if (!expanded) {
      setScrolledToBottom(true);
    }
  }, [expanded]);

  function handleCopy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 1500);
  }

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setScrolledToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 10);
  }
  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--bg-overlay)",
            }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "480px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-menu)",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#22c55e" fillRule="evenodd" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z" />
                  <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z" />
                </svg>
                MCP Server
              </span>
              <button
                onClick={onClose}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-light)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-badge)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.borderColor = "var(--text-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-light)";
                }}
              >
                <X size={16} weight="light" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Server status */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#22c55e",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
                    Running on port 7890
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  Connect Claude Desktop, Cursor, or any MCP client
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-code, #0a0a0a)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "6px",
                    padding: "8px 10px",
                  }}
                >
                  <code
                    style={{
                      fontSize: "12px",
                      color: "var(--text-primary)",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 500,
                    }}
                  >
                    http://127.0.0.1:7890/sse
                  </code>
                  <button
                    onClick={() => handleCopy("http://127.0.0.1:7890/sse", setUrlCopied)}
                    style={{
                      background: "var(--bg-badge)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      borderRadius: "6px",
                      padding: "5px 12px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 600,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-hover)";
                      e.currentTarget.style.borderColor = "var(--text-muted)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "var(--bg-badge)";
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  >
                    {urlCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Copy prompt section */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <span
                    style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}
                  >
                    Zero-config prompt for any AI
                  </span>
                  <button
                    onClick={() => handleCopy(MCP_PROMPT, setPromptCopied)}
                    style={{
                      background: "#22c55e",
                      border: "none",
                      color: "#000",
                      borderRadius: "6px",
                      padding: "7px 16px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 700,
                      transition: "all 0.15s ease",
                      letterSpacing: "0.02em",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#16a34a";
                      e.currentTarget.style.transform = "scale(1.02)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#22c55e";
                      e.currentTarget.style.transform = "scale(1)";
                    }}
                  >
                    {promptCopied ? "Copied!" : "Copy Prompt"}
                  </button>
                </div>
                <div
                  style={{
                    background: "var(--bg-code, #0a0a0a)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "6px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    style={{
                      position: "relative",
                      maxHeight: expanded ? "300px" : "none",
                      overflowY: expanded ? "auto" : "visible",
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontSize: "12px",
                        lineHeight: 1.6,
                        color: "var(--text-primary)",
                        fontFamily: "'Geist Mono', monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        padding: "12px 14px",
                        paddingBottom: expanded && !scrolledToBottom ? "32px" : "12px",
                      }}
                    >
                      {expanded
                        ? MCP_PROMPT
                        : MCP_PROMPT.split("\n").slice(0, PREVIEW_LINES).join("\n") + "\n…"}
                    </pre>
                    {expanded && !scrolledToBottom && (
                      <div
                        style={{
                          position: "sticky",
                          bottom: 0,
                          width: "100%",
                          display: "flex",
                          justifyContent: "center",
                          pointerEvents: "none",
                          marginTop: "-28px",
                          paddingBottom: "6px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "24px",
                            height: "24px",
                            borderRadius: "50%",
                            background: "var(--bg-badge)",
                            border: "1px solid var(--border-light)",
                          }}
                        >
                          <ArrowDown size={14} weight="bold" color="var(--text-secondary)" />
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      width: "100%",
                      padding: "8px 14px",
                      background: "transparent",
                      border: "none",
                      borderTop: "1px solid var(--border-light)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "11px",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 600,
                      transition: "color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                    }}
                  >
                    {expanded ? <CaretUp size={12} /> : <CaretDown size={12} />}
                    {expanded ? "Collapse" : "Show full prompt"}
                  </button>
                </div>
              </div>

              {/* Quick tip */}
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  padding: "8px 0",
                  textAlign: "center",
                }}
              >
                Paste the prompt into any AI chat (Claude, ChatGPT, Gemini) — it will call your MCP
                endpoints automatically.
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
