import React from 'react';
import { NoiseOverlay } from './NoiseOverlay.js';

/**
 * [UI] ObsidianVoid
 * The "Living Void" atmosphere background.
 * Implements warm radial gradient for Safe Mode and fallback scenarios.
 */
export function ObsidianVoid() {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'radial-gradient(circle at 50% 120%, #1a1a2e 0%, #0b0b10 50%, #050505 100%)',
            zIndex: -1,
            overflow: 'hidden'
        }}>
            {/* Noise texture overlay */}
            <NoiseOverlay />

            {/* Subtle ambient glow */}
            <div style={{
                position: 'absolute',
                top: '60%',
                left: '50%',
                width: '200%',
                height: '100%',
                transform: 'translate(-50%, -50%)',
                background: 'radial-gradient(ellipse at center, rgba(26, 26, 46, 0.4) 0%, transparent 60%)',
                pointerEvents: 'none',
                opacity: 0.6
            }} />

            {/* Deep space "Vektor" artifacts */}
            <div style={{
                position: 'absolute',
                top: '40%',
                left: '10%',
                width: '150px',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(0, 243, 255, 0.15), transparent)',
                transform: 'rotate(-45deg)',
                opacity: 0.3
            }} />
            <div style={{
                position: 'absolute',
                bottom: '30%',
                right: '15%',
                width: '200px',
                height: '1px',
                background: 'linear-gradient(90deg, transparent, rgba(255, 100, 100, 0.1), transparent)',
                transform: 'rotate(15deg)',
                opacity: 0.2
            }} />
        </div>
    );
}

