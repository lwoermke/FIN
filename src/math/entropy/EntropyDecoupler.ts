/**
 * [2.5] Entropy Decoupler
 * Listens to Store and enforces 15% weight cap on Buffer B (Soft Data).
 * 
 * Segregates incoming Vektors into:
 * - Buffer A: YFinance, Finnhub, ExchangeRate, FredConnector (Hard Data)
 * - Buffer B: GNews, Polymarket (Soft Data)
 * 
 * Feeds sanitized weights into MatrixVoid (Tensor Construction).
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { store } from '../../kernel/registry/Store.js';
import { MatrixVoid } from '../optimizers/MatrixVoid.js';
import type { Unsubscribe } from '../../kernel/registry/Store.js';

/**
 * Source classification for Buffer A (Hard Data - Endogenous)
 */
const BUFFER_A_SOURCES = new Set([
  'YFINANCE_API',
  'FINNHUB_API',
  'EXCHANGE_RATE_API',
  'FRED_API',
  'SEC_EDGAR',
  'BIS_API',       // [New] Hard Data
  'EIA_API',       // [New] Hard Data
  'WB_OECD_API',   // [New] Hard Data
  'MEMPOOL_SPACE'  // [New] Hard Data (Network Truth)
]);

/**
 * Source classification for Buffer B (Soft Data - Exogenous)
 */
const BUFFER_B_SOURCES = new Set([
  'GNEWS_API',
  'POLYMARKET_API',
  'ALTERNATIVE_ME', // [New] Soft Data
  'MANIFOLD_API'    // [New] Soft Data
]);

/**
 * Vektor buffer entry
 */
interface BufferEntry {
  vektor: Traceable<unknown>;
  path: string;
  influenceWeight: number;
}

/**
 * Decoupled output with sanitized weights
 */
export interface DecoupledOutput {
  bufferA: BufferEntry[];
  bufferB: BufferEntry[];
  weightsA: number[];
  weightsB: number[];
  totalWeight: number;
  wasClamped: boolean;
  clampedWeightB: number;
}

/**
 * Configuration for Entropy Decoupler
 */
export interface EntropyDecouplerConfig {
  /** Maximum weight for Buffer B (default 0.15 = 15%) */
  maxBufferBWeight: number;
  /** Update interval in milliseconds (default 1000ms) */
  updateInterval: number;
  /** MatrixVoid dimensions for tensor construction */
  tensorDepth: number;
  tensorHeight: number;
  tensorWidth: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: EntropyDecouplerConfig = {
  maxBufferBWeight: 0.15, // 15% maximum
  updateInterval: 1000, // 1 second
  tensorDepth: 3,
  tensorHeight: 10,
  tensorWidth: 10
};

/**
 * Entropy Decoupler that listens to Store and feeds MatrixVoid
 */
export class EntropyDecoupler {
  private config: EntropyDecouplerConfig;
  private bufferA: BufferEntry[] = [];
  private bufferB: BufferEntry[] = [];
  private unsubscribeStore: Unsubscribe | null = null;
  private updateTimer: number | null = null;
  private matrixVoid: MatrixVoid;
  private onUpdateCallback: ((output: DecoupledOutput) => void) | null = null;

  /**
   * Creates a new Entropy Decoupler
   * @param config Optional configuration
   */
  constructor(config?: Partial<EntropyDecouplerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize MatrixVoid for tensor construction
    this.matrixVoid = new MatrixVoid(
      this.config.tensorDepth,
      this.config.tensorHeight,
      this.config.tensorWidth
    );
  }

  /**
   * Starts listening to Store for incoming Vektors
   */
  start(): void {
    // Subscribe to all Store changes
    this.unsubscribeStore = store.subscribeAll((vektor, path) => {
      this.processVektor(vektor, path);
    });

    // Process existing Vektors in Store
    this.processExistingVektors();

    // Start periodic updates
    this.startPeriodicUpdates();
  }

  /**
   * Stops listening to Store
   */
  stop(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }

    if (this.updateTimer !== null) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Processes a single Vektor from Store
   * @param vektor The Vektor to process
   * @param path The Store path
   */
  private processVektor(vektor: Traceable<unknown>, path: string): void {
    // Skip Dead Signals
    if (vektor.conf[0] === 0 && vektor.conf[1] === 0) {
      return;
    }

    // Calculate influence weight based on confidence
    // Use average of confidence interval as weight
    const influenceWeight = (vektor.conf[0] + vektor.conf[1]) / 2;

    const entry: BufferEntry = {
      vektor,
      path,
      influenceWeight
    };

    // Segregate into appropriate buffer
    if (BUFFER_A_SOURCES.has(vektor.src)) {
      // Remove existing entry for same path if present
      this.bufferA = this.bufferA.filter(e => e.path !== path);
      this.bufferA.push(entry);
    } else if (BUFFER_B_SOURCES.has(vektor.src)) {
      // Remove existing entry for same path if present
      this.bufferB = this.bufferB.filter(e => e.path !== path);
      this.bufferB.push(entry);
    }
  }

  /**
   * Processes all existing Vektors in Store
   */
  private processExistingVektors(): void {
    const allPaths = store.getAllPaths();

    for (const path of allPaths) {
      const vektor = store.get(path);
      if (vektor) {
        this.processVektor(vektor, path);
      }
    }
  }

  /**
   * Calculates weights and applies 15% clamp
   * @returns Decoupled output with sanitized weights
   */
  calculateWeights(): DecoupledOutput {
    // Calculate total influence weights
    const totalWeightA = this.bufferA.reduce((sum, e) => sum + e.influenceWeight, 0);
    const totalWeightB = this.bufferB.reduce((sum, e) => sum + e.influenceWeight, 0);
    const totalWeight = totalWeightA + totalWeightB;

    if (totalWeight === 0) {
      return {
        bufferA: [],
        bufferB: [],
        weightsA: [],
        weightsB: [],
        totalWeight: 0,
        wasClamped: false,
        clampedWeightB: 0
      };
    }

    // Calculate raw proportions
    const rawProportionB = totalWeightB / totalWeight;
    let wasClamped = false;
    let clampedWeightB = totalWeightB;

    // Apply 15% clamp: Weight_B_Final = min(Weight_B_Raw, 0.15)
    if (rawProportionB > this.config.maxBufferBWeight) {
      wasClamped = true;
      clampedWeightB = totalWeight * this.config.maxBufferBWeight;
    }

    // Calculate remaining weight for Buffer A
    const clampedWeightA = totalWeight - clampedWeightB;

    // Calculate individual weights for Buffer A (proportional redistribution)
    const weightsA = this.bufferA.map(entry => {
      if (totalWeightA === 0) return 0;
      // Redistribute proportionally, including excess from Buffer B
      return (entry.influenceWeight / totalWeightA) * clampedWeightA;
    });

    // Calculate individual weights for Buffer B (clamped)
    const weightsB = this.bufferB.map(entry => {
      if (totalWeightB === 0) return 0;
      // Clamp proportionally
      return (entry.influenceWeight / totalWeightB) * clampedWeightB;
    });

    // Normalize to sum to 1.0
    const normalizedTotal = clampedWeightA + clampedWeightB;
    const normalizedWeightsA = normalizedTotal > 0
      ? weightsA.map(w => w / normalizedTotal)
      : weightsA;
    const normalizedWeightsB = normalizedTotal > 0
      ? weightsB.map(w => w / normalizedTotal)
      : weightsB;

    return {
      bufferA: [...this.bufferA],
      bufferB: [...this.bufferB],
      weightsA: normalizedWeightsA,
      weightsB: normalizedWeightsB,
      totalWeight: normalizedTotal,
      wasClamped,
      clampedWeightB: clampedWeightB / normalizedTotal
    };
  }

  /**
   * Feeds sanitized weights into MatrixVoid
   * @param output Decoupled output with weights
   */
  private feedToMatrixVoid(output: DecoupledOutput): void {
    // Construct weight vector: [Buffer A weights, Buffer B weights]
    const weightVector = [...output.weightsA, ...output.weightsB];

    // Reshape to fit MatrixVoid dimensions
    const totalWeights = weightVector.length;
    const targetSize = this.config.tensorHeight * this.config.tensorWidth;

    // Pad or truncate to fit
    const paddedWeights = new Array(targetSize).fill(0);
    for (let i = 0; i < Math.min(totalWeights, targetSize); i++) {
      paddedWeights[i] = weightVector[i];
    }

    // Write to MatrixVoid (last depth slice)
    const depthIndex = this.config.tensorDepth - 1;
    for (let h = 0; h < this.config.tensorHeight; h++) {
      for (let w = 0; w < this.config.tensorWidth; w++) {
        const index = h * this.config.tensorWidth + w;
        this.matrixVoid.set(depthIndex, h, w, paddedWeights[index] || 0);
      }
    }

    // Store in Store for other components to access
    const weightVectorVektor: Traceable<number[]> = {
      val: weightVector,
      src: 'ENTROPY_DECOUPLER',
      time: Date.now(),
      model_id: 'entropy_decoupler',
      regime_id: this.bufferA[0]?.vektor.regime_id || 'default',
      conf: [0.9, 1.0] // High confidence for processed weights
    };

    store.set('math.entropy.decoupled_weights', weightVectorVektor);
  }

  /**
   * Starts periodic updates
   */
  private startPeriodicUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.update();
    }, this.config.updateInterval) as unknown as number;
  }

  /**
   * Performs update cycle: calculate weights and feed to MatrixVoid
   */
  update(): void {
    const output = this.calculateWeights();

    // Feed to MatrixVoid
    this.feedToMatrixVoid(output);

    // Notify callback if set
    if (this.onUpdateCallback) {
      this.onUpdateCallback(output);
    }
  }

  /**
   * Sets callback for update notifications
   * @param callback Callback function
   */
  onUpdate(callback: (output: DecoupledOutput) => void): void {
    this.onUpdateCallback = callback;
  }

  /**
   * Gets the current MatrixVoid instance
   * @returns MatrixVoid instance
   */
  getMatrixVoid(): MatrixVoid {
    return this.matrixVoid;
  }

  /**
   * Gets current buffer state
   * @returns Object with buffer A and B entries
   */
  getBuffers(): { bufferA: BufferEntry[]; bufferB: BufferEntry[] } {
    return {
      bufferA: [...this.bufferA],
      bufferB: [...this.bufferB]
    };
  }

  /**
   * Clears all buffers
   */
  clearBuffers(): void {
    this.bufferA = [];
    this.bufferB = [];
  }

  /**
   * Updates the configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<EntropyDecouplerConfig>): void {
    this.config = { ...this.config, ...config };

    // Recreate MatrixVoid if dimensions changed
    if (config.tensorDepth || config.tensorHeight || config.tensorWidth) {
      this.matrixVoid = new MatrixVoid(
        this.config.tensorDepth,
        this.config.tensorHeight,
        this.config.tensorWidth
      );
    }
  }
}

// Export singleton instance
export const entropyDecoupler = new EntropyDecoupler();
