/**
 * [Risk Terrain Fragment Shader]
 * 
 * Renders the terrain as "Dark Obsidian" with "Magma" peaks.
 */

precision mediump float;

varying vec2 vUv;
varying float vElevation;

uniform float uStopLossThreshold; // e.g., 8.0 height

void main() {
    // Base Obsidian (Black, Glossy)
    vec3 baseColor = vec3(0.05, 0.05, 0.05);
    
    // Magma Gradient (Orange -> Red -> White)
    vec3 magmaColor = vec3(1.0, 0.2, 0.0);
    vec3 hotColor = vec3(1.0, 0.8, 0.5);
    
    // Determine color based on elevation
    float heat = smoothstep(2.0, 8.0, vElevation);
    vec3 color = mix(baseColor, magmaColor, heat);
    
    // Hot peaks
    float superHeat = smoothstep(6.0, 10.0, vElevation);
    color = mix(color, hotColor, superHeat);
    
    // Stop-Loss Trigger (Execution Red Glow)
    if (vElevation > uStopLossThreshold) {
        // Pulsing warning
        color = vec3(1.0, 0.0, 0.0); 
    }
    
    // Grid overlay (subtle)
    vec2 grid = abs(fract(vUv * 50.0 - 0.5) - 0.5) / fwidth(vUv * 50.0);
    float line = min(grid.x, grid.y);
    if (line < 0.1) {
        color += vec3(0.1, 0.1, 0.1);
    }
    
    gl_FragColor = vec4(color, 1.0);
}
