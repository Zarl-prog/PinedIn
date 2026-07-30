path = "C:/Users/asim junaidi/OneDrive/Desktop/AI/Inbox/PinedIn-Landing/docs.html"

content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Docs — Pinned</title>
  <meta name="description" content="Pinned documentation — setup, shortcuts, and features." />
  <meta property="og:title" content="Pinned — Docs" />
  <meta property="og:description" content="Pinned documentation — setup, shortcuts, and features." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://pinedin.app/docs" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Pinned — Docs" />
  <meta name="twitter:description" content="Pinned documentation — setup, shortcuts, and features." />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #000000;
      --surface: #0a0a0a;
      --surface2: #111111;
      --surface3: #161616;
      --text: #ffffff;
      --muted: #a8a8a8;
      --muted2: #959595;
      --muted3: #222222;
      --green: #22c55e;
      --red: #ff7a7a;
      --border: #222222;
      --geist: "Geist", system-ui, -apple-system, sans-serif;
      --mono: "Geist Mono", "SF Mono", monospace;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--geist);
      -webkit-font-smoothing: antialiased;
      line-height: 1.6;
      min-height: 100vh;
    }
    /* Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--muted3); border-radius: 3px; }

    /* Nav */
    nav {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      width: calc(100% - 24px);
      max-width: 700px;
      background: rgba(20,20,30,0.75);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 8px 16px;
    }
    .nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .nav-logo {
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: var(--mono);
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      text-decoration: none;
    }
    .logo-icon {
      width: 24px;
      height: 24px;
      background: var(--green);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-icon svg {
      width: 14px;
      height: 14px;
      fill: black;
    }
    .nav-badge {
      font-family: var(--mono);
      font-size: 10px;
      color: var(--muted);
      background: var(--surface2);
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .nav-links {
      display: flex;
      gap: 16px;
    }
    .nav-links a {
      color: var(--muted);
      font-size: 13px;
      text-decoration: none;
      transition: color 0.2s;
    }
    .nav-links a:hover { color: var(--text); }
    .nav-links a.active { color: var(--text); }
    .star-border-container {
      display: inline-flex;
      text-decoration: none;
    }
    .star-border-container .inner-content {
      padding: 5px 14px;
      font-family: var(--mono);
      font-size: 12px;
      background: linear-gradient(135deg,#22c55e,#16a34a);
      color: #000;
      font-weight: 600;
      border-radius: 999px;
      transition: opacity 0.2s;
    }
    .star-border-container .inner-content:hover {
      opacity: 0.9;
    }
    .nav-toggle { display: none; }

    /* Page */
    .page {
      position: relative;
      z-index: 1;
      padding-top: 80px;
      padding-bottom: 80px;
    }
    .docs-container {
      max-width: 720px;
      margin: 0 auto;
      padding: 0 20px;
    }

    /* Header */
    .doc-header {
      margin-bottom: 48px;
    }
    .doc-header .doc-eye {
      font-family: var(--mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--green);
      margin-bottom: 12px;
    }
    .doc-header h1 {
      font-size: clamp(28px, 5vw, 48px);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-bottom: 12px;
    }
    .doc-header p {
      color: var(--muted);
      font-size: 15px;
      max-width: 500px;
    }

    /* Sections */
    .doc-section {
      margin-bottom: 48px;
    }
    .doc-section:last-child { margin-bottom: 0; }
    .doc-section h2 {
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }
    .doc-section h3 {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 8px;
      margin-top: 24px;
      color: var(--text);
    }
    .doc-section p {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.7;
      margin-bottom: 12px;
    }
    .doc-section p:last-child { margin-bottom: 0; }
    .doc-section ul {
      list-style: none;
      margin-bottom: 12px;
    }
    .doc-section ul li {
      color: var(--muted);
      font-size: 14px;
      line-height: 1.7;
      padding-left: 16px;
      position: relative;
      margin-bottom: 4px;
    }
    .doc-section ul li::before {
      content: "";
      position: absolute;
      left: 0;
      top: 9px;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--muted3);
    }

    /* Code blocks */
    .doc-code {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 16px;
      overflow-x: auto;
    }
    .doc-code code {
      font-family: var(--mono);
      font-size: 13px;
      color: var(--muted);
      line-height: 1.6;
      white-space: pre;
    }

    /* Inline code */
    .doc-inline {
      background: var(--surface2);
      border: 1px solid var(--border);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--green);
    }

    /* Keyboard shortcut */
    .doc-kbd {
      display: inline-block;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 2px 7px;
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
      box-shadow: 0 1px 0 var(--muted3);
    }

    /* Feature grid */
    .feature-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }
    .feature-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .feature-card .fc-icon {
      font-size: 18px;
      margin-bottom: 8px;
    }
    .feature-card .fc-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .feature-card .fc-desc {
      font-size: 12px;
      color: var(--muted);
      line-height: 1.5;
    }

    /* Footer */
    footer {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px 20px 48px;
      border-top: 1px solid var(--border);
    }
    .footer-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .footer-l {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .footer-name {
      font-size: 13px;
      font-weight: 600;
    }
    .footer-v {
      font-size: 11px;
      color: var(--muted);
    }
    .footer-links {
      display: flex;
      gap
