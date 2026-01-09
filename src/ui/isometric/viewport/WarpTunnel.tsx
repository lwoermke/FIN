import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Janitor } from '../../../kernel/system/Janitor.js';

/**
 * Individual warp line (stretched lattice thread)
 */
function WarpLine({
    startPosition,
    speed,
    color,
    progress
}: {
    startPosition: [number, number, number];
    speed: number;
    color: string;
    progress: number;
}) {
    const lineRef = useRef<THREE.Line>(null);

    // Create line geometry and material
    const { geometry, material } = useMemo(() => {
        const geom = new THREE.BufferGeometry();
        const positions = new Float32Array([
            0, 0, 0,      // Start
            0, 0, -100    // End (toward -infinity)
        ]);
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.6
        });

        return { geometry: geom, material: mat };
    }, [color]);

    useEffect(() => {
        return () => {
            if (lineRef.current) Janitor.dispose(lineRef.current);
        };
    }, []);

    useFrame((state) => {
        if (!lineRef.current) return;

        // Animate line stretching toward camera
        const time = state.clock.elapsedTime;
        const stretch = 1 + time * speed * 10;

        // Z-axis stretch (toward -infinity)
        lineRef.current.scale.z = stretch;

        // Fade based on progress
        (lineRef.current.material as THREE.LineBasicMaterial).opacity =
            Math.sin(progress * Math.PI) * 0.8;
    });

    return (
        <primitive
            ref={lineRef}
            object={new THREE.Line(geometry, material)}
            position={startPosition}
        />
    );
}


/**
 * Warp tunnel effect - grid of lines stretching to infinity
 */
function WarpEffect({
    progress,
    direction
}: {
    progress: number;
    direction: 'ENTERING' | 'EXITING' | null;
}) {
    const groupRef = useRef<THREE.Group>(null);

    // Generate line positions in a cylindrical pattern
    const lines = useMemo(() => {
        const result: Array<{
            position: [number, number, number];
            speed: number;
            color: string;
        }> = [];

        const ringCount = 8;
        const linesPerRing = 24;

        for (let ring = 0; ring < ringCount; ring++) {
            const radius = 2 + ring * 1.5;
            for (let i = 0; i < linesPerRing; i++) {
                const angle = (i / linesPerRing) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                const z = -ring * 5 - Math.random() * 10;

                const speed = 0.5 + ring * 0.3 + Math.random() * 0.5;
                const hue = 0.5 + (ring / ringCount) * 0.2;
                const color = new THREE.Color().setHSL(hue, 0.8, 0.6).getStyle();

                result.push({ position: [x, y, z], speed, color });
            }
        }

        return result;
    }, []);

    useFrame((state) => {
        if (!groupRef.current) return;
        const time = state.clock.elapsedTime;
        groupRef.current.rotation.z = time * 0.1;
        const zMovement = direction === 'ENTERING' ? time * 5 : -time * 5;
        groupRef.current.position.z = zMovement % 50;
    });

    return (
        <group ref={groupRef}>
            {lines.map((line, i) => (
                <WarpLine
                    key={i}
                    startPosition={line.position}
                    speed={line.speed}
                    color={line.color}
                    progress={progress}
                />
            ))}
        </group>
    );
}

/**
 * Central glow effect
 */
function CentralGlow({ progress }: { progress: number }) {
    const meshRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        return () => { if (meshRef.current) Janitor.dispose(meshRef.current); };
    }, []);

    useFrame(() => {
        if (!meshRef.current) return;
        const scale = 0.5 + Math.sin(progress * Math.PI) * 0.3;
        meshRef.current.scale.setScalar(scale);
    });

    return (
        <mesh ref={meshRef} position={[0, 0, -50]}>
            <sphereGeometry args={[5, 32, 32]} />
            <meshBasicMaterial
                color="#00FFC8"
                transparent
                opacity={0.15 * Math.sin(progress * Math.PI)}
            />
        </mesh>
    );
}

/**
 * Radial blur effect (ring of light)
 */
function RadialBlur({ progress }: { progress: number }) {
    const ringRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        return () => { if (ringRef.current) Janitor.dispose(ringRef.current); };
    }, []);

    useFrame((state) => {
        if (!ringRef.current) return;
        const time = state.clock.elapsedTime;
        const scale = 1 + time * 0.5;
        ringRef.current.scale.setScalar(scale);
        (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
            Math.max(0, 0.5 - time * 0.1) * Math.sin(progress * Math.PI);
    });

    return (
        <mesh ref={ringRef} position={[0, 0, -5]} rotation={[0, 0, 0]}>
            <ringGeometry args={[3, 4, 64]} />
            <meshBasicMaterial
                color="#00AAFF"
                transparent
                opacity={0.3}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

/**
 * WarpTunnel component
 */
export function WarpTunnel({
    progress = 0.5,
    direction = 'ENTERING',
    opacity = 1,
    className,
    style
}: {
    progress?: number;
    direction?: 'ENTERING' | 'EXITING' | null;
    opacity?: number;
    className?: string;
    style?: React.CSSProperties;
}) {
    return (
        <div
            className={className}
            style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                opacity, transition: 'opacity 0.3s ease', pointerEvents: 'none', ...style
            }}
        >
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }} style={{ background: 'transparent' }}>
                <WarpEffect progress={progress} direction={direction} />
                <CentralGlow progress={progress} />
                <RadialBlur progress={progress} />
                <fog attach="fog" args={['#0a0a15', 10, 100]} />
            </Canvas>

            <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.7) 100%)',
                pointerEvents: 'none'
            }} />

            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                color: 'rgba(0, 255, 200, 0.8)', fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: '0.2em', textTransform: 'uppercase', textShadow: '0 0 20px rgba(0, 255, 200, 0.5)',
                opacity: Math.sin(progress * Math.PI)
            }}>
                {direction === 'ENTERING' ? 'ENTERING LATTICE' : 'EXITING TO ORBIT'}
            </div>
        </div>
    );
}
