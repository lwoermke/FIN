/**
 * [6.2] Traced Metric Component
 * A wrapper for any metric that enables Neural Trace on hover.
 * 
 * Provides hover detection and trace line activation for any data-driven metric.
 */

import React, { useRef, useCallback, useState } from 'react';
import { useNeuralTrace } from '../../controllers/NeuralTraceContext.js';
import type { Traceable } from '../../../kernel/registry/Vektor.js';

/**
 * Props for TracedMetric component
 */
export interface TracedMetricProps {
    /** Unique ID for this metric */
    id: string;
    /** The Vektor data backing this metric */
    vektor: Traceable<unknown>;
    /** Registry path where this vektor is stored */
    registryPath: string;
    /** Children to render */
    children: React.ReactNode;
    /** Additional className */
    className?: string;
    /** Additional styles */
    style?: React.CSSProperties;
    /** Callback when trace is activated */
    onTraceActivate?: () => void;
    /** Callback when trace is deactivated */
    onTraceDeactivate?: () => void;
}

/**
 * TracedMetric component
 * 
 * Wraps any metric component with hover detection for Neural Trace.
 * On hover, activates a trace line from this metric to its Vektor source.
 */
export function TracedMetric({
    id,
    vektor,
    registryPath,
    children,
    className,
    style,
    onTraceActivate,
    onTraceDeactivate
}: TracedMetricProps) {
    const ref = useRef<HTMLDivElement>(null);
    const { activateTrace, deactivateTrace } = useNeuralTrace();
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseEnter = useCallback(() => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        activateTrace(id, vektor, registryPath, { x: centerX, y: centerY });
        setIsHovered(true);
        onTraceActivate?.();
    }, [id, vektor, registryPath, activateTrace, onTraceActivate]);

    const handleMouseLeave = useCallback(() => {
        deactivateTrace();
        setIsHovered(false);
        onTraceDeactivate?.();
    }, [deactivateTrace, onTraceDeactivate]);

    return (
        <div
            ref={ref}
            className={className}
            style={{
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                ...style,
                // Highlight when hovered
                boxShadow: isHovered ? '0 0 20px rgba(0, 255, 200, 0.3)' : undefined,
                borderColor: isHovered ? 'rgba(0, 255, 200, 0.5)' : undefined
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            data-traced-metric={id}
            data-registry-path={registryPath}
            data-vektor-source={vektor.src}
        >
            {children}

            {/* Trace indicator dot */}
            {isHovered && (
                <div
                    style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: '#00FFC8',
                        boxShadow: '0 0 10px #00FFC8',
                        animation: 'pulse 1s infinite',
                        pointerEvents: 'none'
                    }}
                />
            )}
        </div>
    );
}

/**
 * HOC to make any component traceable
 */
export function withTrace<P extends object>(
    Component: React.ComponentType<P>,
    getVektor: (props: P) => Traceable<unknown>,
    getPath: (props: P) => string,
    getId: (props: P) => string
) {
    return function TracedComponent(props: P) {
        const vektor = getVektor(props);
        const path = getPath(props);
        const id = getId(props);

        return (
            <TracedMetric id={id} vektor={vektor} registryPath={path}>
                <Component {...props} />
            </TracedMetric>
        );
    };
}

/**
 * Stochastic Metric - A traced metric displaying Value ± Variance
 */
export function StochasticMetric({
    id,
    label,
    vektor,
    registryPath,
    unit = '',
    precision = 2
}: {
    id: string;
    label: string;
    vektor: Traceable<number>;
    registryPath: string;
    unit?: string;
    precision?: number;
}) {
    const variance = vektor.conf[1] - vektor.conf[0];
    const isHighEntropy = variance > 0.3;

    return (
        <TracedMetric id={id} vektor={vektor} registryPath={registryPath}>
            <div
                style={{
                    padding: '12px 16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontFamily: "'IBM Plex Mono', monospace"
                }}
            >
                <div
                    style={{
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        opacity: 0.6,
                        marginBottom: '4px'
                    }}
                >
                    {label}
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '8px'
                    }}
                >
                    <span
                        style={{
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            color: 'rgba(255, 255, 255, 0.95)'
                        }}
                    >
                        {vektor.val.toFixed(precision)}{unit}
                    </span>
                    <span
                        style={{
                            fontSize: '0.9rem',
                            color: isHighEntropy ? '#FFAA00' : 'rgba(255, 255, 255, 0.5)',
                            fontWeight: isHighEntropy ? 500 : 400
                        }}
                    >
                        ±{variance.toFixed(precision)}
                    </span>
                </div>
                {/* Source indicator */}
                <div
                    style={{
                        marginTop: '8px',
                        fontSize: '0.7rem',
                        opacity: 0.4,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    <span style={{ color: '#00FFC8' }}>●</span>
                    {vektor.src}
                </div>
            </div>
        </TracedMetric>
    );
}

/**
 * CSS keyframes for pulse animation (inject into document)
 */
if (typeof document !== 'undefined') {
    const styleId = 'traced-metric-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.2); }
      }
    `;
        document.head.appendChild(style);
    }
}
