/**
 * [3.1] Lattice-Fabric Logic
 * Spring-Mass system for lattice threads.
 * 
 * The Lattice is the fundamental material of the 2.5D world.
 * Every visual element is constructed by re-routing existing threads of the space-fabric.
 */

/**
 * 3D position vector
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Lattice node with position, velocity, and mass
 */
export interface LatticeNode {
  /** Node identifier */
  id: number;
  /** Current position */
  position: Vector3;
  /** Current velocity */
  velocity: Vector3;
  /** Mass of the node */
  mass: number;
  /** Whether this node is pinned (fixed position) */
  pinned: boolean;
}

/**
 * Thread connecting two nodes
 */
export interface Thread {
  /** Index of first node */
  nodeA: number;
  /** Index of second node */
  nodeB: number;
  /** Rest length of the spring */
  restLength: number;
  /** Spring stiffness constant */
  stiffness: number;
  /** Damping coefficient */
  damping: number;
}

/**
 * Spring-Mass system for lattice dynamics
 */
export class MeshDynamics {
  private nodes: LatticeNode[] = [];
  private threads: Thread[] = [];
  private timeStep: number = 0.016; // ~60fps default
  private gravity: number = 0.0; // Gravity from environment.ts (can be overridden)

  /**
   * Creates a new MeshDynamics system
   * @param gravity Gravity constant (default 0, can be set from environment)
   */
  constructor(gravity: number = 0.0) {
    this.gravity = gravity;
  }

  /**
   * Adds a node to the system
   * @param position Initial position
   * @param mass Node mass
   * @param pinned Whether the node is fixed
   * @returns The node ID
   */
  addNode(
    position: Vector3,
    mass: number = 1.0,
    pinned: boolean = false
  ): number {
    const id = this.nodes.length;
    this.nodes.push({
      id,
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      mass,
      pinned
    });
    return id;
  }

  /**
   * Adds a thread (spring) connecting two nodes
   * @param nodeA Index of first node
   * @param nodeB Index of second node
   * @param stiffness Spring stiffness
   * @param damping Damping coefficient
   */
  addThread(
    nodeA: number,
    nodeB: number,
    stiffness: number = 100.0,
    damping: number = 0.1
  ): void {
    if (nodeA >= this.nodes.length || nodeB >= this.nodes.length) {
      throw new Error('Invalid node indices');
    }

    const posA = this.nodes[nodeA].position;
    const posB = this.nodes[nodeB].position;
    const dx = posB.x - posA.x;
    const dy = posB.y - posA.y;
    const dz = posB.z - posA.z;
    const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

    this.threads.push({
      nodeA,
      nodeB,
      restLength,
      stiffness,
      damping
    });
  }

  /**
   * Calculates spring force between two nodes
   * @param thread The thread connecting the nodes
   * @returns Force vector on nodeA (force on nodeB is opposite)
   */
  private calculateSpringForce(thread: Thread): Vector3 {
    const nodeA = this.nodes[thread.nodeA];
    const nodeB = this.nodes[thread.nodeB];

    if (!nodeA || !nodeB) {
      return { x: 0, y: 0, z: 0 };
    }

    const dx = nodeB.position.x - nodeA.position.x;
    const dy = nodeB.position.y - nodeA.position.y;
    const dz = nodeB.position.z - nodeA.position.z;

    const currentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const displacement = currentLength - thread.restLength;

    // Spring force: F = -k * (L - L0)
    const forceMagnitude = -thread.stiffness * displacement;

    // Normalize direction vector
    if (currentLength < 0.0001) {
      return { x: 0, y: 0, z: 0 };
    }

    const nx = dx / currentLength;
    const ny = dy / currentLength;
    const nz = dz / currentLength;

    // Damping: F_damp = -c * (v_rel · n) * n
    const vRelX = nodeB.velocity.x - nodeA.velocity.x;
    const vRelY = nodeB.velocity.y - nodeA.velocity.y;
    const vRelZ = nodeB.velocity.z - nodeA.velocity.z;
    const vRelDotN = vRelX * nx + vRelY * ny + vRelZ * nz;
    const dampingForce = -thread.damping * vRelDotN;

    const totalForce = forceMagnitude + dampingForce;

    return {
      x: totalForce * nx,
      y: totalForce * ny,
      z: totalForce * nz
    };
  }

  /**
   * Applies forces and updates node positions (one simulation step)
   * @param externalForces Optional map of node ID to external force vector
   */
  step(externalForces?: Map<number, Vector3>): void {
    // Initialize force accumulators
    const forces: Vector3[] = this.nodes.map(() => ({ x: 0, y: 0, z: 0 }));

    // Apply gravity
    this.nodes.forEach((node, index) => {
      if (!node.pinned) {
        forces[index].z -= this.gravity * node.mass;
      }
    });

    // Apply spring forces
    this.threads.forEach((thread) => {
      if (thread.nodeA >= forces.length || thread.nodeB >= forces.length) return;

      const force = this.calculateSpringForce(thread);
      const nodeA = this.nodes[thread.nodeA];
      const nodeB = this.nodes[thread.nodeB];

      if (nodeA && !nodeA.pinned) {
        forces[thread.nodeA].x += force.x;
        forces[thread.nodeA].y += force.y;
        forces[thread.nodeA].z += force.z;
      }

      if (nodeB && !nodeB.pinned) {
        forces[thread.nodeB].x -= force.x;
        forces[thread.nodeB].y -= force.y;
        forces[thread.nodeB].z -= force.z;
      }
    });

    // Apply external forces
    if (externalForces) {
      externalForces.forEach((force, nodeId) => {
        if (nodeId < forces.length && !this.nodes[nodeId].pinned) {
          forces[nodeId].x += force.x;
          forces[nodeId].y += force.y;
          forces[nodeId].z += force.z;
        }
      });
    }

    // Update velocities and positions (Verlet integration)
    this.nodes.forEach((node, index) => {
      if (node.pinned) {
        return;
      }

      const force = forces[index];
      const acceleration = {
        x: force.x / node.mass,
        y: force.y / node.mass,
        z: force.z / node.mass
      };

      // Update velocity: v = v + a * dt
      node.velocity.x += acceleration.x * this.timeStep;
      node.velocity.y += acceleration.y * this.timeStep;
      node.velocity.z += acceleration.z * this.timeStep;

      // Update position: x = x + v * dt
      node.position.x += node.velocity.x * this.timeStep;
      node.position.y += node.velocity.y * this.timeStep;
      node.position.z += node.velocity.z * this.timeStep;
    });
  }

  /**
   * Gets a node by ID
   * @param id Node ID
   * @returns The node or undefined
   */
  getNode(id: number): LatticeNode | undefined {
    return this.nodes[id];
  }

  /**
   * Gets all nodes
   * @returns Array of all nodes
   */
  getNodes(): LatticeNode[] {
    return [...this.nodes];
  }

  /**
   * Gets all threads
   * @returns Array of all threads
   */
  getThreads(): Thread[] {
    return [...this.threads];
  }

  /**
   * Sets the time step for simulation
   * @param dt Time step in seconds
   */
  setTimeStep(dt: number): void {
    this.timeStep = dt;
  }

  /**
   * Gets the current time step
   * @returns Time step in seconds
   */
  getTimeStep(): number {
    return this.timeStep;
  }

  /**
   * Sets gravity constant
   * @param g Gravity value
   */
  setGravity(g: number): void {
    this.gravity = g;
  }

  /**
   * Exports node positions as a Float32Array buffer
   * Format: [x0, y0, z0, x1, y1, z1, ...]
   * @returns Float32Array buffer
   */
  exportPositionsBuffer(): Float32Array {
    const buffer = new Float32Array(this.nodes.length * 3);
    this.nodes.forEach((node, index) => {
      const offset = index * 3;
      buffer[offset] = node.position.x;
      buffer[offset + 1] = node.position.y;
      buffer[offset + 2] = node.position.z;
    });
    return buffer;
  }

  /**
   * Imports node positions from a Float32Array buffer
   * Format: [x0, y0, z0, x1, y1, z1, ...]
   * @param buffer Float32Array buffer
   */
  importPositionsBuffer(buffer: Float32Array): void {
    const nodeCount = Math.min(buffer.length / 3, this.nodes.length);
    for (let i = 0; i < nodeCount; i++) {
      const offset = i * 3;
      if (!this.nodes[i].pinned) {
        this.nodes[i].position.x = buffer[offset];
        this.nodes[i].position.y = buffer[offset + 1];
        this.nodes[i].position.z = buffer[offset + 2];
      }
    }
  }

  /**
   * Clears all nodes and threads
   */
  clear(): void {
    this.nodes = [];
    this.threads = [];
  }
}

