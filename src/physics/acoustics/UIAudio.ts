/**
 * [Acoustics] UI Audio
 * 
 * Web Audio API sound effects for UI interactions.
 * Reinforces physical weight of information.
 */

// Audio context singleton
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

/**
 * Resume audio context after user interaction
 */
export async function resumeAudio(): Promise<void> {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
        await ctx.resume();
    }
}

/**
 * Play high-pitch chirp for hover events
 * 12kHz sine wave, 50ms duration
 */
export function playHoverChirp(): void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(12000, ctx.currentTime); // 12kHz

        // Very faint volume
        gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.05); // 50ms
    } catch (e) {
        // Silently fail if audio not available
    }
}

/**
 * Play low thud for drop/anchor events
 * 60Hz sine wave, 200ms duration
 */
export function playDropThud(): void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(60, ctx.currentTime); // 60Hz

        // Low thud volume envelope
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2); // 200ms
    } catch (e) {
        // Silently fail if audio not available
    }
}

/**
 * Play commit seal sound
 * Rising tone with reverb-like tail
 */
export function playCommitSeal(): void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(200, ctx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
        // Silently fail
    }
}

/**
 * Play error/warning sound
 * Discordant dual tone
 */
export function playWarning(): void {
    try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'square';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.frequency.setValueAtTime(466, ctx.currentTime); // Slight dissonance

        gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc2.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.15);
    } catch (e) {
        // Silently fail
    }
}
