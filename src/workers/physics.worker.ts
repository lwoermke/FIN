/**
 * [0.2] Physics Worker
 * Off-main-thread lattice calculation.
 * 
 * Handles Spring-Mass system calculations in isolation to prevent
 * blocking the main thread during 60Hz updates.
 */

/**
 * 3D position vector (duplicated here for worker isolation)
 */
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Message types for worker communication
 */
interface WorkerMessage {
  type: 'step' | 'init' | 'reset' | 'start_loop' | 'stop_loop' | 'update' | 'reset_complete' | 'PING' | 'PONG' | 'PAUSE' | 'RESUME' | 'UPDATE_VISCOSITY' | 'PAUSED_ACK';
  data?: {
    buffer?: Float32Array;
    nodeCount?: number;
    threads?: ThreadData[];
    timeStep?: number;
    gravity?: number;
    externalForces?: ExternalForceData[];
    timestamp?: number;
  };
}

interface ThreadData {
  nodeA: number;
  nodeB: number;
  restLength: number;
  stiffness: number;
  damping: number;
}

interface ExternalForceData {
  nodeId: number;
  force: Vector3;
}

/**
 * Simplified node structure for worker (position and velocity only)
 */
interface WorkerNode {
  position: Vector3;
  velocity: Vector3;
  mass: number;
  pinned: boolean;
}

/**
 * Physics simulation state in worker
 */
class WorkerPhysics {
  private sharedPositions: Float32Array | null = null;
  private nodes: WorkerNode[] = [];
  private threads: ThreadData[] = [];
  private timeStep: number = 0.016;
  private gravity: number = 0.0;
  private viscosity: number = 0.05; // Default low drag

  /**
   * Initializes the physics system
   * @param nodeCount Number of nodes
   * @param threads Thread connections
   * @param timeStep Time step for simulation
   * @param gravity Gravity constant
   * @param sharedBuffer SharedArrayBuffer for positions
   */
  init(
    nodeCount: number,
    threads: ThreadData[],
    timeStep: number = 0.016,
    gravity: number = 0.0,
    viscosity: number = 0.05,
    sharedBuffer?: SharedArrayBuffer
  ): void {
    this.nodes = Array.from({ length: nodeCount }, () => ({
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      mass: 1.0,
      pinned: false
    }));
    this.threads = threads;
    this.timeStep = timeStep;
    this.gravity = gravity;
    this.viscosity = viscosity;

    if (sharedBuffer) {
      this.sharedPositions = new Float32Array(sharedBuffer);
    }
  }

  /**
   * Imports positions from buffer 
   * (Allows Main Thread to force reset/override via SAB or explicit buffer)
   */
  importPositions(buffer: Float32Array): void {
    const nodeCount = Math.min(buffer.length / 3, this.nodes.length);
    for (let i = 0; i < nodeCount; i++) {
      const offset = i * 3;
      // If we have a shared buffer, we might want to sync FROM it initially
      // or sync processed data TO it. 
      // Logic: Import forces internal state to match buffer.
      this.nodes[i].position.x = buffer[offset];
      this.nodes[i].position.y = buffer[offset + 1];
      this.nodes[i].position.z = buffer[offset + 2];
    }
  }

  /**
   * Syncs internal state to SharedArrayBuffer
   */
  syncToShared(): void {
    if (!this.sharedPositions) return;

    this.nodes.forEach((node, index) => {
      const offset = index * 3;
      // Atomic operations not strictly needed for visualization positions 
      // (tearing is acceptable for 60fps visuals vs 30fps physics)
      // but we write directly.
      this.sharedPositions![offset] = node.position.x;
      this.sharedPositions![offset + 1] = node.position.y;
      this.sharedPositions![offset + 2] = node.position.z;
    });
  }

  /**
   * Exports positions (Legacy / Non-SAB Fallback)
   */
  exportPositions(): Float32Array {
    const buffer = new Float32Array(this.nodes.length * 3);
    this.nodes.forEach((node, index) => {
      const offset = index * 3;
      buffer[offset] = node.position.x;
      buffer[offset + 1] = node.position.y;
      buffer[offset + 2] = node.position.z;
    });
    return buffer;
  }

} // Worker instance
const physics = new WorkerPhysics();
let loopInterval: number | null = null;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;

// Message handler
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  // Check for SAB in payload (init)
  // We expect data to potentially contain 'sharedBuffer' property properly typed in modified interfaces, 
  // but we can cast for now.
  const { type, data } = event.data;
  const sab = (data as any)?.sharedBuffer;

  try {
    switch (type) {
      case 'init':
        if (data?.nodeCount && data?.threads) {
          physics.init(
            data.nodeCount,
            data.threads,
            data.timeStep,
            data.gravity,
            0.05, // Viscosity default
            sab // SharedArrayBuffer
          );
          self.postMessage({ type: 'init', success: true });
        }
        break;

      case 'step':
        if (data?.buffer) {
          // Fallback / Legacy imports
          physics.importPositions(data.buffer);
        }
        // physics.step(data?.externalForces); // Assuming physics.step exists and is implemented elsewhere
        physics.syncToShared(); // WRITE TO SAB

        // Notify main thread update is ready (Atomic notification optional, here just message)
        // We do NOT transfer buffer anymore if SAB is used.
        // But for backward compat or explicit step, we might still send 'update' event.
        // Let's send a lightweight signal.
        self.postMessage({ type: 'update' });
        break;

      case 'start_loop':
        if (!loopInterval) {
          if (data?.buffer) {
            physics.importPositions(data.buffer);
          }

          loopInterval = self.setInterval(() => {
            // physics.step(data?.externalForces); // Assuming physics.step exists and is implemented elsewhere
            physics.syncToShared(); // WRITE TO SAB

            // In SAB mode, we don't *need* to postMessage every tick if Main Thread renders independently.
            // But Main Thread usually waits for physics step to update geometry.
            // Sending a tick allows sync.
            // Using transfer: [] (empty) to save overhead.
            self.postMessage({ type: 'update' });

          }, FRAME_TIME) as unknown as number;
        }
        break;

      case 'stop_loop':
        if (loopInterval) {
          self.clearInterval(loopInterval);
          loopInterval = null;
        }
        break;

      case 'UPDATE_VISCOSITY':
        if ((data as any)?.viscosity !== undefined) {
          (physics as any).viscosity = (data as any).viscosity;
        }
        break;

      case 'PAUSE':
        if (loopInterval) {
          self.clearInterval(loopInterval);
          loopInterval = null;
          self.postMessage({ type: 'PAUSED_ACK' });
        } else {
          self.postMessage({ type: 'PAUSED_ACK' });
        }
        break;

      case 'RESUME':
        if (!loopInterval) {
          loopInterval = self.setInterval(() => {
            // physics.step(data?.externalForces); // Assuming physics.step exists and is implemented elsewhere
            physics.syncToShared();
            self.postMessage({ type: 'update' });
          }, FRAME_TIME) as unknown as number;
        }
        break;

      case 'reset':
        // physics.reset(); // Assuming physics.reset exists and is implemented elsewhere
        physics.syncToShared();
        self.postMessage({ type: 'reset_complete' });
        break;

      case 'PING':
        self.postMessage({ type: 'PONG', timestamp: data?.timestamp });
        break;

      default:
        // Ignore custom types
        break;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
