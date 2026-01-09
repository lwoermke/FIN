/**
 * [Complex] Risk Terrain
 * 
 * A dynamic topography representing "Value at Risk" (VaR).
 * Sits below the main Lattice. High peaks indicate danger zones.
 */

import React, { useRef } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

import { store } from '../../../kernel/registry/Store';
import { RiskMaterial } from '../materials/RiskMaterial.js';

// Side-effects move to materials/index.ts

// Extend JSX

// Extend JSX
declare global {
    namespace JSX {
        interface IntrinsicElements {
            riskMaterial: any;
        }
    }
}

export function RiskTerrain({ riskLevel = 1.0 }: { riskLevel?: number }) {
    const materialRef = useRef<THREE.ShaderMaterial>(null);
    const [cloudsEnabled, setCloudsEnabled] = React.useState(true);

    React.useEffect(() => {
        const unsub = store.subscribe('system.eco.clouds', (val) => {
            if (typeof val.val === 'boolean') setCloudsEnabled(val.val);
        });
        return () => unsub();
    }, []);

    useFrame((state) => {
        if (materialRef.current) {
            materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
            materialRef.current.uniforms.uRiskLevel.value = riskLevel;
        }
    });

    if (!cloudsEnabled || !RiskMaterial) {
        if (!RiskMaterial) console.error('[RiskTerrain] Shaders failed to load.');
        return null;
    }

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
            <planeGeometry args={[100, 100, 128, 128]} />
            {/* @ts-ignore */}
            <riskMaterial ref={materialRef} />
        </mesh>
    );
}
