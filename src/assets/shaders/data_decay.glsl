/**
 * Data Decay Shader
 * Visualizes the "Freshness" of information.
 *
 * Uniforms:
 *  u_data_age: 0.0 (Fresh) -> 1.0 (Stale)
 *  u_time: Time for noise animation
 */

uniform float u_data_age; // 0.0 to 1.0
uniform float u_time;
uniform vec2 u_resolution;

varying vec2 vUv;

// Simple Noise function
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

void main() {
    vec2 uv = vUv;
    
    // Base Glass Color (Cyan tint)
    vec4 color = vec4(0.0, 1.0, 0.78, 0.1); // #00FFC8
    
    // 1. FROST EFFECT (0.1 - 0.5)
    // Adds noise grain based on age
    if (u_data_age > 0.1) {
        float frostIntensity = smoothstep(0.1, 0.6, u_data_age);
        float noise = hash(uv * 100.0 + u_time * 0.1);
        
        // Frost makes it whiter/foggy
        color.rgb = mix(color.rgb, vec3(0.8, 0.9, 1.0), frostIntensity * 0.3);
        color.a += frostIntensity * 0.2 * noise;
    }
    
    // 2. RUST EFFECT (> 0.6)
    // Edges turn brownish-red, panel becomes opaque
    if (u_data_age > 0.6) {
        float rustIntensity = smoothstep(0.6, 1.0, u_data_age);
        
        // Rust Color
        vec3 rustColor = vec3(0.6, 0.2, 0.1);
        
        // Edge detection
        float dist = distance(uv, vec2(0.5));
        float edge = smoothstep(0.3, 0.5, dist);
        
        color.rgb = mix(color.rgb, rustColor, rustIntensity * edge);
        color.a = mix(color.a, 0.8, rustIntensity); // Opaque
    }
    
    // 3. GLOW (Fresh Only)
    if (u_data_age < 0.1) {
        float glowWithTime = 0.5 + 0.5 * sin(u_time * 2.0);
        float dist = distance(uv, vec2(0.5));
        float edge = smoothstep(0.4, 0.5, dist);
        
        color.rgb += vec3(0.2) * edge * glowWithTime;
        color.a += 0.1 * edge;
    }

    gl_FragColor = color;
}
