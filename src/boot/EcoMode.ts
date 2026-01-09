/**
 * [Phase 7.9] Eco-Regime (Power & Focus Management)
 * 
 * Manages system performance tiers based on:
 * 1. Battery Status (High/Low/Critical)
 * 2. Visibility (Visible/Hidden)
 * 3. User Engagement (Active/Idle)
 */

import { store } from '../kernel/registry/Store';
import { createVektor } from '../kernel/registry/Vektor';

export type EcoTier = 'PRIME' | 'ECO' | 'COMA';
export type FrameloopMode = 'always' | 'demand' | 'never';

export class EcoMode {
    private static isActive: boolean = false;
    private static battery: any = null;
    private static isLowPower: boolean = false;
    private static idleTimer: number | null = null;
    private static lastInteraction: number = Date.now();

    // Constants
    private static IDLE_THRESHOLD_MS = 30000; // 30s
    private static CRITICAL_BATTERY_LEVEL = 0.2; // 20%

    // State Tracking
    private static state = {
        tier: 'PRIME' as EcoTier,
        charging: true,
        level: 1.0,
        visible: true,
        idle: false
    };

    /**
     * Initialize the Eco-Regime
     */
    static async init() {
        if (this.isActive) return;
        this.isActive = true;

        console.log('[FIN] Eco-Regime: Initializing...');

        // 1. Battery Listener
        if ('getBattery' in navigator) {
            try {
                if (this.battery !== null) return;
                // @ts-ignore
                const battery = await (navigator as any).getBattery();
                this.battery = battery;
                this.updateBatteryStatus();
                this.battery.addEventListener('chargingchange', () => this.updateBatteryStatus());
                this.battery.addEventListener('levelchange', () => this.updateBatteryStatus());
            } catch (e) {
                console.warn('[EcoMode] Battery API unavailable');
            }
        }

        // 2. Visibility Listener
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

        // 3. Idle Listener
        window.addEventListener('mousemove', () => this.resetIdleTimer());
        window.addEventListener('keydown', () => this.resetIdleTimer());
        window.addEventListener('click', () => this.resetIdleTimer());
        this.resetIdleTimer(); // Start timer

        // Initial Evaluation
        this.evaluate();
    }

    /**
     * Handle Battery Updates
     */
    private static updateBatteryStatus() {
        if (!this.battery) return;
        this.state.charging = this.battery.charging;
        this.state.level = this.battery.level;
        this.evaluate();
    }

    /**
     * Handle Visibility Changes (The Coma State)
     */
    private static handleVisibilityChange() {
        this.state.visible = document.visibilityState === 'visible';

        if (!this.state.visible) {
            // IMMEDIATE ACTION: HARD STOP
            console.log('[EcoMode] ENTERING COMA (Tab Hidden)');
            this.enforceComa();
        } else {
            console.log('[EcoMode] WAKING UP (Tab Visible)');
            // Request Catch-Up Frame
            this.evaluate();
            window.dispatchEvent(new CustomEvent('SYSTEM_WAKE'));
        }
    }

    /**
     * Handle User Activity
     */
    private static resetIdleTimer() {
        this.state.idle = false;
        this.lastInteraction = Date.now();

        if (this.idleTimer) {
            window.clearTimeout(this.idleTimer);
        }

        // Set timer for Idle State
        this.idleTimer = window.setTimeout(() => {
            this.state.idle = true;
            console.log('[EcoMode] USER IDLE DETECTED (>30s)');
            this.evaluate();
        }, this.IDLE_THRESHOLD_MS);

        // If we were idle, re-evaluate to wake up
        if (store.getValue('system.eco.tier') === 'ECO' && this.state.visible) {
            this.evaluate();
        }
    }

    /**
     * Force Coma State (Hidden)
     */
    private static enforceComa() {
        this.state.tier = 'COMA';
        this.dispatchConfig({
            mode: 'COMA',
            dpr: 0.5, // Minimal
            frameloop: 'never',
            clouds: false,
            opacity: 0.0,
            paused: true // Pause Data
        });

        // Pause Physics
        window.dispatchEvent(new CustomEvent('PHYSICS_PAUSE_REQUEST'));
    }

    /**
     * Evaluate System State and Determine Tier
     */
    private static evaluate() {
        if (!this.state.visible) {
            // Should already be handled, but double check
            this.enforceComa();
            return;
        }

        // Physics Resume (if we were paused)
        window.dispatchEvent(new CustomEvent('PHYSICS_RESUME_REQUEST'));

        let tier: EcoTier = 'PRIME';

        // Check Battery Criticality
        const isBatteryCritical = !this.state.charging && this.state.level < this.CRITICAL_BATTERY_LEVEL;

        if (isBatteryCritical) {
            tier = 'ECO';
            // Dispatch specific critical event
            store.set('system.eco.critical', createVektor(true, 'ECO_MODE', 'power', 'SYSTEM', [1.0, 1.0]));
        } else {
            store.set('system.eco.critical', createVektor(false, 'ECO_MODE', 'power', 'SYSTEM', [1.0, 1.0]));
        }

        // Check Idle
        if (this.state.idle) {
            tier = 'ECO';
        }

        this.state.tier = tier;

        if (tier === 'PRIME') {
            this.dispatchConfig({
                mode: 'PRIME',
                dpr: 2.0, // Retina
                frameloop: 'always',
                clouds: true,
                opacity: 1.0,
                paused: false
            });
        } else if (tier === 'ECO') {
            this.dispatchConfig({
                mode: 'ECO',
                // 1. Battery Logic
                dpr: isBatteryCritical ? 1.0 : 2.0,
                clouds: !isBatteryCritical,

                // 2. Idle Logic
                frameloop: this.state.idle ? 'demand' : 'always',
                opacity: this.state.idle ? 0.3 : 1.0,

                paused: false
            });
        }
    }

    /**
     * Dispatch Configuration to Store
     */
    private static dispatchConfig(config: {
        mode: string;
        dpr: number;
        frameloop: FrameloopMode;
        clouds: boolean;
        opacity: number;
        paused: boolean;
    }) {
        console.log(`[EcoMode] Transitioning to ${config.mode}`, config);

        store.set('system.eco.mode', createVektor(config.mode, 'ECO_MODE', 'state', 'SYSTEM'));
        store.set('system.eco.dpr', createVektor(config.dpr, 'ECO_MODE', 'config', 'SYSTEM'));
        store.set('system.eco.frameloop', createVektor(config.frameloop, 'ECO_MODE', 'config', 'SYSTEM'));
        store.set('system.eco.clouds', createVektor(config.clouds, 'ECO_MODE', 'config', 'SYSTEM'));
        store.set('system.eco.opacity', createVektor(config.opacity, 'ECO_MODE', 'config', 'SYSTEM'));
        store.set('system.eco.paused', createVektor(config.paused, 'ECO_MODE', 'config', 'SYSTEM'));
    }
}
