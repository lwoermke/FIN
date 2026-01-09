/**
 * [6.3] Aura Glow
 * Integrity indicator with flash feedback.
 * 
 * A visual integrity indicator that subscribes to Store.
 * If Merkle Hash check fails or data is corrupted, the Glow turns
 * from Cyan/Green to "Frosted/Dead".
 * 
 * Also responds to trade execution events with flash animations:
 * - Green Flash: Successful trade seal
 * - Red Flash: Error during trade seal
 * - Yellow Flash: Warning condition
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { store } from '../../../kernel/registry/Store.js';
import { Convergence } from './Convergence.js';

/**
 * Integrity state
 */
enum IntegrityState {
  /** Healthy - Cyan/Green glow */
  HEALTHY = 'healthy',
  /** Warning - Yellow/Orange glow */
  WARNING = 'warning',
  /** Corrupted - Frosted/Dead */
  CORRUPTED = 'corrupted'
}

/**
 * Flash state for trade feedback
 */
interface FlashState {
  active: boolean;
  type: 'success' | 'error' | 'warning' | null;
  endTime: number;
}

/**
 * Aura Glow component
 */
export function AuraGlow({
  size = 20,
  position = 'top-right'
}: {
  size?: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const [integrityState, setIntegrityState] = useState<IntegrityState>(IntegrityState.HEALTHY);
  const [merkleHash, setMerkleHash] = useState<string>('');
  const [flash, setFlash] = useState<FlashState>({ active: false, type: null, endTime: 0 });
  const checkInterval = useRef<number | null>(null);
  const flashTimeout = useRef<number | null>(null);

  /**
   * Trigger a flash animation
   */
  const triggerFlash = useCallback((type: 'success' | 'error' | 'warning', duration: number = 500) => {
    console.log(`[AuraGlow] Flash triggered: ${type} for ${duration}ms`);

    // Clear any existing flash timeout
    if (flashTimeout.current !== null) {
      clearTimeout(flashTimeout.current);
    }

    // Activate flash
    setFlash({
      active: true,
      type,
      endTime: Date.now() + duration
    });

    // Schedule flash end
    flashTimeout.current = setTimeout(() => {
      setFlash({ active: false, type: null, endTime: 0 });
    }, duration) as unknown as number;
  }, []);

  // Listen for trade journal flash events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFlash = (event: CustomEvent<{ type: 'success' | 'error' | 'warning'; duration: number }>) => {
      triggerFlash(event.detail.type, event.detail.duration);
    };

    window.addEventListener('fin:auraglow', handleFlash as EventListener);

    return () => {
      window.removeEventListener('fin:auraglow', handleFlash as EventListener);
      if (flashTimeout.current !== null) {
        clearTimeout(flashTimeout.current);
      }
    };
  }, [triggerFlash]);

  // Integrity Worker
  const [worker, setWorker] = useState<Worker | null>(null);

  // Initialize worker
  useEffect(() => {
    const w = new Worker(
      new URL('../../../workers/integrity.worker.ts', import.meta.url),
      { type: 'module' }
    );
    setWorker(w);
    return () => w.terminate();
  }, []);

  // Subscribe to Store and check integrity
  useEffect(() => {
    if (!worker) return;

    // Subscribe to all Store changes to update local tree (lightweight)
    // Actually, we are offloading full verification. 
    // We can skip local updates if the worker does full checks?
    // The previous logic did `merkleTree.update` locally.
    // If we rely on worker, we don't need local updates unless we want immediate hashes.
    // Let's keep local subscription for "liveness" or if needed for other things, 
    // but the heavy check goes to worker.

    // Actually, to avoid duplication, I will remove local merkleTree logic 
    // and rely purely on the worker for the 1Hz check.
    // This is "System Optimization".

    const unsubscribe = store.subscribeAll((vektor, path) => {
      // Check for Dead Signals (Instant feedback)
      if (vektor.conf[0] === 0 && vektor.conf[1] === 0) {
        setIntegrityState(IntegrityState.CORRUPTED);
      }
    });

    // Handle worker results
    worker.onmessage = (event) => {
      const { type, isValid, currentHash } = event.data;
      if (type === 'verification_complete') {
        if (!isValid) {
          setIntegrityState(IntegrityState.CORRUPTED);
        } else {
          // Check for warnings (low confidence data) - logic moved here or kept?
          // We can do a quick check on the snapshot in main thread since it's just loops,
          // but hash verification is the heavy part.
          // Let's re-implement the warning check here.
          const allVektors = Array.from(store.getSnapshot().values());
          const lowConfidenceCount = allVektors.filter(
            v => v.conf[0] < 0.5 || v.conf[1] < 0.5
          ).length;

          if (lowConfidenceCount > allVektors.length * 0.3) {
            setIntegrityState(IntegrityState.WARNING);
          } else {
            setIntegrityState(IntegrityState.HEALTHY);
          }
        }
        if (currentHash && currentHash !== merkleHash) {
          setMerkleHash(currentHash);
        }
      }
    };

    // Periodic integrity check
    const checkIntegrity = () => {
      // Send full snapshot to worker
      const snapshot = Object.fromEntries(store.getSnapshot());
      worker.postMessage({
        type: 'verify_state',
        stateSnapshot: snapshot,
        previousHash: merkleHash
      });
    };

    // Periodic checks (every 1 second)
    checkInterval.current = setInterval(checkIntegrity, 1000) as unknown as number;

    return () => {
      unsubscribe();
      if (checkInterval.current !== null) {
        clearInterval(checkInterval.current);
      }
    };
  }, [worker, merkleHash]);

  // Get glow color based on state (and flash override)
  const getGlowColor = (): string => {
    // Flash overrides normal state
    if (flash.active) {
      switch (flash.type) {
        case 'success':
          return '#00FF88'; // Bright green
        case 'error':
          return '#FF4444'; // Bright red
        case 'warning':
          return '#FFAA00'; // Yellow/Orange
      }
    }

    switch (integrityState) {
      case IntegrityState.HEALTHY:
        return '#00FFC8'; // Cyan/Green
      case IntegrityState.WARNING:
        return '#FFAA00'; // Yellow/Orange
      case IntegrityState.CORRUPTED:
        return '#888888'; // Frosted/Dead (gray)
      default:
        return '#00FFC8';
    }
  };

  // Get glow intensity
  const getGlowIntensity = (): number => {
    // Flash is always full intensity
    if (flash.active) {
      return 1.5; // Extra bright for flash
    }

    switch (integrityState) {
      case IntegrityState.HEALTHY:
        return 1.0;
      case IntegrityState.WARNING:
        return 0.7;
      case IntegrityState.CORRUPTED:
        return 0.3;
      default:
        return 1.0;
    }
  };

  // Get glow size multiplier
  const getSizeMultiplier = (): number => {
    if (flash.active) {
      return 2.0; // Expand during flash
    }
    return 1.0;
  };

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-left': { top: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'bottom-right': { bottom: '20px', right: '20px' }
  };

  const glowColor = getGlowColor();
  const intensity = getGlowIntensity();
  const sizeMultiplier = getSizeMultiplier();
  const effectiveSize = size * sizeMultiplier;

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        width: `${effectiveSize}px`,
        height: `${effectiveSize}px`,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${glowColor}${Math.round(Math.min(1, intensity) * 255).toString(16).padStart(2, '0')}, transparent)`,
        boxShadow: `0 0 ${effectiveSize * 2}px ${effectiveSize}px ${glowColor}${Math.round(Math.min(1, intensity) * 100).toString(16).padStart(2, '0')}`,
        pointerEvents: 'none',
        zIndex: 10000,
        transition: flash.active ? 'all 0.1s ease-out' : 'all 0.3s ease',
        opacity: integrityState === IntegrityState.CORRUPTED && !flash.active ? 0.5 : 1.0,
        filter: integrityState === IntegrityState.CORRUPTED && !flash.active ? 'blur(2px)' : 'none',
        transform: `translate(${position.includes('right') ? '50%' : '-50%'}, ${position.includes('bottom') ? '50%' : '-50%'})`
      }}
    >
      {/* Integrity Status Text */}
      <div className={`mt-2 text-xs font-bold tracking-widest ${integrityState === IntegrityState.CORRUPTED ? 'text-danger animate-pulse' :
        integrityState === IntegrityState.WARNING ? 'text-warning' : 'text-secondary'
        }`}>
        {integrityState === IntegrityState.CORRUPTED ? 'INTEGRITY BREACH' :
          integrityState === IntegrityState.WARNING ? 'HASH MISMATCH' : 'SYSTEM SECURE'}
      </div>

      <Convergence />
      {/* Inner glow dot */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${effectiveSize * 0.3}px`,
          height: `${effectiveSize * 0.3}px`,
          borderRadius: '50%',
          background: glowColor,
          boxShadow: `0 0 ${effectiveSize * 0.5}px ${glowColor}`,
          transition: flash.active ? 'all 0.1s ease-out' : 'all 0.3s ease'
        }}
      />

      {/* Flash pulse ring */}
      {flash.active && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${effectiveSize * 1.5}px`,
            height: `${effectiveSize * 1.5}px`,
            borderRadius: '50%',
            border: `2px solid ${glowColor}`,
            animation: 'aura-pulse 0.5s ease-out',
            opacity: 0.8
          }}
        />
      )}
    </div>
  );
}

// Global Style Injection
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes aura-pulse {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.8;
      }
      100% {
        transform: translate(-50%, -50%) scale(2);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
