/**
 * [6.2] Neural Trace Overlay
 * SVG overlay that renders trace lines from metrics to their Vektor sources.
 * 
 * Visualizes the "Spatial Lineage" of data by drawing animated SVG paths
 * following isometric axes from the metric back to the source.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNeuralTrace } from '../../controllers/NeuralTraceContext.js';

/**
 * Bezier control point calculation for isometric-style curves
 */
function calculateIsometricPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number
): string {
    // Create path that follows isometric axes (30° angles)
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Midpoint
    const mx = x1 + dx / 2;
    const my = y1 + dy / 2;

    // Control points for bezier curve with isometric feel
    // First segment goes horizontal-ish, then vertical-ish
    const cp1x = x1 + dx * 0.3;
    const cp1y = y1;
    const cp2x = mx;
    const cp2y = my - Math.abs(dy) * 0.2;
    const cp3x = x2 - dx * 0.3;
    const cp3y = y2;

    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${mx} ${my} S ${cp3x} ${cp3y}, ${x2} ${y2}`;
}

/**
 * Neural Trace Overlay component
 * Renders SVG trace lines when metrics are hovered
 */
export function NeuralTraceOverlay() {
    const { activeTrace, isTracing } = useNeuralTrace();
    const [animationOffset, setAnimationOffset] = useState(0);

    // Animate the dash offset for flowing effect
    useEffect(() => {
        if (!isTracing) return;

        let frame: number;
        const animate = () => {
            setAnimationOffset(prev => (prev + 0.5) % 20);
            frame = requestAnimationFrame(animate);
        };
        frame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frame);
    }, [isTracing]);

    // Generate path for current trace
    const tracePath = useMemo(() => {
        if (!activeTrace?.source) return null;

        const source = activeTrace.source;
        const target = activeTrace.target;

        // If we have a known target, draw to it
        // Otherwise, draw to a computed "source region" (top-left corner for APIs)
        const targetX = target?.x ?? 100;
        const targetY = target?.y ?? 100;

        return {
            path: calculateIsometricPath(source.x, source.y, targetX, targetY),
            sourceX: source.x,
            sourceY: source.y,
            targetX,
            targetY,
            label: activeTrace.vektor.src
        };
    }, [activeTrace]);

    if (!isTracing || !tracePath) {
        return null;
    }

    return (
        <svg
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 9999
            }}
        >
            <defs>
                {/* Gradient for trace line */}
                <linearGradient id="traceGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00FFC8" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#00AAFF" stopOpacity="0.7" />
                    <stop offset="100%" stopColor="#8855FF" stopOpacity="0.5" />
                </linearGradient>

                {/* Glow filter */}
                <filter id="traceGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Arrow marker */}
                <marker
                    id="traceArrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="5"
                    refY="5"
                    orient="auto-start-reverse"
                >
                    <path
                        d="M 0 0 L 10 5 L 0 10 z"
                        fill="#00FFC8"
                        opacity="0.8"
                    />
                </marker>
            </defs>

            {/* Background glow path */}
            <path
                d={tracePath.path}
                fill="none"
                stroke="#00FFC8"
                strokeWidth="8"
                strokeLinecap="round"
                opacity="0.15"
                filter="url(#traceGlow)"
            />

            {/* Main trace path */}
            <path
                d={tracePath.path}
                fill="none"
                stroke="url(#traceGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="10 10"
                strokeDashoffset={-animationOffset}
                markerEnd="url(#traceArrow)"
            />

            {/* Source endpoint (metric) */}
            <circle
                cx={tracePath.sourceX}
                cy={tracePath.sourceY}
                r="6"
                fill="#00FFC8"
                opacity="0.9"
            >
                <animate
                    attributeName="r"
                    values="6;8;6"
                    dur="1s"
                    repeatCount="indefinite"
                />
            </circle>

            {/* Target endpoint (source) */}
            <g transform={`translate(${tracePath.targetX}, ${tracePath.targetY})`}>
                {/* Outer ring */}
                <circle
                    r="12"
                    fill="none"
                    stroke="#8855FF"
                    strokeWidth="2"
                    opacity="0.6"
                >
                    <animate
                        attributeName="r"
                        values="12;16;12"
                        dur="1.5s"
                        repeatCount="indefinite"
                    />
                    <animate
                        attributeName="opacity"
                        values="0.6;0.3;0.6"
                        dur="1.5s"
                        repeatCount="indefinite"
                    />
                </circle>

                {/* Inner dot */}
                <circle r="4" fill="#8855FF" opacity="0.9" />
            </g>

            {/* Source label */}
            <g transform={`translate(${tracePath.targetX}, ${tracePath.targetY - 25})`}>
                <rect
                    x="-60"
                    y="-12"
                    width="120"
                    height="24"
                    rx="4"
                    fill="rgba(0, 0, 0, 0.8)"
                    stroke="#8855FF"
                    strokeWidth="1"
                    opacity="0.9"
                />
                <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#FFFFFF"
                    fontSize="11"
                    fontFamily="'IBM Plex Mono', monospace"
                >
                    {tracePath.label}
                </text>
            </g>

            {/* Vektor metadata panel */}
            {activeTrace && (
                <g transform={`translate(${tracePath.sourceX + 20}, ${tracePath.sourceY - 60})`}>
                    <rect
                        x="0"
                        y="0"
                        width="200"
                        height="80"
                        rx="4"
                        fill="rgba(20, 20, 30, 0.95)"
                        stroke="rgba(0, 255, 200, 0.3)"
                        strokeWidth="1"
                    />

                    {/* Header */}
                    <text x="10" y="18" fill="#00FFC8" fontSize="10" fontWeight="600">
                        VEKTOR TRACE
                    </text>

                    {/* Source */}
                    <text x="10" y="35" fill="rgba(255,255,255,0.6)" fontSize="9">
                        src: <tspan fill="rgba(255,255,255,0.9)">{activeTrace.vektor.src}</tspan>
                    </text>

                    {/* Model */}
                    <text x="10" y="50" fill="rgba(255,255,255,0.6)" fontSize="9">
                        model: <tspan fill="rgba(255,255,255,0.9)">{activeTrace.vektor.model_id}</tspan>
                    </text>

                    {/* Confidence */}
                    <text x="10" y="65" fill="rgba(255,255,255,0.6)" fontSize="9">
                        conf: <tspan fill="rgba(255,255,255,0.9)">
                            [{activeTrace.vektor.conf[0].toFixed(2)}, {activeTrace.vektor.conf[1].toFixed(2)}]
                        </tspan>
                    </text>
                </g>
            )}
        </svg>
    );
}
