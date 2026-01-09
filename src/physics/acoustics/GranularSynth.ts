/**
 * [3.4] Granular Synth (Geiger Clicks)
 * 
 * Generates "Geiger counter" clicks when toxicity/volatility deviates > 1.5 sigma.
 * Uses procedural white noise bursts to avoid asset dependency.
 * 
 * References Operations Manual Section 3.4: Stochastic Gating
 */

export interface GranularConfig {
    /** Sigma threshold for clicks (default 1.5) */
    sigmaThreshold: number;
    /** Minimum time between clicks in ms (scales with volatility) */
    baseInterval: number;
}

const DEFAULT_CONFIG: GranularConfig = {
    sigmaThreshold: 1.5,
    baseInterval: 100 // 10 click/sec max at threshold
};

export class GranularSynth {
    private config: GranularConfig;
    private audioContext: AudioContext | null = null;
    private clickBuffer: AudioBuffer | null = null;
    private lastClickTime: number = 0;

    constructor(config?: Partial<GranularConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initializes Audio Context and generates click sample
     */
    async initAudio(): Promise<void> {
        if (this.audioContext) return;

        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Generate Click Buffer (White Noise Burst)
            const sampleRate = this.audioContext.sampleRate;
            const length = 0.005 * sampleRate; // 5ms click
            this.clickBuffer = this.audioContext.createBuffer(1, length, sampleRate);
            const data = this.clickBuffer.getChannelData(0);

            for (let i = 0; i < length; i++) {
                // Exponential decay envelope for percussive sound
                const envelope = 1 - (i / length);
                data[i] = (Math.random() * 2 - 1) * envelope;
            }

            console.log('[FIN] Granular Synth initialized.');
        } catch (e) {
            console.warn('[FIN] Granular Synth init failed:', e);
        }
    }

    /**
     * Checks volatility and triggers click if needed
     * @param sigma Current Z-score/Sigma of volatility
     */
    update(sigma: number): void {
        if (!this.audioContext || !this.clickBuffer) return;

        const absSigma = Math.abs(sigma);
        if (absSigma < this.config.sigmaThreshold) return;

        const now = Date.now();

        // Calculate dynamic interval: Higher sigma -> faster clicks
        // At threshold: baseInterval. At 2x threshold: baseInterval / 2
        const excess = absSigma / this.config.sigmaThreshold; // >= 1.0
        const currentInterval = this.config.baseInterval / excess;

        if (now - this.lastClickTime > currentInterval) {
            this.playClick(excess); // Volume scales with excess
            this.lastClickTime = now;
        }
    }

    private playClick(intensity: number): void {
        if (!this.audioContext || !this.clickBuffer) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();

        const source = this.audioContext.createBufferSource();
        source.buffer = this.clickBuffer;

        const gain = this.audioContext.createGain();
        // Scale volume by intensity (clamped)
        const volume = Math.min(0.1 + (intensity - 1) * 0.1, 0.5);
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(this.audioContext.destination);

        source.start();
    }
}

export const granularSynth = new GranularSynth();
