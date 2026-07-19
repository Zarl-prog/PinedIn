import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: string;
  autoRecover?: boolean;
  autoRecoverMs?: number;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
    if (this.props.autoRecover) {
      this.timeoutId = setTimeout(
        () => this.setState({ hasError: false }),
        this.props.autoRecoverMs ?? 50,
      );
    }
  }

  componentWillUnmount() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.autoRecover) return null;
      return (
        <div style={{ color: "var(--text-primary-card, #aaa)", padding: "20px", fontSize: "13px" }}>
          {this.props.fallback || "Something went wrong."}
        </div>
      );
    }
    return this.props.children;
  }
}
