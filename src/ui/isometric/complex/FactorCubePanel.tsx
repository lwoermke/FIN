/**
 * [5.3] Factor Cube Panel
 * 
 * A Gravity Glass panel containing the 3D Factor Cube.
 * Renders the rotating cube inside a glass container.
 */

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { FactorCube } from './FactorCube.js';
import type { Traceable } from '../../../kernel/registry/Vektor.js';

interface FactorCubePanelProps {
    /** Factor data (optional override) */
    data?: Traceable<{ value: number; momentum: number; size: number }> | null;
    /** Panel size */
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
                width: size + 48,
                height: size + 80,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '32px',
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

export function FactorCubePanel({
    data,
    size = 200,
    label = 'FACTOR CUBE'
}: FactorCubePanelProps) {
    // Show skeleton if data is explicitly null (loading)
    // If data is undefined, show the cube with store-driven values
    if (data === null) {
        return <SkeletonPulse size={size} />;
    }

    return (
        <div
            className="gravity-glass"
            style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}
        >
            {/* Label */}
            <div
                style={{
                    marginBottom: '16px',
                    fontSize: '0.65rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: "'IBM Plex Mono', monospace",
                }}
            >
                {label}
            </div>

            {/* 3D Canvas Container */}
            <div
                style={{
                    width: size,
                    height: size,
                    borderRadius: '16px',
                    overflow: 'hidden',
                    background: 'rgba(0, 0, 0, 0.2)',
                }}
            >
                <Canvas
                    camera={{ position: [4, 4, 4], fov: 50 }}
                    style={{ background: 'transparent' }}
                >
                    <ambientLight intensity={0.4} />
                    <pointLight position={[10, 10, 10]} intensity={1} color="#00F3FF" />
                    <pointLight position={[-10, -10, -10]} intensity={0.5} color="#FF00FF" />
                    <FactorCube size={1.5} />
                </Canvas>
            </div>

            {/* Axes Legend */}
            <div
                style={{
                    marginTop: '16px',
                    display: 'flex',
                    gap: '16px',
                    fontSize: '0.55rem',
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: 'rgba(255, 255, 255, 0.4)',
                }}
            >
                <span>X: VALUE</span>
                <span>Y: MOMENTUM</span>
                <span>Z: SIZE</span>
            </div>
        </div>
    );
}
