/**
 * [3.3] Navigation Orchestrator
 * 
 * Root component that orchestrates view transitions between:
 * - OrbitMap (Geostationary Globe)
 * - WarpTunnel (Transition effect)
 * - GroundView (Lattice Fabric)
 * 
 * Uses ScrollVelocity state machine to control opacity and visibility.
 * All views are rendered simultaneously with only opacity transitions (no DOM repaints).
 */

import React from 'react';
import {
    ScrollVelocityProvider,
    useScrollVelocityContext
} from './controllers/useScrollVelocity.js';
import { GroundView } from './isometric/viewport/GroundView.js';
import { WarpTunnel } from './isometric/viewport/WarpTunnel.js';
import { OrbitMap } from './isometric/viewport/OrbitMap.js';
import { NeuralTraceProvider } from './controllers/NeuralTraceContext.js';
import { Sidebar } from './orthographic/workbench/Sidebar.js';
import { SystemStatus } from './hud/SystemStatus.js';
import { OrbitPortfolioPanel } from './orthographic/panels/OrbitPortfolioPanel.js';

/**
 * View layer component with controlled opacity
 */
function ViewLayer({
    children,
    opacity,
    zIndex,
    pointerEvents = 'auto'
}: {
    children: React.ReactNode;
    opacity: number;
    zIndex: number;
    pointerEvents?: 'auto' | 'none';
}) {
    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity,
                zIndex,
                pointerEvents: opacity > 0.1 ? pointerEvents : 'none',
                transition: 'opacity 0.15s ease-out',
                willChange: 'opacity'
            }}
        >
            {children}
        </div>
    );
}

/**
 * Navigation indicator showing current state
 */
function NavigationIndicator() {
    const { state, warpProgress, velocity } = useScrollVelocityContext();

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                padding: '8px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '0.7rem',
                fontFamily: "'IBM Plex Mono', monospace",
                zIndex: 10000,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}
        >
            <div>
                STATE: <span style={{ color: '#00FFC8' }}>{state}</span>
            </div>
            {state === 'warp' && (
                <div>
                    WARP: {(warpProgress * 100).toFixed(0)}%
                </div>
            )}
            <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>
                v: {velocity.toFixed(1)}px/f
            </div>
        </div>
    );
}

/**
 * Navigation trigger buttons (for non-scroll navigation)
 */
function NavigationTriggers() {
    const { state, triggerEnter, triggerExit } = useScrollVelocityContext();

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '16px',
                zIndex: 10000
            }}
        >
            {state === 'orbit' && (
                <button
                    onClick={triggerEnter}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: 'rgba(0, 170, 255, 0.2)',
                        border: '1px solid rgba(0, 170, 255, 0.5)',
                        borderRadius: '4px',
                        color: '#00AAFF',
                        fontSize: '0.8rem',
                        fontFamily: "'IBM Plex Mono', monospace",
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        transition: 'all 0.2s ease'
                    }}
                >
                    Enter Lattice ↓
                </button>
            )}

            {state === 'ground' && (
                <button
                    onClick={triggerExit}
                    style={{
                        padding: '12px 24px',
                        backgroundColor: 'rgba(136, 85, 255, 0.2)',
                        border: '1px solid rgba(136, 85, 255, 0.5)',
                        borderRadius: '4px',
                        color: '#8855FF',
                        fontSize: '0.8rem',
                        fontFamily: "'IBM Plex Mono', monospace",
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        transition: 'all 0.2s ease'
                    }}
                >
                    ↑ Exit to Orbit
                </button>
            )}
        </div>
    );
}

/**
 * Main navigation view orchestrator
 */
function NavigationViews() {
    const {
        state,
        orbitOpacity,
        warpOpacity,
        groundOpacity,
        warpProgress,
        warpDirection
    } = useScrollVelocityContext();

    return (
        <div
            style={{
                position: 'relative',
                width: '100vw',
                height: '100vh',
                overflow: 'hidden',
                background: 'radial-gradient(circle at 50% 120%, #1a1a2e 0%, #0b0b10 50%, #050505 100%)'
            }}
        >
            <Sidebar />

            {/* Ground View Layer (bottom) */}
            <ViewLayer opacity={groundOpacity} zIndex={1}>
                <GroundView tension={0} />
            </ViewLayer>

            {/* Warp Tunnel Layer (middle) */}
            <ViewLayer opacity={warpOpacity} zIndex={2} pointerEvents="none">
                <WarpTunnel
                    progress={warpProgress}
                    direction={warpDirection}
                    opacity={1}
                />
            </ViewLayer>

            {/* Orbit Map Layer (top) - UNMOUNTED in ground view to save GPU */}
            {state !== 'ground' && (
                <ViewLayer opacity={orbitOpacity} zIndex={3}>
                    <OrbitMap />
                </ViewLayer>
            )}

            {/* Orbit Portfolio Panel (only mounted in orbit/warp) */}
            {state !== 'ground' && <OrbitPortfolioPanel />}

            {/* Navigation UI */}
            <NavigationIndicator />
            <NavigationTriggers />

            {/* System Status Matrix (HUD) */}
            <SystemStatus />
        </div>
    );
}

/**
 * Navigation Orchestrator
 * 
 * Main component that provides all necessary context and renders the navigation views.
 * Use this as the root layout for the FIN application.
 */
export function NavigationOrchestrator({
    children
}: {
    children?: React.ReactNode;
}) {
    return (
        <NeuralTraceProvider>
            <ScrollVelocityProvider
                config={{
                    warpDuration: 1500,
                    enabled: true
                }}
            >
                <NavigationViews />
                {children}
            </ScrollVelocityProvider>
        </NeuralTraceProvider>
    );
}

/**
 * Example App component using the NavigationOrchestrator
 */
export function FINApp() {
    return (
        <NavigationOrchestrator>
            {/* Additional UI panels can be added here */}
            {/* They will overlay on top of the navigation views */}
        </NavigationOrchestrator>
    );
}
