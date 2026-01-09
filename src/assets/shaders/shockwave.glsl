/**
 * [Shockwave Fragment Logic]
 * 
 * Logic for generating radial shockwaves.
 * Designed to be @included or pasted into main shaders.
 */

// Uniforms expected:
// uniform float uShockwaveTime;
// uniform vec3 uShockwaveColor;

// Returns the additive color contribution of the shockwave
vec3 computeShockwave(vec3 position, float time, vec3 color) {
    if (time <= 0.0) return vec3(0.0);
    
    // Radius expands over time
    float radius = time * 50.0; // Fast expansion
    float dist = length(position.xy);
    
    // Ring width
    float ringWidth = 2.0;
    
    // Calculate intensity
    float shock = 1.0 - smoothstep(0.0, ringWidth, abs(dist - radius));
    
    // Fade out as it expands
    float fade = 1.0 - smoothstep(0.0, 1.5, time); // Ends at t=1.5
    
    // Result: Color * intensity * fade
    return color * shock * fade * 2.0;
}
