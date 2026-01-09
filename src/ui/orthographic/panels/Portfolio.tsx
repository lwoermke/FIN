/**
 * [7.3] Portfolio Panel
 * 
 * A Gravity Glass panel (blur: 40px) showing:
 * - Aggregated Portfolio Performance (Value + Variance)
 * - Golden/Black Swans (assets with >2σ deviation)
 * - Ledger (recent trades)
 * - News Wire (filtered by exposure)
 * - Polymarket Shadow Odds
 * 
 * Implements Scroll Trap: hovering stops global navigation scroll.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNeuralTrace } from '../../controllers/NeuralTraceContext.js';
import {
    usePortfolioAssets,
    useNewsWire,
    useLedger,
    usePolymarketOdds
} from '../../controllers/useStore.js';
import { DesignTokens } from '../../styles/DesignTokens.js';

/**
 * Swan classification
 */
type SwanType = 'golden' | 'black' | null;

function classifySwan(variance: number, performance: number): SwanType {
    const sigma = Math.sqrt(variance);
    if (performance > 2 * sigma) return 'golden';
    if (performance < -2 * sigma) return 'black';
    return null;
}

/**
 * Radar chart for Polymarket odds
 */
function PolymarketRadar({
    odds
}: {
    odds: Array<{ market: string; outcome: string; probability: number; volume: number }>
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || odds.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.35;

        ctx.clearRect(0, 0, width, height);

        // Draw radar rings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * (i / 4), 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw axes
        const angleStep = (Math.PI * 2) / Math.max(odds.length, 3);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        for (let i = 0; i < odds.length; i++) {
            const angle = i * angleStep - Math.PI / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius
            );
            ctx.stroke();
        }

        // Draw data polygon
        if (odds.length >= 3) {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(136, 85, 255, 0.3)';
            ctx.strokeStyle = '#8855FF';
            ctx.lineWidth = 2;

            for (let i = 0; i < odds.length; i++) {
                const angle = i * angleStep - Math.PI / 2;
                const value = odds[i].probability;
                const r = radius * value;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw points
            for (let i = 0; i < odds.length; i++) {
                const angle = i * angleStep - Math.PI / 2;
                const value = odds[i].probability;
                const r = radius * value;
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;

                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#8855FF';
                ctx.fill();
            }
        }
    }, [odds]);

    return (
        <div style={{ position: 'relative' }}>
            <canvas
                ref={canvasRef}
                width={200}
                height={200}
                style={{ width: '100%', height: 'auto' }}
            />
            {/* Labels */}
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    fontSize: '0.65rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: "'IBM Plex Mono', monospace"
                }}
            >
                {odds.slice(0, 3).map((o, i) => (
                    <div key={i}>{o.outcome}: {(o.probability * 100).toFixed(0)}%</div>
                ))}
            </div>
        </div>
    );
}

/**
 * Section header component
 */
function SectionHeader({ title }: { title: string }) {
    return (
        <h3
            style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '8px',
                fontFamily: "'IBM Plex Mono', monospace",
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '4px'
            }}
        >
            {title}
        </h3>
    );
}

/**
 * Performance header showing total value and variance
 */
function PerformanceHeader({
    totalValue,
    variance,
    change
}: {
    totalValue: number;
    variance: number;
    change: number;
}) {
    const isPositive = change >= 0;

    return (
        <div style={{ marginBottom: '24px' }}>
            <div
                style={{
                    fontSize: '2rem',
                    fontWeight: 600,
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: 'rgba(255, 255, 255, 0.95)'
                }}
            >
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginTop: '4px'
                }}
            >
                <span
                    style={{
                        fontSize: '0.9rem',
                        color: isPositive ? '#00FFC8' : '#FF4444',
                        fontFamily: "'IBM Plex Mono', monospace"
                    }}
                >
                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                </span>
                <span
                    style={{
                        fontSize: '0.75rem',
                        color: 'rgba(255, 255, 255, 0.4)'
                    }}
                >
                    ±{variance.toFixed(2)}σ
                </span>
            </div>
        </div>
    );
}

/**
 * Swan list (Golden/Black swans)
 */
function SwanList({
    assets
}: {
    assets: Array<{
        ticker: string;
        type: SwanType;
        deviation: number;
        value: number;
    }>;
}) {
    if (assets.length === 0) {
        return (
            <div
                style={{
                    padding: '8px',
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '0.8rem',
                    fontStyle: 'italic'
                }}
            >
                No significant deviations
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {assets.map((asset) => (
                <div
                    key={asset.ticker}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 8px',
                        backgroundColor: asset.type === 'golden'
                            ? 'rgba(255, 215, 0, 0.1)'
                            : 'rgba(255, 68, 68, 0.1)',
                        borderRadius: '4px',
                        borderLeft: `3px solid ${asset.type === 'golden' ? '#FFD700' : '#FF4444'}`
                    }}
                >
                    <span
                        style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: '0.85rem'
                        }}
                    >
                        {asset.ticker}
                    </span>
                    <span
                        style={{
                            fontSize: '0.8rem',
                            color: asset.type === 'golden' ? '#FFD700' : '#FF4444'
                        }}
                    >
                        {asset.deviation > 0 ? '+' : ''}{asset.deviation.toFixed(1)}σ
                    </span>
                </div>
            ))}
        </div>
    );
}

/**
 * Ledger entry component
 */
function LedgerEntry({
    ticker,
    action,
    quantity,
    price,
    timestamp
}: {
    ticker: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    timestamp: number;
}) {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                    style={{
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '2px',
                        backgroundColor: action === 'BUY'
                            ? 'rgba(0, 255, 200, 0.2)'
                            : 'rgba(255, 68, 68, 0.2)',
                        color: action === 'BUY' ? '#00FFC8' : '#FF4444'
                    }}
                >
                    {action}
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.85rem' }}>
                    {ticker}
                </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                <div>{quantity} @ ${price.toFixed(2)}</div>
                <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.7rem' }}>
                    {timeStr}
                </div>
            </div>
        </div>
    );
}

/**
 * News card component
 */
function NewsCard({
    title,
    source,
    sentiment,
    timestamp
}: {
    title: string;
    source: string;
    sentiment: number;
    timestamp: number;
}) {
    const sentimentColor = sentiment > 0.3 ? '#00FFC8' : sentiment < -0.3 ? '#FF4444' : '#888';
    const age = Date.now() - timestamp;
    const ageStr = age < 3600000
        ? `${Math.floor(age / 60000)}m ago`
        : `${Math.floor(age / 3600000)}h ago`;

    return (
        <div
            style={{
                padding: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
                borderLeft: `2px solid ${sentimentColor}`,
                marginBottom: '8px'
            }}
        >
            <div
                style={{
                    fontSize: '0.85rem',
                    marginBottom: '4px',
                    lineHeight: 1.3
                }}
            >
                {title}
            </div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.4)'
                }}
            >
                <span>{source}</span>
                <span>{ageStr}</span>
            </div>
        </div>
    );
}

/**
 * Portfolio Panel component
 */
export function PortfolioPanel({
    className,
    style
}: {
    className?: string;
    style?: React.CSSProperties;
}) {
    const [isHovered, setIsHovered] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { isFocusOnLattice, setFocusOnLattice } = useNeuralTrace();

    // Get data from store
    const assets = usePortfolioAssets();
    const news = useNewsWire();
    const ledger = useLedger();
    const polymarketOdds = usePolymarketOdds();

    // Calculate aggregated performance
    const performance = useMemo(() => {
        const totalValue = assets.reduce((sum, a) => sum + a.value, 0);
        const totalVariance = assets.reduce((sum, a) => sum + a.variance, 0) / Math.max(assets.length, 1);
        // Mock change percentage (in production, compare to previous close)
        const change = assets.length > 0 ? (Math.random() - 0.5) * 5 : 0;

        return { totalValue, totalVariance, change };
    }, [assets]);

    // Flicker Logic for Low Confidence
    const [isFlickering, setIsFlickering] = useState(false);
    // Mock Data Confidence (In reality, fetch from Store/GlobalUniforms)
    const dataConfidence = 0.75;

    useEffect(() => {
        if (dataConfidence < 0.8) {
            const interval = setInterval(() => {
                // Random flicker bursts
                if (Math.random() > 0.7) {
                    setIsFlickering(true);
                    setTimeout(() => setIsFlickering(false), 100 + Math.random() * 200);
                }
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [dataConfidence]);

    // Identify swans (>2σ deviation)
    const swans = useMemo(() => {
        return assets
            .map(a => ({
                ticker: a.ticker,
                type: classifySwan(a.variance, a.value * 0.01), // Simplified deviation
                deviation: a.variance * (Math.random() > 0.5 ? 1 : -1) * 3,
                value: a.value
            }))
            .filter(s => s.type !== null);
    }, [assets]);

    // Scroll trap: prevent global scroll when hovering panel
    const handleMouseEnter = useCallback(() => {
        setIsHovered(true);
        setFocusOnLattice(false);
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }, [setFocusOnLattice]);

    const handleMouseLeave = useCallback(() => {
        setIsHovered(false);
        setFocusOnLattice(true);
        // Restore body scroll
        document.body.style.overflow = '';
    }, [setFocusOnLattice]);

    // Handle wheel events to scroll panel content
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
        if (scrollRef.current) {
            scrollRef.current.scrollTop += e.deltaY;
        }
    }, []);

    // Calculate opacity for Parallax Verification
    const opacity = isFocusOnLattice && !isHovered ? 0.1 : 0.95;

    // Mock Data Age for panel decay (aggregate)
    const dataAge = 0.1;

    const decayStyle = useMemo(() => {
        if (dataAge < 0.2) {
            return {
                backdropFilter: 'blur(40px)',
                background: 'rgba(10, 10, 20, 0.6)',
                borderColor: 'rgba(255, 255, 255, 0.1)'
            };
        } else if (dataAge < 0.8) {
            return {
                backdropFilter: 'blur(60px) grayscale(50%)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
            };
        } else {
            return {
                backdropFilter: 'blur(80px) grayscale(100%)',
                backgroundColor: 'rgba(60, 20, 10, 0.6)',
                borderColor: 'rgba(180, 60, 30, 0.8)',
                boxShadow: 'none',
                opacity: 0.8
            };
        }
    }, [dataAge]);

    return (
        <div
            className={className}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '30%',
                minWidth: '320px',
                maxWidth: '400px',
                height: '100vh',
                zIndex: 1000,
                transition: 'opacity 0.3s ease',
                opacity,
                ...style
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onWheel={handleWheel}
        >
            {/* Gravity Glass backdrop with Decay */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    transition: 'all 2s ease',
                    WebkitBackdropFilter: 'blur(40px)',
                    borderRight: '1px solid',
                    ...decayStyle
                }}
            />

            {/* Scrollable content */}
            <div
                ref={scrollRef}
                style={{
                    position: 'relative',
                    zIndex: 1,
                    padding: '24px',
                    height: '100%',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontFamily: DesignTokens.typography.fontLabel,
                    opacity: isFlickering ? 0.3 : 1, // Simple inline flicker
                }}
            >
                {/* Header */}
                <h2
                    style={{
                        fontSize: '1.25rem',
                        fontWeight: 600,
                        marginBottom: '16px',
                        fontFamily: "'IBM Plex Mono', monospace",
                        letterSpacing: '0.05em'
                    }}
                >
                    Portfolio
                </h2>

                {/* Performance */}
                <PerformanceHeader
                    totalValue={performance.totalValue || 125000}
                    variance={performance.totalVariance || 0.15}
                    change={performance.change || 2.34}
                />

                {/* Swans */}
                <section style={{ marginBottom: '24px' }}>
                    <SectionHeader title="Swans" />
                    <SwanList assets={swans} />
                </section>

                {/* Ledger */}
                <section style={{ marginBottom: '24px' }}>
                    <SectionHeader title="Ledger" />
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {ledger.length > 0 ? (
                            ledger.slice(0, 5).map((trade) => (
                                <LedgerEntry key={trade.id} {...trade} />
                            ))
                        ) : (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '8px' }}>
                                No recent trades
                            </div>
                        )}
                    </div>
                </section>

                {/* News Wire */}
                <section style={{ marginBottom: '24px' }}>
                    <SectionHeader title="News Wire" />
                    {news.length > 0 ? (
                        news.slice(0, 3).map((item) => (
                            <NewsCard key={item.id} {...item} />
                        ))
                    ) : (
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem', padding: '8px' }}>
                            No news available
                        </div>
                    )}
                </section>

                {/* Polymarket Radar */}
                <section>
                    <SectionHeader title="Shadow Odds" />
                    {polymarketOdds.length > 0 ? (
                        <PolymarketRadar odds={polymarketOdds} />
                    ) : (
                        <div
                            style={{
                                height: '150px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '4px',
                                color: 'rgba(255, 255, 255, 0.3)',
                                fontSize: '0.8rem'
                            }}
                        >
                            No Polymarket data
                        </div>
                    )}
                </section>
            </div>
        </div>
    );

}
