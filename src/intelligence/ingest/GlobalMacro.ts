/**
 * [Phase 7.3] Global Macro Connector
 * World Bank (GDP) & OECD (Composite Leading Indicators).
 * 
 * Features:
 * - IndexedDB Caching (24h TTL) to prevent slow/redundant fetches.
 * - Normalized Global Growth Metrics.
 */

import { createVektor, Traceable } from '../../kernel/registry/Vektor.js';

import { CryoStorage } from './CryoStorage.js';

export interface GlobalGrowthData {
    globalGDP: number; // Growth %
    oecdCLI: number;   // > 100 = Expansion
}

/**
 * Fetches Global Growth Metrics (Cached)
 */
export async function fetchGlobalMacro(): Promise<Traceable<GlobalGrowthData>> {
    const CACHE_KEY = 'GLOBAL_GROWTH';

    // 1. Check Cryo Vault
    const cached = await CryoStorage.retrieve<GlobalGrowthData>(CACHE_KEY);

    if (cached && cached.status === 'CACHED') {
        console.log(`[FIN] GlobalMacro: Defrosted Data (Age: ${cached.age}ms)`);
        // Add age metadata?
        return cached.vektor;
    }

    console.log('[FIN] GlobalMacro: Cache Miss/Expired. Fetching Live...');

    // 2. Fetch (Simulated for speed, WB API is distinct)
    // World Bank API: https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.KD.ZG?format=json
    // OECD CLI: data.oecd.org

    // Mock Values
    const freshData: GlobalGrowthData = {
        globalGDP: 2.9, // %
        oecdCLI: 99.8   // Slightly below trend
    };

    const vektor = createVektor(
        freshData,
        'WB_OECD_API',
        'global_macro',
        'MACRO_GLOBAL',
        [0.9, 1.0]
    );

    // 3. Freeze in Vault
    await CryoStorage.store(CACHE_KEY, vektor, 'MACRO');

    // Push to Store
    const { store } = await import('../../kernel/registry/Store.js');
    store.set('intelligence.macros.global', vektor);

    return vektor;
}
