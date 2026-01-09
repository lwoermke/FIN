/**
 * [0.1] Lattice Vertex Shader
 * Handles Z-axis deformation based on stress tensors.
 */

attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;

uniform float tension;
uniform float time;
uniform float noiseScale;

varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vPosition;
varying float vElevation;

// Simple noise function
float noise(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
}

float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Calculate deformation
    vec3 deformedPosition = position;
    
    // Stochastic Noise
    vec3 noiseCoord = position * noiseScale + vec3(time * 0.1);
    float nVal = fbm(noiseCoord);
    
    // Z-Deformation
    float zDeformation = tension * (0.5 + 0.5 * nVal);
    deformedPosition.z += zDeformation;
    
    // Pass to varying
    vPosition = deformedPosition; // World/Local space
    vElevation = deformedPosition.z;
    
    vec4 mvPosition = modelViewMatrix * vec4(deformedPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
