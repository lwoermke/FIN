/**
 * [2.5] Transfer Entropy Decoupler
 * Enforces 15% weight cap on Block B (Exogenous).
 * 
 * To prevent narrative overfitting, Transfer Entropy is calculated in two distinct blocks.
 * Block B (Exogenous) is restricted to a maximum 15% weight in the final Kelly-bet calculation
 * to prevent "Echo Chamber" bias.
 */

/**
 * Weight vector with endogenous and exogenous components
 */
export interface WeightVector {
  /** Endogenous weights (Block A: Financial/Macro data) */
  endogenous: number[];
  /** Exogenous weights (Block B: Sentiment/Oracles) */
  exogenous: number[];
}

/**
 * Decoupled weight vector after normalization
 */
export interface DecoupledWeights {
  /** Normalized endogenous weights */
  endogenous: number[];
  /** Normalized exogenous weights (clamped to 15% max) */
  exogenous: number[];
  /** Total weight (should sum to 1.0) */
  total: number;
  /** Whether clamping was applied */
  wasClamped: boolean;
}

/**
 * Configuration for decoupling
 */
export interface DecouplerConfig {
  /** Maximum allowed weight for exogenous block (default 0.15 = 15%) */
  maxExogenousWeight: number;
  /** Whether to normalize after clamping (default true) */
  normalize: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DecouplerConfig = {
  maxExogenousWeight: 0.15, // 15% maximum
  normalize: true
};

/**
 * Transfer Entropy Decoupler
 * Clamps Exogenous weight to 15% maximum and normalizes
 */
export class Decoupler {
  private config: DecouplerConfig;

  /**
   * Creates a new Decoupler
   * @param config Optional configuration
   */
  constructor(config?: Partial<DecouplerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Decouples and normalizes weight vectors
   * @param weights Weight vector with endogenous and exogenous components
   * @returns Decoupled and normalized weights
   */
  decouple(weights: WeightVector): DecoupledWeights {
    // Calculate total weights
    const endogenousSum = weights.endogenous.reduce((a, b) => a + b, 0);
    const exogenousSum = weights.exogenous.reduce((a, b) => a + b, 0);
    const totalSum = endogenousSum + exogenousSum;

    if (totalSum <= 0) {
      throw new Error('Total weight sum must be positive');
    }

    // Calculate exogenous proportion
    const exogenousProportion = exogenousSum / totalSum;
    let wasClamped = false;

    // Clamp exogenous weight if it exceeds threshold
    let clampedExogenousSum = exogenousSum;
    if (exogenousProportion > this.config.maxExogenousWeight) {
      wasClamped = true;
      // Clamp to maximum allowed proportion
      clampedExogenousSum = totalSum * this.config.maxExogenousWeight;
    }

    // Calculate new endogenous sum (remaining weight)
    const clampedEndogenousSum = totalSum - clampedExogenousSum;

    // Normalize endogenous weights
    const normalizedEndogenous = weights.endogenous.map(w => {
      if (endogenousSum === 0) {
        return 0;
      }
      return (w / endogenousSum) * clampedEndogenousSum;
    });

    // Normalize exogenous weights
    const normalizedExogenous = weights.exogenous.map(w => {
      if (exogenousSum === 0) {
        return 0;
      }
      return (w / exogenousSum) * clampedExogenousSum;
    });

    // Final normalization if requested
    let finalEndogenous = normalizedEndogenous;
    let finalExogenous = normalizedExogenous;
    
    if (this.config.normalize) {
      const finalTotal = clampedEndogenousSum + clampedExogenousSum;
      if (finalTotal > 0) {
        finalEndogenous = normalizedEndogenous.map(w => w / finalTotal);
        finalExogenous = normalizedExogenous.map(w => w / finalTotal);
      }
    }

    return {
      endogenous: finalEndogenous,
      exogenous: finalExogenous,
      total: finalEndogenous.reduce((a, b) => a + b, 0) + 
             finalExogenous.reduce((a, b) => a + b, 0),
      wasClamped
    };
  }

  /**
   * Quick decouple function for single call
   * @param endogenous Endogenous weights array
   * @param exogenous Exogenous weights array
   * @returns Decoupled weights
   */
  decoupleArrays(
    endogenous: number[],
    exogenous: number[]
  ): DecoupledWeights {
    return this.decouple({ endogenous, exogenous });
  }

  /**
   * Checks if exogenous weight exceeds threshold
   * @param weights Weight vector
   * @returns True if exogenous weight exceeds threshold
   */
  exceedsThreshold(weights: WeightVector): boolean {
    const endogenousSum = weights.endogenous.reduce((a, b) => a + b, 0);
    const exogenousSum = weights.exogenous.reduce((a, b) => a + b, 0);
    const totalSum = endogenousSum + exogenousSum;

    if (totalSum <= 0) {
      return false;
    }

    const exogenousProportion = exogenousSum / totalSum;
    return exogenousProportion > this.config.maxExogenousWeight;
  }

  /**
   * Gets the current maximum exogenous weight threshold
   * @returns Maximum exogenous weight (0-1)
   */
  getMaxExogenousWeight(): number {
    return this.config.maxExogenousWeight;
  }

  /**
   * Updates the configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<DecouplerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Resets to default configuration
   */
  resetConfig(): void {
    this.config = { ...DEFAULT_CONFIG };
  }
}

/**
 * Convenience function for quick decoupling
 * @param endogenous Endogenous weights
 * @param exogenous Exogenous weights
 * @param maxExogenousWeight Maximum exogenous weight (default 0.15)
 * @returns Decoupled weights
 */
export function decoupleWeights(
  endogenous: number[],
  exogenous: number[],
  maxExogenousWeight: number = 0.15
): DecoupledWeights {
  const decoupler = new Decoupler({ maxExogenousWeight });
  return decoupler.decoupleArrays(endogenous, exogenous);
}
