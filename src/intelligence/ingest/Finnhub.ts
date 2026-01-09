/**
 * [Phases 2 & 7.2] Finnhub Connector
 * Basic Financials and Company Profile (Block A - Endogenous).
 * 
 * Zero-Trust: Validates all API responses.
 * Vektorization: Every data point wrapped immediately.
 * Maps "Metric Quality" to conf field.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { createVektor } from '../../kernel/registry/Vektor.js';

/**
 * Finnhub API configuration
 */
let finnhubApiKey: string = '';

/**
 * Current regime identifier
 */
let currentRegimeId: string = 'default';

/**
 * Sets the Finnhub API key
 * @param apiKey Finnhub API key
 */
export function setFinnhubApiKey(apiKey: string): void {
  finnhubApiKey = apiKey;
}

/**
 * Sets the current regime identifier
 * @param regimeId Regime identifier
 */
export function setCurrentRegime(regimeId: string): void {
  currentRegimeId = regimeId;
}

/**
 * Metric quality levels from Finnhub
 */
export enum MetricQuality {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  UNKNOWN = 'unknown'
}

/**
 * Maps metric quality to conf interval
 * @param quality Metric quality
 * @returns Confidence interval [lower, upper]
 */
function mapQualityToConfidence(quality: MetricQuality | string): [number, number] {
  switch (quality) {
    case MetricQuality.HIGH:
      return [0.85, 1.0];
    case MetricQuality.MEDIUM:
      return [0.65, 0.85];
    case MetricQuality.LOW:
      return [0.4, 0.65];
    default:
      return [0.5, 0.7]; // Default for unknown
  }
}

/**
 * Basic financials data structure
 */
export interface BasicFinancials {
  metric: string;
  value: number;
  quality: MetricQuality;
  period: string;
}

/**
 * Company profile data structure
 */
export interface CompanyProfile {
  ticker: string;
  name: string;
  exchange: string;
  industry: string;
  sector: string;
  marketCap?: number;
  employees?: number;
  website?: string;
  description?: string;
}

/**
 * Finnhub API response structures
 */
interface FinnhubBasicFinancialsResponse {
  metric?: Record<string, {
    value?: number;
    period?: string;
    metricType?: string;
  }>;
}

interface FinnhubCompanyProfileResponse {
  ticker?: string;
  name?: string;
  exchange?: string;
  finnhubIndustry?: string;
  sector?: string;
  marketCapitalization?: number;
  employeeTotal?: number;
  weburl?: string;
  description?: string;
}

/**
 * Type guard for basic financials response
 */
function isValidBasicFinancialsResponse(data: unknown): data is FinnhubBasicFinancialsResponse {
  return typeof data === 'object' && data !== null && 'metric' in data;
}

/**
 * Type guard for company profile response
 */
function isValidCompanyProfileResponse(data: unknown): data is FinnhubCompanyProfileResponse {
  return typeof data === 'object' && data !== null && 'ticker' in data;
}

/**
 * Fetches basic financials for a ticker
 * @param ticker Stock ticker symbol
 * @returns Vektor-wrapped basic financials array
 */
export async function fetchBasicFinancials(
  ticker: string
): Promise<Traceable<BasicFinancials[]>> {
  if (!finnhubApiKey) {
    return createVektor(
      [],
      'FINNHUB_API',
      'finnhub_connector',
      currentRegimeId,
      [0, 0] // Dead Signal
    );
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${finnhubApiKey}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      return createVektor(
        [],
        'FINNHUB_API',
        'finnhub_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const data: unknown = await response.json();

    // Zero-Trust: Validate schema
    if (!isValidBasicFinancialsResponse(data)) {
      console.warn('[FIN] Finnhub: Invalid basic financials response schema');
      return createVektor(
        [],
        'FINNHUB_API',
        'finnhub_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    // Extract financials
    const financials: BasicFinancials[] = [];
    
    if (data.metric) {
      for (const [metricName, metricData] of Object.entries(data.metric)) {
        const value = typeof metricData.value === 'number' ? metricData.value : null;
        const period = metricData.period || 'unknown';
        
        // Determine quality (simplified - in production, use actual quality field if available)
        let quality: MetricQuality = MetricQuality.MEDIUM;
        if (value !== null && !isNaN(value) && isFinite(value)) {
          quality = MetricQuality.HIGH;
        }

        if (value !== null) {
          financials.push({
            metric: metricName,
            value,
            quality,
            period
          });
        }
      }
    }

    // Calculate average conf from metric qualities
    const confs = financials.map(f => mapQualityToConfidence(f.quality));
    const avgLower = confs.reduce((sum, c) => sum + c[0], 0) / confs.length || 0;
    const avgUpper = confs.reduce((sum, c) => sum + c[1], 0) / confs.length || 0;

    return createVektor(
      financials,
      'FINNHUB_API',
      'finnhub_connector',
      currentRegimeId,
      financials.length > 0 ? [avgLower, avgUpper] : [0, 0]
    );
  } catch (error) {
    console.error('[FIN] Finnhub: Error fetching basic financials:', error);
    return createVektor(
      [],
      'FINNHUB_API',
      'finnhub_connector',
      currentRegimeId,
      [0, 0] // Dead Signal
    );
  }
}

/**
 * Fetches company profile for a ticker
 * @param ticker Stock ticker symbol
 * @returns Vektor-wrapped company profile
 */
export async function fetchCompanyProfile(
  ticker: string
): Promise<Traceable<CompanyProfile>> {
  if (!finnhubApiKey) {
    return createVektor(
      {
        ticker,
        name: '',
        exchange: '',
        industry: '',
        sector: ''
      },
      'FINNHUB_API',
      'finnhub_connector',
      currentRegimeId,
      [0, 0] // Dead Signal
    );
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubApiKey}`;
    
    const response = await fetch(url);

    if (!response.ok) {
      return createVektor(
        {
          ticker,
          name: '',
          exchange: '',
          industry: '',
          sector: ''
        },
        'FINNHUB_API',
        'finnhub_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const data: unknown = await response.json();

    // Zero-Trust: Validate schema
    if (!isValidCompanyProfileResponse(data)) {
      console.warn('[FIN] Finnhub: Invalid company profile response schema');
      return createVektor(
        {
          ticker,
          name: '',
          exchange: '',
          industry: '',
          sector: ''
        },
        'FINNHUB_API',
        'finnhub_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      );
    }

    const profile: CompanyProfile = {
      ticker: data.ticker || ticker,
      name: data.name || '',
      exchange: data.exchange || '',
      industry: data.finnhubIndustry || '',
      sector: data.sector || '',
      marketCap: typeof data.marketCapitalization === 'number' ? data.marketCapitalization : undefined,
      employees: typeof data.employeeTotal === 'number' ? data.employeeTotal : undefined,
      website: data.weburl,
      description: data.description
    };

    return createVektor(
      profile,
      'FINNHUB_API',
      'finnhub_connector',
      currentRegimeId,
      [0.85, 0.95] // High conf for company profile
    );
  } catch (error) {
    console.error('[FIN] Finnhub: Error fetching company profile:', error);
    return createVektor(
      {
        ticker,
        name: '',
        exchange: '',
        industry: '',
        sector: ''
      },
      'FINNHUB_API',
      'finnhub_connector',
        currentRegimeId,
      [0, 0] // Dead Signal
    );
  }
}
