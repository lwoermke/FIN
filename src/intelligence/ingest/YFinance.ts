/**
 * [Phases 2 & 7.2] YFinance Connector
 * OHLCV data fetching (Block A - Endogenous).
 * 
 * Zero-Trust: Validates all API responses.
 * Vektorization: Every data point wrapped immediately.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { createVektor } from '../../kernel/registry/Vektor.js';

/**
 * OHLCV data point
 */
export interface OHLCV {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

/**
 * YFinance API response structure (simplified)
 */
interface YFinanceResponse {
  chart?: {
    result?: Array<{
      meta?: {
        symbol?: string;
        regularMarketPrice?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: number[];
          high?: number[];
          low?: number[];
          close?: number[];
          volume?: number[];
        }>;
      };
    }>;
  };
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
 * Type guard for YFinance response validation
 */
function isValidYFinanceResponse(data: unknown): data is YFinanceResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return 'chart' in obj;
}

/**
 * Normalizes a value to a strict number type
 * @param value Value to normalize
 * @returns Normalized number or null
 */
function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * Fetches OHLCV data for a ticker
 * @param ticker Stock ticker symbol
 * @param period Period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
 * @param interval Interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
 * @returns Vektor-wrapped OHLCV data array
 */
export async function fetchOHLCV(
  ticker: string,
  period: string = '1mo',
  interval: string = '1d'
): Promise<Traceable<OHLCV[]>> {
  try {
    // YFinance API endpoint (using yahoo finance API)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period=${period}&interval=${interval}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FIN System',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      // Return Dead Signal Vektor
      return createVektor(
        [],
        'YFINANCE_API',
        'yfinance_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const data: unknown = await response.json();

    // Zero-Trust: Validate schema
    if (!isValidYFinanceResponse(data)) {
      console.warn('[FIN] YFinance: Invalid response schema');
      return createVektor(
        [],
        'YFINANCE_API',
        'yfinance_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    // Extract OHLCV data
    const ohlcvData: OHLCV[] = [];
    
    if (data.chart?.result && data.chart.result.length > 0) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0];

      if (quote && timestamps.length > 0) {
        const opens = quote.open || [];
        const highs = quote.high || [];
        const lows = quote.low || [];
        const closes = quote.close || [];
        const volumes = quote.volume || [];

        for (let i = 0; i < timestamps.length; i++) {
          const open = normalizeNumber(opens[i]);
          const high = normalizeNumber(highs[i]);
          const low = normalizeNumber(lows[i]);
          const close = normalizeNumber(closes[i]);
          const volume = normalizeNumber(volumes[i]);

          // Only add if all values are valid
          if (open !== null && high !== null && low !== null && close !== null && volume !== null) {
            ohlcvData.push({
              open,
              high,
              low,
              close,
              volume,
              timestamp: timestamps[i] * 1000 // Convert to milliseconds
            });
          }
        }
      }
    }

    // Calculate conf based on data quality
    const conf: [number, number] = ohlcvData.length > 0 ? [0.85, 0.95] : [0, 0];

    // Wrap in Vektor structure
    return createVektor(
      ohlcvData,
      'YFINANCE_API',
      'yfinance_connector',
      currentRegimeId,
      conf
    );
  } catch (error) {
    console.error('[FIN] YFinance: Error fetching OHLCV:', error);
    // Return Dead Signal Vektor (don't throw)
    return createVektor(
      [],
      'YFINANCE_API',
      'yfinance_connector',
      currentRegimeId,
      [0, 0] // Dead Signal
    );
  }
}

/**
 * Fetches current price for a ticker
 * @param ticker Stock ticker symbol
 * @returns Vektor-wrapped price (number)
 */
export async function fetchPrice(ticker: string): Promise<Traceable<number>> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FIN System',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return createVektor(
        0,
        'YFINANCE_API',
        'yfinance_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const data: unknown = await response.json();

    if (!isValidYFinanceResponse(data)) {
      return createVektor(
        0,
        'YFINANCE_API',
        'yfinance_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
    const normalizedPrice = normalizeNumber(price);

    if (normalizedPrice === null) {
      return createVektor(
        0,
        'YFINANCE_API',
        'yfinance_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    return createVektor(
      normalizedPrice,
      'YFINANCE_API',
      'yfinance_connector',
      currentRegimeId,
      [0.9, 0.95] // High conf for current price
    );
  } catch (error) {
    console.error('[FIN] YFinance: Error fetching price:', error);
    return createVektor(
      0,
      'YFINANCE_API',
      'yfinance_connector',
      currentRegimeId,
      [0, 0] // Dead Signal
    );
  }
}
