/**
 * [5.3] Volatility Surface
 * Deformed Glass Sheet (IV-smile).
 * 
 * A 3D glass sheet representing the IV-smile, warping surrounding
 * lattice lines via rBergomi logic and refraction shader.
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { store } from '../../../kernel/registry/Store.js';
import type { Traceable } from '../../../kernel/registry/Vektor.js';
import { simulateRBergomi } from '../../../math/kernels/rBergomi.js';

/**
 * Vertex shader for volatility surface deformation
 */
const vertexShader = `
  uniform float time;
  uniform float volatility;
  uniform float tension;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normal;

    // Deform based on rBergomi volatility
    vec3 deformed = position;
    
    // IV-smile deformation: higher volatility at edges
    float smileFactor = sin(uv.x * 3.14159) * volatility;
    deformed.z += smileFactor * 2.0;
    
    // Add tension-based distortion
    deformed.z += tension * 0.5;
    
    // Time-based subtle animation
    deformed.z += sin(time + uv.x * 5.0) * 0.1 * volatility;

    vec4 mvPosition = modelViewMatrix * vec4(deformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * Fragment shader for glass refraction effect
 */
const fragmentShader = `
  precision highp float;
  
  uniform float time;
  uniform float volatility;
  varying vec3 vPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  void main() {
    // Glass material with refraction
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    vec3 normal = normalize(vNormal);
    
    // Refraction index based on volatility
    float refractionIndex = 1.0 + volatility * 0.5;
    
    // Calculate refracted direction
    vec3 refracted = refract(-viewDirection, normal, 1.0 / refractionIndex);
    
    // Glass color with cyan tint
    vec3 glassColor = vec3(0.4, 0.8, 1.0);
    
    // Add fresnel effect
    float fresnel = pow(1.0 - dot(viewDirection, normal), 2.0);
    glassColor += vec3(0.2, 0.4, 0.6) * fresnel;
    
    // Volatility-based opacity
    float opacity = 0.3 + volatility * 0.4;
    
    gl_FragColor = vec4(glassColor, opacity);
  }
`;

/**
 * Volatility Surface component
 */
export function VolSurface({
  width = 10,
  height = 10,
  segments = 50
}: {
  width?: number;
  height?: number;
  segments?: number;
}) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const [volatility, setVolatility] = useState<number>(0.04);
  const [tension, setTension] = useState<number>(0);
  const [rbergomiData, setRBergomiData] = useState<number[]>([]);

  // Subscribe to Store for volatility and tension
  useEffect(() => {
    // Subscribe to volatility
    const unsubscribeVolatility = store.subscribe<number>(
      'math.kernels.volatility',
      (vektor) => {
        setVolatility(vektor.val);

        // Generate rBergomi data for deformation
        const data = simulateRBergomi(20, 0.01, { hurst: 0.1, v0: 0.1 });
        setRBergomiData(data);
      }
    );

    // Subscribe to tension
    const unsubscribeTension = store.subscribe<number>(
      'physics.tension',
      (vektor) => {
        setTension(vektor.val);
      }
    );

    return () => {
      unsubscribeVolatility();
      unsubscribeTension();
    };
  }, []);

  // Create geometry
  const geometry = useMemo(() => {
    return new PlaneGeometry(width, height, segments, segments);
  }, [width, height, segments]);

  // Update material uniforms
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.volatility.value = volatility;
      materialRef.current.uniforms.tension.value = tension;
    }

    // Deform geometry based on rBergomi data
    if (meshRef.current && rbergomiData.length > 0) {
      const positions = geometry.attributes.position;
      const vertexCount = positions.count;

      for (let i = 0; i < vertexCount; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);

        // Map vertex to rBergomi data
        const u = (x / width + 1) * 0.5; // Normalize to 0-1
        const v = (y / height + 1) * 0.5;

        const dataIndex = Math.floor(u * (rbergomiData.length - 1));
        const volValue = rbergomiData[dataIndex] || 0.04;

        // Deform Z based on IV-smile (higher at edges)
        const smileFactor = Math.abs(u - 0.5) * 2; // 0 at center, 1 at edges
        const z = volValue * 5 * smileFactor;

        positions.setZ(i, z);
      }

      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        uniforms={{
          time: { value: 0 },
          volatility: { value: volatility },
          tension: { value: tension }
        }}
      />
    </mesh>
  );
}
