/**
 * [Labs] Experimental Panel
 * 
 * "Under the hood" metrics.
 * Shows the Evolution Sparkline (System Adaptation).
 */

import React, { useEffect, useState, useRef } from 'react';
import { trainingLog, TrainingEntry } from '../../../intelligence/ledger/TrainingLog.js';

export function LabsPanel({ onClose }: { onClose: () => void }) {
    const [history, setHistory] = useState<TrainingEntry[]>([]);

    useEffect(() => {
        // Initial load
        setHistory(trainingLog.getHistory());

        // Poll for updates (simple solution)
        const interval = setInterval(() => {
            setHistory(trainingLog.getHistory());
        }, 2000); // 2s polling

        return () => clearInterval(interval);
    }, []);

    // Sparkline Renderer
    const renderSparkline = () => {
        if (history.length < 2) return <div style={{ opacity: 0.5 }}>Insufficient Data</div>;

        const width = 280;
        const height = 60;
        const maxError = Math.max(...history.map(h => h.errorMagnitude), 0.1);

        // Points: X=Time, Y=Error Magnitude
        // Normalize time to width, error to height
        const points = history.map((h, i) => {
            const x = (i / (history.length - 1)) * width;
            const y = height - (h.errorMagnitude / maxError) * height; // Invert Y
            return `${x},${y}`;
        }).join(' ');

        return (
            <svg width={width} height={height} style={{ overflow: 'visible' }}>
                <polyline
                    points={points}
                    fill="none"
                    stroke="#FF00FF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
                {/* Dots for mutations */}
                {history.map((h, i) => {
                    const x = (i / (history.length - 1)) * width;
                    const y = height - (h.errorMagnitude / maxError) * height;
                    return (
                        <circle key={i} cx={x} cy={y} r={2} fill={h.weightDelta > 0.05 ? '#FF0000' : '#888'} />
                    );
                })}
            </svg>
        );
    };

    return (
        <div style={{
            width: '320px',
            backgroundColor: 'rgba(10, 10, 15, 0.95)',
            borderLeft: '1px solid rgba(255, 0, 255, 0.3)', // Magenta accent
            height: '100%',
            color: '#eee',
            fontFamily: "'IBM Plex Mono', monospace",
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(10px)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', color: '#FF00FF', letterSpacing: '2px' }}>
                    FIN // LABS
                </h2>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.2rem'
                    }}
                >
                    ×
                </button>
            </div>

            <div style={{ marginBottom: '30px' }}>
                <label style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>
                    Adaptation Rate (Evolution Sparkline)
                </label>
                <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    border: '1px solid rgba(255,0,255,0.2)',
                    background: 'rgba(0,0,0,0.3)'
                }}>
                    {renderSparkline()}
                </div>
                <div style={{ fontSize: '0.7rem', marginTop: '5px', color: '#666', display: 'flex', justifyContent: 'space-between' }}>
                    <span>T-{(history.length * 2000 / 1000).toFixed(0)}s</span>
                    <span>Recent Mutations: {history.length}</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <label style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>
                    Recent Adjustments
                </label>
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {history.slice().reverse().map((h, i) => (
                        <div key={i} style={{
                            fontSize: '0.75rem',
                            padding: '8px',
                            borderLeft: `2px solid ${h.weightDelta > 0.05 ? '#FF4444' : '#444'}`,
                            background: 'rgba(255,255,255,0.03)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#fff' }}>{h.punishedModel}</span>
                                <span style={{ color: '#FF4444' }}>-{(h.weightDelta * 100).toFixed(1)}%</span>
                            </div>
                            <div style={{ color: '#666', marginTop: '2px' }}>
                                Error: {h.errorMagnitude.toFixed(4)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
