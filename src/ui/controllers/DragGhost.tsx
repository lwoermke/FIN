/**
 * [Controller] Drag Ghost
 * 
 * 3D ghost preview that follows cursor and raycasts to terrain.
 * Snaps to terrain surface with height awareness.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { dragController } from './DragController.js';
import { Janitor } from '../../kernel/system/Janitor.js';

// Reference to terrain mesh for raycasting (set by TerrainMesh)
let terrainMeshRef: THREE.Mesh | null = null;

export function setTerrainMeshRef(mesh: THREE.Mesh | null) {
    terrainMeshRef = mesh;
}

export function DragGhost() {
    const { camera, raycaster, scene } = useThree();
    const meshRef = useRef<THREE.Mesh>(null);
    const ringRef = useRef<THREE.Mesh>(null);
    const [dragState, setDragState] = useState(dragController.getState());

    // Fallback plane for when terrain isn't hit
    const fallbackPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 10));
    const intersectPoint = useRef(new THREE.Vector3());

    useEffect(() => {
        const unsubscribe = dragController.subscribe(setDragState);
        return () => {
            unsubscribe();
            if (meshRef.current) Janitor.dispose(meshRef.current);
        };
    }, []);

    useEffect(() => {
        const handleMouseUp = () => {
            if (dragState.active && meshRef.current) {
                const pos = meshRef.current.position;
                console.log(`[DragGhost] Dropping ${dragState.type} at`, pos.toArray());
                dragController.triggerDrop([pos.x, pos.y, pos.z]);
            }
        };
        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [dragState]);

    useFrame((state) => {
        if (!dragState.active || !meshRef.current) return;

        raycaster.setFromCamera(state.pointer, camera);

        let hitPoint: THREE.Vector3 | null = null;

        // Try to raycast to terrain mesh first
        if (terrainMeshRef) {
            const intersects = raycaster.intersectObject(terrainMeshRef, false);
            if (intersects.length > 0) {
                hitPoint = intersects[0].point;
            }
        }

        // Fallback: raycast to all meshes in scene with 'terrain' userData
        if (!hitPoint) {
            const terrainObjects: THREE.Object3D[] = [];
            scene.traverse((obj) => {
                if (obj.userData?.isTerrain) {
                    terrainObjects.push(obj);
                }
            });
            if (terrainObjects.length > 0) {
                const intersects = raycaster.intersectObjects(terrainObjects, true);
                if (intersects.length > 0) {
                    hitPoint = intersects[0].point;
                }
            }
        }

        // Final fallback: intersect with horizontal plane
        if (!hitPoint) {
            raycaster.ray.intersectPlane(fallbackPlane.current, intersectPoint.current);
            hitPoint = intersectPoint.current;
        }

        if (hitPoint) {
            // Snap to grid (terrain vertex spacing ~0.78)
            const snap = 0.78;
            const x = Math.round(hitPoint.x / snap) * snap;
            const z = Math.round(hitPoint.z / snap) * snap;
            const y = hitPoint.y + 0.5; // Float slightly above terrain

            // Lerp for smooth follow
            meshRef.current.position.lerp(new THREE.Vector3(x, y, z), 0.15);

            // Update ring indicator
            if (ringRef.current) {
                ringRef.current.position.set(x, hitPoint.y + 0.05, z);
            }
        }
    });

    if (!dragState.active) return null;

    const color = dragState.type === 'VOL_CUBE' ? '#00FFC8' : '#FFAA00';

    return (
        <group>
            {/* Ghost Widget */}
            <mesh ref={meshRef} position={[0, 0, 0]}>
                {dragState.type === 'VOL_CUBE' ? (
                    <boxGeometry args={[0.6, 0.6, 0.6]} />
                ) : (
                    <sphereGeometry args={[0.3, 16, 16]} />
                )}
                <meshBasicMaterial
                    color={color}
                    wireframe
                    transparent
                    opacity={0.6}
                />
            </mesh>

            {/* Anchor Ring (gravity point preview) */}
            <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.3, 0.5, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.4}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* Vertical Tether Line */}
            <line>
                <bufferGeometry>
                    <bufferAttribute
                        attach="attributes-position"
                        count={2}
                        array={new Float32Array([0, 0, 0, 0, -2, 0])}
                        itemSize={3}
                    />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={0.3} />
            </line>
        </group>
    );
}

