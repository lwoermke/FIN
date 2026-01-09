/**
 * [2.2] Rough Volatility (rBergomi)
 * Fractional Brownian Motion with Hurst exponent H < 0.5.
 * 
 * GARCH(1,1) is replaced by the rBergomi kernel.
 * Volatility is modeled as Fractional Brownian Motion with H < 0.5.
 */

/**
 * Configuration for rBergomi simulation
 */
export interface RBergomiConfig {
  /** Hurst exponent (must be < 0.5 for rough volatility) */
  hurst: number;
  /** Volatility of volatility parameter */
  nu: number;
  /** Initial volatility */
  v0: number;
  /** Correlation parameter */
  rho: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: RBergomiConfig = {
  hurst: 0.1, // Rough volatility (H < 0.5)
  nu: 0.3,    // Volatility of volatility
  v0: 0.04,   // Initial volatility (4%)
  rho: -0.7   // Negative correlation (leverage effect)
};

/**
 * Generates fractional Gaussian noise using the Davies-Harte method
 * @param n Number of points
 * @param hurst Hurst exponent
 * @returns Array of fractional Gaussian noise values
 */
function generateFractionalGaussianNoise(n: number, hurst: number): number[] {
  // Simplified implementation using Cholesky decomposition approach
  // For production, use FFT-based methods for efficiency
  
  const noise: number[] = [];
  const alpha = 2 * hurst;
  
  // Generate covariance matrix for fractional Brownian motion
  const covariance: number[][] = [];
  for (let i = 0; i < n; i++) {
    covariance[i] = [];
    for (let j = 0; j < n; j++) {
      const k = Math.abs(i - j);
      // Covariance function for fBm: C(k) = 0.5 * (|k+1|^alpha + |k-1|^alpha - 2|k|^alpha)
      covariance[i][j] = 0.5 * (
        Math.pow(Math.abs(k + 1), alpha) +
        Math.pow(Math.abs(k - 1), alpha) -
        2 * Math.pow(k, alpha)
      );
    }
  }
  
  // Generate independent Gaussian random variables
  const gaussian: number[] = [];
  for (let i = 0; i < n; i++) {
    // Box-Muller transform for Gaussian random numbers
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    gaussian.push(z);
  }
  
  // Cholesky decomposition (simplified - use library in production)
  // For now, use approximate method
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      if (j === i) {
        let diag = covariance[i][i];
        for (let k = 0; k < i; k++) {
          diag -= Math.pow(covariance[i][k] / (covariance[k][k] + 1e-10), 2);
        }
        sum += Math.sqrt(Math.max(diag, 0)) * gaussian[j];
      } else {
        sum += (covariance[i][j] / (covariance[j][j] + 1e-10)) * gaussian[j];
      }
    }
    noise.push(sum);
  }
  
  return noise;
}

/**
 * Simulates Fractional Brownian Motion with Hurst exponent H < 0.5
 * @param n Number of time steps
 * @param dt Time step size
 * @param hurst Hurst exponent (must be < 0.5)
 * @returns Array of fBm increments
 */
export function simulateFractionalBrownianMotion(
  n: number,
  dt: number,
  hurst: number
): number[] {
  if (hurst >= 0.5) {
    throw new Error('Hurst exponent must be < 0.5 for rough volatility');
  }
  
  if (hurst <= 0) {
    throw new Error('Hurst exponent must be > 0');
  }
  
  // Generate fractional Gaussian noise
  const fgn = generateFractionalGaussianNoise(n, hurst);
  
  // Scale by dt^H to get fBm increments
  const dtH = Math.pow(dt, hurst);
  return fgn.map(x => x * dtH);
}

/**
 * Simulates rough volatility using rBergomi model
 * @param n Number of time steps
 * @param dt Time step size
 * @param config Configuration parameters
 * @returns Array of volatility values
 */
export function simulateRBergomi(
  n: number,
  dt: number,
  config?: Partial<RBergomiConfig>
): number[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  if (cfg.hurst >= 0.5) {
    throw new Error('Hurst exponent must be < 0.5 for rough volatility');
  }
  
  // Generate fractional Brownian motion for volatility
  const fBm = simulateFractionalBrownianMotion(n, dt, cfg.hurst);
  
  // rBergomi volatility process: v_t = v_0 * exp(nu * W^H_t - 0.5 * nu^2 * t^(2H))
  const volatility: number[] = [cfg.v0];
  
  for (let i = 1; i < n; i++) {
    const t = i * dt;
    const t2H = Math.pow(t, 2 * cfg.hurst);
    const exponent = cfg.nu * fBm[i] - 0.5 * cfg.nu * cfg.nu * t2H;
    const v = cfg.v0 * Math.exp(exponent);
    volatility.push(Math.max(v, 0.001)); // Ensure positive volatility
  }
  
  return volatility;
}

/**
 * Calculates the roughness parameter (alpha = 2H - 1)
 * @param hurst Hurst exponent
 * @returns Roughness parameter
 */
export function calculateRoughness(hurst: number): number {
  return 2 * hurst - 1;
}

/**
 * Estimates Hurst exponent from volatility time series
 * @param volatility Array of volatility values
 * @returns Estimated Hurst exponent
 */
export function estimateHurst(volatility: number[]): number {
  if (volatility.length < 10) {
    throw new Error('Insufficient data for Hurst estimation');
  }
  
  // Simplified estimation using variance of increments
  const increments: number[] = [];
  for (let i = 1; i < volatility.length; i++) {
    increments.push(Math.log(volatility[i] / volatility[i - 1]));
  }
  
  // Calculate variance at different lags
  const lags = [1, 2, 4, 8].filter(lag => lag < volatility.length);
  const variances: number[] = [];
  
  for (const lag of lags) {
    const laggedIncrements: number[] = [];
    for (let i = lag; i < increments.length; i++) {
      laggedIncrements.push(increments[i] - increments[i - lag]);
    }
    const mean = laggedIncrements.reduce((a, b) => a + b, 0) / laggedIncrements.length;
    const variance = laggedIncrements.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / laggedIncrements.length;
    variances.push(variance);
  }
  
  // Linear regression on log(variance) vs log(lag)
  const logLags = lags.map(lag => Math.log(lag));
  const logVariances = variances.map(v => Math.log(Math.max(v, 1e-10)));
  
  const n = logLags.length;
  const sumX = logLags.reduce((a, b) => a + b, 0);
  const sumY = logVariances.reduce((a, b) => a + b, 0);
  const sumXY = logLags.reduce((sum, x, i) => sum + x * logVariances[i], 0);
  const sumX2 = logLags.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  
  // H = (slope + 1) / 2
  const hurst = (slope + 1) / 2;
  
  return Math.max(0.01, Math.min(0.49, hurst)); // Clamp to valid range
}
