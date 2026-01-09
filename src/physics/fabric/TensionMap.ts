/**
 * [3.1] Tension Map
 * Maps Volatility to Z-axis distortion.
 * 
 * When Rough Volatility spikes, a "Tension Multiplier" is applied,
 * causing the lattice to deform along the Z-axis.
 */

import type { Vector3 } from './MeshDynamics.js';

/**
 * Configuration for tension mapping
 */
export interface TensionConfig {
  /** Base tension multiplier */
  baseMultiplier: number;
  /** Maximum Z-axis distortion */
  maxDistortion: number;
  /** Volatility threshold for significant distortion */
  volatilityThreshold: number;
  /** Smoothing factor for volatility changes */
  smoothingFactor: number;
}

/**
 * Default tension configuration
 */
const DEFAULT_CONFIG: TensionConfig = {
  baseMultiplier: 1.0,
  maxDistortion: 10.0,
  volatilityThreshold: 0.02, // 2% volatility
  smoothingFactor: 0.1
};

/**
 * Tension Map: Converts volatility to Z-axis distortion vectors
 */
export class TensionMap {
  private config: TensionConfig;
  private smoothedVolatility: number = 0.0;
  private previousVolatility: number = 0.0;

  /**
   * Creates a new TensionMap
   * @param config Optional configuration (uses defaults if not provided)
   */
  constructor(config?: Partial<TensionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Maps volatility to Z-axis distortion vector
   * @param volatility Current volatility value (0-1 or percentage)
   * @param position Optional 3D position for spatial variation
   * @returns Z-axis distortion vector (x, y are 0, z is the distortion)
   */
  mapVolatilityToDistortion(
    volatility: number,
    position?: { x: number; y: number }
  ): Vector3 {
    // Smooth volatility to prevent sudden jumps
    this.smoothedVolatility = this.smoothedVolatility * (1 - this.config.smoothingFactor) +
                              volatility * this.config.smoothingFactor;

    // Calculate tension multiplier based on volatility
    // Higher volatility = higher tension = more distortion
    const normalizedVolatility = Math.min(
      Math.max(this.smoothedVolatility / this.config.volatilityThreshold, 0),
      2.0 // Cap at 2x threshold
    );

    // Apply tension multiplier
    // Tension increases exponentially with volatility
    const tensionMultiplier = this.config.baseMultiplier * 
                              (1.0 + Math.pow(normalizedVolatility, 1.5));

    // Calculate base distortion
    let distortion = (tensionMultiplier - 1.0) * this.config.maxDistortion;

    // Apply spatial variation if position is provided
    // Creates wave-like distortion patterns
    if (position) {
      const spatialPhase = Math.sin(position.x * 0.1) * Math.cos(position.y * 0.1);
      distortion *= (1.0 + spatialPhase * 0.3); // ±30% variation
    }

    // Clamp distortion to max
    distortion = Math.min(distortion, this.config.maxDistortion);

    // Store for next frame
    this.previousVolatility = volatility;

    return {
      x: 0,
      y: 0,
      z: distortion
    };
  }

  /**
   * Maps volatility to a tension multiplier (0-1 scale)
   * @param volatility Current volatility value
   * @returns Tension multiplier between 0 and 1
   */
  mapVolatilityToTension(volatility: number): number {
    this.smoothedVolatility = this.smoothedVolatility * (1 - this.config.smoothingFactor) +
                              volatility * this.config.smoothingFactor;

    const normalizedVolatility = Math.min(
      Math.max(this.smoothedVolatility / this.config.volatilityThreshold, 0),
      2.0
    );

    return Math.min(normalizedVolatility / 2.0, 1.0);
  }

  /**
   * Applies Z-axis distortion to a set of positions based on volatility
   * @param positions Array of positions to distort
   * @param volatility Current volatility value
   * @returns Array of distortion vectors (one per position)
   */
  applyDistortionToPositions(
    positions: Vector3[],
    volatility: number
  ): Vector3[] {
    return positions.map(pos => 
      this.mapVolatilityToDistortion(volatility, { x: pos.x, y: pos.y })
    );
  }

  /**
   * Resets the smoothed volatility state
   */
  reset(): void {
    this.smoothedVolatility = 0.0;
    this.previousVolatility = 0.0;
  }

  /**
   * Updates the configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<TensionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Gets the current smoothed volatility
   * @returns Smoothed volatility value
   */
  getSmoothedVolatility(): number {
    return this.smoothedVolatility;
  }
}
