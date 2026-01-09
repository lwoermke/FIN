/**
 * [7.3] Orbit Portfolio Panel
 * 
 * The initial state Portfolio Panel for Orbit View.
 * Displays "INITIALIZE NEURAL LINK // SCROLL TO WARP" prompt.
 * Content is hidden until user enters Ground View.
 * 
 * Also displays sealed ledger entries after commits.
 * Implements Gravity Glass design language.
 */

import React, { useState, useEffect } from 'react';
import { useScrollVelocityContext } from '../../controllers/useScrollVelocity.js';
import { store } from '../../../kernel/registry/Store.js';

interface SealedEntry {
    hash: string;
    timestamp: number;
    chainLength: number;
}

/**
 * Orbit Portfolio Panel - Initial State
 */
export function OrbitPortfolioPanel() {
    const { orbitOpacity, state } = useScrollVelocityContext();
    const [sealedEntries, setSealedEntries] = useState<SealedEntry[]>([]);

    // Subscribe to sealed entries
    useEffect(() => {
        const unsub = store.subscribe<number[]>('ledger.lastSeal', (vektor) => {
            if (vektor && vektor.val && vektor.val.length >= 2) {
                const entry: SealedEntry = {
                    timestamp: vektor.val[0],
                    chainLength: vektor.val[1],
                    hash: vektor.src || 'unknown',
                };
                setSealedEntries(prev => [entry, ...prev].slice(0, 5)); // Keep last 5
            }
        });
        return unsub;
    }, []);

    // Only show in ORBIT state with full opacity handling
    const isVisible = state === 'orbit' || orbitOpacity > 0;

    if (!isVisible) return null;

    const formatTime = (ts: number) => {
        const date = new Date(ts);
        return date.toLocaleTimeString('en-US', { hour12: false });
    };

    return (
        <div
            className="gravity-glass"
            style={{
                position: 'fixed',
                top: 'var(--safe-area, 64px)',
                left: 'var(--safe-area, 64px)',
                bottom: 'var(--safe-area, 64px)',
                width: '380px',
                maxWidth: 'calc(40vw - var(--safe-area, 64px))',
                zIndex: 1000,
                opacity: orbitOpacity,
                transition: 'opacity 0.3s ease-out',
                pointerEvents: orbitOpacity > 0.5 ? 'auto' : 'none',

                display: 'flex',
                flexDirection: 'column',
                padding: 'var(--container-padding, 48px)',
            }}
        >
            {/* Neural Link Initialization Prompt */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    maxWidth: '280px',
                    margin: '0 auto',
                }}
            >
                {/* Main Prompt */}
                <div
                    style={{
                        fontFamily: "'Noto Sans', sans-serif",
                        fontSize: '1.1rem',
                        fontWeight: 300,
                        letterSpacing: '0.25em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.7)',
                        lineHeight: 1.8,
                        marginBottom: '32px',
                    }}
                >
                    Initialize<br />
                    Neural Link
                </div>

                {/* Divider */}
                <div
                    style={{
                        width: '60px',
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, rgba(0, 243, 255, 0.5), transparent)',
                        margin: '0 auto 32px auto',
                    }}
                />

                {/* Scroll Prompt */}
                <div
                    style={{
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '0.7rem',
                        fontWeight: 400,
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(0, 243, 255, 0.6)',
                        animation: 'pulse-glow 3s infinite ease-in-out',
                    }}
                >
                    Scroll to Warp
                </div>

                {/* Scroll Indicator Arrow */}
                <div
                    style={{
                        marginTop: '24px',
                        fontSize: '1.5rem',
                        color: 'rgba(0, 243, 255, 0.4)',
                        animation: 'float-down 2s infinite ease-in-out',
                    }}
                >
                    ↓
                </div>
            </div>

            {/* Sealed Entries List */}
            {sealedEntries.length > 0 && (
                <div
                    style={{
                        marginTop: 'auto',
                        paddingTop: '24px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <div
                        style={{
                            fontSize: '0.6rem',
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: 'rgba(255, 255, 255, 0.4)',
                            marginBottom: '12px',
                            fontFamily: "'IBM Plex Mono', monospace",
                        }}
                    >
                        LEDGER SEALS
                    </div>

                    {sealedEntries.map((entry, i) => (
                        <div
                            key={`${entry.timestamp}-${i}`}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontSize: '0.7rem',
                            }}
                        >
                            <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                #{entry.chainLength} • {formatTime(entry.timestamp)}
                            </span>
                            <span style={{ color: '#FFD700', letterSpacing: '0.05em' }}>
                                {entry.hash.substring(0, 8)}...
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Inject keyframe animations */}
            <style>{`
                @keyframes float-down {
                    0%, 100% { transform: translateY(0); opacity: 0.4; }
                    50% { transform: translateY(8px); opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}

