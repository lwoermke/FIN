/**
 * Store Hooks
 * React hooks for subscribing to Store data with selector pattern.
 * 
 * Provides reactive data binding between Store and React components.
 */

import { useState, useEffect, useRef } from 'react';
import { store } from '../../kernel/registry/Store.js';
import type { Traceable } from '../../kernel/registry/Vektor.js';

/**
 * Hook to subscribe to a specific path in the Store
 * @param path Registry path to subscribe to
 * @returns The Vektor at that path, or undefined
 */
export function useVektor<T>(path: string): Traceable<T> | undefined {
    const [vektor, setVektor] = useState<Traceable<T> | undefined>(
        () => store.get<T>(path)
    );

    useEffect(() => {
        const unsubscribe = store.subscribe<T>(path, (v) => {
            setVektor(v);
        });
        return unsubscribe;
    }, [path]);

    return vektor;
}

/**
 * Hook to get just the value from a Store path
 * @param path Registry path
 * @returns The raw value, or undefined
 */
export function useValue<T>(path: string): T | undefined {
    const vektor = useVektor<T>(path);
    return vektor?.val;
}

/**
 * Hook to subscribe to multiple paths with a selector
 * @param selector Function that selects data from the store
 * @param deps Dependencies for the selector
 * @returns Selected data
 */
export function useSelector<T>(
    selector: (snapshot: Map<string, Traceable<unknown>>) => T,
    deps: React.DependencyList = []
): T {
    const selectorRef = useRef(selector);
    selectorRef.current = selector;

    const [selected, setSelected] = useState<T>(() =>
        selectorRef.current(store.getSnapshot())
    );

    useEffect(() => {
        const unsubscribe = store.subscribeAll(() => {
            const newSelected = selectorRef.current(store.getSnapshot());
            setSelected(newSelected);
        });
        return unsubscribe;
    }, deps);

    return selected;
}

/**
 * Hook to subscribe to all Vektors from a specific source
 * @param source Source identifier (e.g., "YFINANCE_API")
 * @returns Array of { path, vektor } tuples
 */
export function useSource(source: string): Array<{ path: string; vektor: Traceable<unknown> }> {
    const [vektors, setVektors] = useState<Array<{ path: string; vektor: Traceable<unknown> }>>(
        () => store.getVektorsBySource(source)
    );

    useEffect(() => {
        const unsubscribe = store.subscribeToSource(source, () => {
            setVektors(store.getVektorsBySource(source));
        });
        return unsubscribe;
    }, [source]);

    return vektors;
}

/**
 * Hook to subscribe to a block (endogenous or exogenous)
 * @param block Block identifier
 * @returns Array of { path, vektor } tuples
 */
export function useBlock(block: 'endogenous' | 'exogenous'): Array<{ path: string; vektor: Traceable<unknown> }> {
    const [vektors, setVektors] = useState<Array<{ path: string; vektor: Traceable<unknown> }>>(
        () => store.getVektorsByBlock(block)
    );

    useEffect(() => {
        const unsubscribe = store.subscribeAll(() => {
            setVektors(store.getVektorsByBlock(block));
        });
        return unsubscribe;
    }, [block]);

    return vektors;
}

/**
 * Hook to get portfolio assets with their weights
 * Selects from Store paths matching portfolio pattern
 */
export function usePortfolioAssets(): Array<{
    ticker: string;
    weight: number;
    value: number;
    variance: number;
    region: string;
}> {
    return useSelector((snapshot) => {
        const assets: Array<{
            ticker: string;
            weight: number;
            value: number;
            variance: number;
            region: string;
        }> = [];

        snapshot.forEach((vektor, path) => {
            if (path.startsWith('portfolio.assets.')) {
                const val = vektor.val as any;
                if (val && typeof val === 'object') {
                    assets.push({
                        ticker: val.ticker || path.split('.').pop() || '',
                        weight: val.weight || 0,
                        value: val.value || 0,
                        variance: vektor.conf[1] - vektor.conf[0],
                        region: val.region || 'US'
                    });
                }
            }
        });

        return assets;
    }, []);
}

/**
 * Hook to get news/sentiment data (Block B / Exogenous)
 */
export function useNewsWire(): Array<{
    id: string;
    title: string;
    source: string;
    sentiment: number;
    timestamp: number;
    relevantAssets: string[];
}> {
    return useSelector((snapshot) => {
        const news: Array<{
            id: string;
            title: string;
            source: string;
            sentiment: number;
            timestamp: number;
            relevantAssets: string[];
        }> = [];

        snapshot.forEach((vektor, path) => {
            if (path.startsWith('intelligence.news.') || vektor.src === 'GNEWS_API') {
                const val = vektor.val as any;
                if (val && typeof val === 'object' && val.title) {
                    news.push({
                        id: path,
                        title: val.title || '',
                        source: val.source || vektor.src,
                        sentiment: val.sentiment || 0,
                        timestamp: vektor.time,
                        relevantAssets: val.relevantAssets || []
                    });
                }
            }
        });

        return news.sort((a, b) => b.timestamp - a.timestamp);
    }, []);
}

/**
 * Hook to get trade ledger entries
 */
export function useLedger(): Array<{
    id: string;
    ticker: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: number;
    merkleHash?: string;
}> {
    return useSelector((snapshot) => {
        const trades: Array<{
            id: string;
            ticker: string;
            action: 'BUY' | 'SELL';
            quantity: number;
            price: number;
            timestamp: number;
            merkleHash?: string;
        }> = [];

        snapshot.forEach((vektor, path) => {
            if (path.startsWith('ledger.trades.')) {
                const val = vektor.val as any;
                if (val && typeof val === 'object') {
                    trades.push({
                        id: path,
                        ticker: val.ticker || '',
                        action: val.action || 'BUY',
                        quantity: val.quantity || 0,
                        price: val.price || 0,
                        timestamp: vektor.time,
                        merkleHash: val.merkleHash
                    });
                }
            }
        });

        return trades.sort((a, b) => b.timestamp - a.timestamp);
    }, []);
}

/**
 * Hook to get Polymarket shadow odds
 */
export function usePolymarketOdds(): Array<{
    market: string;
    outcome: string;
    probability: number;
    volume: number;
}> {
    return useSelector((snapshot) => {
        const odds: Array<{
            market: string;
            outcome: string;
            probability: number;
            volume: number;
        }> = [];

        snapshot.forEach((vektor, path) => {
            if (path.startsWith('intelligence.polymarket.') || vektor.src === 'POLYMARKET_API') {
                const val = vektor.val as any;
                if (val && typeof val === 'object') {
                    odds.push({
                        market: val.market || '',
                        outcome: val.outcome || '',
                        probability: val.probability || 0,
                        volume: val.volume || 0
                    });
                }
            }
        });

        return odds;
    }, []);
}
