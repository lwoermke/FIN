/**
 * [8.3] The Mutation Engine
 * Recalibrates model weights based on failure via Transfer Entropy.
 * 
 * References Operations Manual Section 8.3: Recalibration
 */

import { referee, type RefereeResult } from './Referee.js';
import { store } from '../kernel/registry/Store.js';
import { createVektor } from '../kernel/registry/Vektor.js';

export type InputBlock = 'endogenous' | 'exogenous';

export const ENDOGENOUS_SOURCES = new Set([
    'YFINANCE_API', 'FINNHUB_API', 'EXCHANGE_RATE_API', 'FRED_API', 'SEC_EDGAR'
]);

export const EXOGENOUS_SOURCES = new Set(['GNEWS_API', 'POLYMARKET_API']);

export interface WeightAdjustment {
    timestamp: number;
    source: string;
    block: InputBlock;
    previousWeight: number;
    newWeight: number;
    reason: string;
    predictionId: string;
    transferEntropy: number;
}

export interface TransferEntropyResult {
    source: string;
    block: InputBlock;
    entropy: number;
    contribution: number;
    peakLag: number;
}

export interface MutationEvent {
    id: string;
    timestamp: number;
    predictionId: string;
    refereeResult: RefereeResult;
    entropyAnalysis: TransferEntropyResult[];
    adjustments: WeightAdjustment[];
    totalWeightReduction: number;
}

export interface MutationEngineConfig {
    learningRate: number;
    minWeight: number;
    maxWeight: number;
    decayFactor: number;
    entropyWindowSize: number;
    maxExogenousWeight: number;
    autoMutate: boolean;
}

const DEFAULT_CONFIG: MutationEngineConfig = {
    learningRate: 0.1,
    minWeight: 0.01,
    maxWeight: 1.0,
    decayFactor: 0.99,
    entropyWindowSize: 50,
    maxExogenousWeight: 0.15,
    autoMutate: true
};

export class MutationEngine {
    private config: MutationEngineConfig;
    private weights: Map<string, number> = new Map();
    private history: Map<string, number[]> = new Map();
    private mutationEvents: MutationEvent[] = [];
    private unsubscribeReferee: (() => void) | null = null;
    private isRunning: boolean = false;

    constructor(config?: Partial<MutationEngineConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeWeights();
    }

    private initializeWeights(): void {
        for (const source of ENDOGENOUS_SOURCES) {
            this.weights.set(source, 1.0 / ENDOGENOUS_SOURCES.size);
        }
        const exoWeight = this.config.maxExogenousWeight / EXOGENOUS_SOURCES.size;
        for (const source of EXOGENOUS_SOURCES) {
            this.weights.set(source, exoWeight);
        }
        this.normalizeWeights();
    }

    start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('[MutationEngine] Starting...');
        if (this.config.autoMutate) {
            this.unsubscribeReferee = referee.onFailure(
                (predictionId, result) => this.handleFailure(predictionId, result)
            );
        }
        this.publishWeights();
    }

    stop(): void {
        if (!this.isRunning) return;
        if (this.unsubscribeReferee) {
            this.unsubscribeReferee();
            this.unsubscribeReferee = null;
        }
        this.isRunning = false;
        console.log('[MutationEngine] Stopped');
    }

    private handleFailure(predictionId: string, result: RefereeResult): void {
        console.log(`[MutationEngine] Processing failure for ${predictionId}`);

        // 1. Calculate Z-Score of Geodesic Distance based on history
        // Use all available history for "System Error" baseline
        // We can aggregate error history. For simplicity, we use the error magnitude relative to a rolling average?
        // Or store global error history.
        // Let's use a simple rolling window of errors on the MutationEngine for this calculation.

        const recentErrors = this.getRecentErrors();
        const meanError = recentErrors.reduce((a, b) => a + b, 0) / (recentErrors.length || 1);
        const variance = recentErrors.reduce((s, e) => s + Math.pow(e - meanError, 2), 0) / (recentErrors.length || 1);
        const stdDev = Math.sqrt(variance) || 0.1; // fallback

        const zScore = (result.geodesicDistance - meanError) / stdDev;

        console.log(`[MutationEngine] Error Metrics: Distance=${result.geodesicDistance.toFixed(4)} Mean=${meanError.toFixed(4)} Z=${zScore.toFixed(2)}`);

        // Record this error for future stats
        this.recordError(result.geodesicDistance);

        // 2. Threshold Check (1.5 Sigma)
        if (zScore < 1.5 && recentErrors.length > 5) {
            console.log('[MutationEngine] Deviation within tolerance (< 1.5σ). No mutation.');
            return;
        }

        const entropyAnalysis = this.calculateTransferEntropy(result);
        const culprits = this.identifyCulprits(entropyAnalysis, result.geodesicDistance);
        const adjustments = this.applyAdjustments(culprits, predictionId, result);
        this.normalizeWeights();
        this.enforceExogenousCap();

        const event: MutationEvent = {
            id: `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            timestamp: Date.now(),
            predictionId,
            refereeResult: result,
            entropyAnalysis,
            adjustments,
            totalWeightReduction: adjustments.reduce((s, a) => s + (a.previousWeight - a.newWeight), 0)
        };
        this.mutationEvents.push(event);
        store.set(`automata.mutation.events.${event.id}`, createVektor(
            event, 'MUTATION_ENGINE', 'mutation_engine', 'active', [event.totalWeightReduction, 0]
        ));
        this.publishWeights();
        console.log(`[MutationEngine] MUTATION APPLIED. ${adjustments.length} adjustments.`);
    }

    private errorHistory: number[] = [];
    private recordError(err: number) {
        this.errorHistory.push(err);
        if (this.errorHistory.length > 100) this.errorHistory.shift();
    }
    private getRecentErrors(): number[] {
        return this.errorHistory;
    }


    private calculateTransferEntropy(result: RefereeResult): TransferEntropyResult[] {
        const results: TransferEntropyResult[] = [];
        for (const [source] of this.weights) {
            const block = EXOGENOUS_SOURCES.has(source) ? 'exogenous' : 'endogenous';
            const history = this.history.get(source) || [];
            const entropy = this.computeTE(history, result);
            results.push({ source, block, entropy, contribution: 0, peakLag: Math.min(history.length, 5) });
        }
        const total = results.reduce((s, r) => s + r.entropy, 0);
        if (total > 0) results.forEach(r => r.contribution = r.entropy / total);
        return results;
    }

    private computeTE(history: number[], result: RefereeResult): number {
        if (history.length < 2) return 0.1;
        const mean = history.reduce((a, b) => a + b, 0) / history.length;
        const variance = history.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / history.length;
        return Math.max(0, result.geodesicDistance * variance + Math.random() * 0.1);
    }

    private identifyCulprits(analysis: TransferEntropyResult[], distance: number): TransferEntropyResult[] {
        const sorted = [...analysis].sort((a, b) => b.contribution - a.contribution);
        const avg = 1.0 / analysis.length;
        const threshold = avg * 1.5 / Math.min(2, 1 + distance);
        return sorted.filter(r => r.contribution > threshold);
    }

    private applyAdjustments(culprits: TransferEntropyResult[], predictionId: string, result: RefereeResult): WeightAdjustment[] {
        const adjustments: WeightAdjustment[] = [];
        for (const c of culprits) {
            const curr = this.weights.get(c.source) || 0;
            const reduction = this.config.learningRate * c.contribution * Math.min(1, result.geodesicDistance);
            const newW = Math.max(this.config.minWeight, curr * (1 - reduction));
            this.weights.set(c.source, newW);
            adjustments.push({
                timestamp: Date.now(), source: c.source, block: c.block,
                previousWeight: curr, newWeight: newW,
                reason: `Failure at ${result.horizon}`, predictionId, transferEntropy: c.entropy
            });
        }
        return adjustments;
    }

    private normalizeWeights(): void {
        const total = Array.from(this.weights.values()).reduce((a, b) => a + b, 0);
        if (total === 0) { this.initializeWeights(); return; }
        for (const [src, w] of this.weights) this.weights.set(src, w / total);
    }

    private enforceExogenousCap(): void {
        let exo = 0, endo = 0;
        for (const [src, w] of this.weights) {
            if (EXOGENOUS_SOURCES.has(src)) exo += w; else endo += w;
        }
        if (exo > this.config.maxExogenousWeight) {
            const excess = exo - this.config.maxExogenousWeight;
            const scale = this.config.maxExogenousWeight / exo;
            for (const src of EXOGENOUS_SOURCES) {
                this.weights.set(src, (this.weights.get(src) || 0) * scale);
            }
            for (const src of ENDOGENOUS_SOURCES) {
                const c = this.weights.get(src) || 0;
                this.weights.set(src, c + excess * (c / endo));
            }
        }
    }

    private publishWeights(): void {
        const rec: Record<string, number> = {};
        for (const [src, w] of this.weights) rec[src] = w;
        store.set('automata.mutation.weights', createVektor(rec, 'MUTATION_ENGINE', 'weight_vector', 'active', [0, 1]));
    }

    recordDataPoint(source: string, value: number): void {
        if (!this.history.has(source)) this.history.set(source, []);
        const h = this.history.get(source)!;
        h.push(value);
        while (h.length > this.config.entropyWindowSize) h.shift();
    }

    getWeight(source: string): number { return this.weights.get(source) || 0; }
    getWeights(): Map<string, number> { return new Map(this.weights); }
    getMutationEvents(): MutationEvent[] { return [...this.mutationEvents]; }

    getStatistics() {
        let totalRed = 0, adjCount = 0, exo = 0, endo = 0;
        for (const e of this.mutationEvents) { totalRed += e.totalWeightReduction; adjCount += e.adjustments.length; }
        for (const [src, w] of this.weights) { if (EXOGENOUS_SOURCES.has(src)) exo += w; else endo += w; }
        return {
            totalMutations: this.mutationEvents.length,
            totalWeightReduction: totalRed,
            currentExogenousWeight: exo,
            currentEndogenousWeight: endo,
            averageAdjustmentSize: adjCount > 0 ? totalRed / adjCount : 0
        };
    }

    triggerMutation(predictionId: string, result: RefereeResult): MutationEvent | null {
        if (!this.isRunning) return null;
        this.handleFailure(predictionId, result);
        return this.mutationEvents[this.mutationEvents.length - 1];
    }

    applyDecay(): void {
        const uniform = 1.0 / this.weights.size;
        for (const [src, w] of this.weights) {
            this.weights.set(src, w + (uniform - w) * (1 - this.config.decayFactor));
        }
        this.normalizeWeights();
        this.enforceExogenousCap();
        this.publishWeights();
    }

    updateConfig(config: Partial<MutationEngineConfig>): void {
        this.config = { ...this.config, ...config };
        this.enforceExogenousCap();
        this.publishWeights();
    }

    resetWeights(): void { this.initializeWeights(); this.publishWeights(); }
    clearHistory(): void { this.mutationEvents = []; this.history.clear(); }
}

export const mutationEngine = new MutationEngine();
