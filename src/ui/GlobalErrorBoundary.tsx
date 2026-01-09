import React, { Component, ErrorInfo, ReactNode } from 'react';

/**
 * [FAIL_SAFE] Global Error Boundary
 * 
 * Captures render errors and displays a "System Failure" screen.
 * Implements "Gravity Glass" spectral error reporting:
 * - Red Monochrome CRT Text
 * - Raw Stack Trace
 * - Manual Reboot Trigger (ESC)
 */

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class GlobalErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    handleReboot = () => {
        // Hard reload application
        window.location.reload();
    };

    componentDidMount() {
        window.addEventListener('keydown', this.handleKeyDown);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown = (e: KeyboardEvent) => {
        if (this.state.hasError && e.key === 'Escape') {
            this.handleReboot();
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: '#000',
                    color: '#FF0000',
                    fontFamily: 'IBM Plex Mono, monospace',
                    padding: '40px',
                    zIndex: 99999,
                    overflow: 'auto',
                    textTransform: 'uppercase'
                }}>
                    <div style={{
                        border: '1px solid #FF0000',
                        padding: '20px',
                        maxWidth: '800px',
                        margin: '40px auto'
                    }}>
                        <h1 style={{ fontSize: '24px', letterSpacing: '4px', marginBottom: '40px' }}>
                            /// CRITICAL SYSTEM FAILURE ///
                        </h1>

                        <div style={{ marginBottom: '20px', fontSize: '14px' }}>
                            <strong>FATAL EXCEPTION:</strong> {this.state.error?.toString()}
                        </div>

                        <div style={{
                            whiteSpace: 'pre-wrap',
                            fontSize: '11px',
                            opacity: 0.7,
                            marginBottom: '40px',
                            borderTop: '1px dashed #330000',
                            borderBottom: '1px dashed #330000',
                            padding: '20px 0'
                        }}>
                            {this.state.errorInfo?.componentStack || "No stack trace available."}
                        </div>

                        <div style={{
                            fontSize: '12px',
                            background: '#FF0000',
                            color: '#000',
                            display: 'inline-block',
                            padding: '4px 8px',
                            fontWeight: 'bold'
                        }}>
                            PRESS [ESC] TO INITIATE EMERGENCY RESUSCITATION
                        </div>
                    </div>

                    {/* Scanlines Overlay */}
                    <div style={{
                        position: 'fixed',
                        top: 0, left: 0, width: '100%', height: '100%',
                        background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
                        backgroundSize: '100% 2px, 3px 100%',
                        pointerEvents: 'none'
                    }} />
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
