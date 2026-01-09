/**
 * [7.2] Polymarket Shadow Odds Integration
 * Shadow Odds integration for sentiment/oracle data.
 * 
 * Fetches prediction market odds from Polymarket.
 * All responses are wrapped in Vektor<T> structure for traceability.
 * This data is routed to Block B (Exogenous) in the decoupler.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { createVektor } from '../../kernel/registry/Vektor.js';

/**
 * Polymarket market data
 */
export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  conditionId: string;
  outcomes: PolymarketOutcome[];
  volume: number;
  liquidity: number;
  endDate: string;
  imageUrl?: string;
}

/**
 * Polymarket outcome (Yes/No or multiple outcomes)
 */
export interface PolymarketOutcome {
  outcome: string;
  price: number; // Price in cents (0-100)
  volume: number;
}

/**
 * Polymarket shadow odds (probability estimate)
 */
export interface ShadowOdds {
  marketId: string;
  question: string;
  probability: number; // 0-1 probability
  conf: number; // 0-1 conf in the odds
  volume: number;
  timestamp: number;
}

/**
 * Current regime identifier
 */
let currentRegimeId: string = 'default';

/**
 * Polymarket API base URL
 */
const POLYMARKET_API_BASE = 'https://clob.polymarket.com';

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
 * Fetches active markets from Polymarket
 * @param limit Maximum number of markets to fetch
 * @param category Optional category filter
 * @returns Vektor-wrapped array of markets
 */
export async function fetchMarkets(
  limit: number = 50,
  category?: string
): Promise<Traceable<PolymarketMarket[]>> {
  try {
    let url = `${POLYMARKET_API_BASE}/markets?limit=${limit}`;
    if (category) {
      url += `&category=${category}`;
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Polymarket API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse markets from Polymarket API response
    const markets: PolymarketMarket[] = [];
    if (Array.isArray(data)) {
      for (const market of data) {
        markets.push({
          id: market.id || market.slug,
          question: market.question || '',
          slug: market.slug || '',
          conditionId: market.conditionId || '',
          outcomes: market.outcomes || [],
          volume: market.volume || 0,
          liquidity: market.liquidity || 0,
          endDate: market.endDate || '',
          imageUrl: market.imageUrl
        });
      }
    }

    // Wrap in Vektor structure
    return createVektor(
      markets,
      'POLYMARKET_API',
      'polymarket_scraper',
      currentRegimeId,
      [0.7, 0.9] // Lower conf for prediction markets (sentiment data)
    );
  } catch (error) {
    console.error('[FIN] Polymarket: Failed to fetch markets:', error);
    throw error;
  }
}

/**
 * Fetches shadow odds for a specific market
 * @param marketId Market ID or slug
 * @returns Vektor-wrapped shadow odds
 */
export async function fetchShadowOdds(
  marketId: string
): Promise<Traceable<ShadowOdds>> {
  try {
    // Fetch market details
    const response = await fetch(
      `${POLYMARKET_API_BASE}/markets/${marketId}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Polymarket market request failed: ${response.statusText}`);
    }

    const market = await response.json();

    // Calculate probability from market prices
    // For Yes/No markets, probability is the Yes price
    let probability = 0.5;
    let conf = 0.5;

    if (market.outcomes && market.outcomes.length > 0) {
      // Find Yes outcome or first outcome
      const yesOutcome = market.outcomes.find((o: any) => 
        o.outcome.toLowerCase().includes('yes') || o.outcome === 'Yes'
      ) || market.outcomes[0];

      if (yesOutcome && yesOutcome.price !== undefined) {
        // Price is in cents (0-100), convert to probability (0-1)
        probability = yesOutcome.price / 100;
      }

      // Confidence based on volume and liquidity
      const totalVolume = market.volume || 0;
      const liquidity = market.liquidity || 0;
      
      // Higher volume and liquidity = higher conf
      conf = Math.min(
        0.5 + (totalVolume / 100000) * 0.3 + (liquidity / 50000) * 0.2,
        0.9
      );
    }

    const shadowOdds: ShadowOdds = {
      marketId: market.id || marketId,
      question: market.question || '',
      probability,
      conf,
      volume: market.volume || 0,
      timestamp: Date.now()
    };

    // Wrap in Vektor structure
    return createVektor(
      shadowOdds,
      'POLYMARKET_API',
      'polymarket_scraper',
      currentRegimeId,
      [0.6, 0.85] // Moderate conf for prediction market odds
    );
  } catch (error) {
    console.error('[FIN] Polymarket: Failed to fetch shadow odds:', error);
    throw error;
  }
}

/**
 * Searches markets by keyword
 * @param query Search query
 * @param limit Maximum results
 * @returns Vektor-wrapped array of markets
 */
export async function searchMarkets(
  query: string,
  limit: number = 20
): Promise<Traceable<PolymarketMarket[]>> {
  try {
    // Polymarket search endpoint (if available)
    // Fallback to fetching all and filtering
    const allMarkets = await fetchMarkets(limit * 2);
    
    // Filter by query
    const filtered = allMarkets.val.filter(market =>
      market.question.toLowerCase().includes(query.toLowerCase()) ||
      market.slug.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);

    // Create new Vektor with filtered results
    return createVektor(
      filtered,
      'POLYMARKET_API',
      'polymarket_scraper',
      currentRegimeId,
      [0.7, 0.9]
    );
  } catch (error) {
    console.error('[FIN] Polymarket: Failed to search markets:', error);
    throw error;
  }
}
