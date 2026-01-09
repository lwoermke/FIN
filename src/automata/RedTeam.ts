/**
 * [Red Team] Stress-GAN Logic
 * Adversarial System that actively tries to break the portfolio.
 * 
 * Uses Gradient Descent to find the "Black Swan" vector:
 * The configuration that minimizes Portfolio Value while staying
 * within realistic probability bounds (< 4 sigma).
 */

import { Vektor } from '../kernel/registry/Vektor.js';
import { createVektor } from '../kernel/registry/Vektor.js';
import { store } from '../kernel/registry/Store.js';
import { RiemannMetric } from '../math/topology/RiemannMetric.js';

export class RedTeam {
    private metric: RiemannMetric;
    private readonly MAX_SIGMA = 4.0;
    private readonly LEARNING_RATE = 0.1;
    private listeners: ((swan: Vektor) => void)[] = [];

    constructor() {
        this.metric = new RiemannMetric();
    }

    /**
     * Subscribe to Black Swan events
     */
    onBlackSwan(callback: (swan: Vektor) => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    /**
     * Published the found swan to listeners
     */
    private publish(swan: Vektor) {
        this.listeners.forEach(cb => cb(swan));
    }

    /**
     * Generates a realistic worst-case scenario (Black Swan)
     * @param current Current market state
     * @iterations Optimization steps
     * @returns The adversarial vector
     */
    generateBlackSwan(current: Vektor, iterations: number = 50): Vektor {
        // Clone starting state (The "Generator")
        const swan = { ...current, val: [...current.val] };

        for (let i = 0; i < iterations; i++) {
            // 1. Calculate Gradient of Value Function (Sensitivity)
            const gradient = this.computeGradient(swan);

            // 2. Step towards ruin (Minimize Value)
            // swan = swan - learningRate * gradient
            // Since gradient points uphill (increasing value), we subtract to go downhill.
            for (let j = 0; j < swan.val.length; j++) {
                swan.val[j] -= this.LEARNING_RATE * gradient[j];
            }

            // 3. Project onto Constraint Manifold (The "Discriminator")
            // Enforce max sigma distance from origin (current state)
            const distance = this.metric.distance(current, swan);

            if (distance > this.MAX_SIGMA) {
                // Normalize direction and scale to MAX_SIGMA
                // Simplified projection: interpolate back towards origin
                const scale = this.MAX_SIGMA / distance;
                for (let j = 0; j < swan.val.length; j++) {
                    // Vector math: origin + (point - origin) * scale
                    swan.val[j] = current.val[j] + (swan.val[j] - current.val[j]) * scale;
                }
            }
        }

        this.publish(swan);

        // Wire to Kernel: Dispatch global risk state
        // Re-wrap or assuming swan is already a Vektor
        // We create a fresh Vektor to ensure metadata is correct for the Event
        const riskVektor = createVektor(
            swan.val,
            'RED_TEAM',
            'stress_gan',
            'active',
            [0.9, 0.9] // High confidence in this risk assessment
        );
        store.set('intelligence.risk.global', riskVektor);

        return swan;
    }

    /**
     * Numerically estimates the gradient of the Portfolio Value function
     */
    private computeGradient(state: Vektor): number[] {
        const EPSILON = 0.001;
        const gradient: number[] = [];
        const baseValue = this.portfolioValue(state);

        for (let i = 0; i < state.val.length; i++) {
            // Perturb dimension i
            state.val[i] += EPSILON;
            const upValue = this.portfolioValue(state);
            state.val[i] -= EPSILON; // Restore

            // derivative = (f(x+h) - f(x)) / h
            gradient.push((upValue - baseValue) / EPSILON);
        }

        return gradient;
    }

    /**
     * Mock Valuation Engine
     * Higher is better.
     * Assumes even indices are Price (Pos), odd are Risk (Neg).
     */
    private portfolioValue(state: Vektor): number {
        let value = 0;
        for (let i = 0; i < state.val.length; i++) {
            if (i % 2 === 0) {
                value += state.val[i]; // + Price
            } else {
                value -= state.val[i]; // - Risk
            }
        }
        return value;
    }
}

export const redTeam = new RedTeam();
