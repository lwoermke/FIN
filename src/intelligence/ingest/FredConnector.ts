/**
 * [Phases 2 & 7.2] FRED Connector
 * Macro-Satellite data.
 * 
 * Fetches macroeconomic data from Federal Reserve Economic Data (FRED) API.
 * All responses are wrapped in Vektor<T> structure for traceability.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { createVektor } from '../../kernel/registry/Vektor.js';

/**
 * FRED API configuration
 */
export interface FredConfig {
  apiKey: string;
  baseUrl: string;
}

/**
 * FRED time series data point
 */
export interface FredDataPoint {
  date: string;
  value: number | null;
}

/**
 * FRED time series response
 */
export interface FredTimeSeries {
  seriesId: string;
  title: string;
  units: string;
  frequency: string;
  data: FredDataPoint[];
}

/**
 * Current regime identifier
 */
let currentRegimeId: string = 'default';

/**
 * FRED API key
 */
const fredApiKey = import.meta.env.VITE_FRED_KEY || '';

/**
 * Sets the current regime identifier
 * @param regimeId Regime identifier
 */
export function setCurrentRegime(regimeId: string): void {
  currentRegimeId = regimeId;
}

/**
 * Gets the current regime identifier
 * @returns Current regime ID
 */
export function getCurrentRegime(): string {
  return currentRegimeId;
}

/**
 * Common FRED series IDs for macro indicators
 */
export const FRED_SERIES = {
  GDP: 'GDP',             // Gross Domestic Product
  CPI: 'CPIAUCSL',        // Consumer Price Index for All Urban Consumers: All Items
  UNRATE: 'UNRATE',       // Unemployment Rate
  YIELD_10Y2Y: 'T10Y2Y'   // 10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity
} as const;


/**
 * Helper: Calculate YoY % Change
 * @param currentValue Current value
 * @param previousValue Value from one year ago
 * @returns Percentage change
 */
function calculateYoY(currentValue: number, previousValue: number): number {
  if (previousValue === 0) return 0;
  return ((currentValue - previousValue) / previousValue);
}

/**
 * Fetches a time series from FRED API
 * @param seriesId FRED series ID
 * @param startDate Optional start date (YYYY-MM-DD)
 * @returns Vektor-wrapped time series data
 */
export async function fetchTimeSeries(
  seriesId: string,
  startDate?: string
): Promise<Traceable<FredTimeSeries>> {
  if (!fredApiKey) {
    console.warn('[FIN] FRED API key missing.');
    return createVektor(
      { seriesId, title: 'MISSING_KEY', units: '', frequency: '', data: [] },
      'FRED_API',
      'fred_connector',
      currentRegimeId,
      [0, 0]
    );
  }

  try {
    let url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json`;
    if (startDate) url += `&observation_start=${startDate}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`FRED API request failed: ${response.statusText}`);

    const data = await response.json();
    if (data.error_code) throw new Error(`FRED API error: ${data.error_message}`);

    // Fetch Metadata
    const metaResponse = await fetch(`https://api.stlouisfed.org/fred/series?series_id=${seriesId}&api_key=${fredApiKey}&file_type=json`);
    let title = seriesId, units = '', frequency = '';
    if (metaResponse.ok) {
      const meta = await metaResponse.json();
      if (meta.seriess && meta.seriess.length > 0) {
        title = meta.seriess[0].title;
        units = meta.seriess[0].units;
        frequency = meta.seriess[0].frequency;
      }
    }

    // Parse Data
    const dataPoints: FredDataPoint[] = [];
    if (data.observations) {
      for (const obs of data.observations) {
        const val = obs.value === '.' ? null : parseFloat(obs.value);
        dataPoints.push({ date: obs.date, value: val });
      }
    }

    // Normalization Logic for specific series (YoY)
    // If it's CPI or GDP, we might want to attach a computed "YoY" metric to the Vektor metadata or modify value?
    // For now, we return the raw series, but we could compute a derived "Inflation" signal here.

    // NOTE: For now, returning raw data wrapped in Vektor.
    // The "Val" of the Vektor for a time series is usually the LATEST value, 
    // but here we are returning the whole series object as the payload.

    const timeSeries: FredTimeSeries = {
      seriesId,
      title,
      units,
      frequency,
      data: dataPoints
    };

    const vektor = createVektor(
      timeSeries,
      'FRED_API',
      'fred_connector',
      currentRegimeId,
      [0.9, 1.0]
    );

    // Push to Store
    const { store } = await import('../../kernel/registry/Store.js');
    store.set(`intelligence.macros.fred.${seriesId.toLowerCase()}`, vektor);

    return vektor;

  } catch (error) {
    console.error('[FIN] FredConnector: Failed to fetch time series:', error);
    // Return Dead Signal
    return createVektor(
      { seriesId, title: 'ERROR', units: '', frequency: '', data: [] },
      'FRED_API',
      'fred_connector',
      currentRegimeId,
      [0, 0]
    );
  }
}

/**
 * Fetches Core Macro Indicators (GDP, CPI, UNRATE, YIELD)
 * Returns a map of Vektors
 */
export async function fetchMacroIndicators(): Promise<Record<string, Traceable<FredTimeSeries>>> {
  const indicators = [FRED_SERIES.GDP, FRED_SERIES.CPI, FRED_SERIES.UNRATE, FRED_SERIES.YIELD_10Y2Y];
  const results: Record<string, Traceable<FredTimeSeries>> = {};

  // Parallel Fetch
  await Promise.all(indicators.map(async (id) => {
    results[id] = await fetchTimeSeries(id);
  }));

  return results;
}
