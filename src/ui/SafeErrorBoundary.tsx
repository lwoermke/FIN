/**
 * [UI] SafeErrorBoundary
 * 
 * Catches rendering exceptions and provides a fallback view.
 * Specifically used to handle R3F crashes while keeping the 2D HUD alive.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onCrash?: (error: Error) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class SafeErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[SafeErrorBoundary] Component Crash Detected:', error, errorInfo);
        if (this.props.onCrash) {
            this.props.onCrash(error);
        }
    }

    public render() {
        if (this.state.hasError) {
            return (
                this.props.fallback || (
                    <div style={{
                        padding: '20px',
                        background: 'rgba(255, 0, 0, 0.1)',
                        border: '1px solid #FF4444',
                        color: '#FF4444',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '0.7rem'
                    }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>[R3F_RENDER_HALT]</div>
                        <div>3D Visualization Layer collapsed. Switched to Safe Mode.</div>
                        {this.state.error && (
                            <div style={{ marginTop: '8px', opacity: 0.7 }}>
                                {this.state.error.message}
                            </div>
                        )}
                    </div>
                )
            );
        }

        return this.props.children;
    }
}
