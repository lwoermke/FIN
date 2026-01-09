/**
 * [Phase 7.4] Alternative.me Connector
 * Crypto Fear & Greed Index.
 * 
 * Source: https://api.alternative.me/fng/
 * Purpose: Market Sentiment Analysis & Visual Fraying.
 * 
 * Logic:
 * - Fetches "Fear & Greed Index" (0-100).
 * - Maps to 0.0-1.0 float.
 * - If Value < 0.20 (Extreme Fear), dispatches 'STOCHASTIC_FRAY' event to UI.
 */

import { createVektor, Traceable } from '../../kernel/registry/Vektor.js';

export interface FearGreedData {
    value: number; // 0-100
    value_classification: string; // "Extreme Fear", "Greed", etc.
    timestamp: string;
    time_until_update?: string;
}

/**
 * Fetches Crypto Fear & Greed Index
 */
export async function fetchFearAndGreed(): Promise<Traceable<FearGreedData>> {
    try {
        const response = await fetch('https://api.alternative.me/fng/?limit=1');

        if (!response.ok) {
            throw new Error(`Alternative.me API failed: ${response.statusText}`);
        }

        const json = await response.json();

        if (!json.data || json.data.length === 0) {
            throw new Error('No data received from Alternative.me');
        }

        const item = json.data[0];
        const value = parseInt(item.value, 10);
        const classification = item.value_classification;

        // Normalization (0-100 -> 0.0-1.0)
        const normalizedValue = value / 100.0;

        const data: FearGreedData = {
            value: value,
            value_classification: classification,
            timestamp: item.timestamp
        };

        // Physics Trigger Logic
        // If Extreme Fear (< 20), dispatch STOCHASTIC_FRAY
        if (normalizedValue < 0.20) {
            console.warn(`[FIN] MARKET ALERT: EXTREME FEAR DETECTED (${value}). Dispatching FRAY event.`);
            // Dispatch event to window for GroundView to pick up
            // Note: In a pure Node environment this would fail, but we are in Browser.
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('STOCHASTIC_FRAY', {
                    detail: { intensity: 1.0 - normalizedValue }
                });
                window.dispatchEvent(event);
            }
        }

        return createVektor(
            data,
            'ALTERNATIVE_ME',
            'sentiment_crypto',
            'MACRO_CRYPTO',
            [0.9, 1.0]
        );

    } catch (error) {
        console.error('[FIN] AlternativeMe Connector Error:', error);
        return createVektor(
            { value: 50, value_classification: 'Error', timestamp: '' },
            'ALTERNATIVE_ME',
            'sentiment_crypto',
            'MACRO_CRYPTO',
            [0, 0] // Dead Signal
        );
    }
}
