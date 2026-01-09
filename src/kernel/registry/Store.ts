/**
 * [1.1] The Central Subscriber
 * Registry-First Doctrine: Every visual element is a reactive subscriber to this central Store.
 * 
 * Implements Observer pattern for state atomicity across the entire system.
 */

import type { Traceable } from './Vektor.js';

/**
 * Subscriber callback function type
 * @template T The type of the value being observed
 */
export type Subscriber<T> = (vektor: Traceable<T>, path: string) => void;

/**
 * Unsubscribe function returned when subscribing
 */
export type Unsubscribe = () => void;

/**
 * Central Registry Store implementing Observer pattern
 * Maintains atomic state and notifies all subscribers of changes
 */
class Store {
  private state: Map<string, Traceable<unknown>> = new Map();
  private subscribers: Map<string, Set<Subscriber<unknown>>> = new Map();
  private globalSubscribers: Set<Subscriber<unknown>> = new Set();

  // Dirty flag for Commit Safety
  public isDirty: boolean = false;

  /**
   * Sets a value in the store at the given path
   * @template T The type of the value
   * @param path The registry path (e.g., "kernel.registry.price")
   * @param vektor The Traceable<T> object to store
   */
  set<T>(path: string, vektor: Traceable<T>): void {
    // ------------------------------------------------------------
    // SAFETY VALVE (Null-State Physics)
    // ------------------------------------------------------------

    // 1. Mock Detection (Strict Real Data Policy)
    const forbidden = /mock|random|simulated/i;
    if (forbidden.test(vektor.src) && !path.includes('test')) {
      // We allow 'test' paths for unit testing, but not general logic
      console.error(`[FATAL] SYSTEM HALT. Mock Data Detected: ${vektor.src}`);
      throw new Error(`CRITICAL_INTEGRITY_FAILURE: Mock Data from ${vektor.src} rejected.`);
    }

    // 2. NaN Detection (Null Vektor)
    if (typeof vektor.val === 'number' && Number.isNaN(vektor.val)) {
      console.warn(`[FIN] Null State Detected at ${path}. Severing Link.`);
      // Mutate to NullVektor structure (preserving metadata)
      (vektor as any).status = 'SEVERED';
      (vektor as any).conf = [0, 0];
    }

    const previous = this.state.get(path);
    this.state.set(path, vektor as Traceable<unknown>);
    this.isDirty = true;

    // Notify path-specific subscribers
    const pathSubscribers = this.subscribers.get(path);
    if (pathSubscribers) {
      pathSubscribers.forEach(subscriber => {
        subscriber(vektor as Traceable<unknown>, path);
      });
    }

    // Notify global subscribers
    this.globalSubscribers.forEach(subscriber => {
      subscriber(vektor as Traceable<unknown>, path);
    });
  }

  /**
   * Gets a value from the store at the given path
   * @template T The type of the value
   * @param path The registry path
   * @returns The Traceable<T> object or undefined if not found
   */
  get<T>(path: string): Traceable<T> | undefined {
    return this.state.get(path) as Traceable<T> | undefined;
  }

  /**
   * Gets the raw value (unwrapped from Traceable) at the given path
   * @template T The type of the value
   * @param path The registry path
   * @returns The raw value or undefined if not found
   */
  getValue<T>(path: string): T | undefined {
    const vektor = this.get<T>(path);
    return vektor?.val;
  }

  /**
   * Checks if a path exists in the store
   * @param path The registry path
   * @returns True if the path exists
   */
  has(path: string): boolean {
    return this.state.has(path);
  }

  /**
   * Deletes a value from the store
   * @param path The registry path
   * @returns True if the path was deleted
   */
  delete(path: string): boolean {
    const existed = this.state.delete(path);
    if (existed) {
      this.isDirty = true;
      // Notify subscribers of deletion
      const pathSubscribers = this.subscribers.get(path);
      if (pathSubscribers) {
        pathSubscribers.forEach(subscriber => {
          subscriber({} as Traceable<unknown>, path);
        });
      }
    }
    return existed;
  }

  /**
   * Subscribes to changes at a specific path
   * @template T The type of the value
   * @param path The registry path to observe
   * @param subscriber The callback function
   * @returns Unsubscribe function
   */
  subscribe<T>(path: string, subscriber: Subscriber<T>): Unsubscribe {
    if (!this.subscribers.has(path)) {
      this.subscribers.set(path, new Set());
    }

    const subscriberSet = this.subscribers.get(path)!;
    subscriberSet.add(subscriber as Subscriber<unknown>);

    // Immediately notify with current value if it exists
    const current = this.get<T>(path);
    if (current) {
      subscriber(current, path);
    }

    // Return unsubscribe function
    return () => {
      subscriberSet.delete(subscriber as Subscriber<unknown>);
      if (subscriberSet.size === 0) {
        this.subscribers.delete(path);
      }
    };
  }

  /**
   * Subscribes to all changes in the store
   * @template T The type of the value
   * @param subscriber The callback function
   * @returns Unsubscribe function
   */
  subscribeAll<T>(subscriber: Subscriber<T>): Unsubscribe {
    this.globalSubscribers.add(subscriber as Subscriber<unknown>);

    // Immediately notify with all current values
    this.state.forEach((vektor, path) => {
      subscriber(vektor as unknown as Traceable<T>, path);
    });

    // Return unsubscribe function
    return () => {
      this.globalSubscribers.delete(subscriber as Subscriber<unknown>);
    };
  }

  /**
   * Gets all paths in the store
   * @returns Array of all registry paths
   */
  getAllPaths(): string[] {
    return Array.from(this.state.keys());
  }

  /**
   * Gets the entire state as a snapshot
   * @returns Map of all path-value pairs
   */
  getSnapshot(): Map<string, Traceable<unknown>> {
    const snap = new Map(this.state);
    // Note: We don't auto-reset isDirty here; explicit commit should do it.
    return snap;
  }

  /**
   * Resets the dirty flag (called after successful Commit/Merkle Seal)
   */
  markClean(): void {
    this.isDirty = false;
  }

  /**
   * Clears all state and subscribers
   * Use with caution - this will reset the entire registry
   */
  clear(): void {
    this.state.clear();
    this.subscribers.clear();
    this.globalSubscribers.clear();
  }

  /**
   * Gets the number of registered paths
   * @returns Count of registered paths
   */
  size(): number {
    return this.state.size;
  }

  /**
   * Accepts a Vektor stream and stores it at the given path
   * Automatically routes based on source and handles exogenous markers
   * @template T The type of the value
   * @param path The registry path (e.g., "intelligence.ingest.price")
   * @param vektor The Traceable<T> object to store
   * @param autoRoute Whether to automatically route based on source (default true)
   */
  acceptVektorStream<T>(
    path: string,
    vektor: Traceable<T>,
    autoRoute: boolean = true
  ): void {
    // Check if this is a Dead Signal (conf: [0, 0])
    if (vektor.conf[0] === 0 && vektor.conf[1] === 0) {
      console.warn(`[FIN] Store: Dead Signal received at ${path} from ${vektor.src}`);
      // Still store it, but mark as dead signal
      this.set(path, vektor);
      return;
    }

    // Auto-route based on source if enabled
    if (autoRoute) {
      // Check for exogenous type marker
      const isExogenous = 'type' in vektor && (vektor as any).type === 'exogenous';

      // Route to appropriate block path
      const blockPath = isExogenous
        ? `intelligence.blocks.exogenous.${path}`
        : `intelligence.blocks.endogenous.${path}`;

      // Store in both original path and block path
      this.set(path, vektor);
      this.set(blockPath, vektor);
    } else {
      // Just store at the given path
      this.set(path, vektor);
    }
  }

  /**
   * Accepts multiple Vektor streams in batch
   * @param vektors Array of { path, vektor } tuples
   * @param autoRoute Whether to automatically route based on source
   */
  acceptVektorStreams(
    vektors: Array<{ path: string; vektor: Traceable<unknown> }>,
    autoRoute: boolean = true
  ): void {
    for (const { path, vektor } of vektors) {
      this.acceptVektorStream(path, vektor, autoRoute);
    }
  }

  /**
   * Subscribes to Vektor streams from a specific source
   * @template T The type of the value
   * @param source Source identifier (e.g., "YFINANCE_API")
   * @param subscriber Callback function
   * @returns Unsubscribe function
   */
  subscribeToSource<T>(source: string, subscriber: Subscriber<T>): Unsubscribe {
    // Subscribe to all paths and filter by source
    return this.subscribeAll((vektor, path) => {
      if (vektor.src === source) {
        subscriber(vektor as unknown as Traceable<T>, path);
      }
    });
  }

  /**
   * Gets all Vektors from a specific source
   * @param source Source identifier
   * @returns Array of { path, vektor } tuples
   */
  getVektorsBySource(source: string): Array<{ path: string; vektor: Traceable<unknown> }> {
    const results: Array<{ path: string; vektor: Traceable<unknown> }> = [];

    this.state.forEach((vektor, path) => {
      if (vektor.src === source) {
        results.push({ path, vektor });
      }
    });

    return results;
  }

  /**
   * Gets all Vektors in a specific block (endogenous or exogenous)
   * @param block Block identifier ("endogenous" or "exogenous")
   * @returns Array of { path, vektor } tuples
   */
  getVektorsByBlock(block: 'endogenous' | 'exogenous'): Array<{ path: string; vektor: Traceable<unknown> }> {
    const results: Array<{ path: string; vektor: Traceable<unknown> }> = [];
    const blockPrefix = `intelligence.blocks.${block}.`;

    this.state.forEach((vektor, path) => {
      if (path.startsWith(blockPrefix)) {
        results.push({ path, vektor });
      }
    });

    return results;
  }
}

// Export singleton instance
export const store = new Store();
