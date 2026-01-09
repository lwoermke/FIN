/**
 * [Red Team] Cliff Hunter
 * 
 * Identifies the "Point of No Return" for the portfolio.
 * Calculates distance to liquidation and maps to terrain coordinates.
 * 
 * Algorithm: Distance_To_Liquidation = (Price - LiquidationPrice) / (Volatility * Price)
 */

import { Vektor, createVektor } from '../kernel/registry/Vektor.js';
import { RiemannMetric } from '../math/topology/RiemannMetric.js';
import { store } from '../kernel/registry/Store.js';

export interface LiquidationRisk {
    /** Distance to liquidation (in volatility units) */
    distance: number;
    /** Liquidation trigger price */
    liquidationPrice: number;
    /** Current price */
    currentPrice: number;
    /** Volatility used in calculation */
    volatility: number;
    /** Coordinates on terrain (for crater placement) */
    terrainCoords: [number, number];
    /** Risk status */
    status: 'critical' | 'warning' | 'safe';
}

export class CliffHunter {
    private metric: RiemannMetric;
    private readonly DRAWDOWN_THRESHOLD = 0.5;
    private maintenanceMargin = 0.25;
    private listeners: ((risk: LiquidationRisk) => void)[] = [];

    constructor() {
        this.metric = new RiemannMetric();
    }

    /**
     * Subscribe to liquidation risk updates
     */
    onLiquidationRisk(callback: (risk: LiquidationRisk) => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Calculate distance to liquidation
     */
    calculateLiquidationDistance(
        currentPrice: number,
        entryPrice: number,
        leverage: number,
        volatility: number,
        isLong: boolean = true
    ): LiquidationRisk {
        // Calculate liquidation price
        let liquidationPrice: number;
        if (isLong) {
            liquidationPrice = entryPrice * (1 - (1 - this.maintenanceMargin) / leverage);
        } else {
            liquidationPrice = entryPrice * (1 + (1 - this.maintenanceMargin) / leverage);
        }

        // Distance in price terms
        const priceDistance = isLong
            ? currentPrice - liquidationPrice
            : liquidationPrice - currentPrice;

        // Normalize by volatility (how many "daily moves" away)
        const volatilityDistance = priceDistance / (volatility * currentPrice);

        // Map to terrain coordinates
        const terrainX = ((currentPrice - liquidationPrice) / entryPrice) * 50;
        const terrainZ = Math.max(0, 10 - volatilityDistance) * 5;

        const status = volatilityDistance < 2 ? 'critical' : volatilityDistance < 5 ? 'warning' : 'safe';

        const risk: LiquidationRisk = {
            distance: volatilityDistance,
            liquidationPrice,
            currentPrice,
            volatility,
            terrainCoords: [terrainX, terrainZ],
            status,
        };

        // Publish to listeners
        this.listeners.forEach(cb => cb(risk));

        // Store in registry
        const riskVektor = createVektor(
            [volatilityDistance, liquidationPrice, terrainX, terrainZ],
            'CLIFF_HUNTER',
            'liquidation_distance',
            status,
            [0.95, 0.95]
        );
        store.set('risk.liquidation', riskVektor);

        return risk;
    }

    /**
     * Hunts for the cliff edge for a given portfolio state
     */
    hunt(current: Vektor): Vektor {
        const cliff = { ...current, val: [...current.val] };
        let simulatedValue = 1.0;
        let iterations = 0;

        while (simulatedValue > (1.0 - this.DRAWDOWN_THRESHOLD) && iterations < 100) {
            cliff.val.forEach((v, i) => {
                if (i % 2 === 0) {
                    cliff.val[i] *= 0.95;
                } else {
                    cliff.val[i] *= 1.10;
                }
            });

            const avgPrice = cliff.val.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) / (cliff.val.length / 2);
            const avgVol = cliff.val.filter((_, i) => i % 2 !== 0).reduce((a, b) => a + b, 0) / (cliff.val.length / 2);

            simulatedValue = avgPrice * (1 - avgVol * 0.2);
            iterations++;
        }

        return cliff;
    }

    /**
     * Set maintenance margin requirement
     */
    setMaintenanceMargin(margin: number) {
        this.maintenanceMargin = Math.max(0.01, Math.min(0.5, margin));
    }
}

export const cliffHunter = new CliffHunter();

