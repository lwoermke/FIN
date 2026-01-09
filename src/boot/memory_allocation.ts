/**
 * [1.2] Memory Allocation
 * Reserves Volatile RAM for Shard 1 of Master Key.
 */

/**
 * Size of the memory block to reserve for Shard 1 (in bytes)
 * This is a volatile RAM reservation that will be cleared on system crash
 */
const SHARD_1_MEMORY_SIZE: number = 256; // 256 bytes for AES-256-GCM key shard

/**
 * Reserved memory block for Shard 1 of the Master Key
 * This is volatile RAM that will be cleared on system crash or page unload
 */
let shard1MemoryBlock: Uint8Array | null = null;

/**
 * Flag indicating if memory has been allocated
 */
let isAllocated: boolean = false;

/**
 * Allocates a specific block of volatile RAM for Shard 1 of the Master Key
 * This memory is intentionally volatile and will be cleared on:
 * - System crash
 * - Page unload
 * - Explicit deallocation
 * 
 * @returns The allocated Uint8Array memory block, or null if allocation fails
 */
export function allocateShard1Memory(): Uint8Array | null {
  if (isAllocated && shard1MemoryBlock !== null) {
    console.warn('[FIN] Shard 1 memory already allocated. Returning existing block.');
    return shard1MemoryBlock;
  }

  try {
    // Allocate volatile RAM block
    shard1MemoryBlock = new Uint8Array(SHARD_1_MEMORY_SIZE);
    
    // Zero-initialize the memory block for security
    shard1MemoryBlock.fill(0);
    
    isAllocated = true;
    console.log(`[FIN] Allocated ${SHARD_1_MEMORY_SIZE} bytes of volatile RAM for Shard 1.`);
    
    return shard1MemoryBlock;
  } catch (error) {
    console.error('[FIN] Failed to allocate Shard 1 memory:', error);
    return null;
  }
}

/**
 * Gets the currently allocated Shard 1 memory block
 * @returns The allocated Uint8Array or null if not allocated
 */
export function getShard1Memory(): Uint8Array | null {
  return shard1MemoryBlock;
}

/**
 * Securely deallocates Shard 1 memory by zeroing it out
 * This should be called during system shutdown or when the key is no longer needed
 */
export function deallocateShard1Memory(): void {
  if (shard1MemoryBlock !== null) {
    // Securely zero out the memory
    shard1MemoryBlock.fill(0);
    shard1MemoryBlock = null;
    isAllocated = false;
    console.log('[FIN] Shard 1 memory deallocated and zeroed.');
  }
}

/**
 * Checks if Shard 1 memory is currently allocated
 * @returns True if memory is allocated, false otherwise
 */
export function isShard1Allocated(): boolean {
  return isAllocated && shard1MemoryBlock !== null;
}

/**
 * Gets the size of the Shard 1 memory block
 * @returns The size in bytes
 */
export function getShard1MemorySize(): number {
  return SHARD_1_MEMORY_SIZE;
}
