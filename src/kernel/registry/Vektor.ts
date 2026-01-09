/**
 * [1.1] The Vektor Standard
 * Information exists only as "Vektors." Every data point is a Traceable<T> object.
 * 
 * The Vektor Standard enforces that data is never a primitive.
 * All information must contain structural metadata for traceability and integrity.
 */

/**
 * Generic Traceable interface representing a data point with full lineage
 * @template T The type of the actual value
 */
export interface Traceable<T> {
  /** The actual value */
  val: T;
  /** Source identifier (e.g., API endpoint, calculation path) */
  src: string;
  /** Timestamp in milliseconds since epoch */
  time: number;
  /** Model identifier that produced this value */
  model_id: string;
  /** Regime identifier (market regime classification) */
  regime_id: string;
  /** Confidence interval as [lower, upper] bounds */
  conf: [number, number];
}

/**
 * Standard Vektor Type (Numeric Array State)
 */
export type Vektor = Traceable<number[]>;

/**
 * Null Vektor (Severed Link)
 * Represents a data void or severed connection.
 */
export interface NullVektor extends Traceable<number> {
  val: typeof NaN;
  status: 'SEVERED';
  conf: [0, 0];
}

/**
 * Creates a new Traceable object with the given value and metadata
 * @template T The type of the value
 * @param value The actual value
 * @param source Source identifier
 */
export function createVektor<T>(
  value: T,
  source: string,
  modelId: string,
  regimeId: string,
  confidence: [number, number] = [0, 1]
): Traceable<T> {
  return {
    val: value,
    src: source,
    time: Date.now(),
    model_id: modelId,
    regime_id: regimeId,
    conf: confidence
  };
}

/**
 * Updates the value of an existing Vektor while preserving metadata
 */
export function updateVektor<T>(
  vektor: Traceable<T>,
  newValue: T,
  newSource?: string
): Traceable<T> {
  return {
    ...vektor,
    val: newValue,
    src: newSource ?? vektor.src,
    time: Date.now()
  };
}

export function isWithinConfidence(vektor: Traceable<number>): boolean {
  return vektor.val >= vektor.conf[0] && vektor.val <= vektor.conf[1];
}

export function getVektorAge(vektor: Traceable<unknown>): number {
  return Date.now() - vektor.time;
}
