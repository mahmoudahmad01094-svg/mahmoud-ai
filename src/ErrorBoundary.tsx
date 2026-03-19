import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: '#ff5555', backgroundColor: '#111', minHeight: '100vh', direction: 'ltr', fontFamily: 'monospace' }}>
          <h2>Something went wrong! (حدث خطأ)</h2>
          <p>The application crashed. Here is the error message:</p>
          <pre style={{ backgroundColor: '#222', padding: '15px', borderRadius: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '20px' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ backgroundColor: '#222', padding: '15px', borderRadius: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '20px', fontSize: '12px', color: '#aaa' }}>
            {this.state.error?.stack}
          </pre>
          <p style={{ marginTop: '20px', color: 'white' }}>Please take a screenshot of this error and share it so I can fix it for you.</p>
        </div>
      );
    }

    return this.props.children;
  }
}
