/**
 * [HUD] Convergence Vector
 * 
 * Displays the system's "Convergence Score" as a 3-segment bar.
 * Composition:
 * - 30% Model Confidence (Cyan)
 * - 30% Data Integrity (White)
 * - 40% Inverse Toxicity (Green/Red)
 * 
 * Visual: High-density bar gauge that "breathes" at 40Hz (gamma resonance).
 */

import React, { useEffect, useState } from 'react';
import { store } from '../../../kernel/registry/Store.js';

interface ConvergenceSegment {
    value: number;
    color: string;
    label: string;
}

export function Convergence() {
    const [confidence, setConfidence] = useState(0.85);
    const [integrity, setIntegrity] = useState(1.0);
    const [toxicity, setToxicity] = useState(0.1);
    const [phase, setPhase] = useState(0);

    // 40Hz Breathing Animation Loop
    useEffect(() => {
        let frameId: number;
        const start = Date.now();

        const animate = () => {
            const now = Date.now();
            const t = (now - start) / 1000;
            setPhase(t);
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, []);

    // Subscribe to Store for real values
    useEffect(() => {
        const unsubConfidence = store.subscribe<number>('inference.confidence', (vektor) => {
            setConfidence(vektor.val);
        });

        const unsubToxicity = store.subscribe<number>('entropy.toxicity', (vektor) => {
            setToxicity(vektor.val);
        });

        const unsubIntegrity = store.subscribe<number>('system.integrity', (vektor) => {
            setIntegrity(vektor.val);
        });

        // Simulate updates for demo
        const interval = setInterval(() => {
            setConfidence(0.8 + Math.random() * 0.15);
            setToxicity(Math.random() * 0.25);
            setIntegrity(0.95 + Math.random() * 0.05);
        }, 2000);

        return () => {
            unsubConfidence();
            unsubToxicity();
            unsubIntegrity();
            clearInterval(interval);
        };
    }, []);

    // Calculate composite score
    const inverseToxicity = 1.0 - toxicity;
    const compositeScore = (confidence * 0.3) + (integrity * 0.3) + (inverseToxicity * 0.4);

    // Visual calculations
    const flicker = Math.sin(phase * 40 * Math.PI * 2) * 0.03 + 1.0;
    const breath = Math.sin(phase * 2) * 0.015 + 1.0;
    const scale = flicker * breath;

    // Segment colors
    const getToxicityColor = () => {
        if (inverseToxicity > 0.8) return '#00FFC8';
        if (inverseToxicity > 0.5) return '#FFFF00';
        return '#FF4444';
    };

    const segments: ConvergenceSegment[] = [
        { value: confidence * 0.3, color: '#00F3FF', label: 'CONFIDENCE' },
        { value: integrity * 0.3, color: '#FFFFFF', label: 'INTEGRITY' },
        { value: inverseToxicity * 0.4, color: getToxicityColor(), label: 'HEALTH' },
    ];

    return (
        <div
            className="gravity-glass"
            style={{
                padding: '20px 24px',
                width: '100%',
                maxWidth: '400px',
            }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <span
                    style={{
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontFamily: "'IBM Plex Mono', monospace",
                    }}
                >
                    CONVERGENCE VECTOR
                </span>
                <span
                    style={{
                        fontSize: '1.5rem',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 600,
                        color: '#00F3FF',
                    }}
                >
                    {(compositeScore * 100).toFixed(1)}%
                </span>
            </div>

            {/* Composite Bar */}
            <div
                style={{
                    height: '24px',
                    background: 'rgba(0, 0, 0, 0.4)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    display: 'flex',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
            >
                {segments.map((segment, i) => (
                    <div
                        key={i}
                        style={{
                            width: `${segment.value * 100}%`,
                            height: '100%',
                            background: segment.color,
                            opacity: 0.8 * scale,
                            boxShadow: `0 0 ${10 * scale}px ${segment.color}`,
                            transition: 'width 0.5s ease-out',
                        }}
                    />
                ))}
            </div>

            {/* Segment Labels */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    fontSize: '0.55rem',
                    letterSpacing: '0.1em',
                    fontFamily: "'IBM Plex Mono', monospace",
                }}
            >
                {segments.map((segment, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: segment.color,
                                boxShadow: `0 0 6px ${segment.color}`,
                            }}
                        />
                        <span style={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                            {segment.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* 40Hz Indicator */}
            <div
                style={{
                    marginTop: '12px',
                    height: '2px',
                    background: 'rgba(0, 243, 255, 0.1)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        position: 'absolute',
                        left: `${(Math.sin(phase * 40 * Math.PI * 2) + 1) * 50}%`,
                        top: 0,
                        width: '4px',
                        height: '100%',
                        background: '#00F3FF',
                        boxShadow: '0 0 8px #00F3FF',
                        transition: 'left 0.01s linear',
                    }}
                />
            </div>
        </div>
    );
}

