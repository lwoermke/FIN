
// Crater Vertex Shader
// Deforms geometry into a depression based on uniform 'uCraterPosition' & 'uCraterRadius'

varying vec2 vUv;
varying float vDepth;

uniform float uTime;
uniform vec3 uCraterPosition;
uniform float uCraterRadius;
uniform float uCraterDepth;

void main() {
  vUv = uv;
  vec3 pos = position;
  
  // Calculate distance from crater center (assuming plane is X/Y or X/Z)
  // Standard lattice is usually X/Y plane for convenience in 3D
  float dist = distance(pos.xy, uCraterPosition.xy);
  
  // Deformation logic
  // If inside radius, push Z down
  float influence = smoothstep(uCraterRadius, 0.0, dist);
  float depression = -uCraterDepth * influence * influence; // Quadratic falloff
  
  // Dynamic Pulse
  float pulse = sin(uTime * 5.0) * 0.1 + 1.0;
  pos.z += depression * pulse;
  
  vDepth = depression; // Pass to fragment for coloring
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
