/**
 * [Phase 0.1] Sequential Bootloader
 * 
 * Orchestrates system initialization in a strict, defensive sequence.
 * Ensures critical sub-systems are healthy before rendering the UI.
 */

import { store } from '../kernel/registry/Store';

export interface BootStep {
    id: string;
    label: string;
    action: () => Promise<void>;
}

export class BootLoader {
    private static steps: BootStep[] = [
        {
            id: 'registry',
            label: 'Registry: Syncing System Store',
            action: async () => {
                // Ensure store exists and is accessible
                if (!store) throw new Error('Global Store unavailable');
                // Potential initial population or sync check
            }
        },
        {
            id: 'storage',
            label: 'Storage: Unlocking IndexedDB Vault',
            action: async () => {
                const { isIndexedDBAvailable } = await import('../kernel/security/IndexedDBEnc');
                if (!isIndexedDBAvailable()) throw new Error('IndexedDB not supported in this environment');

                // Try to open connection (implicitly) or check availability
                const dbOpen = await new Promise((resolve) => {
                    const req = indexedDB.open('FIN_BOOT_TEST', 1);
                    req.onsuccess = () => {
                        indexedDB.deleteDatabase('FIN_BOOT_TEST');
                        resolve(true);
                    };
                    req.onerror = () => resolve(false);
                });

                if (!dbOpen) throw new Error('Persistence block: Storage access denied');
            }
        },
        {
            id: 'physics',
            label: 'Physics: Verifying Worker Heartbeat',
            action: async () => {
                // We create a temporary worker to check the loop reliability
                const worker = new Worker(
                    new URL('../workers/physics.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                const pingTime = Date.now();
                const pong = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('PhysicsWorker Timeout: Heartbeat failed')), 3000);
                    worker.onmessage = (e) => {
                        if (e.data.type === 'PONG') {
                            clearTimeout(timeout);
                            resolve(true);
                        }
                    };
                    worker.onerror = (e) => reject(new Error('PhysicsWorker Crash during handshake'));
                    worker.postMessage({ type: 'PING', data: { timestamp: pingTime } });
                });

                worker.terminate();
                if (!pong) throw new Error('Physics Thread stalled');
            }
        },
        {
            id: 'gpu',
            label: 'GPU: Hardware Handshake (Retina Sync)',
            action: async () => {
                const { performHardwareHandshake } = await import('./hardware_handshake');
                await performHardwareHandshake();
            }
        }
    ];

    /**
     * Executes the sequence and returns diagnostic log or throws on halt.
     */
    static async runSequence(onLog: (msg: string) => void): Promise<void> {
        for (const step of this.steps) {
            onLog(`[REACTIVE] Executing ${step.label}...`);
            try {
                await step.action();
                onLog(`[OK] ${step.id.toUpperCase()} initialized.`);
            } catch (err: any) {
                console.error(`[BOOT_HALT] ${step.id}:`, err);
                throw new Error(`${step.label} FAILED: ${err.message}`);
            }
        }
    }
}
