/**
 * [3.3] useScrollVelocity Hook
 * 
 * React hook for the ScrollVelocity state machine.
 * Provides reactive state updates for navigation transitions with opacity values.
 */

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { ScrollVelocity, NavigationState, type ScrollVelocityConfig } from './ScrollVelocity.js';

/**
 * Warp direction for transition effects
 */
export type WarpDirection = 'ENTERING' | 'EXITING' | null;

/**
 * Extended navigation state with opacity values
 */
export interface NavigationStateExtended {
  /** Current navigation state */
  state: NavigationState;
  /** Direction of warp transition */
  warpDirection: WarpDirection;
  /** Progress through warp (0-1) */
  warpProgress: number;
  /** Current scroll velocity */
  velocity: number;
  /** Opacity for ORBIT view (0-1) */
  orbitOpacity: number;
  /** Opacity for WARP view (0-1) */
  warpOpacity: number;
  /** Opacity for GROUND view (0-1) */
  groundOpacity: number;
  /** Is currently in warp transition */
  isWarping: boolean;
}

/**
 * Configuration for the hook
 */
export interface UseScrollVelocityConfig extends Partial<ScrollVelocityConfig> {
  /** Duration of warp transition in ms */
  warpDuration?: number;
  /** Whether to enable scroll listening */
  enabled?: boolean;
}

const DEFAULT_WARP_DURATION = 1500;

/**
 * Calculate opacities based on warp progress and direction
 */
function calculateOpacities(
  state: NavigationState,
  warpDirection: WarpDirection,
  warpProgress: number
): { orbit: number; warp: number; ground: number } {
  const fadeInEnd = 0.25;
  const fadeOutStart = 0.75;

  switch (state) {
    case NavigationState.ORBIT:
      return { orbit: 1, warp: 0, ground: 0 };

    case NavigationState.GROUND:
      return { orbit: 0, warp: 0, ground: 1 };

    case NavigationState.WARP:
      if (warpDirection === 'ENTERING') {
        if (warpProgress < fadeInEnd) {
          const t = warpProgress / fadeInEnd;
          return { orbit: 1 - t, warp: t, ground: 0 };
        } else if (warpProgress < fadeOutStart) {
          return { orbit: 0, warp: 1, ground: 0 };
        } else {
          const t = (warpProgress - fadeOutStart) / (1 - fadeOutStart);
          return { orbit: 0, warp: 1 - t, ground: t };
        }
      } else if (warpDirection === 'EXITING') {
        if (warpProgress < fadeInEnd) {
          const t = warpProgress / fadeInEnd;
          return { orbit: 0, warp: t, ground: 1 - t };
        } else if (warpProgress < fadeOutStart) {
          return { orbit: 0, warp: 1, ground: 0 };
        } else {
          const t = (warpProgress - fadeOutStart) / (1 - fadeOutStart);
          return { orbit: t, warp: 1 - t, ground: 0 };
        }
      }
      return { orbit: 0, warp: 1, ground: 0 };

    default:
      return { orbit: 1, warp: 0, ground: 0 };
  }
}

/**
 * React hook for ScrollVelocity state machine
 */
export function useScrollVelocity(
  config: UseScrollVelocityConfig = {}
): NavigationStateExtended & {
  triggerEnter: () => void;
  triggerExit: () => void;
  reset: () => void;
  scrollVelocity: ScrollVelocity;
} {
  const { warpDuration = DEFAULT_WARP_DURATION, enabled = true, ...scrollConfig } = config;

  const scrollVelocityRef = useRef<ScrollVelocity>(new ScrollVelocity(scrollConfig));

  const [state, setState] = useState<NavigationState>(NavigationState.ORBIT);
  const [warpDirection, setWarpDirection] = useState<WarpDirection>(null);
  const [warpProgress, setWarpProgress] = useState(0);
  const [velocity, setVelocity] = useState(0);

  const warpStartTime = useRef<number | null>(null);
  const animationFrame = useRef<number | null>(null);

  const opacities = calculateOpacities(state, warpDirection, warpProgress);

  const animateWarp = useCallback(() => {
    if (!warpStartTime.current) return;

    const elapsed = Date.now() - warpStartTime.current;
    const progress = Math.min(elapsed / warpDuration, 1);

    setWarpProgress(progress);

    if (progress < 1) {
      animationFrame.current = requestAnimationFrame(animateWarp);
    } else {
      const finalState = warpDirection === 'ENTERING'
        ? NavigationState.GROUND
        : NavigationState.ORBIT;

      setState(finalState);
      scrollVelocityRef.current.setStateManually(finalState);
      setWarpDirection(null);
      setWarpProgress(0);
      warpStartTime.current = null;

      console.log(`[ScrollVelocity] Warp complete -> ${finalState}`);
    }
  }, [warpDuration, warpDirection]);

  const startWarp = useCallback((direction: WarpDirection) => {
    if (state === NavigationState.WARP) return;

    console.log(`[ScrollVelocity] Starting warp: ${direction}`);

    setState(NavigationState.WARP);
    scrollVelocityRef.current.setStateManually(NavigationState.WARP);
    setWarpDirection(direction);
    setWarpProgress(0);
    warpStartTime.current = Date.now();

    animationFrame.current = requestAnimationFrame(animateWarp);
  }, [state, animateWarp]);

  useEffect(() => {
    if (!enabled) return;

    const handleWheel = (event: WheelEvent) => {
      scrollVelocityRef.current.update(event.deltaY, Date.now());
      setVelocity(scrollVelocityRef.current.getVelocity());

      const smoothedVelocity = scrollVelocityRef.current.getSmoothedVelocity();

      if (state === NavigationState.ORBIT && smoothedVelocity > 5) {
        startWarp('ENTERING');
      } else if (state === NavigationState.GROUND && smoothedVelocity < -8) {
        startWarp('EXITING');
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [enabled, state, startWarp]);

  const triggerEnter = useCallback(() => {
    if (state === NavigationState.ORBIT) {
      startWarp('ENTERING');
    }
  }, [state, startWarp]);

  const triggerExit = useCallback(() => {
    if (state === NavigationState.GROUND) {
      startWarp('EXITING');
    }
  }, [state, startWarp]);

  const reset = useCallback(() => {
    if (animationFrame.current) {
      cancelAnimationFrame(animationFrame.current);
    }
    setState(NavigationState.ORBIT);
    scrollVelocityRef.current.setStateManually(NavigationState.ORBIT);
    setWarpDirection(null);
    setWarpProgress(0);
    warpStartTime.current = null;
    scrollVelocityRef.current.reset();
  }, []);

  return {
    state,
    warpDirection,
    warpProgress,
    velocity,
    orbitOpacity: opacities.orbit,
    warpOpacity: opacities.warp,
    groundOpacity: opacities.ground,
    isWarping: state === NavigationState.WARP,
    triggerEnter,
    triggerExit,
    reset,
    scrollVelocity: scrollVelocityRef.current
  };
}

/**
 * Context for scroll velocity state
 */
export interface ScrollVelocityContextValue extends NavigationStateExtended {
  triggerEnter: () => void;
  triggerExit: () => void;
  reset: () => void;
}

export const ScrollVelocityContext = createContext<ScrollVelocityContextValue | null>(null);

/**
 * Hook to access scroll velocity context
 */
export function useScrollVelocityContext(): ScrollVelocityContextValue {
  const context = useContext(ScrollVelocityContext);
  if (!context) {
    throw new Error('useScrollVelocityContext must be used within ScrollVelocityProvider');
  }
  return context;
}

/**
 * Safe hook that returns defaults when outside provider (for isolated component testing)
 */
export function useScrollVelocityContextSafe(): ScrollVelocityContextValue {
  const context = useContext(ScrollVelocityContext);
  if (!context) {
    // Return safe defaults for components rendered outside the provider context
    return {
      state: 'ground' as unknown as NavigationState,
      warpDirection: null,
      warpProgress: 0,
      velocity: 0,
      orbitOpacity: 0,
      warpOpacity: 0,
      groundOpacity: 1,
      isWarping: false,
      triggerEnter: () => { },
      triggerExit: () => { },
      reset: () => { },
    };
  }
  return context;
}

/**
 * Provider component
 */
export function ScrollVelocityProvider({
  children,
  config
}: {
  children: React.ReactNode;
  config?: UseScrollVelocityConfig;
}) {
  const scrollState = useScrollVelocity(config);

  return (
    <ScrollVelocityContext.Provider value={scrollState} >
      {children}
    </ScrollVelocityContext.Provider>
  );
}
