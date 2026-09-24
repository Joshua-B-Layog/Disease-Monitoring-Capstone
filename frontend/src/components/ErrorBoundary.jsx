import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.moduleName || 'module', 'crashed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minHeight: '100%',
            padding: '40px 20px',
            textAlign: 'center',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ fontSize: '40px' }}>⚠️</div>
          <h3 style={{ color: 'var(--text, #0f172a)', margin: 0, fontSize: '18px' }}>
            This module is temporarily unavailable
          </h3>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: 0, fontSize: '14px', maxWidth: '420px' }}>
            {this.props.fallbackMessage ||
              'You can still use the rest of the system. Please try again or contact the administrator if this keeps happening.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '8px 18px',
                background: 'var(--accent, #129968)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              Retry
            </button>
            {this.props.onBack && (
              <button
                onClick={this.props.onBack}
                style={{
                  padding: '8px 18px',
                  background: '#e2e8f0',
                  color: '#0f172a',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Go Back
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}