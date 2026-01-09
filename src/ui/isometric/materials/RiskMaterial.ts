import { shaderMaterial } from '@react-three/drei';
import vertexShader from '@/assets/shaders/risk_vertex.glsl?raw';
import fragmentShader from '@/assets/shaders/risk_frag.glsl?raw';

// Verify shader integrity
const shadersValid = typeof vertexShader === 'string' && typeof fragmentShader === 'string';

/**
 * [Material] RiskMaterial
 * Custom shader for the Risk Terrain topographical heights.
 */
export const RiskMaterial = shadersValid ? shaderMaterial(
    {
        uTime: 0.0,
        uRiskLevel: 1.0,
        uStopLossThreshold: 8.0
    },
    vertexShader,
    fragmentShader
) : null;
