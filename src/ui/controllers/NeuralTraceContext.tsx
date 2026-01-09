/**
 * [6.2] Neural Trace Context
 * Manages hover state and trace line rendering for Spatial Lineage visualization.
 * 
 * Hovering a metric triggers visual SVG lines following isometric axes back
 * to the source. This provides Parallax Verification of data derivation.
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { Traceable } from '../../kernel/registry/Vektor.js';

/**
 * Trace line endpoint positions
 */
export interface TraceEndpoint {
    /** Element ID for the endpoint */
    id: string;
    /** X coordinate (screen pixels) */
    x: number;
    /** Y coordinate (screen pixels) */
    y: number;
    /** Label for the endpoint */
    label: string;
}

/**
 * Active trace connection
 */
export interface ActiveTrace {
    /** Unique ID for this trace */
    id: string;
    /** Source metric position */
    source: TraceEndpoint;
    /** Target vektor source position (if resolved) */
    target: TraceEndpoint | null;
    /** The vektor being traced */
    vektor: Traceable<unknown>;
    /** Registry path of the vektor */
    registryPath: string;
    /** Timestamp when trace was activated */
    activatedAt: number;
}

/**
 * Source position registration
 */
export interface SourcePosition {
    /** Registry path */
    path: string;
    /** X coordinate */
    x: number;
    /** Y coordinate */
    y: number;
    /** Source label */
    label: string;
}

/**
 * Neural Trace context value
 */
export interface NeuralTraceContextValue {
    /** Currently active trace (if any) */
    activeTrace: ActiveTrace | null;
    /** Whether any trace is active (for transparency effect) */
    isTracing: boolean;
    /** Focus mode - when true, Gravity Glass becomes transparent */
    isFocusOnLattice: boolean;
    /** Set focus on lattice (for Parallax Verification) */
    setFocusOnLattice: (focus: boolean) => void;
    /** Activate a trace for a metric */
    activateTrace: (
        metricId: string,
        vektor: Traceable<unknown>,
        registryPath: string,
        position: { x: number; y: number }
    ) => void;
    /** Deactivate the current trace */
    deactivateTrace: () => void;
    /** Register a source position (for trace endpoints) */
    registerSourcePosition: (source: SourcePosition) => void;
    /** Unregister a source position */
    unregisterSourcePosition: (path: string) => void;
    /** Get registered source positions */
    getSourcePositions: () => Map<string, SourcePosition>;
}

const NeuralTraceContext = createContext<NeuralTraceContextValue | null>(null);

/**
 * Neural Trace Provider
 * Wraps the application to provide trace state management
 */
export function NeuralTraceProvider({ children }: { children: React.ReactNode }) {
    const [activeTrace, setActiveTrace] = useState<ActiveTrace | null>(null);
    const [isFocusOnLattice, setFocusOnLattice] = useState(false);
    const sourcePositions = useRef<Map<string, SourcePosition>>(new Map());

    const activateTrace = useCallback((
        metricId: string,
        vektor: Traceable<unknown>,
        registryPath: string,
        position: { x: number; y: number }
    ) => {
        // Look up target position based on vektor source
        const sourcePath = vektor.src;
        const targetPos = sourcePositions.current.get(sourcePath);

        const trace: ActiveTrace = {
            id: `trace_${metricId}_${Date.now()}`,
            source: {
                id: metricId,
                x: position.x,
                y: position.y,
                label: registryPath.split('.').pop() || 'metric'
            },
            target: targetPos ? {
                id: sourcePath,
                x: targetPos.x,
                y: targetPos.y,
                label: targetPos.label
            } : null,
            vektor,
            registryPath,
            activatedAt: Date.now()
        };

        setActiveTrace(trace);
        console.log(`[NeuralTrace] Activated trace: ${registryPath} → ${sourcePath}`);
    }, []);

    const deactivateTrace = useCallback(() => {
        setActiveTrace(null);
    }, []);

    const registerSourcePosition = useCallback((source: SourcePosition) => {
        sourcePositions.current.set(source.path, source);
    }, []);

    const unregisterSourcePosition = useCallback((path: string) => {
        sourcePositions.current.delete(path);
    }, []);

    const getSourcePositions = useCallback(() => {
        return new Map(sourcePositions.current);
    }, []);

    const value: NeuralTraceContextValue = {
        activeTrace,
        isTracing: activeTrace !== null,
        isFocusOnLattice,
        setFocusOnLattice,
        activateTrace,
        deactivateTrace,
        registerSourcePosition,
        unregisterSourcePosition,
        getSourcePositions
    };

    return (
        <NeuralTraceContext.Provider value={value}>
            {children}
        </NeuralTraceContext.Provider>
    );
}

/**
 * Hook to access Neural Trace context
 */
export function useNeuralTrace(): NeuralTraceContextValue {
    const context = useContext(NeuralTraceContext);
    if (!context) {
        throw new Error('useNeuralTrace must be used within a NeuralTraceProvider');
    }
    return context;
}

/**
 * Hook to check if tracing is active (for components that need to react to it)
 */
export function useIsTracing(): boolean {
    const { isTracing } = useNeuralTrace();
    return isTracing;
}

/**
 * Hook for lattice focus state (for Parallax Verification)
 */
export function useLattiFocus(): {
    isFocusOnLattice: boolean;
    setFocusOnLattice: (focus: boolean) => void;
} {
    const { isFocusOnLattice, setFocusOnLattice } = useNeuralTrace();
    return { isFocusOnLattice, setFocusOnLattice };
}
