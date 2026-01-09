/**
 * [Panel] Red Team / Stress-GAN Panel
 * 
 * Gravity Glass panel for adversarial stress testing.
 * Sigma slider controls terrain distortion preview.
 */

import React, { useState, useEffect } from 'react';
import { store } from '../../../kernel/registry/Store.js';
import { createVektor } from '../../../kernel/registry/Vektor.js';
import { cliffHunter, type LiquidationRisk } from '../../../automata/CliffHunter.js';

interface RedTeamPanelProps {
    onClose: () => void;
}

export function RedTeamPanel({ onClose }: RedTeamPanelProps) {
    const [sigmaLevel, setSigmaLevel] = useState(1);
    const [isStressing, setIsStressing] = useState(false);
    const [liquidationRisk, setLiquidationRisk] = useState<LiquidationRisk | null>(null);

    // Subscribe to liquidation risk updates
    useEffect(() => {
        const unsub = cliffHunter.onLiquidationRisk((risk) => {
            setLiquidationRisk(risk);
        });
        return unsub;
    }, []);

    // Handle sigma slider change
    const handleSigmaChange = (value: number) => {
        setSigmaLevel(value);

        // Dispatch stress level to Store for terrain distortion
        const stressVektor = createVektor(
            [value, value * 0.2], // sigma, distortion intensity
            'RED_TEAM_PANEL',
            'stress_level',
            value > 4 ? 'critical' : value > 2 ? 'warning' : 'safe',
            [1.0, 1.0]
        );
        store.set('system.stress.sigma', stressVektor);
    };

    // Trigger stress test
    const runStressTest = () => {
        setIsStressing(true);

        // Simulate stress test by calculating liquidation at current sigma
        cliffHunter.calculateLiquidationDistance(
            100,  // Current price
            100,  // Entry price
            5,    // 5x leverage
            0.02 * sigmaLevel,  // Volatility scaled by sigma
            true  // Long position
        );

        setTimeout(() => setIsStressing(false), 2000);
    };

    const getSigmaColor = (sigma: number) => {
        if (sigma >= 5) return '#FF0F0F';
        if (sigma >= 4) return '#FF4444';
        if (sigma >= 3) return '#FFAA00';
        if (sigma >= 2) return '#FFFF00';
        return '#00F3FF';
    };

    return (
        <div
            className="gravity-glass"
            style={{
                width: '360px',
                height: '100%',
                padding: '32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2
                    style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        letterSpacing: '0.3em',
                        textTransform: 'uppercase',
                        color: '#FF0F0F',
                        fontFamily: "'IBM Plex Mono', monospace",
                    }}
                >
                    RED TEAM // STRESS-GAN
                </h2>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255, 255, 255, 0.4)',
                        cursor: 'pointer',
                        fontSize: '1.5rem',
                        lineHeight: 1,
                    }}
                >
                    ×
                </button>
            </div>

            {/* Sigma Slider */}
            <div>
                <label
                    style={{
                        display: 'block',
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginBottom: '12px',
                        fontFamily: "'IBM Plex Mono', monospace",
                    }}
                >
                    SIGMA EVENT
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <input
                        type="range"
                        min="1"
                        max="6"
                        step="0.5"
                        value={sigmaLevel}
                        onChange={(e) => handleSigmaChange(parseFloat(e.target.value))}
                        style={{
                            flex: 1,
                            accentColor: getSigmaColor(sigmaLevel),
                            height: '8px',
                        }}
                    />
                    <span
                        style={{
                            fontSize: '1.5rem',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontWeight: 600,
                            color: getSigmaColor(sigmaLevel),
                            minWidth: '60px',
                            textAlign: 'right',
                        }}
                    >
                        {sigmaLevel}σ
                    </span>
                </div>

                {/* Sigma Scale Labels */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '8px',
                        fontSize: '0.55rem',
                        color: 'rgba(255, 255, 255, 0.3)',
                        fontFamily: "'IBM Plex Mono', monospace",
                    }}
                >
                    <span>1σ NORMAL</span>
                    <span>3σ RARE</span>
                    <span>6σ BLACK SWAN</span>
                </div>
            </div>

            {/* Stress Test Button */}
            <button
                onClick={runStressTest}
                disabled={isStressing}
                style={{
                    padding: '16px 24px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    fontFamily: "'IBM Plex Mono', monospace",
                    background: isStressing ? 'rgba(255, 15, 15, 0.3)' : 'rgba(255, 15, 15, 0.1)',
                    border: '1px solid rgba(255, 15, 15, 0.5)',
                    borderRadius: '8px',
                    color: '#FF0F0F',
                    cursor: isStressing ? 'wait' : 'pointer',
                    transition: 'all 0.3s ease',
                }}
            >
                {isStressing ? 'SIMULATING...' : 'RUN STRESS TEST'}
            </button>

            {/* Liquidation Risk Display */}
            {liquidationRisk && (
                <div
                    style={{
                        padding: '16px',
                        background: liquidationRisk.status === 'critical'
                            ? 'rgba(255, 15, 15, 0.15)'
                            : liquidationRisk.status === 'warning'
                                ? 'rgba(255, 170, 0, 0.15)'
                                : 'rgba(0, 243, 255, 0.1)',
                        border: `1px solid ${liquidationRisk.status === 'critical'
                                ? 'rgba(255, 15, 15, 0.4)'
                                : liquidationRisk.status === 'warning'
                                    ? 'rgba(255, 170, 0, 0.4)'
                                    : 'rgba(0, 243, 255, 0.3)'
                            }`,
                        borderRadius: '8px',
                    }}
                >
                    <div
                        style={{
                            fontSize: '0.6rem',
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            color: 'rgba(255, 255, 255, 0.5)',
                            marginBottom: '8px',
                        }}
                    >
                        LIQUIDATION DISTANCE
                    </div>
                    <div
                        style={{
                            fontSize: '2rem',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontWeight: 600,
                            color: liquidationRisk.status === 'critical'
                                ? '#FF0F0F'
                                : liquidationRisk.status === 'warning'
                                    ? '#FFAA00'
                                    : '#00F3FF',
                        }}
                    >
                        {liquidationRisk.distance.toFixed(2)}σ
                    </div>
                    <div
                        style={{
                            fontSize: '0.7rem',
                            color: 'rgba(255, 255, 255, 0.4)',
                            marginTop: '8px',
                            fontFamily: "'IBM Plex Mono', monospace",
                        }}
                    >
                        Liq. Price: ${liquidationRisk.liquidationPrice.toFixed(2)}
                    </div>
                </div>
            )}

            {/* Warning */}
            {sigmaLevel >= 4 && (
                <div
                    style={{
                        padding: '12px',
                        background: 'rgba(255, 15, 15, 0.1)',
                        border: '1px solid rgba(255, 15, 15, 0.3)',
                        borderRadius: '8px',
                        fontSize: '0.65rem',
                        color: '#FF4444',
                        textAlign: 'center',
                    }}
                >
                    ⚠️ EXTREME STRESS: Terrain distortion active
                </div>
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Footer */}
            <div
                style={{
                    fontSize: '0.55rem',
                    color: 'rgba(255, 255, 255, 0.3)',
                    textAlign: 'center',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    paddingTop: '16px',
                }}
            >
                Stress scenarios are simulated previews.
                <br />
                Portfolio state remains unchanged.
            </div>
        </div>
    );
}
