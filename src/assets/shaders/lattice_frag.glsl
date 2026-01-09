precision mediump float;

varying vec2 vUv;
varying vec3 vPosition;
varying float vElevation;

uniform vec3 glowColor;
uniform float glowIntensity;
uniform float u_data_influx; // 0.0 to 1.0 (Flash White)
uniform float u_integrity; // 0.0 (Void) to 1.0 (Solid) - default 1.0

void main() {
  // ---------------------------------------------------------
  // VOID LOGIC (Null-State Physics)
  // ---------------------------------------------------------
  if (u_integrity < 0.1) {
      discard; // Tear the mesh (create a hole)
  }

  // Grid Lines
  vec2 grid = abs(fract(vPosition.xy * 1.0 - 0.5) - 0.5) / fwidth(vPosition.xy * 1.0);
  float line = min(grid.x, grid.y);
  float lineStrength = 1.0 - smoothstep(0.0, 0.05, line);
  
  // Base Color (Deep Blue/Purple)
  vec3 baseColor = vec3(0.02, 0.02, 0.08);
  
  // Height Gradient
  vec3 heightColor = mix(baseColor, glowColor, vElevation * 0.5 + 0.1);
  
  // Combine
  vec3 color = mix(baseColor, heightColor, 0.5);
  color += glowColor * lineStrength * glowIntensity;

  // ---------------------------------------------------------
  // DATA INFLUX FLASH (Network Pulse)
  // ---------------------------------------------------------
  if (u_data_influx > 0.0) {
      vec3 flashColor = vec3(1.0, 1.0, 1.0); // Pure White
      color = mix(color, flashColor, u_data_influx * 0.8 * lineStrength); // Mostly flash lines
  }

  // ---------------------------------------------------------
  // SHOCKWAVE EFFECT (Commit)
  // ---------------------------------------------------------
  // Ring expands from center
  if (uShockwaveTime > 0.0) {
      float radius = uShockwaveTime * 50.0;
      float dist = length(vPosition.xy);
      
      // Shockwave Ring
      float ringWidth = 2.0;
      float shock = 1.0 - smoothstep(0.0, ringWidth, abs(dist - radius));
      
      // Gold Color
      vec3 gold = vec3(1.0, 0.84, 0.0);
      
      // Add shockwave
      color = mix(color, gold, shock * (1.0 - uShockwaveTime));
      color += gold * shock * 2.0 * (1.0 - uShockwaveTime);
  }

  gl_FragColor = vec4(color, 1.0);
}
