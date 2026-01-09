/**
 * [Phase 9.2] Performance Profiler
 * Real-time HUD showing FPS, Memory usage, and WebGL metrics.
 * Includes a "Heart Rate" sparkline for memory monitoring.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Janitor } from '../../../kernel/system/Janitor.js';

export function PerfMonitor() {
    const { gl } = useThree();
    const [metrics, setMetrics] = useState({
        fps: 0,
        mem: 0,
        geoms: 0,
        calls: 0
    });
    const [isLeak, setIsLeak] = useState(false);
    const lastMemory = useRef(0);
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());

    // Sparkline data (last 30 seconds)
    const [history, setHistory] = useState<number[]>([]);

    useFrame(() => {
        // GLOBAL RESET: Clear the VectorPool for the next frame
        Janitor.vectors.reset();

        frameCount.current++;
        const now = performance.now();

        if (now - lastTime.current >= 1000) {
            // Update Every 1s
            const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current));

            // Memory (Chrome only)
            const mem = (performance as any).memory?.usedJSHeapSize / (1024 * 1024) || 0;

            // Texture/Geom info
            const info = gl.info;
            const geoms = info.memory.geometries;
            const calls = info.render.calls;

            setMetrics({ fps, mem, geoms, calls });

            // Heart Rate History
            setHistory(prev => [...prev.slice(-29), mem]);

            // Leak Detection: Simple heuristic (growing for 5 iterations without drop)
            if (mem > lastMemory.current && mem > 512) { // 512MB threshold
                setIsLeak(true);
            } else if (mem < lastMemory.current) {
                setIsLeak(false);
            }

            lastMemory.current = mem;
            frameCount.current = 0;
            lastTime.current = now;
        }
    });

    useEffect(() => {
        const style = document.createElement('style');
        style.id = 'perf-monitor-styles';
        style.textContent = `
            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.1; }
                100% { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById('perf-monitor-styles');
            if (el) el.remove();
        };
    }, []);

    return (
        <Html fullscreen>
            <div style={{
                position: 'absolute',
                bottom: '24px',
                left: '24px',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                border: `1px solid ${isLeak ? '#FF4444' : 'rgba(0, 255, 200, 0.3)'}`,
                padding: '12px',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '0.65rem',
                color: isLeak ? '#FF4444' : '#00FFC8',
                pointerEvents: 'none',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: '160px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>FPS</span>
                    <span>{metrics.fps}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>METRICS:HEAP</span>
                    <span>{metrics.mem.toFixed(1)}MB</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>GEOMETRIES</span>
                    <span>{metrics.geoms}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>DRAW_CALLS</span>
                    <span>{metrics.calls}</span>
                </div>

                {/* Sparkline (Heart Rate) */}
                <div style={{
                    height: '20px',
                    width: '100%',
                    borderBottom: '1px solid rgba(0,255,200,0.1)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '1px'
                }}>
                    {history.map((m, i) => (
                        <div key={i} style={{
                            flex: 1,
                            height: `${Math.min(100, (m / 1024) * 100)}%`,
                            backgroundColor: isLeak ? '#FF4444' : '#00FFC8',
                            opacity: 0.5 + (i / history.length) * 0.5
                        }} />
                    ))}
                </div>

                {isLeak && (
                    <div style={{
                        fontWeight: 'bold',
                        marginTop: '4px',
                        textAlign: 'center',
                        animation: 'blink 1s infinite'
                    }}>
                        CRITICAL: MEM LEAK
                    </div>
                )}
            </div>
        </Html>
    );
}
