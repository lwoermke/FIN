/**
 * [UI] Global Shader Uniforms
 * 
 * Shared THREE.js vectors for maintaining color consistency between 
 * React UI (CSS) and WebGL (Shaders).
 */

import { Vector3, Color } from 'three';
import { DesignTokens } from './DesignTokens.js';

// Helper: Hex to Vector3 (0-1)
const hexToVec3 = (hex: string) => {
    const c = new Color(hex);
    return new Vector3(c.r, c.g, c.b);
};

export const GlobalUniforms = {
    uColorObsidian: { value: hexToVec3(DesignTokens.colors.OBSIDIAN_VOID) },
    uColorCyan: { value: hexToVec3(DesignTokens.colors.ELECTRIC_CYAN) },
    uColorRed: { value: hexToVec3(DesignTokens.colors.EXECUTION_RED) },
    uColorYellow: { value: hexToVec3(DesignTokens.colors.ENTROPY_YELLOW) },

    // Shared State Flags
    uIsPanic: { value: 0.0 },     // 0 = Normal, 1 = Panic/Red
    uDataConfidence: { value: 1.0 } // 1.0 = High, <0.8 = Glitch
};

/**
 * Update global uniforms based on application state.
 * Call this from a central ticker or Context.
 */
export function updateGlobalUniforms(isPanic: boolean, confidence: number) {
    GlobalUniforms.uIsPanic.value = isPanic ? 1.0 : 0.0;
    GlobalUniforms.uDataConfidence.value = confidence;
}
