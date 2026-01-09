/**
 * [7.2] GNews Connector
 * Keyword-based news with sentiment analysis (Block B - Exogenous).
 * 
 * Zero-Trust: Validates all API responses.
 * Vektorization: Every data point wrapped immediately.
 * Sentiment Analysis: Bag of Words / TF-IDF score (-1.0 to 1.0).
 * Marked with { type: 'exogenous' } metadata for Decoupler.
 */

import type { Traceable } from '../../kernel/registry/Vektor.js';
import { createVektor } from '../../kernel/registry/Vektor.js';
import { store } from '../../kernel/registry/Store.js';

/**
 * GNews API configuration
 */
let gnewsApiKey: string = '';

/**
 * Current regime identifier
 */
let currentRegimeId: string = 'default';

/**
 * Sets the GNews API key
 * @param apiKey GNews API key
 */
export function setGNewsApiKey(apiKey: string): void {
  gnewsApiKey = apiKey;
}

/**
 * Sets the current regime identifier
 * @param regimeId Regime identifier
 */
export function setCurrentRegime(regimeId: string): void {
  currentRegimeId = regimeId;
}

/**
 * News article with sentiment
 */
export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
  source: string;
  sentiment: number; // -1.0 to 1.0
}

/**
 * Extended Vektor with exogenous metadata
 */
export interface ExogenousVektor<T> extends Traceable<T> {
  type: 'exogenous';
}

/**
 * GNews API response structure
 */
interface GNewsResponse {
  articles?: Array<{
    title?: string;
    description?: string;
    url?: string;
    publishedAt?: string;
    source?: {
      name?: string;
    };
  }>;
  totalArticles?: number;
}

/**
 * Type guard for GNews response validation
 */
function isValidGNewsResponse(data: unknown): data is GNewsResponse {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  return 'articles' in obj;
}

/**
 * Positive sentiment words (simplified Bag of Words)
 */
const POSITIVE_WORDS = new Set([
  'up', 'rise', 'gain', 'surge', 'rally', 'boost', 'growth', 'profit', 'earnings',
  'beat', 'strong', 'positive', 'bullish', 'optimistic', 'success', 'win', 'high',
  'increase', 'improve', 'better', 'exceed', 'outperform', 'soar', 'jump', 'climb'
]);

/**
 * Negative sentiment words (simplified Bag of Words)
 */
const NEGATIVE_WORDS = new Set([
  'down', 'fall', 'drop', 'plunge', 'crash', 'loss', 'decline', 'miss', 'weak',
  'negative', 'bearish', 'pessimistic', 'fail', 'low', 'decrease', 'worse', 'underperform',
  'sink', 'tumble', 'slump', 'dip', 'shrink', 'cut', 'reduce', 'worry', 'concern', 'risk'
]);

/**
 * Calculates sentiment score using Bag of Words
 * @param text Text to analyze
 * @returns Sentiment score (-1.0 to 1.0)
 */
function calculateSentiment(text: string): number {
  if (!text || text.length === 0) return 0;

  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2);

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (POSITIVE_WORDS.has(word)) {
      positiveCount++;
    }
    if (NEGATIVE_WORDS.has(word)) {
      negativeCount++;
    }
  }

  const total = positiveCount + negativeCount;
  if (total === 0) return 0;

  // Normalize to -1.0 to 1.0
  const sentiment = (positiveCount - negativeCount) / Math.max(total, 1);
  return Math.max(-1.0, Math.min(1.0, sentiment));
}

/**
 * Fetches news articles by keyword
 * @param keyword Search keyword
 * @param maxResults Maximum number of results (default 10)
 * @returns Vektor-wrapped news articles with sentiment
 */
export async function fetchNews(
  keyword: string,
  maxResults: number = 10
): Promise<ExogenousVektor<NewsArticle[]>> {
  if (!gnewsApiKey) {
    // Return Dead Signal with exogenous type
    return {
      ...createVektor(
        [],
        'GNEWS_API',
        'gnews_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      ),
      type: 'exogenous'
    };
  }

  try {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(keyword)}&max=${maxResults}&token=${gnewsApiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      return {
        ...createVektor(
          [],
          'GNEWS_API',
          'gnews_connector',
          currentRegimeId,
          [0, 0] // Dead Signal
        ),
        type: 'exogenous'
      };
    }

    const data: unknown = await response.json();

    // Zero-Trust: Validate schema
    if (!isValidGNewsResponse(data)) {
      console.warn('[FIN] GNews: Invalid response schema');
      return {
        ...createVektor(
          [],
          'GNEWS_API',
          'gnews_connector',
          currentRegimeId,
          [0, 0] // Dead Signal
        ),
        type: 'exogenous'
      };
    }

    // Extract and analyze articles
    const articles: NewsArticle[] = [];

    if (data.articles && Array.isArray(data.articles)) {
      for (const article of data.articles) {
        const title = article.title || '';
        const description = article.description || '';
        const combinedText = `${title} ${description}`;

        // Calculate sentiment using Bag of Words
        const sentiment = calculateSentiment(combinedText);

        articles.push({
          title,
          description,
          url: article.url || '',
          publishedAt: article.publishedAt || '',
          source: article.source?.name || 'Unknown',
          sentiment
        });
      }
    }

    // Confidence based on number of articles and sentiment consistency
    const conf: [number, number] = articles.length > 0 ? [0.6, 0.8] : [0, 0];

    const finalVektor = {
      ...createVektor(
        articles,
        'GNEWS_API',
        'gnews_connector',
        currentRegimeId,
        conf
      ),
      type: 'exogenous'
    };

    // Wire to Kernel: Store in intelligence.news.{keyword}
    // Using a simple ID for now, in prod could be timestamped or hashed
    const topicKey = keyword.toLowerCase().replace(/[^a-z0-9]/g, '_');
    store.set(`intelligence.news.${topicKey}`, finalVektor);

    return finalVektor as ExogenousVektor<NewsArticle[]>;
  } catch (error) {
    console.error('[FIN] GNews: Error fetching news:', error);
    // Return Dead Signal Vektor (don't throw)
    return {
      ...createVektor(
        [],
        'GNEWS_API',
        'gnews_connector',
        currentRegimeId,
        [0, 0] // Dead Signal
      ),
      type: 'exogenous'
    };
  }
}

/**
 * Fetches news and returns average sentiment score
 * @param keyword Search keyword
 * @returns Vektor-wrapped sentiment score (-1.0 to 1.0)
 */
export async function fetchSentiment(
  keyword: string
): Promise<ExogenousVektor<number>> {
  const newsVektor = await fetchNews(keyword, 10);

  if (newsVektor.conf[0] === 0 && newsVektor.conf[1] === 0) {
    // Dead Signal
    return {
      ...createVektor(
        0,
        'GNEWS_API',
        'gnews_connector',
        currentRegimeId,
        [0, 0]
      ),
      type: 'exogenous'
    };
  }

  // Calculate average sentiment
  const articles = newsVektor.val;
  const avgSentiment = articles.length > 0
    ? articles.reduce((sum, a) => sum + a.sentiment, 0) / articles.length
    : 0;

  return {
    ...createVektor(
      avgSentiment,
      'GNEWS_API',
      'gnews_connector',
      currentRegimeId,
      [0.6, 0.8] // Moderate conf for sentiment analysis
    ),
    type: 'exogenous'
  };
}
