/**
 * [8.1] Forensic Snapshot
 * Serializes world state at T+0 (trade execution time).
 * 
 * Captures the entire current state of the Store including:
 * - All Vektors (data points with lineage)
 * - All Weights (model weights from mutation engine)
 * - All Matrices (tensor outputs)
 * 
 * This provides a complete audit trail for each trade decision.
 */

import { store } from '../../kernel/registry/Store.js';
import type { Traceable } from '../../kernel/registry/Vektor.js';

/**
 * Forensic snapshot structure
 */
export interface ForensicSnapshot {
    /** Unique snapshot ID */
    id: string;
    /** Timestamp of snapshot creation */
    timestamp: number;
    /** Trade ID that triggered this snapshot */
    tradeId: string;
    /** Complete store state as serialized Vektors */
    storeState: SerializedStoreState;
    /** Model weights at time of snapshot */
    weights: SerializedWeights;
    /** Matrix/tensor outputs at time of snapshot */
    matrices: SerializedMatrices;
    /** Regime ID at time of decision */
    regimeId: string;
    /** Model IDs that contributed to decision */
    modelIds: string[];
}

/**
 * Serialized store state
 */
export interface SerializedStoreState {
    /** Total count of Vektors */
    vektorCount: number;
    /** Vektors by path */
    vektors: Record<string, SerializedVektor>;
    /** Block A (Endogenous) paths */
    endogenousPaths: string[];
    /** Block B (Exogenous) paths */
    exogenousPaths: string[];
}

/**
 * Serialized Vektor (JSON-safe format)
 */
export interface SerializedVektor {
    /** The actual value (serialized) */
    val: unknown;
    /** Source identifier */
    src: string;
    /** Timestamp */
    time: number;
    /** Model ID */
    model_id: string;
    /** Regime ID */
    regime_id: string;
    /** Confidence interval */
    conf: [number, number];
}

/**
 * Serialized weights from mutation engine
 */
export interface SerializedWeights {
    /** Endogenous source weights */
    endogenous: Record<string, number>;
    /** Exogenous source weights */
    exogenous: Record<string, number>;
    /** Total exogenous weight (should be <= 0.15) */
    totalExogenousWeight: number;
}

/**
 * Serialized matrix outputs
 */
export interface SerializedMatrices {
    /** Matrix Void tensor dimensions */
    matrixVoidDimensions?: [number, number, number];
    /** Covariance matrix (flattened) */
    covarianceMatrix?: number[];
    /** Correlation matrix (flattened) */
    correlationMatrix?: number[];
    /** Factor loadings */
    factorLoadings?: Record<string, number[]>;
}

/**
 * Convert a Traceable to serialized format
 */
function serializeVektor(vektor: Traceable<unknown>): SerializedVektor {
    return {
        val: serializeValue(vektor.val),
        src: vektor.src,
        time: vektor.time,
        model_id: vektor.model_id,
        regime_id: vektor.regime_id,
        conf: vektor.conf
    };
}

/**
 * Serialize a value to JSON-safe format
 */
function serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (typeof value === 'number' && !isFinite(value)) {
        return value > 0 ? 'Infinity' : value < 0 ? '-Infinity' : 'NaN';
    }

    if (value instanceof Map) {
        return {
            __type: 'Map',
            entries: Array.from(value.entries()).map(([k, v]) => [k, serializeValue(v)])
        };
    }

    if (value instanceof Set) {
        return {
            __type: 'Set',
            values: Array.from(value).map(v => serializeValue(v))
        };
    }

    if (Array.isArray(value)) {
        return value.map(v => serializeValue(v));
    }

    if (typeof value === 'object') {
        const serialized: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            serialized[key] = serializeValue(val);
        }
        return serialized;
    }

    return value;
}

/**
 * Generate unique snapshot ID
 */
function generateSnapshotId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `SNAP_${timestamp}_${random}`;
}

/**
 * ForensicSnap - Captures complete system state at trade execution
 */
export class ForensicSnap {
    /**
     * Capture a forensic snapshot immediately upon trade execution
     * @param tradeId The trade ID triggering this snapshot
     * @returns Complete forensic snapshot
     */
    static capture(tradeId: string): ForensicSnapshot {
        const timestamp = Date.now();
        const id = generateSnapshotId();

        console.log(`[ForensicSnap] Capturing snapshot for trade ${tradeId}...`);

        // Capture store state
        const storeState = ForensicSnap.captureStoreState();

        // Capture weights
        const weights = ForensicSnap.captureWeights();

        // Capture matrices
        const matrices = ForensicSnap.captureMatrices();

        // Extract regime and model IDs from store state
        const regimeId = ForensicSnap.extractCurrentRegime(storeState);
        const modelIds = ForensicSnap.extractModelIds(storeState);

        const snapshot: ForensicSnapshot = {
            id,
            timestamp,
            tradeId,
            storeState,
            weights,
            matrices,
            regimeId,
            modelIds
        };

        console.log(`[ForensicSnap] Snapshot ${id} captured: ${storeState.vektorCount} vektors`);

        return snapshot;
    }

    /**
     * Capture entire store state
     */
    private static captureStoreState(): SerializedStoreState {
        const snapshot = store.getSnapshot();
        const vektors: Record<string, SerializedVektor> = {};
        const endogenousPaths: string[] = [];
        const exogenousPaths: string[] = [];

        snapshot.forEach((vektor, path) => {
            vektors[path] = serializeVektor(vektor);

            // Classify by block
            if (path.includes('exogenous') || path.includes('sentiment') || path.includes('news')) {
                exogenousPaths.push(path);
            } else {
                endogenousPaths.push(path);
            }
        });

        return {
            vektorCount: snapshot.size,
            vektors,
            endogenousPaths,
            exogenousPaths
        };
    }

    /**
     * Capture model weights from Store
     */
    private static captureWeights(): SerializedWeights {
        const endogenous: Record<string, number> = {};
        const exogenous: Record<string, number> = {};
        let totalExogenous = 0;

        // Get weights from store if available
        const weightsVektor = store.get<Record<string, number>>('mutation.weights');
        if (weightsVektor) {
            const weights = weightsVektor.val;
            for (const [source, weight] of Object.entries(weights)) {
                if (source.includes('exogenous') || source.includes('sentiment')) {
                    exogenous[source] = weight;
                    totalExogenous += weight;
                } else {
                    endogenous[source] = weight;
                }
            }
        }

        return {
            endogenous,
            exogenous,
            totalExogenousWeight: totalExogenous
        };
    }

    /**
     * Capture matrix outputs from Store
     */
    private static captureMatrices(): SerializedMatrices {
        const matrices: SerializedMatrices = {};

        // Get Matrix Void dimensions if available
        const matrixVoid = store.get<{ dimensions: [number, number, number] }>('math.matrixVoid');
        if (matrixVoid) {
            matrices.matrixVoidDimensions = matrixVoid.val.dimensions;
        }

        // Get covariance matrix if available
        const covariance = store.get<number[]>('math.covariance');
        if (covariance) {
            matrices.covarianceMatrix = covariance.val;
        }

        // Get correlation matrix if available
        const correlation = store.get<number[]>('math.correlation');
        if (correlation) {
            matrices.correlationMatrix = correlation.val;
        }

        return matrices;
    }

    /**
     * Extract current regime ID from store state
     */
    private static extractCurrentRegime(storeState: SerializedStoreState): string {
        // Find the most common regime ID in the store
        const regimeCounts: Record<string, number> = {};

        for (const vektor of Object.values(storeState.vektors)) {
            const regime = vektor.regime_id;
            regimeCounts[regime] = (regimeCounts[regime] || 0) + 1;
        }

        let maxCount = 0;
        let dominantRegime = 'unknown';

        for (const [regime, count] of Object.entries(regimeCounts)) {
            if (count > maxCount) {
                maxCount = count;
                dominantRegime = regime;
            }
        }

        return dominantRegime;
    }

    /**
     * Extract unique model IDs from store state
     */
    private static extractModelIds(storeState: SerializedStoreState): string[] {
        const modelIds = new Set<string>();

        for (const vektor of Object.values(storeState.vektors)) {
            if (vektor.model_id) {
                modelIds.add(vektor.model_id);
            }
        }

        return Array.from(modelIds);
    }

    /**
     * Serialize a snapshot to JSON string
     */
    static serialize(snapshot: ForensicSnapshot): string {
        return JSON.stringify(snapshot, null, 2);
    }

    /**
     * Deserialize a snapshot from JSON string
     */
    static deserialize(json: string): ForensicSnapshot {
        return JSON.parse(json);
    }

    /**
     * Calculate the size of a snapshot in bytes
     */
    static getSize(snapshot: ForensicSnapshot): number {
        return new TextEncoder().encode(ForensicSnap.serialize(snapshot)).length;
    }
}
