/**
 * [5.3] Factor Cube
 * Rotating 3D Value/Momentum/Size.
 * 
 * A rotating 3D glass cube projecting into the isometric room.
 * Axes: Value, Momentum, Size.
 * Rotation speed correlates with Market Velocity.
 */

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, BoxGeometry, MeshStandardMaterial } from 'three';
import { store } from '../../../kernel/registry/Store.js';
import type { Traceable } from '../../../kernel/registry/Vektor.js';

/**
 * Factor Cube component
 */
export function FactorCube({ size = 2 }: { size?: number }) {
  const cubeRef = useRef<Mesh>(null);
  const [marketVelocity, setMarketVelocity] = useState<number>(0);
  const [value, setValue] = useState<number>(0.5);
  const [momentum, setMomentum] = useState<number>(0.5);
  const [sizeFactor, setSizeFactor] = useState<number>(0.5);

  // Subscribe to Store for market velocity and factors
  useEffect(() => {
    // Subscribe to market velocity (can be calculated from price changes)
    const unsubscribeVelocity = store.subscribe<number>(
      'math.market_velocity',
      (vektor) => {
        setMarketVelocity(vektor.val);
      }
    );

    // Subscribe to Value factor
    const unsubscribeValue = store.subscribe<number>(
      'math.factors.value',
      (vektor) => {
        setValue(vektor.val);
      }
    );

    // Subscribe to Momentum factor
    const unsubscribeMomentum = store.subscribe<number>(
      'math.factors.momentum',
      (vektor) => {
        setMomentum(vektor.val);
      }
    );

    // Subscribe to Size factor
    const unsubscribeSize = store.subscribe<number>(
      'math.factors.size',
      (vektor) => {
        setSizeFactor(vektor.val);
      }
    );

    return () => {
      unsubscribeVelocity();
      unsubscribeValue();
      unsubscribeMomentum();
      unsubscribeSize();
    };
  }, []);

  // Animate rotation based on market velocity
  useFrame((state, delta) => {
    if (!cubeRef.current) return;

    // Rotation speed correlates with market velocity
    // Normalize velocity to rotation speed (0.1 to 2.0 rad/s)
    const baseSpeed = 0.5;
    const velocityMultiplier = Math.max(0.1, Math.min(2.0, Math.abs(marketVelocity) * 10));
    const rotationSpeed = baseSpeed * velocityMultiplier;

    // Rotate around all axes with different speeds for visual interest
    cubeRef.current.rotation.x += rotationSpeed * delta * 0.5;
    cubeRef.current.rotation.y += rotationSpeed * delta;
    cubeRef.current.rotation.z += rotationSpeed * delta * 0.3;

    // Scale cube based on factors
    const scaleX = 0.5 + value * 0.5; // Value axis
    const scaleY = 0.5 + momentum * 0.5; // Momentum axis
    const scaleZ = 0.5 + sizeFactor * 0.5; // Size axis
    
    cubeRef.current.scale.set(scaleX, scaleY, scaleZ);
  });

  return (
    <mesh ref={cubeRef}>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial
        color={0x64C8FF} // Cyan
        transparent
        opacity={0.6}
        metalness={0.8}
        roughness={0.2}
        envMapIntensity={1.0}
      />
      
      {/* Axes indicators (optional wireframe) */}
      <mesh>
        <boxGeometry args={[size * 1.1, size * 1.1, size * 1.1]} />
        <meshStandardMaterial
          color={0xFFFFFF}
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
    </mesh>
  );
}
