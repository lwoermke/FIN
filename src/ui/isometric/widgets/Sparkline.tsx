/**
 * [5.1] Sparkline Widget
 * 
 * High-fidelity SVG path showing last 50 ticks.
 * Effect: Neon glow filter for filament appearance.
 */

import React, { useMemo } from 'react';
import type { Traceable } from '../../../kernel/registry/Vektor.js';

interface SparklineProps {
    /** Array of tick values (last 50) */
    data: Traceable<number[]> | null;
    /** Widget width */
    width?: number;
    /** Widget height */
    height?: number;
    /** Line color */
    color?: string;
    /** Optional label */
    label?: string;
}

/**
 * Skeleton loading state
 */
function SkeletonPulse({ width, height }: { width: number; height: number }) {
    return (
        <div
            style={{
                width: width + 48,
                height: height + 60,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                animation: 'pulse-skeleton 2s infinite ease-in-out',
            }}
        >
            <style>{`
                @keyframes pulse-skeleton {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.1; }
                }
            `}</style>
        </div>
    );
}

export function Sparkline({
    data,
    width = 200,
    height = 60,
    color = '#00F3FF',
    label = 'MICROSTRUCTURE'
}: SparklineProps) {
    // Skeleton state
    if (!data || !data.val || data.val.length === 0) {
        return <SkeletonPulse width={width} height={height} />;
    }

    const values = data.val.slice(-50); // Last 50 ticks

    // Generate SVG path
    const { path, areaPath, minVal, maxVal, lastVal, change } = useMemo(() => {
        if (values.length === 0) return { path: '', areaPath: '', minVal: 0, maxVal: 0, lastVal: 0, change: 0 };

        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const range = maxVal - minVal || 1;
        const padding = 4;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const points = values.map((val, i) => {
            const x = padding + (i / (values.length - 1)) * chartWidth;
            const y = padding + chartHeight - ((val - minVal) / range) * chartHeight;
            return { x, y };
        });

        // Line path
        const path = points.map((p, i) =>
            i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
        ).join(' ');

        // Area path (for gradient fill)
        const areaPath = `${path} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

        const lastVal = values[values.length - 1];
        const firstVal = values[0];
        const change = ((lastVal - firstVal) / firstVal) * 100;

        return { path, areaPath, minVal, maxVal, lastVal, change };
    }, [values, width, height]);

    const isPositive = change >= 0;
    const glowId = `sparkline-glow-${Math.random().toString(36).substr(2, 9)}`;
    const gradientId = `sparkline-gradient-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div
            className="gravity-glass"
            style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '12px',
                }}
            >
                <span
                    style={{
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontFamily: "'IBM Plex Mono', monospace",
                    }}
                >
                    {label}
                </span>
                <span
                    style={{
                        fontSize: '0.75rem',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 500,
                        color: isPositive ? '#00FFC8' : '#FF4444',
                    }}
                >
                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                </span>
            </div>

            {/* SVG Sparkline */}
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={{ overflow: 'visible' }}
            >
                {/* Defs */}
                <defs>
                    {/* Neon Glow Filter */}
                    <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="blur1" />
                        <feGaussianBlur stdDeviation="4" result="blur2" />
                        <feMerge>
                            <feMergeNode in="blur2" />
                            <feMergeNode in="blur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* Area Gradient */}
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Area Fill */}
                <path
                    d={areaPath}
                    fill={`url(#${gradientId})`}
                />

                {/* Main Line (Neon Filament) */}
                <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={`url(#${glowId})`}
                />

                {/* End Point */}
                <circle
                    cx={width - 4}
                    cy={height - 4 - ((lastVal - minVal) / (maxVal - minVal || 1)) * (height - 8)}
                    r="4"
                    fill={color}
                    filter={`url(#${glowId})`}
                />
            </svg>

            {/* Value Display */}
            <div
                style={{
                    marginTop: '8px',
                    fontSize: '1.1rem',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    color: color,
                }}
            >
                {lastVal.toFixed(4)}
            </div>
        </div>
    );
}
