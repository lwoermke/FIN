/**
 * [Complex] Anchor Line
 * 
 * Glowing vertical line connecting 2D panel to 3D anchor point.
 * Visually tethers the "Fact" (Glass) to the "Physics" (Lattice).
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AnchorLineProps {
    /** Anchor position on terrain */
    anchorPosition: [number, number, number];
    /** Height to extend line upward */
    lineHeight?: number;
    /** Line color */
    color?: string;
    /** Pulse animation */
    pulse?: boolean;
}

export function AnchorLine({
    anchorPosition,
    lineHeight = 5,
    color = '#00F3FF',
    pulse = true,
}: AnchorLineProps) {
    const materialRef = useRef<THREE.LineBasicMaterial>(null);

    // Create line object
    const lineObject = useMemo(() => {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array([
            anchorPosition[0], anchorPosition[1], anchorPosition[2],
            anchorPosition[0], anchorPosition[1] + lineHeight, anchorPosition[2],
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.4,
        });

        return new THREE.Line(geom, mat);
    }, [anchorPosition, lineHeight, color]);

    // Animate opacity pulse
    useFrame((state) => {
        if (pulse && lineObject.material instanceof THREE.LineBasicMaterial) {
            const t = state.clock.elapsedTime;
            lineObject.material.opacity = 0.3 + Math.sin(t * 2) * 0.15;
        }
    });

    return (
        <group>
            {/* Main line */}
            <primitive object={lineObject} />

            {/* Anchor point indicator */}
            <mesh position={anchorPosition}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color={color} transparent opacity={0.6} />
            </mesh>

            {/* Top connection point */}
            <mesh position={[anchorPosition[0], anchorPosition[1] + lineHeight, anchorPosition[2]]}>
                <ringGeometry args={[0.08, 0.12, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
}


/**
 * Render multiple anchor lines from widget positions
 */
export function AnchorLineRenderer({
    widgets,
}: {
    widgets: Array<{ id: string | number; position: [number, number, number]; type: string }>;
}) {
    return (
        <group>
            {widgets.map((widget) => (
                <AnchorLine
                    key={widget.id}
                    anchorPosition={widget.position}
                    color={widget.type === 'VOL_CUBE' ? '#00FFC8' : '#FFAA00'}
                />
            ))}
        </group>
    );
}
