/**
 * [HUD] System Status Matrix
 * Displays the connection status of the 12 Global Satellites.
 * 
 * Features:
 * - 4x3 Grid
 * - Real-time Status Colors (Green, Cyan, Yellow, Red)
 * - Drill-down Terminal for Header Inspection
 */

import React, { useState, useEffect } from 'react';
import { store } from '../../kernel/registry/Store.js';
import { DesignTokens } from '../styles/DesignTokens.js';
import type { SatelliteID, ConnectionStatus } from '../../intelligence/ingest/NetworkPulse.js';

interface SatelliteData {
    id: SatelliteID;
    status: ConnectionStatus;
    latency: number;
    lastPing: number;
    headers: Record<string, string>;
}

const SATELLITE_ORDER: SatelliteID[] = [
    'FRED', 'SEC', 'BIS', 'EIA',
    'WB', 'OECD', 'POLY', 'MANI',
    'ALT', 'MEMP', 'YFIN', 'EXCH'
];

export function SystemStatus() {
    const [satellites, setSatellites] = useState<Record<string, SatelliteData>>({});
    const [selectedSat, setSelectedSat] = useState<SatelliteID | null>(null);

    // Subscribe to all satellite updates
    useEffect(() => {
        // We can use a wildcard subscription pattern or just specific ones
        // Store doesn't support wildcards natively yet, so we subscribe to the block?
        // Actually Store has `getVektorsByBlock` or specific paths.
        // For efficiency, let's subscribe individually or polling since it's 12 items.
        // Or better: NetworkPulse updates happen often.

        const unsubs: (() => void)[] = [];

        SATELLITE_ORDER.forEach(id => {
            const unsub = store.subscribe(`intelligence.network.satellites.${id}`, (vektor) => {
                setSatellites(prev => ({
                    ...prev,
                    [id]: vektor.val as SatelliteData
                }));
            });
            unsubs.push(unsub);
        });

        return () => unsubs.forEach(u => u());
    }, []);

    // Helper for Status Color
    const getStatusColor = (s: SatelliteData) => {
        if (!s) return '#333';

        // Pulse logic: if lastPing < 2000ms, it's ACTIVE GREEN
        const isPulse = (Date.now() - s.lastPing) < 2000;

        if (s.status === 'SEVERED') return '#FF4444'; // Red
        if (s.status === 'LAG') return '#FFD700'; // Yellow
        if (s.status === 'CRYO') return '#00AAFF'; // Blue

        if (isPulse) return '#00FFC8'; // Bright Green (Pulse)
        return '#0088AA'; // Cyan (Idle/Connected)
    };

    return (
        <>
            {/* Matrix Grid */}
            <div style={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '4px',
                zIndex: 9000
            }}>
                {SATELLITE_ORDER.map(id => {
                    const data = satellites[id];
                    const color = getStatusColor(data);

                    return (
                        <div
                            key={id}
                            onClick={() => setSelectedSat(id)}
                            style={{
                                width: '32px',
                                height: '24px',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                border: `1px solid ${color}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            title={`${id} - ${data ? data.status : 'OFFLINE'}`}
                        >
                            <span style={{
                                fontSize: '0.55rem',
                                color: color,
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontWeight: 'bold'
                            }}>
                                {id}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Drill-Down Terminal */}
            {selectedSat && satellites[selectedSat] && (
                <div style={{
                    position: 'fixed',
                    bottom: 60,
                    right: 20,
                    width: '300px',
                    backgroundColor: 'rgba(10, 10, 15, 0.95)',
                    border: `1px solid ${getStatusColor(satellites[selectedSat])}`,
                    backdropFilter: 'blur(10px)',
                    padding: '12px',
                    zIndex: 9001,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: '#ccc',
                    fontSize: '0.7rem',
                    boxShadow: '0 0 30px rgba(0,0,0,0.5)'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        paddingBottom: '8px',
                        marginBottom: '8px'
                    }}>
                        <span style={{ color: getStatusColor(satellites[selectedSat]), fontWeight: 'bold' }}>
                            UPLINK: {selectedSat}
                        </span>
                        <button
                            onClick={() => setSelectedSat(null)}
                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}
                        >
                            [X]
                        </button>
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                        <div>STATUS: {satellites[selectedSat].status}</div>
                        <div>LATENCY: {satellites[selectedSat].latency.toFixed(0)}ms</div>
                        <div>LAST_PING: {((Date.now() - satellites[selectedSat].lastPing) / 1000).toFixed(1)}s ago</div>
                    </div>

                    <div style={{
                        maxHeight: '150px',
                        overflowY: 'auto',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '4px'
                    }}>
                        <div style={{ color: '#666', marginBottom: '4px' }}>// HEADERS</div>
                        {Object.entries(satellites[selectedSat].headers || {}).map(([k, v]) => (
                            <div key={k} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ color: '#888' }}>{k}:</span> {v}
                            </div>
                        ))}
                        {Object.keys(satellites[selectedSat].headers || {}).length === 0 && (
                            <div style={{ color: '#444' }}>Waiting for packet...</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
