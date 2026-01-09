/**
 * [System] App State Machine
 * 
 * Implements the "5-Phase Airlock" architecture.
 * Manages high-level system state and renders the appropriate environment.
 */

import React, { useState, useEffect } from 'react';
import { NavigationOrchestrator } from './ui/NavigationOrchestrator.js';
import GlobalErrorBoundary from './ui/GlobalErrorBoundary';
import { Janitor } from './kernel/system/Janitor.js';
import { PerfMonitor } from './ui/orthographic/hud/PerfMonitor.js';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { referee } from './automata/Referee.js';
import { mutationEngine } from './automata/MutationEngine.js';
import { entropyDecoupler } from './math/entropy/EntropyDecoupler.js';
import { NetworkPulse } from './intelligence/ingest/NetworkPulse.js';
import './intelligence/ledger/TradeJournal.js';
import { BootLoader } from './boot/BootLoader.js';
import { SafeErrorBoundary } from './ui/SafeErrorBoundary.js';
import { ObsidianVoid } from './ui/orthographic/background/ObsidianVoid.js';
import { NoiseOverlay } from './ui/orthographic/background/NoiseOverlay.js';

// Phase Definitions
enum Phase {
    BOOT = 0,   // Hardware Check
    ORBIT = 1,  // Macro View
    WARP = 2,   // Transition
    GROUND = 3, // Lattice
    AUDIT = 4   // Freeze/Commit
}

export function App() {
    const [phase, setPhase] = useState<Phase>(Phase.BOOT);
    const [bootLog, setBootLog] = useState<string[]>([]);
    const [fatalError, setFatalError] = useState<string | null>(null);
    const [isSafeMode, setSafeMode] = useState(false);
    const [isStaticMode, setStaticMode] = useState(false);

    // Boot Sequence
    useEffect(() => {
        NetworkPulse.init();

        const boot = async () => {
            const addLog = (msg: string) => setBootLog(prev => [...prev, msg]);

            addLog('[BOOT] Establishing Reactive Sequence...');

            try {
                await BootLoader.runSequence(addLog);
            } catch (err: any) {
                // Check if it's a worker timeout specifically
                if (err.message.includes('PhysicsWorker Timeout')) {
                    addLog('[WARN] Neural Link Severed - Running in Static Mode.');
                    setStaticMode(true);
                } else {
                    setFatalError(err.message);
                    throw err; // Stop local boot
                }
            }

            // Automata Wakeout
            if (!isStaticMode) {
                addLog('[BOOT] Waking Referee...');
                referee.start();
                addLog('[BOOT] Engaging Mutation Engine...');
                mutationEngine.start();
                addLog('[BOOT] Linking Entropy Decoupler...');
                entropyDecoupler.start();
            } else {
                addLog('[BOOT] Static Mode: Automata Offline');
            }

            // Janitor Shakeout
            Janitor.boot();
            addLog('[BOOT] Memory Janitor: Active');

            addLog('[BOOT] System Integrity Verified. Engaging Orbit...');
            setTimeout(() => {
                setPhase(Phase.ORBIT);
            }, 800);
        };

        boot().catch(err => {
            console.error('[FATAL_BOOT_LOOP_PREVENTED]', err);
            // Fatal error handled via state
        });
    }, []);

    // SYSTEM HALT SCREEN
    if (fatalError) {
        return (
            <div style={{
                backgroundColor: '#1a0000',
                color: '#FF4444',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: "'IBM Plex Mono', monospace",
                padding: '40px',
                textAlign: 'center'
            }}>
                <div style={{ maxWidth: '600px', border: '1px solid #FF4444', padding: '20px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '20px' }}>
                        SYSTEM_HALT: BOOT_FAILURE
                    </div>
                    <div style={{ background: '#330000', padding: '15px', textAlign: 'left', marginBottom: '20px' }}>
                        <code>{fatalError}</code>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        Check IndexedDB permissions or PhysicsWorker availability.
                        The application cannot proceed safely.
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '20px',
                            background: 'transparent',
                            border: '1px solid #FF4444',
                            color: '#FF4444',
                            padding: '8px 16px',
                            cursor: 'pointer'
                        }}
                    >
                        RETRY_SEQUENCE
                    </button>
                </div>
            </div>
        );
    }

    if (phase === Phase.BOOT) {
        return (
            <div style={{
                background: 'radial-gradient(circle at 50% 120%, #1a1a2e 0%, #0b0b10 50%, #050505 100%)',
                color: '#555',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: "'IBM Plex Mono', monospace"
            }}>
                <div style={{ width: '400px' }}>
                    <div style={{ borderBottom: '1px solid #333', marginBottom: '10px', paddingBottom: '5px', color: '#00FFC8' }}>
                        FIN // GRAVITY_GLASS // BOOT
                    </div>
                    {bootLog.map((log, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', marginBottom: '4px' }}>
                            {log}
                        </div>
                    ))}
                    <div style={{ marginTop: '10px', width: '100%', height: '2px', background: '#222' }}>
                        <div style={{
                            width: '100%',
                            height: '100%',
                            background: '#00FFC8',
                            animation: 'loading 1s infinite alternate',
                            opacity: 0.5
                        }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <GlobalErrorBoundary>
            <SafeErrorBoundary onCrash={() => setSafeMode(true)}>
                <NavigationOrchestrator>
                    {/* 3D Visual Metrics - Swapped for Void in Safe Mode */}
                    {!isSafeMode ? (
                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 9000 }}>
                            <Canvas style={{ background: 'transparent' }}>
                                <PerfMonitor />
                                <EffectComposer>
                                    <Bloom
                                        intensity={0.5}
                                        luminanceThreshold={0.2}
                                        luminanceSmoothing={0.9}
                                        mipmapBlur
                                    />
                                </EffectComposer>
                            </Canvas>
                        </div>
                    ) : (
                        <ObsidianVoid />
                    )}

                    {/* Static Mode Notification */}
                    {isStaticMode && (
                        <div style={{
                            position: 'fixed',
                            bottom: '20px',
                            right: '20px',
                            padding: '10px 20px',
                            backgroundColor: 'rgba(255, 170, 0, 0.1)',
                            border: '1px solid #FFAA00',
                            color: '#FFAA00',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '0.7rem',
                            zIndex: 10000,
                            letterSpacing: '0.1em'
                        }}>
                            Neural Link Severed - Running in Static Mode
                        </div>
                    )}

                    {/* Phase 4 Audit Overlay */}
                    {phase === Phase.AUDIT && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            border: '4px solid #FFD700',
                            pointerEvents: 'none',
                            zIndex: 9999,
                            opacity: 0.5
                        }} />
                    )}
                </NavigationOrchestrator>
            </SafeErrorBoundary>
        </GlobalErrorBoundary>
    );
}

// Inject keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes loading {
        0% { transform: scaleX(0.1); transform-origin: left; }
        100% { transform: scaleX(1); transform-origin: left; }
    }
`;
document.head.appendChild(style);
