/**
 * [5.2] Conformal Cone Panel
 * 
 * A Gravity Glass panel containing the Conformal Cone chart.
 * Shows price with 98% uncertainty ribbon.
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { Traceable } from '../../../kernel/registry/Vektor.js';
import { store } from '../../../kernel/registry/Store.js';

interface PricePoint {
    price: number;
    upper: number;
    lower: number;
}

interface ConformalConePanelProps {
    /** Price data with uncertainty bounds */
    data?: Traceable<PricePoint[]> | null;
    /** Panel width */
    width?: number;
    /** Panel height */
    height?: number;
    /** Optional label */
    label?: string;
}

/**
 * Skeleton loading state
 */
function SkeletonPulse({ width, height }: { width: number; height: number }) {
    return (
        <div
            style={{
                width: width + 48,
                height: height + 80,
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '32px',
                animation: 'pulse-skeleton 2s infinite ease-in-out',
            }}
        >
            <style>{`
                @keyframes pulse-skeleton {
                    0%, 100% { opacity: 0.2; }
                    50% { opacity: 0.1; }
                }
            `}</style>
        </div>
    );
}

export function ConformalConePanel({
    data,
    width = 400,
    height = 200,
    label = 'UNCERTAINTY RIBBON'
}: ConformalConePanelProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [ribbonWidth, setRibbonWidth] = useState(1);
    const [priceData, setPriceData] = useState<PricePoint[]>([]);

    // Use provided data or generate demo data
    useEffect(() => {
        if (data && data.val) {
            setPriceData(data.val);
            return;
        }

        // Subscribe to volatility for ribbon width animation
        const unsubVol = store.subscribe<number>('math.kernels.volatility', (vektor) => {
            // Spring animation to target width
            const targetWidth = 1 + vektor.val * 10;
            setRibbonWidth(prev => prev + (targetWidth - prev) * 0.1);
        });

        // Generate demo data if no data provided
        const generateDemoData = () => {
            const points: PricePoint[] = [];
            let price = 100;
            for (let i = 0; i < 50; i++) {
                price += (Math.random() - 0.5) * 2;
                const uncertainty = price * 0.02 * ribbonWidth;
                points.push({
                    price,
                    upper: price + uncertainty,
                    lower: price - uncertainty,
                });
            }
            setPriceData(points);
        };

        generateDemoData();
        const interval = setInterval(generateDemoData, 2000);

        return () => {
            unsubVol();
            clearInterval(interval);
        };
    }, [data, ribbonWidth]);

    // Render chart
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || priceData.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Calculate bounds
        const allPrices = priceData.flatMap(p => [p.upper, p.lower]);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const range = maxPrice - minPrice || 1;
        const padding = 10;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        const toX = (i: number) => padding + (i / (priceData.length - 1)) * chartWidth;
        const toY = (p: number) => padding + chartHeight - ((p - minPrice) / range) * chartHeight;

        // Draw ribbon (filled area)
        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 243, 255, 0.15)';

        // Upper bound
        priceData.forEach((p, i) => {
            const x = toX(i);
            const y = toY(p.upper);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // Lower bound (reverse)
        for (let i = priceData.length - 1; i >= 0; i--) {
            const x = toX(i);
            const y = toY(priceData[i].lower);
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();

        // Draw ribbon edges
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        // Upper edge
        ctx.beginPath();
        priceData.forEach((p, i) => {
            const x = toX(i);
            const y = toY(p.upper);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Lower edge
        ctx.beginPath();
        priceData.forEach((p, i) => {
            const x = toX(i);
            const y = toY(p.lower);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw price line
        ctx.strokeStyle = '#00F3FF';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00F3FF';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        priceData.forEach((p, i) => {
            const x = toX(i);
            const y = toY(p.price);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.shadowBlur = 0;

    }, [priceData, width, height]);

    // Skeleton if data is explicitly null
    if (data === null) {
        return <SkeletonPulse width={width} height={height} />;
    }

    const lastPrice = priceData[priceData.length - 1]?.price;

    return (
        <div
            className="gravity-glass"
            style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '16px',
                }}
            >
                <span
                    style={{
                        fontSize: '0.65rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontFamily: "'IBM Plex Mono', monospace",
                    }}
                >
                    {label}
                </span>
                {lastPrice && (
                    <span
                        style={{
                            fontSize: '1rem',
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontWeight: 600,
                            color: '#00F3FF',
                        }}
                    >
                        ${lastPrice.toFixed(2)}
                    </span>
                )}
            </div>

            {/* Chart Canvas */}
            <canvas
                ref={canvasRef}
                style={{
                    width,
                    height,
                    borderRadius: '8px',
                }}
            />

            {/* Ribbon Width Indicator */}
            <div
                style={{
                    marginTop: '12px',
                    fontSize: '0.6rem',
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: 'rgba(255, 255, 255, 0.4)',
                }}
            >
                Uncertainty: ±{(ribbonWidth * 2).toFixed(1)}%
            </div>
        </div>
    );
}
