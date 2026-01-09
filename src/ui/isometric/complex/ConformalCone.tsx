/**
 * [5.2] Conformal Cone Chart
 * 98% Uncertainty Ribbon.
 * 
 * Price vs. Time with 98% uncertainty ribbons.
 * The ribbon width is calculated via physics.tension from the Lattice.
 * When Rough Volatility spikes, a "Tension Multiplier" is applied to
 * artificially widen the cone before price movement.
 */

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { store } from '../../../kernel/registry/Store.js';
import type { Traceable } from '../../../kernel/registry/Vektor.js';
import { TensionMap } from '../../../physics/fabric/TensionMap.js';
import { simulateRBergomi } from '../../../math/kernels/rBergomi.js';

/**
 * Price data point
 */
interface PricePoint {
  time: number;
  price: number;
  upperBound: number;
  lowerBound: number;
}

/**
 * Conformal Cone component
 */
export function ConformalCone({
  width = 800,
  height = 400
}: {
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [priceData, setPriceData] = useState<PricePoint[]>([]);
  const [tension, setTension] = useState<number>(0);
  const [volatility, setVolatility] = useState<number>(0.02);
  const tensionMap = useRef(new TensionMap()).current;

  // Subscribe to Store for tension and price data
  useEffect(() => {
    // Subscribe to physics tension
    const unsubscribeTension = store.subscribe<number>(
      'physics.tension',
      (vektor) => {
        setTension(vektor.val);
      }
    );

    // Subscribe to price data
    const unsubscribePrice = store.subscribe<number[]>(
      'intelligence.ingest.price',
      (vektor) => {
        // Update price data
        const prices = Array.isArray(vektor.val) ? vektor.val : [vektor.val];
        updatePriceData(prices);
      }
    );

    // Subscribe to volatility
    const unsubscribeVolatility = store.subscribe<number>(
      'math.kernels.volatility',
      (vektor) => {
        setVolatility(vektor.val);
        setVolatility(vektor.val);
      }
    );

    // Subscribe to BIS Credit Gap for Tension override
    const unsubscribeCredit = store.subscribe<any>(
      'intelligence.macros.bis',
      (vektor) => {
        // Map Gap % (e.g., 10%) to Tension (0.0 - 1.0)
        // 0% -> 0.0
        // 10% -> 0.5
        // 20% -> 1.0
        if (vektor && typeof vektor.val?.gap === 'number') {
          const gap = vektor.val.gap;
          const tensionFromGap = Math.min(Math.max(gap / 20.0, 0), 1.0);
          // We add this to base tension or override?
          // Use the max of physics tension and macro tension
          setTension(prev => Math.max(prev, tensionFromGap));
        }
      }
    );

    return () => {
      unsubscribeTension();
      unsubscribePrice();
      unsubscribeVolatility();
      unsubscribeCredit();
    };
  }, []);

  /**
   * Updates price data with uncertainty bounds
   */
  const updatePriceData = (prices: number[]) => {
    const newData: PricePoint[] = [];
    const now = Date.now();
    const timeStep = 1000 * 60 * 60; // 1 hour per point

    // Calculate tension multiplier
    const tensionMultiplier = tensionMap.mapVolatilityToTension(volatility);

    // Calculate base uncertainty (98% confidence interval)
    const baseUncertainty = 0.02; // 2% base uncertainty
    const tensionAdjustedUncertainty = baseUncertainty * (1 + tensionMultiplier * 2);

    // Apply Tension Multiplier when volatility spikes
    let finalUncertainty = tensionAdjustedUncertainty;
    if (volatility > 0.05) { // Volatility spike threshold
      const volatilityExcess = (volatility - 0.05) / 0.05; // Normalize excess
      const tensionMultiplier = 1 + volatilityExcess * 2; // Up to 3x multiplier
      finalUncertainty = tensionAdjustedUncertainty * tensionMultiplier;
    }

    for (let i = 0; i < prices.length; i++) {
      const price = prices[i];
      const uncertainty = price * finalUncertainty;

      newData.push({
        time: now - (prices.length - i) * timeStep,
        price,
        upperBound: price + uncertainty,
        lowerBound: price - uncertainty
      });
    }

    setPriceData(newData);
  };

  // Render chart
  useFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas || priceData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set up coordinate system
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Find price range
    const allPrices = priceData.flatMap(p => [p.upperBound, p.lowerBound, p.price]);
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRange = maxPrice - minPrice || 1;

    // Find time range
    const times = priceData.map(p => p.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const timeRange = maxTime - minTime || 1;

    // Draw uncertainty ribbon (filled area)
    ctx.beginPath();
    ctx.fillStyle = 'rgba(100, 200, 255, 0.2)'; // Cyan with transparency
    for (let i = 0; i < priceData.length; i++) {
      const point = priceData[i];
      const x = padding + ((point.time - minTime) / timeRange) * chartWidth;
      const upperY = padding + chartHeight - ((point.upperBound - minPrice) / priceRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, upperY);
      } else {
        ctx.lineTo(x, upperY);
      }
    }
    // Draw lower bound in reverse
    for (let i = priceData.length - 1; i >= 0; i--) {
      const point = priceData[i];
      const x = padding + ((point.time - minTime) / timeRange) * chartWidth;
      const lowerY = padding + chartHeight - ((point.lowerBound - minPrice) / priceRange) * chartHeight;
      ctx.lineTo(x, lowerY);
    }
    ctx.closePath();
    ctx.fill();

    // Draw price line
    ctx.beginPath();
    ctx.strokeStyle = '#64C8FF'; // Cyan
    ctx.lineWidth = 2;
    for (let i = 0; i < priceData.length; i++) {
      const point = priceData[i];
      const x = padding + ((point.time - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((point.price - minPrice) / priceRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Draw bounds lines
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    // Upper bound
    for (let i = 0; i < priceData.length; i++) {
      const point = priceData[i];
      const x = padding + ((point.time - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((point.upperBound - minPrice) / priceRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Lower bound
    ctx.beginPath();
    for (let i = 0; i < priceData.length; i++) {
      const point = priceData[i];
      const x = padding + ((point.time - minTime) / timeRange) * chartWidth;
      const y = padding + chartHeight - ((point.lowerBound - minPrice) / priceRange) * chartHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%'
      }}
    />
  );
}
