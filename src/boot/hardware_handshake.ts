/**
 * [1.3] Hardware Handshake
 * Benchmarks GPU/WebWorker capacity. Enforces "Low-Compute" fallback.
 */

/**
 * Global flag indicating if the system should operate in low-compute mode
 * Set to true when GPU capacity is below threshold
 */
export let LOW_COMPUTE_MODE: boolean = false;

/**
 * Minimum required combined texture image units for high-fidelity operation
 * Below this threshold, volumetric voids and lattice fraying physics are disabled
 */
const MIN_TEXTURE_UNITS_THRESHOLD: number = 16;

/**
 * GPU benchmark results interface
 */
export interface GPUBenchmark {
  maxCombinedTextureImageUnits: number;
  maxVertexTextureImageUnits: number;
  maxTextureSize: number;
  maxRenderbufferSize: number;
  webglVersion: string;
  vendor: string;
  renderer: string;
}

/**
 * Benchmarks GPU capacity by querying WebGL context limits
 * @returns Promise resolving to GPU benchmark results
 */
export async function benchmarkGPU(): Promise<GPUBenchmark> {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

  if (!gl) {
    console.warn('[FIN] WebGL not available. Falling back to LOW_COMPUTE_MODE.');
    LOW_COMPUTE_MODE = true;
    return {
      maxCombinedTextureImageUnits: 0,
      maxVertexTextureImageUnits: 0,
      maxTextureSize: 0,
      maxRenderbufferSize: 0,
      webglVersion: 'none',
      vendor: 'unknown',
      renderer: 'unknown'
    };
  }

  // Strict WebGPU Check (Simulated for WebGL environment if needed or actual navigator.gpu)
  // Note: While THREE.js can use WebGL, the manual requires a "High Fidelity" check.
  if (!('gpu' in navigator)) {
    console.error('[FIN] FATAL: WebGPU interface missing. Neural Link Severed.');
    // We only throw if strict mode is ON. For dev, we might just warn? 
    // User requested: "Do not fallback... This is a high-fidelity instrument".
    // We'll enforce it.
    document.body.innerHTML = `
        <div style="background: #000; color: #FF0F0F; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; font-family: monospace;">
            <h1 style="font-size: 2rem; border-bottom: 2px solid #FF0F0F; padding-bottom: 10px;">FATAL ERROR // 0xDEAD_GPU</h1>
            <p style="margin-top: 20px;">Neural Link Severed.</p>
            <p style="opacity: 0.7; font-size: 0.8rem;">WebGPU Hardware Acceleration Required.</p>
        </div>
       `;
    throw new Error('WebGPU Missing');
  }


  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const maxCombinedTextureImageUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
  const maxVertexTextureImageUnits = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS);
  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const maxRenderbufferSize = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);

  const benchmark: GPUBenchmark = {
    maxCombinedTextureImageUnits,
    maxVertexTextureImageUnits,
    maxTextureSize,
    maxRenderbufferSize,
    webglVersion: gl.getParameter(gl.VERSION) || 'unknown',
    vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown' : 'unknown',
    renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown' : 'unknown'
  };

  // Enforce Low-Compute Mode if capacity is below threshold
  if (maxCombinedTextureImageUnits < MIN_TEXTURE_UNITS_THRESHOLD) {
    LOW_COMPUTE_MODE = true;
    console.warn(
      `[FIN] GPU capacity (${maxCombinedTextureImageUnits} texture units) below threshold (${MIN_TEXTURE_UNITS_THRESHOLD}). ` +
      `Enabling LOW_COMPUTE_MODE. Volumetric voids and lattice fraying physics disabled.`
    );
  } else {
    LOW_COMPUTE_MODE = false;
    console.log(`[FIN] GPU benchmark passed. High-fidelity mode enabled.`);
  }

  return benchmark;
}

/**
 * Benchmarks WebWorker capacity by testing spawn time and message throughput
 * Uses a minimal inline worker for benchmarking purposes
 * @returns Promise resolving to worker benchmark results
 */
export async function benchmarkWebWorker(): Promise<{ spawnTime: number; throughput: number }> {
  const startTime = performance.now();

  try {
    // Create a minimal inline worker for benchmarking
    const workerCode = `
      self.onmessage = function(e) {
        // Echo back the message for throughput testing
        self.postMessage(e.data);
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    const spawnTime = performance.now() - startTime;

    return new Promise((resolve) => {
      // Test message throughput
      const messageCount = 100;
      const messages: number[] = [];
      let received = 0;

      const testMessage = { type: 'benchmark', data: Array(1000).fill(0).map(() => Math.random()) };

      worker.onmessage = () => {
        received++;
        messages.push(performance.now());

        if (received === messageCount) {
          const totalTime = messages[messages.length - 1] - messages[0];
          const throughput = messageCount / (totalTime / 1000); // messages per second
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve({ spawnTime, throughput });
        }
      };

      // Send benchmark messages
      for (let i = 0; i < messageCount; i++) {
        worker.postMessage(testMessage);
      }

      // Timeout fallback
      setTimeout(() => {
        if (received < messageCount) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve({ spawnTime, throughput: received / 5 }); // Estimate based on received messages
        }
      }, 5000);
    });
  } catch (error) {
    console.warn('[FIN] WebWorker benchmark failed:', error);
    return { spawnTime: Infinity, throughput: 0 };
  }
}

/**
 * Performs complete hardware handshake during boot sequence
 * @returns Promise resolving when handshake is complete
 */
export async function performHardwareHandshake(): Promise<{
  gpu: GPUBenchmark;
  worker: { spawnTime: number; throughput: number };
}> {
  console.log('[FIN] Initiating hardware handshake...');

  const [gpu, worker] = await Promise.all([
    benchmarkGPU(),
    benchmarkWebWorker().catch(() => ({ spawnTime: Infinity, throughput: 0 }))
  ]);

  console.log('[FIN] Hardware handshake complete.', {
    lowComputeMode: LOW_COMPUTE_MODE,
    gpu: gpu.maxCombinedTextureImageUnits,
    workerThroughput: worker.throughput
  });

  return { gpu, worker };
}
