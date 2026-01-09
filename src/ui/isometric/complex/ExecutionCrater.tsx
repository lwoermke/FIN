/**
 * [Visuals] Execution Crater
 * 
 * Visualizes the "Point of No Return" on the Lattice Fabric.
 * Renders a pulsing red crater at liquidation coordinates.
 * 
 * "If the market moves here, you die."
 */

import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { redTeam } from '../../../automata/RedTeam.js';
import { cliffHunter, type LiquidationRisk } from '../../../automata/CliffHunter.js';
import type { Vektor } from '../../../kernel/registry/Vektor.js';

// Execution Red color
const EXECUTION_RED = new THREE.Color('#FF0F0F');

export function ExecutionCrater() {
    const meshRef = useRef<THREE.Mesh>(null);
    const materialRef = useRef<THREE.MeshBasicMaterial>(null);
    const ringRef = useRef<THREE.Mesh>(null);

    const [craterPosition, setCraterPosition] = useState<[number, number, number]>([0, -10, 0]);
    const [opacity, setOpacity] = useState(0);
    const [pulsePhase, setPulsePhase] = useState(0);
    const [isActive, setIsActive] = useState(false);

    // Subscribe to CliffHunter liquidation risk
    useEffect(() => {
        const unsubLiquidation = cliffHunter.onLiquidationRisk((risk: LiquidationRisk) => {
            // Map terrain coords to 3D position
            const x = risk.terrainCoords[0];
            const z = risk.terrainCoords[1];
            const y = -2; // Below terrain surface (crater depth)

            setCraterPosition([x, y, z]);
            setIsActive(true);
            setOpacity(1.0);

            console.log('[ExecutionCrater] Liquidation risk at', risk.terrainCoords, 'status:', risk.status);
        });

        // Also subscribe to Red Team Black Swan events
        const unsubSwan = redTeam.onBlackSwan((vektor: Vektor) => {
            const x = (vektor.val[0] || 0) * 10;
            const z = (vektor.val[1] || 0) * 10;

            setCraterPosition([x, -2, z]);
            setIsActive(true);
            setOpacity(1.0);
        });

        return () => {
            unsubLiquidation();
            unsubSwan();
        };
    }, []);

    // Animate crater
    useFrame((state, delta) => {
        if (!isActive) return;

        // Update pulse phase
        setPulsePhase(prev => prev + delta * 3);

        // Pulse opacity
        const pulseIntensity = 0.5 + Math.sin(pulsePhase) * 0.3;

        if (materialRef.current) {
            materialRef.current.opacity = opacity * pulseIntensity;
        }

        if (ringRef.current) {
            // Pulse ring scale
            const scale = 1 + Math.sin(pulsePhase * 2) * 0.1;
            ringRef.current.scale.set(scale, scale, 1);
        }

        // Fade out over time
        if (opacity > 0) {
            setOpacity(prev => Math.max(0, prev - delta * 0.1));
        } else if (opacity <= 0) {
            setIsActive(false);
        }

        // Update mesh position
        if (meshRef.current) {
            meshRef.current.position.lerp(
                new THREE.Vector3(...craterPosition),
                delta * 2
            );
        }
    });

    if (!isActive && opacity <= 0) return null;

    return (
        <group>
            {/* Main Crater Disk */}
            <mesh ref={meshRef} position={craterPosition} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[3, 32]} />
                <meshBasicMaterial
                    ref={materialRef}
                    color={EXECUTION_RED}
                    transparent
                    opacity={0.6}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Pulsing Ring */}
            <mesh ref={ringRef} position={[craterPosition[0], craterPosition[1] + 0.1, craterPosition[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[2.5, 3.5, 32]} />
                <meshBasicMaterial
                    color={EXECUTION_RED}
                    transparent
                    opacity={opacity * 0.4}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Warning Symbol (cross) */}
            <group position={[craterPosition[0], craterPosition[1] + 0.2, craterPosition[2]]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.3, 2]} />
                    <meshBasicMaterial color={EXECUTION_RED} transparent opacity={opacity * 0.8} side={THREE.DoubleSide} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
                    <planeGeometry args={[0.3, 2]} />
                    <meshBasicMaterial color={EXECUTION_RED} transparent opacity={opacity * 0.8} side={THREE.DoubleSide} />
                </mesh>
            </group>

            {/* "LIQUIDATION" text indicator - using a simple billboard */}
            <mesh position={[craterPosition[0], craterPosition[1] + 3, craterPosition[2]]}>
                <planeGeometry args={[4, 0.5]} />
                <meshBasicMaterial color={EXECUTION_RED} transparent opacity={opacity * 0.6} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}

