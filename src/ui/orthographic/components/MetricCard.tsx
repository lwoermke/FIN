/**
 * [UI] Metric Card
 * Displays a labelled metric.
 * 
 * NULL-STATE PHYSICS:
 * If value is NaN, renders a "Glitch" effect (ERR/NULL) in Red.
 */

import React, { useEffect, useState } from 'react';
import { DesignTokens } from '../../styles/DesignTokens.js';

interface MetricCardProps {
    label: string;
    value: number | string | null;
    unit?: string;
    trend?: number;
}

export function MetricCard({ label, value, unit = '', trend }: MetricCardProps) {
    const [glitchText, setGlitchText] = useState('NULL');

    // Check for Null State
    const isNull = value === null || (typeof value === 'number' && isNaN(value));

    // Glitch Animation Logic
    useEffect(() => {
        if (!isNull) return;

        const chars = 'ABCDEF0123456789!@#$%^&*';
        const states = ['NULL', 'VOID', 'ERR', '0x00'];

        const interval = setInterval(() => {
            // Randomly pick a state or scramble chars
            if (Math.random() > 0.5) {
                setGlitchText(states[Math.floor(Math.random() * states.length)]);
            } else {
                setGlitchText(
                    Array(4).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
                );
            }
        }, 100);

        return () => clearInterval(interval);
    }, [isNull]);

    return (
        <div style={{
            padding: '12px',
            borderRight: DesignTokens.borders.default,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            marginBottom: '8px',
            background: isNull ? 'rgba(50, 0, 0, 0.2)' : 'transparent',
            transition: 'background 0.3s ease'
        }}>
            <div style={{
                fontFamily: DesignTokens.typography.fontLabel,
                fontSize: '0.7rem',
                color: DesignTokens.colors.dim,
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
            }}>
                {label}
            </div>

            <div style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '1.2rem',
                color: isNull ? '#FF0000' : 'white',
                textShadow: isNull ? '0 0 5px red' : 'none'
            }}>
                {isNull ? (
                    <span style={{ animation: 'shake 0.2s infinite' }}>
                        {glitchText}
                    </span>
                ) : (
                    <>
                        {typeof value === 'number' ? value.toLocaleString() : value}
                        <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '4px' }}>
                            {unit}
                        </span>
                    </>
                )}
            </div>

            <style>{`
                @keyframes shake {
                    0% { transform: translate(1px, 1px) rotate(0deg); }
                    10% { transform: translate(-1px, -2px) rotate(-1deg); }
                    20% { transform: translate(-3px, 0px) rotate(1deg); }
                    30% { transform: translate(3px, 2px) rotate(0deg); }
                    40% { transform: translate(1px, -1px) rotate(1deg); }
                    50% { transform: translate(-1px, 2px) rotate(-1deg); }
                    60% { transform: translate(-3px, 1px) rotate(0deg); }
                    70% { transform: translate(3px, 1px) rotate(-1deg); }
                    80% { transform: translate(-1px, -1px) rotate(1deg); }
                    90% { transform: translate(1px, 2px) rotate(0deg); }
                    100% { transform: translate(1px, -2px) rotate(-1deg); }
                }
            `}</style>
        </div>
    );
}
