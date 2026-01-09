/**
 * [Phase 7.5] Network Pulse (The Nervous System)
 * Global Fetch Interceptor & Traffic Monitor.
 * 
 * Intercepts all window.fetch calls to:
 * 1. Track global network load (concurrency).
 * 2. Dispatch FLUX_PACKET events for visual feedback (Data Influx).
 * 3. Trigger GranularSynth clicks for auditory feedback.
 */

import { granularSynth } from '../../physics/acoustics/GranularSynth.js';
import { store } from '../../kernel/registry/Store.js';
import { createVektor } from '../../kernel/registry/Vektor.js';
import { Governor } from './Governor.js';
import { Scheduler } from './Scheduler.js';

export type SatelliteID = 'FRED' | 'SEC' | 'BIS' | 'EIA' | 'WB' | 'OECD' | 'POLY' | 'MANI' | 'ALT' | 'MEMP' | 'YFIN' | 'EXCH';
export type ConnectionStatus = 'IDLE' | 'PULSE' | 'LAG' | 'SEVERED' | 'CRYO';

interface SatelliteStats {
    id: SatelliteID;
    status: ConnectionStatus;
    latency: number;
    lastPing: number;
    headers: Record<string, string>;
    url: string;
}

const SATELLITE_REGISTRY: Record<SatelliteID, RegExp> = {
    FRED: /stlouisfed\.org/i,
    SEC: /sec\.gov/i,
    BIS: /bis\.org/i,
    EIA: /eia\.gov/i,
    WB: /worldbank\.org/i,
    OECD: /oecd\.org/i,
    POLY: /polymarket\.com/i,
    MANI: /manifold/i,
    ALT: /alternative\.me/i,
    MEMP: /mempool\.space/i,
    YFIN: /yahoo|yfinance/i,
    EXCH: /nasdaq|nyse/i
};

export class NetworkPulse {
    private static originalFetch: typeof fetch;
    private static activeRequests: number = 0;
    private static totalBytesReceived: number = 0;

    /**
     * Initializes the Network Pulse interceptor
     */
    static init() {
        if (this.originalFetch !== undefined) return; // Already initialized

        this.originalFetch = window.fetch;
        window.fetch = this.intercept.bind(this);

        console.log('[FIN] Network Pulse: Interceptor Active');

        // Initialize Audio
        granularSynth.initAudio();

        // Initialize Satellites in Store
        Object.keys(SATELLITE_REGISTRY).forEach(id => {
            this.updateSatellite(id as SatelliteID, 'IDLE', 0, {});
        });
    }

    /**
     * Intercepted Fetch Implementation
     */
    private static async intercept(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        // 1. Identify Satellite
        const urlStr = input.toString();
        let satID: SatelliteID | null = null;
        for (const [id, regex] of Object.entries(SATELLITE_REGISTRY)) {
            if (regex.test(urlStr)) {
                satID = id as SatelliteID;
                break;
            }
        }

        // 2. Governor Check (The Dam)
        if (satID) {
            const priority = Scheduler.getPriority(satID);
            await Governor.admit(satID, priority);
        }

        // 3. Request Start
        this.activeRequests++;
        const startTime = performance.now();
        // ... (rest of logic)

        // Dispatch FLUX_START
        window.dispatchEvent(new CustomEvent('FLUX_START', { detail: { count: this.activeRequests } }));

        try {
            // 3. Perform Fetch
            const response = await this.originalFetch(input, init);
            const duration = performance.now() - startTime;

            // 4. Update Satellite Stats
            if (satID) {
                const headers: Record<string, string> = {};
                response.headers.forEach((val, key) => headers[key] = val);

                const status = duration > 500 ? 'LAG' : 'IDLE'; // Revert to IDLE after pulse? Or keep PULSE for a bit?
                // Actually, 'PULSE' is active, 'IDLE' is waiting.
                // We'll set it to 'IDLE' (connected) after success, but record latency.
                this.updateSatellite(satID, status, duration, headers);

                // Keep 'PULSE' status visible for a moment via UI logic, or handle here?
                // Let's set it to 'IDLE' but the UI will see the recent timestamp.
            }

            // 5. Clone for monitoring (so we don't consume the body)
            const monitorResponse = response.clone();
            this.monitorStream(monitorResponse);

            return response;
        } catch (error) {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            this.dispatchLoadUpdate();

            if (satID) {
                this.updateSatellite(satID, 'SEVERED', 0, {});
            }
            throw error;
        }
    }

    /**
     * Monitors the response stream for data packets
     */
    private static async monitorStream(response: Response) {
        const body = response.body;
        if (!body) {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            this.dispatchLoadUpdate();
            return;
        }

        const reader = body.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) break;

                // Value is Uint8Array
                if (value) {
                    const chunkSize = value.length;
                    this.totalBytesReceived += chunkSize;

                    // Audio Trigger (Geiger Click)
                    const intensity = Math.min(chunkSize / 1024, 2.0); // 1KB = 1.0 intensity
                    granularSynth.update(1.5 + intensity);

                    // Visual Trigger (Flux Packet)
                    window.dispatchEvent(new CustomEvent('FLUX_PACKET', {
                        detail: { size: chunkSize }
                    }));
                }
            }
        } catch (err) {
            console.error('[NetworkPulse] Stream Error', err);
        } finally {
            this.activeRequests = Math.max(0, this.activeRequests - 1);
            this.dispatchLoadUpdate();
            window.dispatchEvent(new CustomEvent('FLUX_COMPLETE'));
        }
    }

    /**
     * Updates Store with current network load
     */
    private static dispatchLoadUpdate() {
        const load = this.activeRequests;
        store.set('intelligence.network.load', createVektor(
            load,
            'NETWORK_PULSE',
            'nervous_system',
            'SYSTEM',
            [1.0, 1.0]
        ));
    }

    /**
     * Updates Satellite Registry in Store
     */
    private static updateSatellite(id: SatelliteID, status: ConnectionStatus, latency: number, headers: any) {
        const stats: SatelliteStats = {
            id,
            status,
            latency,
            lastPing: Date.now(),
            headers,
            url: headers.url || ''
        };

        store.set(`intelligence.network.satellites.${id}`, createVektor(
            stats,
            'NETWORK_PULSE',
            'nervous_system',
            'SYSTEM',
            [1.0, 1.0]
        ));
    }
}
