import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

/**
 * [CALIBRATION]
 * 
 * First-Run Experience.
 * "Tuning the Instrument" to the physical display.
 * 
 * - Gamma: Adjusts visual weight of the Lattice.
 * - Tension: Adjusts the responsiveness of the physics engine.
 */

const Calibration: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [gamma, setGamma] = useState(1.0);
    const [tension, setTension] = useState(0.5);
    const [step, setStep] = useState<number>(0); // 0: Intro, 1: Tune, 2: Warp

    useEffect(() => {
        // Play low hum on mount? 
        // For now, silent.
    }, []);

    const handleComplete = () => {
        setStep(2);
        // Persist calibration
        localStorage.setItem('FIN_CALIBRATION', JSON.stringify({ gamma, tension }));

        // Trigger Warp Animation then callback
        setTimeout(() => {
            onComplete();
        }, 2000);
    };

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: '#050505',
            color: '#E0E0E0',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            fontFamily: 'IBM Plex Mono, monospace',
            position: 'absolute',
            zIndex: 9999,
            overflow: 'hidden'
        }}>
            {/* Background Grid */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: 'radial-gradient(#1a1a1a 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                opacity: 0.2,
                pointerEvents: 'none'
            }} />

            <div style={{
                zIndex: 2,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '40px',
                background: 'rgba(10, 10, 15, 0.8)',
                backdropFilter: 'blur(20px)',
                width: '600px',
                textAlign: 'left'
            }}>
                <h1 style={{
                    fontSize: '24px',
                    marginBottom: '20px',
                    letterSpacing: '2px',
                    color: '#00F3FF',
                    textTransform: 'uppercase'
                }}>
                    /// System Calibration
                </h1>

                {step === 0 && (
                    <>
                        <p style={{ marginBottom: '30px', lineHeight: '1.6', color: '#888' }}>
                            Hardware detected.<br />
                            Initializing Neural Link...<br /><br />
                            This instrument requires calibration to your physical display device to ensure accurate rendering of the Lattice-Fabric.
                        </p>
                        <button
                            onClick={() => setStep(1)}
                            style={buttonStyle}
                        >
                            [INITIATE SEQUENCE]
                        </button>
                    </>
                )}

                {step === 1 && (
                    <>
                        <div style={{ marginBottom: '30px' }}>
                            <label style={labelStyle}>GAMMA CORRECTION (VISUAL WEIGHT)</label>
                            <input
                                type="range"
                                min="0.5" max="2.0" step="0.1"
                                value={gamma}
                                onChange={(e) => setGamma(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#00F3FF' }}
                            />
                            <div style={valueStyle}>{gamma.toFixed(2)}</div>
                        </div>

                        <div style={{ marginBottom: '40px' }}>
                            <label style={labelStyle}>SURFACE TENSION (PHYSICS RESPONSE)</label>
                            <input
                                type="range"
                                min="0.1" max="1.0" step="0.1"
                                value={tension}
                                onChange={(e) => setTension(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: '#00F3FF' }}
                            />
                            <div style={valueStyle}>{tension.toFixed(1)}</div>
                        </div>

                        <button
                            onClick={handleComplete}
                            style={buttonStyle}
                        >
                            [ESTABLISH_LINK]
                        </button>
                    </>
                )}

                {step === 2 && (
                    <div style={{ textAlign: 'center', color: '#00F3FF' }}>
                        <p>CALIBRATING...</p>
                        <div className="loader" style={{
                            width: '100%',
                            height: '2px',
                            background: '#333',
                            marginTop: '20px',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                position: 'absolute',
                                left: 0, top: 0, height: '100%',
                                width: '50%',
                                background: '#00F3FF',
                                animation: 'loading 1s infinite ease-in-out'
                            }} />
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes loading {
                    0% { left: -50%; }
                    100% { left: 100%; }
                }
            `}</style>
        </div>
    );
};

const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '10px',
    color: '#666',
    letterSpacing: '1px',
    marginBottom: '10px',
    textTransform: 'uppercase'
};

const valueStyle: React.CSSProperties = {
    textAlign: 'right',
    fontSize: '12px',
    color: '#00F3FF',
    marginTop: '5px'
};

const buttonStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #00F3FF',
    color: '#00F3FF',
    padding: '12px 24px',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '12px',
    cursor: 'pointer',
    width: '100%',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    transition: 'all 0.2s ease',
    outline: 'none'
};

export default Calibration;
