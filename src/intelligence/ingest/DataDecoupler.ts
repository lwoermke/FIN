/**
 * [2.5] Data Routing Decoupler
 * Enforces "Endogenous vs. Exogenous" split at the ingest layer.
 * 
 * Routes data to Block A (Endogenous) or Block B (Exogenous) before it hits the Kernel.
 * This ensures the 15% weight cap on Block B is enforced at the data ingestion level.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';

/**
 * Data block classification
 */
export enum DataBlock {
  /** Block A: Endogenous (Financial/Macro data) */
  ENDOGENOUS = 'endogenous',
  /** Block B: Exogenous (Sentiment/Oracle data) */
  EXOGENOUS = 'exogenous'
}

/**
 * Data source classification map
 */
const SOURCE_CLASSIFICATION: Record<string, DataBlock> = {
  // Endogenous sources (Block A)
  'SEC_EDGAR': DataBlock.ENDOGENOUS,
  'FRED_API': DataBlock.ENDOGENOUS,
  'YFINANCE': DataBlock.ENDOGENOUS,
  'EXCHANGE_RATE_API': DataBlock.ENDOGENOUS,
  'FINNHUB_API': DataBlock.ENDOGENOUS,
  
  // Exogenous sources (Block B)
  'POLYMARKET_API': DataBlock.EXOGENOUS,
  'GNEWS_API': DataBlock.EXOGENOUS,
  'SENTIMENT_API': DataBlock.EXOGENOUS
};

/**
 * Data routing result
 */
export interface RoutedData<T> {
  /** The original Vektor data */
  vektor: Traceable<T>;
  /** Which block it was routed to */
  block: DataBlock;
  /** Whether this data should be included (after weight cap check) */
  included: boolean;
}

/**
 * Data Decoupler for routing ingested data
 */
export class DataDecoupler {
  private endogenousData: Traceable<unknown>[] = [];
  private exogenousData: Traceable<unknown>[] = [];
  private maxExogenousWeight: number = 0.15; // 15% cap

  /**
   * Routes a Vektor to the appropriate block based on source
   * @template T Data type
   * @param vektor The Vektor to route
   * @returns Routed data with block classification
   */
  route<T>(vektor: Traceable<T>): RoutedData<T> {
    // Determine block based on source
    const block = SOURCE_CLASSIFICATION[vektor.src] || DataBlock.ENDOGENOUS;
    
    // Add to appropriate block
    if (block === DataBlock.ENDOGENOUS) {
      this.endogenousData.push(vektor as Traceable<unknown>);
    } else {
      this.exogenousData.push(vektor as Traceable<unknown>);
    }

    // Check if exogenous data exceeds weight cap
    const shouldInclude = this.checkWeightCap(block);

    return {
      vektor,
      block,
      included: shouldInclude
    };
  }

  /**
   * Checks if adding more exogenous data would exceed the weight cap
   * @param block The block being added to
   * @returns True if data should be included
   */
  private checkWeightCap(block: DataBlock): boolean {
    if (block === DataBlock.ENDOGENOUS) {
      // Endogenous data always included
      return true;
    }

    // Calculate current weights
    const totalEndogenous = this.endogenousData.length;
    const totalExogenous = this.exogenousData.length;
    const total = totalEndogenous + totalExogenous;

    if (total === 0) {
      return true; // First data point
    }

    // Calculate exogenous proportion
    const exogenousProportion = totalExogenous / total;

    // Check if adding one more would exceed cap
    const newExogenousProportion = (totalExogenous + 1) / (total + 1);

    return newExogenousProportion <= this.maxExogenousWeight;
  }

  /**
   * Gets all data in Block A (Endogenous)
   * @returns Array of endogenous Vektors
   */
  getEndogenousData(): Traceable<unknown>[] {
    return [...this.endogenousData];
  }

  /**
   * Gets all data in Block B (Exogenous)
   * @returns Array of exogenous Vektors
   */
  getExogenousData(): Traceable<unknown>[] {
    return [...this.exogenousData];
  }

  /**
   * Gets the current weight distribution
   * @returns Object with endogenous and exogenous counts and proportions
   */
  getWeightDistribution(): {
    endogenous: { count: number; proportion: number };
    exogenous: { count: number; proportion: number };
  } {
    const totalEndogenous = this.endogenousData.length;
    const totalExogenous = this.exogenousData.length;
    const total = totalEndogenous + totalExogenous;

    return {
      endogenous: {
        count: totalEndogenous,
        proportion: total > 0 ? totalEndogenous / total : 0
      },
      exogenous: {
        count: totalExogenous,
        proportion: total > 0 ? totalExogenous / total : 0
      }
    };
  }

  /**
   * Clears all routed data
   */
  clear(): void {
    this.endogenousData = [];
    this.exogenousData = [];
  }

  /**
   * Sets the maximum exogenous weight cap
   * @param maxWeight Maximum weight (0-1)
   */
  setMaxExogenousWeight(maxWeight: number): void {
    if (maxWeight < 0 || maxWeight > 1) {
      throw new Error('Max exogenous weight must be between 0 and 1');
    }
    this.maxExogenousWeight = maxWeight;
  }

  /**
   * Gets the maximum exogenous weight cap
   * @returns Maximum weight (0-1)
   */
  getMaxExogenousWeight(): number {
    return this.maxExogenousWeight;
  }
}

// Export singleton instance
export const dataDecoupler = new DataDecoupler();
