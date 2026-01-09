import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import vertexShader from '@/assets/shaders/lattice_vertex.glsl?raw';
import fragmentShader from '@/assets/shaders/lattice_frag.glsl?raw';

/**
 * [Material] LatticeMaterial
 * Custom shader for the isometric lattice fabric.
 */
export const LatticeMaterial = shaderMaterial(
    {
        tension: 0.0,
        time: 0.0,
        noiseScale: 1.0,
        glowColor: new THREE.Color(0.2, 0.5, 1.0),
        glowIntensity: 1.0,
        frayingAmount: 0.3,
        uShockwaveTime: 0.0,
        u_data_influx: 0.0,
        u_integrity: 1.0
    },
    vertexShader,
    fragmentShader
);
