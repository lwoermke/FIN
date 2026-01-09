/**
 * [5.1] Z-Score Bar Widget
 * 
 * Vertical thermometer bar centered at 0.
 * Formula: (Current_Price - Moving_Avg) / Std_Dev
 * 
 * Style: Green (>0) to Red (<0) gradient fill.
 */

import React from 'react';
import type { Traceable } from '../../../kernel/registry/Vektor.js';

interface ZScoreBarProps {
    /** Z-Score value (typically -3 to +3) */
    data: Traceable<number> | null;
    /** Widget height */
    height?: number;
    /** Widget width */
    width?: number;
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
                height: height + 80,
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

export function ZScoreBar({
    data,
    height = 200,
    width = 40,
    label = 'Z-SCORE'
}: ZScoreBarProps) {
    // Skeleton state
    if (!data) {
        return <SkeletonPulse width={width} height={height} />;
    }

    // Clamp z-score to -3 to +3 range
    const zScore = Math.max(-3, Math.min(3, data.val));
    const normalizedValue = (zScore + 3) / 6; // 0 to 1, where 0.5 is center

    // Calculate fill position
    const centerY = height / 2;
    const maxDeviation = height / 2 - 10;
    const fillHeight = Math.abs(zScore / 3) * maxDeviation;
    const isPositive = zScore >= 0;

    // Color based on z-score
    const getColor = () => {
        if (zScore > 1.5) return '#00FFC8';
        if (zScore > 0) return '#44FF88';
        if (zScore > -1.5) return '#FF6644';
        return '#FF4444';
    };

    const fillColor = getColor();
    const glowId = `zscore-glow-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div
            className="gravity-glass"
            style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            {/* Value Display */}
            <div
                style={{
                    marginBottom: '16px',
                    fontSize: '1.5rem',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontWeight: 600,
                    color: fillColor,
                }}
            >
                {zScore >= 0 ? '+' : ''}{zScore.toFixed(2)}σ
            </div>

            {/* SVG Thermometer */}
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                style={{ overflow: 'visible' }}
            >
                {/* Glow Filter */}
                <defs>
                    <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    <linearGradient id="zscore-bg-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(0, 255, 200, 0.1)" />
                        <stop offset="50%" stopColor="rgba(255, 255, 255, 0.05)" />
                        <stop offset="100%" stopColor="rgba(255, 68, 68, 0.1)" />
                    </linearGradient>
                </defs>

                {/* Background Bar */}
                <rect
                    x="4"
                    y="4"
                    width={width - 8}
                    height={height - 8}
                    rx="8"
                    fill="url(#zscore-bg-gradient)"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="1"
                />

                {/* Center Line */}
                <line
                    x1="0"
                    y1={centerY}
                    x2={width}
                    y2={centerY}
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                />

                {/* Fill Bar */}
                <rect
                    x="8"
                    y={isPositive ? centerY - fillHeight : centerY}
                    width={width - 16}
                    height={fillHeight}
                    rx="4"
                    fill={fillColor}
                    filter={`url(#${glowId})`}
                    style={{
                        transition: 'all 0.3s ease-out',
                    }}
                />

                {/* Scale Markers */}
                {[-3, -2, -1, 0, 1, 2, 3].map((mark) => {
                    const y = height - ((mark + 3) / 6) * height;
                    return (
                        <g key={mark}>
                            <line
                                x1={width - 6}
                                y1={y}
                                x2={width}
                                y2={y}
                                stroke="rgba(255, 255, 255, 0.3)"
                                strokeWidth="1"
                            />
                        </g>
                    );
                })}
            </svg>

            {/* Label */}
            <div
                style={{
                    marginTop: '16px',
                    fontSize: '0.65rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: "'IBM Plex Mono', monospace",
                }}
            >
                {label}
            </div>
        </div>
    );
}
