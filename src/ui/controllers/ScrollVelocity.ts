/**
 * [3.3] Scroll Velocity Controller
 * Determines Orbit vs Ground vs Exit.
 * 
 * Navigation is driven solely by vertical scroll velocity.
 * - Orbit (Macro): Low-density view containing the 3D Geostationary Map
 * - Warp Transition: High-velocity downward scroll triggers "Spatial Collapse"
 * - Ground View: The primary Lattice interface
 * - Escape Velocity: Violent upward scroll at the top of Ground View triggers Warp-Exit
 */

/**
 * Navigation states
 */
export enum NavigationState {
  /** Orbit view - Macro geostationary map */
  ORBIT = 'orbit',
  /** Warp transition - Spatial collapse animation */
  WARP = 'warp',
  /** Ground view - Primary lattice interface */
  GROUND = 'ground'
}

/**
 * Configuration for scroll velocity detection
 */
export interface ScrollVelocityConfig {
  /** Threshold for warp transition (pixels per frame) */
  warpThreshold: number;
  /** Threshold for escape velocity (pixels per frame) */
  escapeThreshold: number;
  /** Smoothing factor for velocity calculation */
  smoothingFactor: number;
  /** Cooldown period after state change (ms) */
  cooldownPeriod: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ScrollVelocityConfig = {
  warpThreshold: 5.0,      // High velocity downward
  escapeThreshold: -8.0,    // Very high velocity upward
  smoothingFactor: 0.1,
  cooldownPeriod: 500      // 500ms cooldown
};

/**
 * Scroll velocity state machine
 */
export class ScrollVelocity {
  private state: NavigationState = NavigationState.ORBIT;
  private config: ScrollVelocityConfig;
  private velocity: number = 0;
  private smoothedVelocity: number = 0;
  private lastScrollY: number = 0;
  private lastTime: number = 0;
  private lastStateChange: number = 0;
  private listeners: Map<NavigationState, Set<() => void>> = new Map();

  /**
   * Creates a new ScrollVelocity controller
   * @param config Optional configuration
   */
  constructor(config?: Partial<ScrollVelocityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize listeners map
    Object.values(NavigationState).forEach(state => {
      this.listeners.set(state, new Set());
    });
  }

  /**
   * Updates scroll velocity from scroll event
   * @param scrollY Current scroll position
   * @param timestamp Current timestamp
   */
  update(scrollY: number, timestamp: number = Date.now()): void {
    const deltaTime = timestamp - this.lastTime;
    
    if (deltaTime > 0 && this.lastTime > 0) {
      // Calculate instantaneous velocity (pixels per millisecond)
      const instantVelocity = (scrollY - this.lastScrollY) / deltaTime;
      
      // Convert to pixels per frame (assuming 60fps)
      const velocityPerFrame = instantVelocity * (1000 / 60);
      
      // Smooth velocity
      this.smoothedVelocity = this.smoothedVelocity * (1 - this.config.smoothingFactor) +
                            velocityPerFrame * this.config.smoothingFactor;
      
      this.velocity = velocityPerFrame;
    }
    
    this.lastScrollY = scrollY;
    this.lastTime = timestamp;
    
    // Update state based on velocity
    this.updateState();
  }

  /**
   * Updates navigation state based on current velocity
   */
  private updateState(): void {
    const now = Date.now();
    const cooldownExpired = now - this.lastStateChange >= this.config.cooldownPeriod;
    
    if (!cooldownExpired) {
      return; // Respect cooldown period
    }

    const previousState = this.state;

    // State machine logic
    switch (this.state) {
      case NavigationState.ORBIT:
        // High velocity downward -> Warp transition
        if (this.smoothedVelocity > this.config.warpThreshold) {
          this.setState(NavigationState.WARP);
        }
        break;

      case NavigationState.WARP:
        // After warp, enter Ground view
        if (Math.abs(this.smoothedVelocity) < 1.0) {
          this.setState(NavigationState.GROUND);
        }
        break;

      case NavigationState.GROUND:
        // Very high velocity upward -> Escape (back to Orbit)
        if (this.smoothedVelocity < this.config.escapeThreshold) {
          this.setState(NavigationState.ORBIT);
        }
        // High velocity downward -> Stay in Ground (or could trigger deeper view)
        else if (this.smoothedVelocity > this.config.warpThreshold) {
          // Could trigger micro view or other state
          // For now, stay in Ground
        }
        break;
    }

    // If state changed, notify listeners
    if (this.state !== previousState) {
      this.notifyListeners(this.state);
    }
  }

  /**
   * Sets the navigation state
   * @param newState New state
   */
  private setState(newState: NavigationState): void {
    this.state = newState;
    this.lastStateChange = Date.now();
  }

  /**
   * Gets the current navigation state
   * @returns Current state
   */
  getState(): NavigationState {
    return this.state;
  }

  /**
   * Gets the current scroll velocity
   * @returns Velocity in pixels per frame
   */
  getVelocity(): number {
    return this.velocity;
  }

  /**
   * Gets the smoothed scroll velocity
   * @returns Smoothed velocity in pixels per frame
   */
  getSmoothedVelocity(): number {
    return this.smoothedVelocity;
  }

  /**
   * Subscribes to state changes
   * @param state State to listen for
   * @param callback Callback function
   * @returns Unsubscribe function
   */
  onStateChange(state: NavigationState, callback: () => void): () => void {
    const listeners = this.listeners.get(state);
    if (listeners) {
      listeners.add(callback);
    }

    return () => {
      const listeners = this.listeners.get(state);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Notifies all listeners for a given state
   * @param state State that changed
   */
  private notifyListeners(state: NavigationState): void {
    const listeners = this.listeners.get(state);
    if (listeners) {
      listeners.forEach(callback => callback());
    }
  }

  /**
   * Manually sets the navigation state (for programmatic control)
   * @param state New state
   */
  setStateManually(state: NavigationState): void {
    this.setState(state);
    this.notifyListeners(state);
  }

  /**
   * Resets the scroll velocity tracking
   */
  reset(): void {
    this.velocity = 0;
    this.smoothedVelocity = 0;
    this.lastScrollY = 0;
    this.lastTime = 0;
    this.lastStateChange = 0;
  }

  /**
   * Updates the configuration
   * @param config Partial configuration to update
   */
  updateConfig(config: Partial<ScrollVelocityConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// React hook is exported from useScrollVelocity.ts
// Import: import { useScrollVelocity } from './useScrollVelocity';
