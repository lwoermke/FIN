/**
 * [3.4] Resonance 40Hz
 * Event-triggered hum generator.
 * 
 * The 40Hz Hum activates only when GARCH volatility or VPIN toxicity
 * deviates >1.5σ from the 30-day moving average.
 * 
 * Continuous sensory feedback is prohibited to prevent alarm fatigue.
 */

import { RESONANCE_FREQ } from '../.././boot/environment.js';

/**
 * Configuration for resonance detection
 */
export interface ResonanceConfig {
  /** Toxicity threshold in standard deviations (default 1.5σ) */
  toxicityThreshold: number;
  /** Window size for moving average (default 30 days) */
  movingAverageWindow: number;
  /** Minimum time between triggers (ms) to prevent spam */
  cooldownPeriod: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ResonanceConfig = {
  toxicityThreshold: 1.5,
  movingAverageWindow: 30,
  cooldownPeriod: 1000 // 1 second cooldown
};

/**
 * Callback function type for resonance trigger
 */
export type ResonanceCallback = (frequency: number, amplitude: number) => void;

/**
 * Resonance 40Hz detector and trigger
 */
export class Resonance40Hz {
  private config: ResonanceConfig;
  private toxicityHistory: number[] = [];
  private lastTriggerTime: number = 0;
  private callback: ResonanceCallback | null = null;
  private isActive: boolean = false;

  /**
   * Creates a new Resonance40Hz detector
   * @param config Optional configuration
   * @param callback Optional callback function for audio oscillator
   */
  constructor(
    config?: Partial<ResonanceConfig>,
    callback?: ResonanceCallback
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callback = callback || null;
  }

  /**
   * Sets the callback function for resonance trigger
   * @param callback Function to call when resonance is triggered
   */
  setCallback(callback: ResonanceCallback): void {
    this.callback = callback;
  }

  /**
   * Updates toxicity value and checks if resonance should trigger
   * @param toxicity Current toxicity value (VPIN or GARCH volatility)
   * @returns True if resonance was triggered
   */
  update(toxicity: number): boolean {
    const now = Date.now();

    // Add to history
    this.toxicityHistory.push(toxicity);

    // Maintain window size
    if (this.toxicityHistory.length > this.config.movingAverageWindow) {
      this.toxicityHistory.shift();
    }

    // Need at least 2 data points to calculate standard deviation
    if (this.toxicityHistory.length < 2) {
      return false;
    }

    // Calculate moving average
    const mean = this.toxicityHistory.reduce((a, b) => a + b, 0) /
      this.toxicityHistory.length;

    // Calculate standard deviation
    const variance = this.toxicityHistory.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2);
    }, 0) / this.toxicityHistory.length;
    const stdDev = Math.sqrt(variance);

    // Check if toxicity exceeds threshold
    if (stdDev < 0.0001) {
      // Avoid division by zero
      return false;
    }

    const zScore = (toxicity - mean) / stdDev;

    // Check threshold and cooldown
    const exceedsThreshold = Math.abs(zScore) > this.config.toxicityThreshold;
    const cooldownExpired = now - this.lastTriggerTime >= this.config.cooldownPeriod;

    if (exceedsThreshold && cooldownExpired) {
      this.trigger(zScore);
      this.lastTriggerTime = now;
      return true;
    }

    // Stop resonance if below threshold
    if (!exceedsThreshold && this.isActive) {
      this.stop();
    }

    return false;
  }

  private audioContext: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;

  /**
   * Initializes the Audio Context (must be called after user interaction)
   */
  async initAudio(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = 0;
      this.gainNode.connect(this.audioContext.destination);

      this.oscillator = this.audioContext.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.frequency.value = RESONANCE_FREQ || 40;
      this.oscillator.connect(this.gainNode);
      this.oscillator.start();

      console.log('[FIN] Resonance Audio System initialized.');
    } catch (e) {
      console.warn('[FIN] Audio initialization failed (Autoplay blocked?):', e);
    }
  }

  /**
   * Triggers the 40Hz resonance
   * @param zScore The Z-score that triggered the resonance
   */
  private trigger(zScore: number): void {
    const wasActive = this.isActive;
    this.isActive = true;

    // Amplitude scales with how far above threshold (capped at 1.0)
    const excessZ = Math.abs(zScore) - this.config.toxicityThreshold;
    const targetAmplitude = Math.min(excessZ / this.config.toxicityThreshold, 0.5); // Max volume 0.5 for sanity

    // WebAudio updates
    if (this.audioContext && this.gainNode) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const now = this.audioContext.currentTime;
      // Fade in/out to target amplitude
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(targetAmplitude, now + 0.1);
    }

    if (this.callback) {
      this.callback(RESONANCE_FREQ, targetAmplitude);
    }

    if (!wasActive) {
      console.log(
        `[FIN] 40Hz Resonance triggered. Z-score: ${zScore.toFixed(2)}, ` +
        `Amplitude: ${targetAmplitude.toFixed(2)}`
      );
    }
  }

  /**
   * Stops the resonance
   */
  stop(): void {
    if (this.isActive) {
      this.isActive = false;

      // WebAudio Fade out
      if (this.audioContext && this.gainNode) {
        const now = this.audioContext.currentTime;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
      }

      if (this.callback) {
        this.callback(RESONANCE_FREQ, 0);
      }
    }
  }

  /**
   * Sets the oscillator frequency (e.g. for dynamic pitch)
   */
  setFrequency(hz: number): void {
    if (this.oscillator && this.audioContext) {
      this.oscillator.frequency.setValueAtTime(hz, this.audioContext.currentTime);
    }
  }

  /**
   * Gets the current moving average
   * @returns Moving average or 0 if insufficient data
   */
  getMovingAverage(): number {
    if (this.toxicityHistory.length === 0) {
      return 0;
    }
    return this.toxicityHistory.reduce((a, b) => a + b, 0) /
      this.toxicityHistory.length;
  }

  /**
   * Gets the current standard deviation
   * @returns Standard deviation or 0 if insufficient data
   */
  getStandardDeviation(): number {
    if (this.toxicityHistory.length < 2) {
      return 0;
    }
    const mean = this.getMovingAverage();
    const variance = this.toxicityHistory.reduce((sum, val) => {
      return sum + Math.pow(val - mean, 2);
    }, 0) / this.toxicityHistory.length;
    return Math.sqrt(variance);
  }

  /**
   * Gets the current Z-score for a given toxicity value
   * @param toxicity Toxicity value
   * @returns Z-score
   */
  getZScore(toxicity: number): number {
    const mean = this.getMovingAverage();
    const stdDev = this.getStandardDeviation();
    if (stdDev < 0.0001) {
      return 0;
    }
    return (toxicity - mean) / stdDev;
  }

  /**
   * Resets the toxicity history
   */
  reset(): void {
    this.toxicityHistory = [];
    this.lastTriggerTime = 0;
    this.isActive = false;
  }

  /**
   * Checks if resonance is currently active
   * @returns True if active
   */
  isResonanceActive(): boolean {
    return this.isActive;
  }

  /**
   * Updates the configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<ResonanceConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
