/**
 * [3.1] Ground View
 * The primary Lattice interface.
 * 
 * Renders the isometric lattice fabric using R3F and connects to physics worker.
 */

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Import shaders
import vertexShader from '@/assets/shaders/lattice_vertex.glsl?raw';
import fragmentShader from '@/assets/shaders/lattice_frag.glsl?raw';
import { LOW_COMPUTE_MODE } from '../../.././boot/hardware_handshake';
import { store } from '../../../kernel/registry/Store';
import { Heartbeat } from '../../../kernel/system/Heartbeat';
import { dragController } from '../../controllers/DragController.js';
import { DragGhost } from '../../controllers/DragGhost.js';
import { RiskTerrain } from '../complex/RiskTerrain.js';
import { LatticeMaterial } from '../materials/LatticeMaterial.js';
import { TerrainMesh } from '../terrain/TerrainMesh.js';

// Extend Three.js types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      latticeMaterial: any;
    }
  }
}

// Side-effects move to materials/index.ts

/**
 * Lattice mesh component that connects to physics worker
 */
function LatticeMesh({
  tension,
  positionsBuffer
}: {
  tension: number;
  positionsBuffer: Float32Array | null;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [shockwaveTime, setShockwaveTime] = useState(0.0);
  const [isCommitting, setIsCommitting] = useState(false);
  const [shockType, setShockType] = useState<'commit' | 'news'>('commit');
  const [ecoOpacity, setEcoOpacity] = useState(1.0);
  const prevPointer = useRef(new THREE.Vector2(0, 0));

  // Initialize physics worker
  useEffect(() => {
    const physicsWorker = new Worker(
      new URL('../../../workers/physics.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Create initial lattice geometry
    // Reduce segment count by 50% in Low Compute Mode (20 -> 10)
    const gridSize = LOW_COMPUTE_MODE ? 10 : 20;
    const spacing = 0.5;
    const vertices: number[] = [];
    const indices: number[] = [];

    // Generate grid of vertices
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const x = (i - gridSize / 2) * spacing;
        const y = (j - gridSize / 2) * spacing;
        const z = 0;
        vertices.push(x, y, z);
      }
    }

    // Generate indices for grid
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const a = i * (gridSize + 1) + j;
        const b = a + 1;
        const c = a + gridSize + 1;
        const d = c + 1;

        // Two triangles per quad
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    const geom = new THREE.BufferGeometry();
    const positionAttribute = new THREE.Float32BufferAttribute(vertices, 3);
    // Mark as dynamic usage
    positionAttribute.usage = THREE.DynamicDrawUsage;
    geom.setAttribute('position', positionAttribute);

    geom.setIndex(indices);
    geom.computeVertexNormals();

    // Add UV coordinates
    const uvs: number[] = [];
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        uvs.push(i / gridSize, j / gridSize);
      }
    }
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    setGeometry(geom);

    // Initialize physics worker
    const nodeCount = (gridSize + 1) * (gridSize + 1);
    const threads: any[] = [];

    // Create threads (springs) between adjacent nodes
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * (gridSize + 1) + j;

        // Horizontal connections
        if (j < gridSize) {
          threads.push({
            nodeA: idx,
            nodeB: idx + 1,
            restLength: spacing,
            stiffness: 100.0,
            damping: 0.1
          });
        }

        // Vertical connections
        if (i < gridSize) {
          threads.push({
            nodeA: idx,
            nodeB: idx + gridSize + 1,
            restLength: spacing,
            stiffness: 100.0,
            damping: 0.1
          });
        }
      }
    }

    // SHARED MEMORY ALLOCATION
    // 3 floats per node (x, y, z) * 4 bytes per float
    const sab = new SharedArrayBuffer(nodeCount * 3 * 4);
    const sharedFloats = new Float32Array(sab);

    // Initialize SAB with starting positions
    sharedFloats.set(vertices);

    // Keep reference to view for useFrame
    (window as any).latticeSharedBuffer = sharedFloats;

    physicsWorker.postMessage({
      type: 'init',
      data: {
        nodeCount,
        threads,
        timeStep: 0.016,
        gravity: 0.0,
        sharedBuffer: sab // Pass the SAB
      }
    });

    // Start the physics loop
    physicsWorker.postMessage({
      type: 'start_loop',
      // We don't need to send buffer anymore, worker has SAB
    });


    setInitialized(true);
    setWorker(physicsWorker);

    // Handle worker messages
    physicsWorker.onmessage = (event) => {
      const { type } = event.data;

      // 'update' just means "sim ticked", we rely on SAB for data
      if (type === 'update' && geom) {
        // Mark geometry as dirty so it re-uploads data from CPU RAM (SAB view) to GPU
        // NOTE: In useFrame we will copy from SAB to attribute
      }
    };

    // REGISTER WITH HEARTBEAT
    Heartbeat.register('physics.worker', physicsWorker, () => {
      console.log('[GroundView] Respawing Worker...');
      const newWorker = new Worker(
        new URL('../../../workers/physics.worker.ts', import.meta.url),
        { type: 'module' }
      );
      // Re-create SAB logic if needed, but for now we reuse the window.latticeSharedBuffer logic or re-init?
      // Simpler to just re-init standard way.
      // Ideally we should persist the SAB.

      newWorker.postMessage({
        type: 'init',
        data: { nodeCount, threads, timeStep: 0.016, gravity: 0.0, sharedBuffer: sab }
      });

      newWorker.postMessage({ type: 'start_loop' });

      newWorker.onmessage = physicsWorker.onmessage;
      setWorker(newWorker);
      return newWorker;
    });

    return () => {
      Heartbeat.unregister('physics.worker');
      physicsWorker.postMessage({ type: 'stop_loop' });
      physicsWorker.terminate();
    };
  }, []);

  // Parallax & News & Risk Logic

  useEffect(() => {
    // 1. Commit State Handler
    (window as any).commitState = () => {
      console.log('[GroundView] Committing State...');
      setIsCommitting(true);
      setShockType('commit');
      setShockwaveTime(0.01);
    };

    // 2. News Shock Handler
    const handleNewsShock = (e: any) => {
      console.log('[GroundView] NEWS SHOCK RECEIVED', e.detail);
      setShockType('news');
      setShockwaveTime(0.01);
    };

    window.addEventListener('NEWS_SHOCK', handleNewsShock);

    // 3. Physics Control Handlers
    const handlePause = () => {
      if (worker) worker.postMessage({ type: 'PAUSE' });
    };
    const handleResume = () => {
      if (worker) worker.postMessage({ type: 'RESUME' });
    };

    window.addEventListener('PHYSICS_PAUSE_REQUEST', handlePause);
    window.addEventListener('PHYSICS_RESUME_REQUEST', handleResume);

    // 4. Store Subscriptions (News/Risk)
    // We listen for changes to drive visual uniforms
    const unsubNews = store.subscribe('intelligence.news', (val) => {
      if (val && val.conf) {
        console.log('[GroundView] Store Update: NEWS', val);
        setShockType('news');
        setShockwaveTime(0.01);
        // We could extract sentiment from val.val and pass to shader color
      }
    });

    const unsubRisk = store.subscribe('intelligence.risk', (val) => {
      if (val) {
        console.log('[GroundView] Store Update: RISK', val);
        // Verify if risk is high > 0.8?
        // materialRef.current.uniforms.tension.value = ...
      }
    });

    // 5. Viscosity & Fraying (Exogenous/Chain)
    const unsubViscosity = store.subscribe('intelligence.chain.viscosity', (val: any) => {
      if (val && typeof val.val === 'number') {
        // Send to worker
        if (worker) {
          worker.postMessage({ type: 'UPDATE_VISCOSITY', data: { viscosity: val.val } });
        }
      }
    });

    const handleFray = (e: any) => {
      const intensity = e.detail?.intensity || 0.5;
      console.log('[GroundView] STOCHASTIC FRAY DETECTED', intensity);
      // Boost fraying uniform temporarily
      if (materialRef.current) {
        materialRef.current.uniforms.frayingAmount.value = 0.3 + (intensity * 0.5);
        // Decay logic needs to happen in useFrame or set a timeout to reset
        setTimeout(() => {
          if (materialRef.current) materialRef.current.uniforms.frayingAmount.value = 0.3;
        }, 5000);
      }
    };
    window.addEventListener('STOCHASTIC_FRAY', handleFray);

    // 6. Network Flux (Data Flash)
    const handleFlux = (e: any) => {
      // Trigger Flash
      if (materialRef.current) {
        materialRef.current.uniforms.u_data_influx.value = 1.0;
      }
    };
    window.addEventListener('FLUX_PACKET', handleFlux);

    return () => {
      window.removeEventListener('NEWS_SHOCK', handleNewsShock);
      window.removeEventListener('PHYSICS_PAUSE_REQUEST', handlePause);
      window.removeEventListener('PHYSICS_RESUME_REQUEST', handleResume);
      window.removeEventListener('STOCHASTIC_FRAY', handleFray);
      window.removeEventListener('FLUX_PACKET', handleFlux);
      unsubNews();
      unsubRisk();
      unsubRisk();
      unsubViscosity();
    };
  }, [worker]); // Re-bind if worker changes

  // Eco-Regime Opacity
  useEffect(() => {
    const unsubEco = store.subscribe('system.eco.opacity', (val) => {
      if (typeof val.val === 'number') setEcoOpacity(val.val);
    });
    return () => unsubEco();
  }, []);

  useFrame((state, delta) => {
    // Sync Geometry from SharedArrayBuffer
    if (geometry && (window as any).latticeSharedBuffer) {
      const positions = (window as any).latticeSharedBuffer as Float32Array;
      const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;

      if (positionAttribute && positionAttribute.array &&
        positions.length === positionAttribute.array.length) {
        positionAttribute.array.set(positions);
        positionAttribute.needsUpdate = true;
        geometry.computeVertexNormals();
      }
    }

    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.tension.value = tension;

      // Parallax Opacity Logic
      // Calculate velocity
      const currentPointer = state.pointer;
      const velocity = currentPointer.distanceTo(prevPointer.current) / delta;
      prevPointer.current.copy(currentPointer);

      // Threshold: 2.0 (arbitrary speed unit)
      // If velocity > 2.0 -> Scanning -> High opacity (Glass)
      // If velocity < 0.1 -> Studying -> Low opacity (Wireframe)
      // Smooth interpolation would be ideal but we need a uniform 'uOpacity'.
      // LatticeMaterial doesn't have transparency prop exposed easily yet (defines shader).
      // We'll set 'frayingAmount' as a proxy for now? No, 'glowIntensity'.

      const targetGlow = velocity > 2.0 ? 2.0 : 1.0;
      // Lerp glow
      materialRef.current.uniforms.glowIntensity.value += (targetGlow - materialRef.current.uniforms.glowIntensity.value) * 0.1;

      // Influx Decay (White Flash)
      if (materialRef.current.uniforms.u_data_influx.value > 0.0) {
        materialRef.current.uniforms.u_data_influx.value *= 0.9; // Fast decay
        if (materialRef.current.uniforms.u_data_influx.value < 0.01) {
          materialRef.current.uniforms.u_data_influx.value = 0.0;
        }
      }

      if (shockwaveTime > 0.0) {
        const newTime = shockwaveTime + delta * 0.5;
        if (newTime > 1.5) {
          setShockwaveTime(0.0);
          setIsCommitting(false);
          materialRef.current.uniforms.uShockwaveTime.value = 0.0;
        } else {
          setShockwaveTime(newTime);
          materialRef.current.uniforms.uShockwaveTime.value = newTime;
          // Pass shock color via uniform? Or hardcode 'Electric Yellow' if shockType == 'news'.
          // I didn't add uShockColor to lattice_frag yet.
          // For now, let's stick to Gold for Commit.
          // If I want Electric Yellow, I need to update shader.
        }
      }
    }
  });

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      {/* @ts-ignore */}
      <latticeMaterial
        ref={materialRef}
        tension={tension}
        time={0.0}
        noiseScale={1.0}
        glowColor={new THREE.Color(0.2, 0.5, 1.0)}
        glowIntensity={1.0}
        frayingAmount={0.3}
        uShockwaveTime={0.0}
        u_data_influx={0.0}
        u_integrity={1.0}
        transparent={true}
        opacity={ecoOpacity}
      />
    </mesh>
  );
}

/**
 * Focus indicator component for when lattice is active
 */
function FocusIndicator({ isFocused }: { isFocused: boolean }) {
  if (!isFocused) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        padding: '8px 16px',
        backgroundColor: 'rgba(0, 170, 255, 0.15)',
        border: '1px solid rgba(0, 170, 255, 0.4)',
        borderRadius: '4px',
        color: 'rgba(0, 170, 255, 0.9)',
        fontSize: '0.75rem',
        fontFamily: "'IBM Plex Mono', monospace",
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        zIndex: 100
      }}
    >
      LATTICE FOCUS
    </div>
  );
}

export function GroundView({
  tension = 0.0,
  onFocusChange
}: {
  tension?: number;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [widgets, setWidgets] = useState<{ id: number; type: string; position: [number, number, number] }[]>([]);

  // Eco-Regime State
  const [dpr, setDpr] = useState(2.0); // Default to Retina
  const [frameloop, setFrameloop] = useState<'always' | 'demand' | 'never'>('always');
  const [opacity, setOpacity] = useState(1.0);

  useEffect(() => {
    // Subscribe to Eco Config
    const unsubDpr = store.subscribe('system.eco.dpr', (val) => setDpr(val.val as number));
    const unsubLoop = store.subscribe('system.eco.frameloop', (val) => setFrameloop(val.val as any));
    const unsubOp = store.subscribe('system.eco.opacity', (val) => setOpacity(val.val as number));

    return () => {
      unsubDpr();
      unsubLoop();
      unsubOp();
    };
  }, []);
  useEffect(() => {
    const unsub = dragController.onDrop((type, pos) => {
      if (!type) return;
      console.log('[GroundView] Spawning widget:', type, pos);
      setWidgets(prev => [
        ...prev,
        { id: Date.now(), type, position: pos }
      ]);
    });
    return () => { unsub(); };
  }, []);

  const handleMouseEnter = () => {
    setIsFocused(true);
    onFocusChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsFocused(false);
    onFocusChange?.(false);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        opacity: opacity,
        transition: 'opacity 1s ease-in-out'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-lattice-view="ground"
    >
      <Canvas
        dpr={dpr}
        frameloop={frameloop}
        orthographic
        camera={{ position: [100, 100, 100], zoom: 20, near: 0.1, far: 1000 }}
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1.0} />
        <pointLight position={[-50, 50, -50]} intensity={0.3} color="#00F3FF" />

        {/* Volumetric Lattice Terrain */}
        <TerrainMesh />

        <LatticeMesh tension={tension} positionsBuffer={null} />
        <RiskTerrain riskLevel={1.5} />
        <DragGhost />

        {widgets.map(w => (
          <group key={w.id} position={w.position}>
            {/* Placeholder simulation for now, or FactorCube if available */}
            {w.type === 'VOL_CUBE' ? (
              <mesh position={[0, 0, 0.5]}>
                <boxGeometry args={[0.8, 0.8, 0.8]} />
                <meshStandardMaterial color="#00FFC8" metalness={0.8} roughness={0.2} />
              </mesh>
            ) : (
              <mesh position={[0, 0, 0.5]}>
                <sphereGeometry args={[0.4, 32, 32]} />
                <meshStandardMaterial color="#FFAA00" metalness={0.5} roughness={0.2} />
              </mesh>
            )}
          </group>
        ))}
      </Canvas>

      <FocusIndicator isFocused={isFocused} />
    </div>
  );
}
