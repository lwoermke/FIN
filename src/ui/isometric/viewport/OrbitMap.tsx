import { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';
import { usePortfolioAssets } from '../../controllers/useStore.js';
import { Janitor } from '../../../kernel/system/Janitor.js';

/**
 * Region coordinates on globe (lat, lon in degrees)
 */
const REGION_COORDS: Record<string, { lat: number; lon: number; name: string }> = {
    US: { lat: 40, lon: -100, name: 'United States' },
    EU: { lat: 50, lon: 10, name: 'Europe' },
    UK: { lat: 52, lon: -1, name: 'United Kingdom' },
    JP: { lat: 36, lon: 138, name: 'Japan' },
    CN: { lat: 35, lon: 105, name: 'China' },
    HK: { lat: 22, lon: 114, name: 'Hong Kong' },
    SG: { lat: 1, lon: 104, name: 'Singapore' },
    AU: { lat: -25, lon: 135, name: 'Australia' },
    BR: { lat: -10, lon: -55, name: 'Brazil' },
    IN: { lat: 20, lon: 78, name: 'India' }
};

/**
 * Convert lat/lon to 3D position on sphere
 * Refactored to avoid 'new' internally if target is provided.
 */
function getLatLonPos(lat: number, lon: number, radius: number, target: THREE.Vector3): THREE.Vector3 {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    target.set(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
    return target;
}

/**
 * Hexagonal extrusion representing asset exposure
 */
function ExposureHexagon({
    position,
    height,
    color,
    riskLevel
}: {
    position: THREE.Vector3;
    height: number;
    color: string;
    riskLevel: number;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const lookAtTarget = useRef(new THREE.Vector3());

    useEffect(() => {
        // Calculate look-at target once (static for this hexagon)
        lookAtTarget.current.copy(position).multiplyScalar(2);
        return () => { if (meshRef.current) Janitor.dispose(meshRef.current); };
    }, [position]);

    useFrame((state) => {
        if (meshRef.current) {
            const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + riskLevel * 10) * 0.05 * riskLevel;
            meshRef.current.scale.setScalar(pulse);
        }
    });

    return (
        <group position={position}>
            <mesh
                ref={meshRef}
                rotation={[
                    Math.atan2(lookAtTarget.current.y, Math.sqrt(lookAtTarget.current.x ** 2 + lookAtTarget.current.z ** 2)),
                    Math.atan2(lookAtTarget.current.x, lookAtTarget.current.z),
                    0
                ]}
            >
                <cylinderGeometry args={[0.08, 0.1, height * 0.5, 6]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.3 + riskLevel * 0.5}
                    transparent
                    opacity={0.8}
                />
            </mesh>
        </group>
    );
}

/**
 * Flow arc between two regions (Bezier curve)
 */
function FlowArc({
    start,
    end,
    volume,
    color = '#00AAFF'
}: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    volume: number;
    color?: string;
}) {
    const [offset, setOffset] = useState(0);

    useFrame(() => {
        setOffset((offset + 0.01 * (1 + volume)) % 1);
    });

    // POOLING: mid and curve points
    const { points } = useMemo(() => {
        const mid = start.clone().add(end).multiplyScalar(0.5);
        const arcHeight = 1 + start.distanceTo(end) * 0.3;
        mid.normalize().multiplyScalar(arcHeight + 2);

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        return { points: curve.getPoints(50) };
    }, [start, end]);

    return (
        <Line
            points={points}
            color={color}
            lineWidth={1 + volume * 2}
            transparent
            opacity={0.6}
            dashed
            dashSize={0.1}
            dashOffset={-offset}
        />
    );
}

/**
 * Risk cloud overlay
 */
function RiskCloud({
    position,
    riskLevel,
    spread = 0.3
}: {
    position: THREE.Vector3;
    riskLevel: number;
    spread?: number;
}) {
    const meshRef = useRef<THREE.Mesh>(null);
    const color = useRef(new THREE.Color());

    useEffect(() => {
        color.current.setHSL((1 - riskLevel) * 0.3, 0.8, 0.5);
        return () => { if (meshRef.current) Janitor.dispose(meshRef.current); };
    }, [riskLevel]);

    useFrame((state) => {
        if (meshRef.current) {
            const scale = spread + Math.sin(state.clock.elapsedTime * 3) * 0.02 * riskLevel;
            meshRef.current.scale.setScalar(scale);
        }
    });

    return (
        <mesh ref={meshRef} position={position}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial
                color={color.current}
                transparent
                opacity={0.15 * riskLevel}
                depthWrite={false}
            />
        </mesh>
    );
}

/**
 * The main globe component
 */
function Globe({
    spinSpeed
}: {
    spinSpeed: number;
}) {
    const globeRef = useRef<THREE.Group>(null);
    const assets = usePortfolioAssets();

    useFrame((_, delta) => {
        if (globeRef.current) {
            // Slow cinematic spin
            globeRef.current.rotation.y += delta * 0.02;
        }
    });

    const regionData = useMemo(() => {
        const regions: Record<string, { weight: number; value: number; risk: number }> = {};
        if (!assets || !Array.isArray(assets)) return regions;

        for (const asset of assets) {
            const region = asset.region || 'US';
            if (!regions[region]) regions[region] = { weight: 0, value: 0, risk: 0 };
            regions[region].weight += asset.weight;
            regions[region].value += asset.value;
            regions[region].risk = Math.max(regions[region].risk, Math.min(1, asset.variance * 3));
        }
        return regions;
    }, [assets]);

    const flows = useMemo(() => {
        const entries = Object.entries(regionData).sort((a, b) => b[1].weight - a[1].weight);
        if (!entries || entries.length < 2) return [];
        const flows: Array<{ from: string; to: string; volume: number }> = [];
        const [largest] = entries;
        for (let i = 1; i < Math.min(entries.length, 4); i++) {
            flows.push({ from: largest[0], to: entries[i][0], volume: entries[i][1].weight });
        }
        return flows;
    }, [regionData]);

    const GLOBE_RADIUS = 2;

    return (
        <group ref={globeRef} position={[2, 0, 0]}>
            {/* Dark Obsidian Ocean */}
            <Sphere args={[GLOBE_RADIUS, 64, 64]}>
                <meshStandardMaterial
                    color="#0a0a15"
                    roughness={0.2}
                    metalness={0.4}
                    transparent
                    opacity={0.95}
                />
            </Sphere>
            {/* Glowing Cyan Coastlines */}
            <Sphere args={[GLOBE_RADIUS + 0.01, 32, 32]}>
                <meshBasicMaterial
                    color="#00F3FF"
                    wireframe
                    transparent
                    opacity={0.4}
                />
            </Sphere>

            {Object.entries(regionData).map(([region, data]) => {
                const coords = REGION_COORDS[region];
                if (!coords) return null;
                // POOLING: We need fresh vectors for sub-components as they hold refs, but we can reuse temporary ones for calc
                const pos = getLatLonPos(coords.lat, coords.lon, GLOBE_RADIUS + 0.1, new THREE.Vector3());
                return (
                    <ExposureHexagon key={region} position={pos} height={data.weight} color={data.risk > 0.5 ? '#FF4444' : '#00FFC8'} riskLevel={data.risk} />
                );
            })}

            {Object.entries(regionData).map(([region, data]) => {
                const coords = REGION_COORDS[region];
                if (!coords || data.risk < 0.3) return null;
                const pos = getLatLonPos(coords.lat, coords.lon, GLOBE_RADIUS + 0.2, new THREE.Vector3());
                return <RiskCloud key={`risk-${region}`} position={pos} riskLevel={data.risk} />;
            })}

            {flows.map((flow, i) => {
                const fromCoords = REGION_COORDS[flow.from];
                const toCoords = REGION_COORDS[flow.to];
                if (!fromCoords || !toCoords) return null;
                const start = getLatLonPos(fromCoords.lat, fromCoords.lon, GLOBE_RADIUS + 0.15, new THREE.Vector3());
                const end = getLatLonPos(toCoords.lat, toCoords.lon, GLOBE_RADIUS + 0.15, new THREE.Vector3());
                return <FlowArc key={`flow-${i}`} start={start} end={end} volume={flow.volume} />;
            })}
        </group>
    );
}

/**
 * Cursor tracker for spin speed modulation
 */
function CursorTracker({
    onSpeedChange
}: {
    onSpeedChange: (speed: number) => void;
}) {
    useFrame(({ mouse }) => {
        const speed = 0.5 + (mouse.x + 1) * 0.75;
        onSpeedChange(speed);
    });
    return null;
}

/**
 * Orbit Map component
 */
export function OrbitMap({
    className,
    style
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    const [spinSpeed, setSpinSpeed] = useState(1);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={className}
            style={{ width: '100%', height: '100%', position: 'relative', ...style }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => { setIsHovered(false); setSpinSpeed(1); }}
        >
            <Canvas camera={{ position: [0, 0, 6], fov: 50 }} style={{ background: 'transparent' }}>
                <ambientLight intensity={0.4} />
                <pointLight position={[10, 10, 10]} intensity={1} />
                <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4488FF" />
                <Globe spinSpeed={spinSpeed} />
                {isHovered && <CursorTracker onSpeedChange={setSpinSpeed} />}
            </Canvas>

            <div style={{
                position: 'absolute', top: 16, left: 16, padding: '4px 12px',
                backgroundColor: 'rgba(0, 170, 255, 0.15)', border: '1px solid rgba(0, 170, 255, 0.4)',
                borderRadius: '4px', color: 'rgba(0, 170, 255, 0.9)', fontSize: '0.7rem',
                fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase',
                pointerEvents: 'none'
            }}>
                EXPOSURE
            </div>
        </div>
    );
}
