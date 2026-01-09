/**
 * [Phase 7.4] Mempool.space Connector
 * The Truth Layer (Bitcoin Network State).
 * 
 * Source: https://mempool.space/api/v1/fees/recommended
 * Purpose: Network Congestion Pressure -> Physics Viscosity.
 * 
 * Logic:
 * - Fetches Fee Rates (sat/vB).
 * - Maps 'fastestFee' to 'viscosity' (0.0 - 1.0).
 * - High Fees = High Viscosity (Slower lattice animations).
 */

import { createVektor, Traceable } from '../../kernel/registry/Vektor.js';
import { store } from '../../kernel/registry/Store.js';

export interface MempoolFees {
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
}

const MEMPOOL_API = 'https://mempool.space/api/v1/fees/recommended';

/**
 * Fetches recommended bitcoin fees
 */
export async function fetchNetworkFees(): Promise<Traceable<MempoolFees>> {
    try {
        const response = await fetch(MEMPOOL_API);
        if (!response.ok) throw new Error('Mempool API failed');

        const data: MempoolFees = await response.json();

        // Map to Viscosity
        // Baseline: 10 sat/vB = 0.1 viscosity
        // Congestion: 100 sat/vB = 0.8 viscosity

        // Normalize: (fee / 100) clamped 0.05 to 0.95
        const viscosity = Math.min(Math.max(data.fastestFee / 100.0, 0.05), 0.95);

        const vektor = createVektor(
            data,
            'MEMPOOL_SPACE',
            'mempool_connector',
            'CRYPTO_CORE',
            [1.0, 1.0]
        );

        store.set('intelligence.network.fees', createVektor(
            data.fastestFee,
            'MEMPOOL_SPACE',
            'mempool_api',
            'NETWORK',
            [data.hourFee, data.fastestFee]
        ) as any);

        // Store Logic
        // We push this to a specific channel listened to by GroundView
        store.set('intelligence.chain.fees', vektor);
        store.set('intelligence.chain.viscosity', {
            ...createVektor(viscosity, 'DERIVED', 'physics_mapper', 'CRYPTO_CORE', [1.0, 1.0]),
            // @ts-ignore - Metadata is custom for this Vektor
            meta: { fee: data.fastestFee }
        });

        return vektor;

    } catch (error) {
        console.error('[FIN] Mempool Connector Error:', error);
        return createVektor(
            { fastestFee: 0, halfHourFee: 0, hourFee: 0, economyFee: 0, minimumFee: 0 },
            'MEMPOOL_SPACE',
            'mempool_connector',
            'CRYPTO_CORE',
            [0, 0]
        );
    }
}
