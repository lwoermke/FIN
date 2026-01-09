/**
 * [Phase 7.8] Heartbeat (System Process Watchdog)
 * 
 * Monitors vital signs of system workers (Physics, Integrity).
 * - Sends 1Hz PING.
 * - Expects PONG.
 * - Auto-Resuscitation on cardiac arrest (>3s hang).
 * - GC on Memory Pressure (>800MB).
 */

type WorkerID = string;

interface WorkerHandle {
    id: WorkerID;
    worker: Worker;
    lastPong: number;
    respawnCallback: () => Worker; // Function to recreate the worker
}

export class Heartbeat {
    private static handles: Map<WorkerID, WorkerHandle> = new Map();
    private static interval: number | null = null;
    private static MEMORY_WARNING_THRESHOLD = 800 * 1024 * 1024; // 800MB

    /**
     * Start the pacemaker
     */
    static init() {
        if (this.interval) return;

        this.interval = window.setInterval(() => this.pulse(), 1000);
        console.log('[FIN] Heartbeat: Pacemaker Active (1000ms)');
    }

    /**
     * Register a worker for monitoring
     */
    static register(id: WorkerID, worker: Worker, respawnCallback: () => Worker) {
        this.handles.set(id, {
            id,
            worker,
            lastPong: Date.now(),
            respawnCallback
        });

        // Attach Pong Listener
        this.attachListener(worker, id);
    }

    /**
     * Unregister to stop monitoring
     */
    static unregister(id: WorkerID) {
        this.handles.delete(id);
    }

    /**
     * Internal: Attach PONG listener
     */
    private static attachListener(worker: Worker, id: WorkerID) {
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'PONG') {
                const handle = this.handles.get(id);
                if (handle) {
                    handle.lastPong = Date.now();
                }
            }
        };
        worker.addEventListener('message', handleMessage);
    }

    /**
     * The Tick
     */
    private static pulse() {
        const now = Date.now();

        // 1. Monitor Workers
        this.handles.forEach((handle, id) => {
            // Check Death
            if (now - handle.lastPong > 3000) {
                console.error(`[Heartbeat] CARDIAC ARREST DETECTED on ${id}. Resuscitating...`);
                this.resuscitate(id);
                return;
            }

            // Send Ping
            handle.worker.postMessage({ type: 'PING', timestamp: now });
        });

        // 2. Monitor Memory
        if ((performance as any).memory) {
            const used = (performance as any).memory.usedJSHeapSize;
            if (used > this.MEMORY_WARNING_THRESHOLD) {
                console.warn(`[Heartbeat] MEMORY PRESSURE: ${(used / 1024 / 1024).toFixed(0)}MB`);
                this.triggerGC();
            }
        }
    }

    /**
     * Emergency Reboot of a Worker
     */
    private static resuscitate(id: WorkerID) {
        const handle = this.handles.get(id);
        if (!handle) return;

        // 1. Kill
        handle.worker.terminate();

        // 2. Respawn
        const newWorker = handle.respawnCallback();

        // 3. Update Handle
        handle.worker = newWorker;
        handle.lastPong = Date.now();
        this.attachListener(newWorker, id);

        // 4. Update MapRef
        this.handles.set(id, handle);

        // 5. Visual Feedback (System Glitch)
        window.dispatchEvent(new CustomEvent('SYSTEM_GLITCH', {
            detail: { intensity: 1.0, duration: 200 }
        }));
    }

    /**
     * Force cleanup of caches
     */
    private static triggerGC() {
        // Dispatch event for Store to prune old keys
        window.dispatchEvent(new CustomEvent('SYSTEM_GC'));
    }
}

// Auto-init
Heartbeat.init();
