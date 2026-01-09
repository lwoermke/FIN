/**
 * [Phase 9.1] Memory Janitor
 * Responsible for object pooling, state pruning, and explicit resource disposal.
 * 
 * "Never create what you can reuse. Never keep what you cannot justify."
 */

import * as THREE from 'three';
import { store } from '../registry/Store.js';
import { CryoStorage } from '../../intelligence/ingest/CryoStorage.js';

/**
 * Vector3 Object Pool
 * Prevents GC pressure by reusing Vector3 instances in high-frequency loops.
 */
class VectorPool {
    private pool: THREE.Vector3[] = [];
    private activeCount = 0;

    constructor(initialSize = 100) {
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(new THREE.Vector3());
        }
    }

    /**
     * Get a vector from the pool. 
     * IMPORTANT: Must return it back to the pool after use!
     */
    get(): THREE.Vector3 {
        if (this.activeCount < this.pool.length) {
            const v = this.pool[this.activeCount++];
            v.set(0, 0, 0);
            return v;
        }
        // Expand pool if needed (but warn as it indicates a leak or under-provisioning)
        console.warn('[Janitor] VectorPool exhausted. Expanding by 10 units.');
        for (let i = 0; i < 10; i++) {
            this.pool.push(new THREE.Vector3());
        }
        return this.get();
    }

    /**
     * Resets the active count. Call this at the end of a frame or loop cycle.
     */
    reset() {
        this.activeCount = 0;
    }
}

/**
 * Memory Janitor Service
 */
export class Janitor {
    public static vectors = new VectorPool(500);
    private static pruneInterval: any = null;

    /**
     * Initialize background maintenance
     */
    static boot() {
        if (this.pruneInterval) return;

        console.log('[Janitor] Service Booted.');
        this.pruneInterval = setInterval(() => this.conductAudit(), 60000); // Every minute
    }

    /**
     * Explicitly dispose of WebGL resources
     */
    static dispose(obj: any) {
        if (!obj) return;

        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach((m: any) => m.dispose());
            } else {
                obj.material.dispose();
            }
        }
        if (obj.dispose && typeof obj.dispose === 'function') {
            obj.dispose();
        }
    }

    /**
     * Scan Store for stale Vektors and move to CryoStorage
     */
    private static async conductAudit() {
        const size = store.size();
        if (size < 10000) return;

        console.log(`[Janitor] Auditing Store (${size} Vektors)...`);

        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        const snapshot = store.getSnapshot();
        const staleKeys: string[] = [];

        snapshot.forEach((vektor, path) => {
            // Check timestamp from Traceable metadata
            if (vektor.time < oneHourAgo) {
                staleKeys.push(path);
            }
        });

        if (staleKeys.length > 0) {
            console.log(`[Janitor] Pruning ${staleKeys.length} stale Vektors to CryoStorage.`);

            for (const key of staleKeys) {
                const vektor = store.get(key);
                if (vektor) {
                    // Move to IndexedDB
                    await CryoStorage.store(key, vektor, 'GENERIC');
                    // Delete from RAM
                    store.delete(key);
                }
            }

            // Attempt to trigger GC if exposed
            if ((window as any).gc) {
                (window as any).gc();
            }
        }
    }

    static shutdown() {
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
            this.pruneInterval = null;
        }
    }
}
