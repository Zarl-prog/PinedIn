import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: string;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: "var(--text-primary-card, #aaa)", padding: "20px", fontSize: "13px" }}>
          {this.props.fallback || "Something went wrong."}
        </div>
      );
    }
    return this.props.children;
  }
}
