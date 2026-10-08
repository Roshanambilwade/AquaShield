import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="page error-fallback" role="alert">
          <p className="eyebrow">AquaShield</p>
          <h1>Something went wrong.</h1>
          <p>Please reload the page to try again.</p>
          <button className="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
