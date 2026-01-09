/**
 * Automata Layer - The Evolutionary Loop
 * 
 * Implements Section 8 of the Operations Manual:
 * - Capture: Trade execution triggers Forensic Snapshots
 * - Realization: Referee monitors outcomes at T+1, T+7, T+30
 * - Recalibration: Mutation Engine adjusts weights via Transfer Entropy
 * 
 * Also includes Phase 4 Red Team for adversarial stress testing.
 */

// [8.2] The Referee - Outcome monitoring using Riemannian Metrics
export {
    Referee,
    referee,
    MONITORING_HORIZONS,
    type HorizonId,
    type StateSnapshot,
    type MonitoredPrediction,
    type RefereeResult,
    type FailureCallback,
    type RefereeConfig
} from './Referee.js';

// [8.3] Mutation Engine - Recalibration via Transfer Entropy
export {
    MutationEngine,
    mutationEngine,
    ENDOGENOUS_SOURCES,
    EXOGENOUS_SOURCES,
    type InputBlock,
    type WeightAdjustment,
    type TransferEntropyResult,
    type MutationEvent,
    type MutationEngineConfig
} from './MutationEngine.js';

// [Phase 4] Red Team - Adversarial stress testing
export {
    RedTeam,
    redTeam
} from './RedTeam.js';
