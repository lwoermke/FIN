/**
 * [8.2] The Referee
 * Monitors outcomes at T+1, T+7, T+30 using Riemannian Metrics.
 * 
 * The Referee worker monitors outcomes using the geodesic distance between
 * "Predicted State" and "Actual State" on the SPD manifold.
 * 
 * References Operations Manual Section 8.2: Realization
 */

import { geodesicDistance, createSPDMatrix, type SPDMatrix } from '../math/topology/RiemannMetric.js';
import { store } from '../kernel/registry/Store.js';
import { createVektor, type Traceable } from '../kernel/registry/Vektor.js';

/**
 * Temporal horizons for outcome monitoring (in milliseconds)
 */
export const MONITORING_HORIZONS = {
  T_PLUS_1: 24 * 60 * 60 * 1000,      // T+1 day
  T_PLUS_7: 7 * 24 * 60 * 60 * 1000,  // T+7 days
  T_PLUS_30: 30 * 24 * 60 * 60 * 1000 // T+30 days
} as const;

/**
 * Horizon identifiers
 */
export type HorizonId = 'T+1' | 'T+7' | 'T+30';

/**
 * Represents a state snapshot for comparison
 */
export interface StateSnapshot {
  /** Unique identifier for the snapshot */
  id: string;
  /** Timestamp when the snapshot was taken */
  timestamp: number;
  /** The state vector as an SPD matrix */
  stateMatrix: SPDMatrix;
  /** Matrix dimension */
  dimension: number;
  /** Associated model ID */
  modelId: string;
  /** Source path in registry */
  sourcePath: string;
}

/**
 * Represents a prediction to be monitored
 */
export interface MonitoredPrediction {
  /** Unique identifier */
  id: string;
  /** Timestamp when prediction was made */
  predictionTime: number;
  /** The predicted state matrix */
  predictedState: SPDMatrix;
  /** Matrix dimension */
  dimension: number;
  /** Model that made the prediction */
  modelId: string;
  /** Registry path for the prediction */
  registryPath: string;
  /** Horizons to monitor */
  horizons: HorizonId[];
  /** Results keyed by horizon */
  results: Map<HorizonId, RefereeResult>;
}

/**
 * Result of a Referee evaluation
 */
export interface RefereeResult {
  /** Horizon at which evaluation was made */
  horizon: HorizonId;
  /** Geodesic distance between predicted and actual */
  geodesicDistance: number;
  /** Whether the threshold was exceeded (failure) */
  isFailure: boolean;
  /** Predicted state matrix */
  predictedState: SPDMatrix;
  /** Actual state matrix */
  actualState: SPDMatrix;
  /** Timestamp of evaluation */
  evaluationTime: number;
  /** Threshold used for evaluation */
  threshold: number;
}

/**
 * Callback for failure notifications
 */
export type FailureCallback = (
  predictionId: string,
  result: RefereeResult
) => void;

/**
 * Configuration for the Referee
 */
export interface RefereeConfig {
  /** Distance threshold for failure detection */
  distanceThreshold: number;
  /** Polling interval for monitoring (ms) */
  pollingInterval: number;
  /** Maximum number of predictions to monitor */
  maxPredictions: number;
  /** Per-horizon thresholds (optional overrides) */
  horizonThresholds?: Partial<Record<HorizonId, number>>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RefereeConfig = {
  distanceThreshold: 0.5,
  pollingInterval: 60000, // 1 minute
  maxPredictions: 1000,
  horizonThresholds: {
    'T+1': 0.3,   // Tighter threshold for short-term
    'T+7': 0.5,   // Medium threshold
    'T+30': 0.7   // Looser threshold for long-term
  }
};

/**
 * The Referee: Monitors prediction outcomes using Riemannian geometry
 * 
 * Implements the Evolutionary Loop (Section 8) by:
 * 1. Capturing predictions as Forensic Snapshots
 * 2. Monitoring at T+1, T+7, T+30
 * 3. Calculating geodesic distance on SPD manifold
 * 4. Triggering recalibration on failure
 */
export class Referee {
  private config: RefereeConfig;
  private predictions: Map<string, MonitoredPrediction> = new Map();
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private failureCallbacks: FailureCallback[] = [];
  private isRunning: boolean = false;

  constructor(config?: Partial<RefereeConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts the monitoring loop
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[Referee] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[Referee] Starting monitoring loop...');

    // Initial check
    this.evaluatePendingPredictions();

    // Set up polling
    this.pollingTimer = setInterval(() => {
      this.evaluatePendingPredictions();
    }, this.config.pollingInterval);
  }

  /**
   * Stops the monitoring loop
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }

    this.isRunning = false;
    console.log('[Referee] Monitoring stopped');
  }

  /**
   * Registers a prediction for monitoring
   * @param predictedState The predicted state matrix
   * @param dimension Matrix dimension
   * @param modelId Model that made the prediction
   * @param registryPath Path in registry for actual state
   * @param horizons Horizons to monitor (default: all)
   * @returns Prediction ID
   */
  registerPrediction(
    predictedState: SPDMatrix,
    dimension: number,
    modelId: string,
    registryPath: string,
    horizons: HorizonId[] = ['T+1', 'T+7', 'T+30']
  ): string {
    // Enforce maximum predictions
    if (this.predictions.size >= this.config.maxPredictions) {
      this.pruneOldestPredictions();
    }

    const id = `pred_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const prediction: MonitoredPrediction = {
      id,
      predictionTime: Date.now(),
      predictedState,
      dimension,
      modelId,
      registryPath,
      horizons,
      results: new Map()
    };

    this.predictions.set(id, prediction);

    // Store in registry
    store.set(`automata.referee.predictions.${id}`, createVektor(
      prediction,
      'REFEREE',
      modelId,
      'monitoring',
      [1, 1]
    ));

    console.log(`[Referee] Registered prediction ${id} for horizons: ${horizons.join(', ')}`);
    return id;
  }

  /**
   * Captures current state from a covariance matrix
   * @param covariance Covariance matrix (n x n, row-major)
   * @param n Matrix dimension
   * @returns SPD matrix ready for comparison
   */
  captureState(covariance: number[], n: number): SPDMatrix {
    return createSPDMatrix(covariance, n);
  }

  /**
   * Evaluates a prediction against actual state
   * @param predictionId Prediction to evaluate
   * @param horizon Horizon to check
   * @param actualState Current actual state
   * @returns RefereeResult or null if not ready
   */
  evaluate(
    predictionId: string,
    horizon: HorizonId,
    actualState: SPDMatrix
  ): RefereeResult | null {
    const prediction = this.predictions.get(predictionId);
    if (!prediction) {
      console.warn(`[Referee] Prediction ${predictionId} not found`);
      return null;
    }

    // Check if already evaluated for this horizon
    if (prediction.results.has(horizon)) {
      return prediction.results.get(horizon)!;
    }

    // Calculate geodesic distance
    const distance = geodesicDistance(
      prediction.predictedState,
      actualState,
      prediction.dimension
    );

    // Get threshold for this horizon
    const threshold = this.config.horizonThresholds?.[horizon] 
      ?? this.config.distanceThreshold;

    const result: RefereeResult = {
      horizon,
      geodesicDistance: distance,
      isFailure: distance > threshold,
      predictedState: prediction.predictedState,
      actualState,
      evaluationTime: Date.now(),
      threshold
    };

    // Store result
    prediction.results.set(horizon, result);

    // Store in registry
    store.set(
      `automata.referee.results.${predictionId}.${horizon}`,
      createVektor(
        result,
        'REFEREE',
        prediction.modelId,
        result.isFailure ? 'failure' : 'success',
        [distance, threshold]
      )
    );

    // Trigger failure callbacks if needed
    if (result.isFailure) {
      console.log(`[Referee] FAILURE detected for ${predictionId} at ${horizon}: ` +
        `distance=${distance.toFixed(4)} > threshold=${threshold}`);
      this.notifyFailure(predictionId, result);
    } else {
      console.log(`[Referee] SUCCESS for ${predictionId} at ${horizon}: ` +
        `distance=${distance.toFixed(4)} <= threshold=${threshold}`);
    }

    return result;
  }

  /**
   * Evaluates all pending predictions that have reached their horizons
   */
  private evaluatePendingPredictions(): void {
    const now = Date.now();

    for (const [id, prediction] of this.predictions) {
      for (const horizon of prediction.horizons) {
        // Skip if already evaluated
        if (prediction.results.has(horizon)) continue;

        // Calculate horizon time
        const horizonMs = this.getHorizonMs(horizon);
        const targetTime = prediction.predictionTime + horizonMs;

        // Check if horizon has been reached
        if (now >= targetTime) {
          // Fetch actual state from registry
          const actualVektor = this.fetchActualState(prediction.registryPath);
          if (actualVektor) {
            const actualState = this.extractStateMatrix(actualVektor, prediction.dimension);
            if (actualState) {
              this.evaluate(id, horizon, actualState);
            }
          }
        }
      }
    }
  }

  /**
   * Gets horizon duration in milliseconds
   */
  private getHorizonMs(horizon: HorizonId): number {
    switch (horizon) {
      case 'T+1': return MONITORING_HORIZONS.T_PLUS_1;
      case 'T+7': return MONITORING_HORIZONS.T_PLUS_7;
      case 'T+30': return MONITORING_HORIZONS.T_PLUS_30;
    }
  }

  /**
   * Fetches actual state from registry
   */
  private fetchActualState(registryPath: string): Traceable<unknown> | undefined {
    return store.get(registryPath);
  }

  /**
   * Extracts SPD matrix from a Vektor
   * Assumes the Vektor contains array data that can be interpreted as a matrix
   */
  private extractStateMatrix(vektor: Traceable<unknown>, dimension: number): SPDMatrix | null {
    const value = vektor.val;
    
    // If already an SPD matrix (array of numbers)
    if (Array.isArray(value) && value.every(v => typeof v === 'number')) {
      return value as SPDMatrix;
    }

    // If it's an object with a matrix property
    if (typeof value === 'object' && value !== null && 'matrix' in value) {
      const matrix = (value as { matrix: unknown }).matrix;
      if (Array.isArray(matrix) && matrix.every(v => typeof v === 'number')) {
        return matrix as SPDMatrix;
      }
    }

    // If it's a covariance-like structure
    if (typeof value === 'object' && value !== null && 'covariance' in value) {
      const cov = (value as { covariance: number[] }).covariance;
      return createSPDMatrix(cov, dimension);
    }

    console.warn(`[Referee] Could not extract state matrix from ${vektor.src}`);
    return null;
  }

  /**
   * Registers a callback for failure notifications
   */
  onFailure(callback: FailureCallback): () => void {
    this.failureCallbacks.push(callback);
    return () => {
      const index = this.failureCallbacks.indexOf(callback);
      if (index >= 0) {
        this.failureCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notifies all failure callbacks
   */
  private notifyFailure(predictionId: string, result: RefereeResult): void {
    for (const callback of this.failureCallbacks) {
      try {
        callback(predictionId, result);
      } catch (error) {
        console.error('[Referee] Error in failure callback:', error);
      }
    }
  }

  /**
   * Prunes oldest predictions to maintain max limit
   */
  private pruneOldestPredictions(): void {
    const toRemove = Math.ceil(this.config.maxPredictions * 0.1); // Remove 10%
    const sorted = [...this.predictions.entries()]
      .sort((a, b) => a[1].predictionTime - b[1].predictionTime);

    for (let i = 0; i < toRemove && i < sorted.length; i++) {
      this.predictions.delete(sorted[i][0]);
      store.delete(`automata.referee.predictions.${sorted[i][0]}`);
    }

    console.log(`[Referee] Pruned ${toRemove} oldest predictions`);
  }

  /**
   * Gets all predictions with their current status
   */
  getPredictions(): Map<string, MonitoredPrediction> {
    return new Map(this.predictions);
  }

  /**
   * Gets results for a specific prediction
   */
  getResults(predictionId: string): Map<HorizonId, RefereeResult> | undefined {
    return this.predictions.get(predictionId)?.results;
  }

  /**
   * Gets summary statistics
   */
  getStatistics(): {
    totalPredictions: number;
    pendingEvaluations: number;
    failures: number;
    successes: number;
    averageDistance: number;
  } {
    let pendingEvaluations = 0;
    let failures = 0;
    let successes = 0;
    let totalDistance = 0;
    let distanceCount = 0;

    for (const prediction of this.predictions.values()) {
      const pendingHorizons = prediction.horizons.filter(h => !prediction.results.has(h));
      pendingEvaluations += pendingHorizons.length;

      for (const result of prediction.results.values()) {
        if (result.isFailure) {
          failures++;
        } else {
          successes++;
        }
        totalDistance += result.geodesicDistance;
        distanceCount++;
      }
    }

    return {
      totalPredictions: this.predictions.size,
      pendingEvaluations,
      failures,
      successes,
      averageDistance: distanceCount > 0 ? totalDistance / distanceCount : 0
    };
  }

  /**
   * Updates configuration
   */
  updateConfig(config: Partial<RefereeConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart polling if interval changed and currently running
    if (config.pollingInterval && this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Clears all predictions and results
   */
  clear(): void {
    for (const id of this.predictions.keys()) {
      store.delete(`automata.referee.predictions.${id}`);
    }
    this.predictions.clear();
    console.log('[Referee] Cleared all predictions');
  }
}

// Export singleton instance
export const referee = new Referee();
