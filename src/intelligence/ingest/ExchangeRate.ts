/**
 * [Phases 2 & 7.2] Exchange Rate Connector
 * Major currency pairs (Block A - Endogenous).
 * 
 * These inputs drive the Gravity constant in the physics engine.
 * Zero-Trust: Validates all API responses.
 * Vektorization: Every data point wrapped immediately.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { createVektor } from '../../kernel/registry/Vektor.js';

/**
 * Exchange rate data
 */
export interface ExchangeRate {
  pair: string; // e.g., "USD/EUR"
  rate: number;
  base: string; // Base currency
  quote: string; // Quote currency
  timestamp: number;
}

/**
 * Exchange rate API response structure
 */
interface ExchangeRateResponse {
  rates?: Record<string, number>;
  base?: string;
  date?: string;
}

/**
 * Current regime identifier
 */
let currentRegimeId: string = 'default';

/**
 * Sets the current regime identifier
 * @param regimeId Regime identifier
 */
export function setCurrentRegime(regimeId: string): void {
  currentRegimeId = regimeId;
}

/**
 * Type guard for exchange rate response validation
 */
function isValidExchangeRateResponse(data: unknown): data is ExchangeRateResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return 'rates' in obj && typeof obj.rates === 'object';
}

/**
 * Normalizes exchange rate to number
 */
function normalizeRate(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
}

/**
 * Fetches exchange rates for major pairs
 * @param pairs Array of currency pairs (e.g., ["USD/EUR", "USD/JPY"])
 * @returns Vektor-wrapped exchange rates array
 */
export async function fetchExchangeRates(
  pairs: string[] = ['USD/EUR', 'USD/JPY', 'USD/GBP', 'USD/CHF']
): Promise<Traceable<ExchangeRate[]>> {
  try {
    // Using exchangerate-api.com (free tier) or similar
    // For production, use a more reliable API
    const baseCurrency = 'USD';
    const url = `https://api.exchangerate-api.com/v4/latest/${baseCurrency}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return createVektor(
        [],
        'EXCHANGE_RATE_API',
        'exchangerate_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const data: unknown = await response.json();

    // Zero-Trust: Validate schema
    if (!isValidExchangeRateResponse(data)) {
      console.warn('[FIN] ExchangeRate: Invalid response schema');
      return createVektor(
        [],
        'EXCHANGE_RATE_API',
        'exchangerate_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    // Extract rates for requested pairs
    const exchangeRates: ExchangeRate[] = [];
    const rates = data.rates || {};
    const timestamp = Date.now();

    for (const pair of pairs) {
      const [base, quote] = pair.split('/');
      
      if (base === baseCurrency && rates[quote]) {
        const rate = normalizeRate(rates[quote]);
        
        if (rate !== null) {
          exchangeRates.push({
            pair,
            rate,
            base: base || 'USD',
            quote: quote || '',
            timestamp
          });
        }
      } else if (quote === baseCurrency && rates[base]) {
        // Inverse rate
        const inverseRate = normalizeRate(rates[base]);
        
        if (inverseRate !== null && inverseRate > 0) {
          exchangeRates.push({
            pair,
            rate: 1 / inverseRate,
            base: base || '',
            quote: quote || 'USD',
            timestamp
          });
        }
      }
    }

    // Calculate conf based on data quality
    const conf: [number, number] = exchangeRates.length > 0 ? [0.8, 0.9] : [0, 0];

    return createVektor(
      exchangeRates,
      'EXCHANGE_RATE_API',
      'exchangerate_connector',
      currentRegimeId,
      conf
    );
  } catch (error) {
    console.error('[FIN] ExchangeRate: Error fetching rates:', error);
    // Return Dead Signal Vektor (don't throw)
    return createVektor(
      [],
      'EXCHANGE_RATE_API',
      'exchangerate_connector',
      currentRegimeId,
      [0, 0] // Dead Signal
    );
  }
}

/**
 * Fetches a single exchange rate pair
 * @param pair Currency pair (e.g., "USD/EUR")
 * @returns Vektor-wrapped exchange rate (number)
 */
export async function fetchRate(pair: string): Promise<Traceable<number>> {
  const ratesVektor = await fetchExchangeRates([pair]);
  
  if (ratesVektor.conf[0] === 0 && ratesVektor.conf[1] === 0) {
    // Dead Signal
    return createVektor(
      0,
      'EXCHANGE_RATE_API',
      'exchangerate_connector',
      currentRegimeId,
      [0, 0]
    );
  }

  const rate = ratesVektor.val.length > 0 ? ratesVektor.val[0].rate : 0;
  
  return createVektor(
    rate,
    'EXCHANGE_RATE_API',
    'exchangerate_connector',
    currentRegimeId,
    rate > 0 ? [0.8, 0.9] : [0, 0]
  );
}

/**
 * Calculates Gravity constant from exchange rates
 * Higher volatility in rates = higher gravity
 * @param rates Exchange rates array
 * @returns Gravity value (0-1 scale, can be scaled to actual gravity)
 */
export function calculateGravityFromRates(rates: ExchangeRate[]): number {
  if (rates.length === 0) return 0;

  // Calculate volatility across rates
  const rateValues = rates.map(r => r.rate);
  const mean = rateValues.reduce((a, b) => a + b, 0) / rateValues.length;
  const variance = rateValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / rateValues.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / mean;

  // Normalize to 0-1 scale (higher volatility = higher gravity)
  const gravity = Math.min(coefficientOfVariation * 10, 1.0);

  return gravity;
}
