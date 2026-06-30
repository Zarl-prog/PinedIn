import { motion, AnimatePresence } from "framer-motion";
import { X, Plug } from "@phosphor-icons/react";

const MCP_PROMPT = `I have a local PinedIn task manager running on my machine. It exposes an MCP-compatible HTTP API.

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

export default function McpPanel({ open, onClose }: McpPanelProps) {
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
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "480px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
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
              <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
                <Plug size={18} weight="fill" style={{ color: "#22c55e" }} />
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
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", color: "var(--text-primary)", fontWeight: 500 }}>
                    Running on port 7890
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Geist Mono', monospace" }}>
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
                  <code style={{ fontSize: "12px", color: "var(--text-primary)", fontFamily: "'Geist Mono', monospace", fontWeight: 500 }}>
                    http://127.0.0.1:7890/sse
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText("http://127.0.0.1:7890/sse")}
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
                    Copy
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>
                    Zero-config prompt for any AI
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(MCP_PROMPT)}
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
                    Copy Prompt
                  </button>
                </div>
                <div
                  style={{
                    background: "var(--bg-code, #0a0a0a)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "6px",
                    padding: "12px 14px",
                    maxHeight: "220px",
                    overflowY: "auto",
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
                    }}
                  >
                    {MCP_PROMPT}
                  </pre>
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
                Paste the prompt into any AI chat (Claude, ChatGPT, Gemini) — it will call your MCP endpoints automatically.
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
