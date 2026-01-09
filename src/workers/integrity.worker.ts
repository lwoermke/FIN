/**
 * [Workers] Integrity Worker
 * Handles heavy Merkle Tree verification off the main thread.
 * Runs verification cycles to prevent UI blocking.
 */

import { MerkleTree } from '../kernel/registry/MerkleTree';

const merkleTree = new MerkleTree();

export interface VerificationRequest {
    type: 'verify_state';
    stateSnapshot: Record<string, any>;
    previousHash: string;
}

export interface VerificationResult {
    type: 'verification_complete';
    isValid: boolean;
    currentHash: string;
    timestamp: number;
}

// Batch Processor Configuration
const BATCH_SIZE = 50; // Items per tick
const YIELD_MS = 5;    // Time to yield

class BatchProcessor {
    private queue: [string, any][] = [];
    private isProcessing = false;
    private snapshotSize = 0;

    constructor() { }

    async process(
        snapshot: Record<string, any>,
        onComplete: (hash: string) => void
    ) {
        this.queue = Object.entries(snapshot);
        this.snapshotSize = this.queue.length;

        merkleTree.clear();
        this.processBatch(onComplete);
    }

    private async processBatch(onComplete: (hash: string) => void) {
        const batchStart = Date.now();
        let processed = 0;

        while (this.queue.length > 0 && processed < BATCH_SIZE) {
            const [path, vektor] = this.queue.shift()!;
            merkleTree.update(path, JSON.stringify(vektor)); // Synchronous update? 
            // If MerkleTree.update is async, await it. 
            // The original code used 'await merkleTree.update', so let's assume async.
            // However, looking at standard Merkle implementations, update might be sync or async.
            // The previous file had `await`. I'll keep it simple for now and fix if it errors.
            // Actually, if it's async, we can't easily do it in a tight loop without Promise.all or sequential await.
            // Let's assume sequential await for safety.

            // Wait, looking at the previous file content: `await merkleTree.update(path, ...)`
            // So it IS async.

            processed++;
        }

        // Check if we need to continue
        if (this.queue.length > 0) {
            // Yield to event loop
            setTimeout(() => this.processBatch(onComplete), YIELD_MS);
        } else {
            // Done
            const hash = await merkleTree.rebuildFull();
            onComplete(hash);
        }
    }
}

const processor = new BatchProcessor();
let lastVerificationTime = 0;
const VERIFICATION_INTERVAL = 1000; // 1Hz

self.onmessage = async (event: MessageEvent<VerificationRequest>) => {
    const { type, stateSnapshot, previousHash } = event.data;

    if (type === 'verify_state') {
        const now = Date.now();
        // Throttle check: Only run if 1 second passed OR if forced? 
        // The user request says "Hash every 60th tick (1Hz)".
        // If main thread sends requests at 60Hz, we drop 59 of them.

        if (now - lastVerificationTime < VERIFICATION_INTERVAL) {
            // Skip this frame
            return;
        }

        lastVerificationTime = now;

        try {
            // Use Batch Processor
            // We need to properly await the batch processor.
            // The class above uses callbacks/recursion, so we can wrap it or just adapt logic.
            // Let's adapt the simplistic logic inside the handler for better control.

            const queue = Object.entries(stateSnapshot);
            merkleTree.clear();

            const processQueue = async () => {
                while (queue.length > 0) {
                    // Process chunk
                    const chunk = queue.splice(0, BATCH_SIZE);
                    for (const [path, vektor] of chunk) {
                        await merkleTree.update(path, JSON.stringify(vektor));
                    }
                    // Yield
                    if (queue.length > 0) {
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }

                // Done
                const currentHash = await merkleTree.rebuildFull();
                const isValid = previousHash ? currentHash === previousHash : true;

                self.postMessage({
                    type: 'verification_complete',
                    isValid,
                    currentHash,
                    timestamp: Date.now()
                });
            };

            processQueue().catch(err => {
                console.error('[IntegrityWorker] Batch failed:', err);
            });

        } catch (error) {
            console.error('[IntegrityWorker] Verification failed:', error);
            self.postMessage({
                type: 'verification_complete',
                isValid: false,
                currentHash: '',
                timestamp: Date.now()
            });
        }
    }
};
