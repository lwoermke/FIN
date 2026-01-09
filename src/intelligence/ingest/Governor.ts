/**
 * [Phase 7.7] API Governor (The Dam)
 * Token Bucket Rate Limiter & Priority Queue.
 * 
 * Enforces strict quotas to prevent 429s.
 * Queues requests when tokens are empty.
 */

import type { SatelliteID } from './NetworkPulse.js';

interface BucketConfig {
    maxTokens: number;
    refillRate: number; // Tokens per second
    cost: number; // Cost per request
}

import { store } from '../../kernel/registry/Store.js';

// Config per Satellite
const QUOTAS: Record<SatelliteID, BucketConfig> = {
    FRED: { maxTokens: 120, refillRate: 120 / 60, cost: 1 }, // 120/min
    SEC: { maxTokens: 10, refillRate: 10, cost: 1 },         // 10/sec
    BIS: { maxTokens: 60, refillRate: 1, cost: 1 },
    EIA: { maxTokens: 60, refillRate: 1, cost: 1 },
    WB: { maxTokens: 60, refillRate: 1, cost: 1 },
    OECD: { maxTokens: 60, refillRate: 1, cost: 1 },
    POLY: { maxTokens: 1000, refillRate: 100, cost: 1 },     // ~Unlimited
    MANI: { maxTokens: 100, refillRate: 10, cost: 1 },
    ALT: { maxTokens: 60, refillRate: 1, cost: 1 },
    MEMP: { maxTokens: 60, refillRate: 1, cost: 1 },
    YFIN: { maxTokens: 5, refillRate: 5 / 60, cost: 1 },     // 5/min (AlphaVantage/YFin stricter)
    EXCH: { maxTokens: 60, refillRate: 1, cost: 1 }
};

interface QueueItem {
    id: string; // Unique Request ID
    priority: number; // Higher = Sooner
    resolve: () => void;
    timestamp: number;
}

class TokenBucket {
    tokens: number;
    lastRefill: number;
    config: BucketConfig;
    queue: QueueItem[] = [];

    constructor(config: BucketConfig) {
        this.config = config;
        this.tokens = config.maxTokens;
        this.lastRefill = Date.now();
    }

    refill() {
        const now = Date.now();
        const delta = (now - this.lastRefill) / 1000; // Seconds
        const newTokens = delta * this.config.refillRate;

        if (newTokens > 0) {
            this.tokens = Math.min(this.config.maxTokens, this.tokens + newTokens);
            this.lastRefill = now;
            this.processQueue();
        }
    }

    processQueue() {
        if (this.queue.length === 0) return;

        // Simple First-Come-First-Serve + Priority sort
        this.queue.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp);

        while (this.queue.length > 0 && this.tokens >= this.config.cost) {
            const item = this.queue.shift();
            if (item) {
                this.tokens -= this.config.cost;
                item.resolve();
            }
        }
    }

    async consume(priority: number = 0): Promise<void> {
        this.refill();

        if (this.tokens >= this.config.cost) {
            this.tokens -= this.config.cost;
            return Promise.resolve();
        } else {
            // Queue it
            return new Promise((resolve) => {
                this.queue.push({
                    id: Math.random().toString(36).slice(2),
                    priority,
                    resolve,
                    timestamp: Date.now()
                });

                // Dispatch 'QUEUED' event for UI?
                // Handled centrally by Governor
            });
        }
    }
}

export class Governor {
    private static buckets: Record<string, TokenBucket> = {};
    private static paused: boolean = false;

    static init() {
        Object.entries(QUOTAS).forEach(([id, config]) => {
            this.buckets[id] = new TokenBucket(config);
        });

        // Subscribe to Eco Pause
        store.subscribe('system.eco.paused', (val) => {
            if (typeof val.val === 'boolean') {
                this.paused = val.val;
                if (this.paused) {
                    console.warn('[Governor] DAM CLOSED (Eco Paused)');
                } else {
                    console.log('[Governor] DAM OPEN (Eco Resumed)');
                }
            }
        });

        console.log('[FIN] Governor: Quotas enforced.');
    }

    /**
     * Request entry to the network.
     * Returns a Promise that resolves when tokens are available.
     */
    static async admit(satellite: SatelliteID, priority: number = 0): Promise<void> {
        // Hard Stop Check
        if (this.paused) {
            // Reject the request to stop the fetch interval
            return Promise.reject(new Error('GOVERNOR_HARD_STOP: System in Coma/Eco Pause'));
        }

        const bucket = this.buckets[satellite];
        if (!bucket) {
            // No quota defined, allow pass
            return Promise.resolve();
        }

        const isQueued = bucket.tokens < bucket.config.cost;

        if (isQueued) {
            console.warn(`[Governor] Throttling ${satellite}... (Tokens: ${bucket.tokens.toFixed(2)})`);
            // Dispatch UI Queue Event?
            window.dispatchEvent(new CustomEvent('GOVERNOR_QUEUE', { detail: { id: satellite } }));
        }

        await bucket.consume(priority);

        if (isQueued) {
            // Dispatch UI Release Event?
            window.dispatchEvent(new CustomEvent('GOVERNOR_RELEASE', { detail: { id: satellite } }));
        }
    }
}

// Auto-init
Governor.init();
