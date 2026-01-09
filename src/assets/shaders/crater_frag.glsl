
// Crater Fragment Shader
// Renders "Execution Red" with depth-based gradient

varying vec2 vUv;
varying float vDepth;

uniform float uTime;

void main() {
  // Base color: Execution Red
  vec3 baseColor = vec3(1.0, 0.05, 0.05); // #FF0F0F
  
  // Core darkness based on depth vs max depth (normalized roughly)
  // Assuming depth is negative, make deeper parts darker/more intense
  float depthFactor = smoothstep(0.0, -2.0, vDepth); // Adjustable range
  
  // Pulse glow at edges
  float pulse = sin(uTime * 4.0 - length(vUv - 0.5) * 10.0) * 0.5 + 0.5;
  
  vec3 finalColor = mix(baseColor, vec3(0.5, 0.0, 0.0), depthFactor);
  finalColor += vec3(0.2, 0.0, 0.0) * pulse * depthFactor;
  
  // Add transparency at edges (alpha logic)
  // Just simple color for now, lattice usually additive or transparent
  
  gl_FragColor = vec4(finalColor, 0.8 + 0.2 * pulse);
}
