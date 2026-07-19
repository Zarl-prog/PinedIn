let mediaListener: (() => void) | null = null;

export function stopSystemTheme(): void {
  if (mediaListener) {
    mediaListener();
    mediaListener = null;
  }
}

export function listenSystemTheme(): void {
  stopSystemTheme();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle("dark", e.matches);
  };
  mq.addEventListener("change", handler);
  mediaListener = () => mq.removeEventListener("change", handler);
}

export function applyTheme(theme: string): void {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else if (theme === "parchment") {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "parchment");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}
