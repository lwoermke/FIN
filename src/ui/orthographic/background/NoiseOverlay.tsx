import React from 'react';

/**
 * [UI] NoiseOverlay
 * Fixed simplex noise texture overlay to prevent digital banding.
 * Uses SVG filter for high-performance noise generation.
 * Opacity: 0.04 for subtle grit effect.
 */
export function NoiseOverlay() {
    return (
        <>
            {/* SVG Filter Definition */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <defs>
                    <filter id="noiseFilter">
                        <feTurbulence
                            type="fractalNoise"
                            baseFrequency="0.9"
                            numOctaves="4"
                            stitchTiles="stitch"
                        />
                        <feColorMatrix type="saturate" values="0" />
                    </filter>
                </defs>
            </svg>

            {/* Noise Overlay Layer */}
            <div
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    opacity: 0.04,
                    filter: 'url(#noiseFilter)',
                    mixBlendMode: 'overlay'
                }}
                aria-hidden="true"
            />
        </>
    );
}
