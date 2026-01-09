/**
 * [Phase 7.7] Scheduler (The Conductor)
 * Determines request priority based on User Focus (Neural Trace).
 */

import { store } from '../../kernel/registry/Store.js';

export class Scheduler {

    /**
     * Calculates priority for a given asset/satellite.
     * Scale: 0 (Background) to 10 (Critical Focus).
     */
    static getPriority(tag: string): number {
        // 1. Get User Focus from Store (hypothetical path or direct state access)
        // Ideally we subscribe, but synchronous check is fine for this.
        // Assuming NeuralTrace writes to `ui.focus.target` or similar.

        // Mocking the check for now until NeuralTrace Store integration is solidified.
        // In NavigationOrchestrator we use Context, but we need it available here.
        // Let's assume the Store holds 'ui.focus.sector'.

        const focusSector = store.getValue<string>('ui.focus.sector'); // e.g. 'CRYPTO', 'MACRO'

        if (!focusSector) return 1; // Default low priority

        // Simple matching logic
        if (tag === 'MEMP' || tag === 'ALT' || tag === 'POLY') {
            return focusSector === 'CRYPTO' ? 10 : 1;
        }

        if (tag === 'FRED' || tag === 'BIS' || tag === 'OECD') {
            return focusSector === 'MACRO' ? 10 : 1;
        }

        return 1;
    }
}
