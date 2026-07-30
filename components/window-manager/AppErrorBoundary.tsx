"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  appName: string;
}

interface State {
  hasError: boolean;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error(`${this.props.appName} crashed:`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          <p>{this.props.appName} stopped responding.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
