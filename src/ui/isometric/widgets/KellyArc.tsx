/**
 * [5.1] Kelly Arc Widget
 * 
 * Semi-circle SVG gauge showing optimal bet size (0-100%).
 * Formula: Optimal_Bet_Size = Edge / Odds
 * 
 * Style: Cyan glow, yellow pulse if kelly > 0.5 (high risk)
 */

import React, { useMemo } from 'react';
import type { Traceable } from '../../../kernel/registry/Vektor.js';

interface KellyArcProps {
    /** Kelly fraction data (0-1) */
    data: Traceable<number> | null;
    /** Widget width */
    size?: number;
    /** Optional label */
    label?: string;
}

/**
 * Skeleton loading state
 */
function SkeletonPulse({ size }: { size: number }) {
    return (
        <div
            style={{
                width: size,
                height: size / 2 + 40,
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

export function KellyArc({ data, size = 200, label = 'KELLY %' }: KellyArcProps) {
    // Skeleton state
    if (!data) {
        return <SkeletonPulse size={size} />;
    }

    const kelly = Math.max(0, Math.min(1, data.val));
    const isHighRisk = kelly > 0.5;
    const percentage = Math.round(kelly * 100);

    // SVG arc calculation
    const { arcPath, endX, endY } = useMemo(() => {
        const radius = size * 0.4;
        const centerX = size / 2;
        const centerY = size / 2;
        const startAngle = Math.PI; // 180 degrees (left)
        const endAngle = Math.PI + (kelly * Math.PI); // 180 to 360 degrees

        const startX = centerX + radius * Math.cos(startAngle);
        const startY = centerY + radius * Math.sin(startAngle);
        const endX = centerX + radius * Math.cos(endAngle);
        const endY = centerY + radius * Math.sin(endAngle);

        const largeArcFlag = kelly > 0.5 ? 1 : 0;

        const arcPath = `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;

        return { arcPath, endX, endY };
    }, [kelly, size]);

    const primaryColor = isHighRisk ? '#FFAA00' : '#00F3FF';
    const glowId = `kelly-glow-${Math.random().toString(36).substr(2, 9)}`;

    return (
        <div
            className="gravity-glass"
            style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: size + 48,
            }}
        >
            {/* SVG Gauge */}
            <svg
                width={size}
                height={size / 2 + 20}
                viewBox={`0 0 ${size} ${size / 2 + 20}`}
                style={{ overflow: 'visible' }}
            >
                {/* Glow Filter */}
                <defs>
                    <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Background Arc (full semi-circle) */}
                <path
                    d={`M ${size * 0.1} ${size / 2} A ${size * 0.4} ${size * 0.4} 0 0 1 ${size * 0.9} ${size / 2}`}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="12"
                    strokeLinecap="round"
                />

                {/* Value Arc */}
                <path
                    d={arcPath}
                    fill="none"
                    stroke={primaryColor}
                    strokeWidth="12"
                    strokeLinecap="round"
                    filter={`url(#${glowId})`}
                    style={{
                        animation: isHighRisk ? 'kelly-pulse 1.5s infinite ease-in-out' : 'none',
                    }}
                />

                {/* Center Value */}
                <text
                    x={size / 2}
                    y={size / 2 - 5}
                    textAnchor="middle"
                    fill={primaryColor}
                    fontSize="28"
                    fontFamily="'IBM Plex Mono', monospace"
                    fontWeight="600"
                >
                    {percentage}%
                </text>
            </svg>

            {/* Label */}
            <div
                style={{
                    marginTop: '12px',
                    fontSize: '0.65rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: "'IBM Plex Mono', monospace",
                }}
            >
                {label}
            </div>

            {/* High Risk Indicator */}
            {isHighRisk && (
                <div
                    style={{
                        marginTop: '8px',
                        padding: '4px 12px',
                        background: 'rgba(255, 170, 0, 0.15)',
                        border: '1px solid rgba(255, 170, 0, 0.4)',
                        borderRadius: '12px',
                        fontSize: '0.6rem',
                        letterSpacing: '0.15em',
                        color: '#FFAA00',
                    }}
                >
                    HIGH RISK
                </div>
            )}

            {/* CSS Animation */}
            <style>{`
                @keyframes kelly-pulse {
                    0%, 100% { stroke-opacity: 1; }
                    50% { stroke-opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}
