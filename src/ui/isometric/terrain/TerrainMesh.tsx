/**
 * [Isometric] Terrain Mesh
 * 
 * Volumetric lattice terrain based on "Drone Shield" reference.
 * Uses Perlin noise displacement with cyan peaks and dark valleys.
 * Includes cursor-following light for dynamic shadows.
 */

import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainMaterial } from '../materials/TerrainMaterial.js';
import { setTerrainMeshRef } from '../../controllers/DragGhost.js';

// Ensure material is extended
import '../materials/TerrainMaterial.js';

/**
 * Terrain Mesh Component
 * Creates a volumetric lattice terrain with Perlin noise displacement.
 */
export function TerrainMesh({
    noiseScale = 0.02,
    noiseAmplitude = 8.0,
}: {
    noiseScale?: number;
    noiseAmplitude?: number;
}) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const wireframeMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
    const meshRef = useRef<THREE.Mesh>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const [lightPosition, setLightPosition] = useState<[number, number, number]>([0, 10, 0]);

    const { raycaster, camera } = useThree();

    // Animate shader uniforms and update light position
    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
        }

        // Update cursor-following light
        if (meshRef.current && lightRef.current) {
            raycaster.setFromCamera(state.pointer, camera);
            const intersects = raycaster.intersectObject(meshRef.current, false);

            if (intersects.length > 0) {
                const point = intersects[0].point;
                // Position light above the terrain at cursor
                setLightPosition([point.x, point.y + 8, point.z]);
            }
        }

        // Register mesh ref for DragGhost raycasting
        if (meshRef.current) {
            setTerrainMeshRef(meshRef.current);
        }
    });

    return (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -10, 0]}>
            {/* Cursor-following Point Light */}
            <pointLight
                ref={lightRef}
                position={lightPosition}
                color="#00F3FF"
                intensity={2}
                distance={50}
                decay={2}
            />

            {/* Main terrain surface */}
            <mesh ref={meshRef} userData={{ isTerrain: true }}>
                <planeGeometry args={[200, 200, 256, 256]} />
                {/* @ts-ignore */}
                <terrainMaterial
                    ref={materialRef}
                    uNoiseScale={noiseScale}
                    uNoiseAmplitude={noiseAmplitude}
                    transparent
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Faint wireframe overlay */}
            <mesh position={[0, 0, 0.1]}>
                <planeGeometry args={[200, 200, 64, 64]} />
                <meshBasicMaterial
                    ref={wireframeMaterialRef}
                    color="#00F3FF"
                    wireframe
                    transparent
                    opacity={0.1}
                    side={THREE.DoubleSide}
                />
            </mesh>
        </group>
    );
}

