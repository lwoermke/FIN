/**
 * [Risk Terrain Vertex Shader]
 * 
 * Deforms a plane based on "Value at Risk" (VaR).
 * Uses fractal noise to simulate "jagged" peaks.
 */

varying vec2 vUv;
varying float vElevation;

uniform float uTime;
uniform float uRiskLevel; // Global risk multiplier

// Simple noise
float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

// FBM for topography
float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
        value += amplitude * noise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vUv = uv;
    
    vec3 pos = position;
    
    // Generate height based on position and time (slow drift)
    // Risk Level controls the AMPLITUDE of the mountains
    float height = fbm(pos * 0.2 + vec3(uTime * 0.05, 0.0, 0.0));
    
    // Sharpen peaks (power function)
    height = pow(height, 2.0) * 10.0 * uRiskLevel;
    
    pos.z += height;
    vElevation = height;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
