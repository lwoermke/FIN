/**
 * [Intelligence] Training Log
 * 
 * The Learning Ledger.
 * Persists evolutionary training events (mutations) to local storage.
 * Used for visualizing adaptation rate and verifying system learning.
 */

import { store } from '../../kernel/registry/Store.js';
import { MutationEvent, mutationEngine } from '../../automata/MutationEngine.js';

export interface TrainingEntry {
    timestamp: number;
    mutationId: string;
    punishedModel: string;
    boostedModel: string | null;
    errorMagnitude: number;
    weightDelta: number;
}

const STORAGE_KEY = 'fin_training_log';

export class TrainingLog {
    private entries: TrainingEntry[] = [];

    constructor() {
        this.load();
        this.subscribe();
    }

    private load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                this.entries = JSON.parse(raw);
            }
        } catch (e) {
            console.warn('[TrainingLog] Failed to load history', e);
        }
    }

    private save() {
        try {
            // Keep last 1000 entries
            if (this.entries.length > 1000) {
                this.entries = this.entries.slice(-1000);
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
        } catch (e) {
            console.error('[TrainingLog] Save failed', e);
        }
    }

    private subscribe() {
        // We poll the MutationEngine or hook into an event.
        // Ideally MutationEngine should emit events via Store or custom emitter.
        // For now, we will assume MutationEngine emits to Store 'automata.mutation.events.*'
        // and we subscribe to that path?
        // Actually, MutationEngine.ts has `mutationEvents` array. 
        // Let's expose a listener method in MutationEngine or use Store.

        // Better: We subscribe to the store path where events are published.
        store.subscribeToSource('MUTATION_ENGINE', (vektor) => {
            // If this is a new mutation event
            if (vektor.src === 'MUTATION_ENGINE' && (vektor as any).meta?.kind === 'active') {
                // Let's assume the MutationEngine writes the whole event object to val (as per code).
                // Actually, in MutationEngine code:
                // store.set(`automata.mutation.events.${event.id}`, createVektor(event, ...))

                const event = vektor.val as MutationEvent;
                if (event && event.id && event.adjustments) {
                    this.logEvent(event);
                }
            }
        });
    }

    private logEvent(event: MutationEvent) {
        // Find primary punished/boosted
        // Simplifying: biggest loser and biggest winner?
        let maxLoss = 0;
        let pModel = '';

        event.adjustments.forEach(adj => {
            const delta = adj.previousWeight - adj.newWeight;
            if (delta > maxLoss) {
                maxLoss = delta;
                pModel = adj.source;
            }
        });

        const entry: TrainingEntry = {
            timestamp: event.timestamp,
            mutationId: event.id,
            punishedModel: pModel,
            boostedModel: null, // Logic for boosted is complex (redistribution), usually uniform or best
            errorMagnitude: event.refereeResult.geodesicDistance,
            weightDelta: maxLoss
        };

        // Avoid duplicates if store emits multiple times? 
        // ID check
        if (this.entries.find(e => e.mutationId === entry.mutationId)) return;

        this.entries.push(entry);
        this.save();
        console.log('[TrainingLog] Logged entry', entry);
    }

    public getHistory(): TrainingEntry[] {
        return this.entries;
    }

    public getAdaptationRate(): number {
        // Average mutations per hour over last 24h
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const recent = this.entries.filter(e => now - e.timestamp < oneDay);
        return recent.length / 24;
    }
}

export const trainingLog = new TrainingLog();
