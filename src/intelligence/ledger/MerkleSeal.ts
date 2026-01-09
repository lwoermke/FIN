/**
 * [5.0] Merkle Seal
 * Generates the "Convergence Vector" and blockchain-style hash chaining.
 * 
 * After every trade journal write:
 * 1. Takes the ForensicSnap payload
 * 2. Generates SHA-256 Root Hash
 * 3. Includes Previous_Root_Hash for non-repudiation (blockchain logic)
 * 4. Updates the Aura-Glow integrity check
 */

import { MerkleTree } from '../../kernel/registry/MerkleTree.js';
import type { ForensicSnapshot } from './ForensicSnap.js';

/**
 * Sealed trade entry with blockchain chaining
 */
export interface SealedEntry {
  /** SHA-256 hash of the entry */
  hash: string;
  /** Previous entry's hash (blockchain chain) */
  previousHash: string;
  /** Timestamp of sealing */
  timestamp: number;
  /** Trade data */
  tradeData: unknown;
  /** Forensic snapshot at T+0 */
  forensicSnap: ForensicSnapshot;
  /** Merkle root of the snapshot */
  merkleRoot: string;
  /** Nonce for additional entropy */
  nonce: string;
}

/**
 * Seal result returned after sealing
 */
export interface SealResult {
  /** The sealed entry */
  entry: SealedEntry;
  /** Whether this is the genesis (first) entry */
  isGenesis: boolean;
  /** Chain length */
  chainLength: number;
}

/**
 * Merkle Seal for state integrity with blockchain chaining
 */
export class MerkleSeal {
  private static merkleTree: MerkleTree = new MerkleTree();
  private static previousRootHash: string = '';
  private static chainLength: number = 0;

  /**
   * Computes SHA-256 hash of data
   * @param data The data to hash
   * @returns Promise resolving to hex hash string
   */
  private static async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate a random nonce for additional entropy
   */
  private static generateNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Seal a trade with forensic snapshot using blockchain chaining
   * @param tradeData The trade data to seal
   * @param forensicSnap The forensic snapshot at T+0
   * @returns Promise resolving to seal result
   */
  static async seal(
    tradeData: unknown,
    forensicSnap: ForensicSnapshot
  ): Promise<SealResult> {
    const timestamp = Date.now();
    const nonce = MerkleSeal.generateNonce();
    const isGenesis = MerkleSeal.chainLength === 0;

    // Get previous hash (empty string for genesis block)
    const previousHash = MerkleSeal.previousRootHash;

    // Build Merkle tree from forensic snapshot
    MerkleSeal.merkleTree.clear();

    // Add all vektors to tree
    for (const [path, vektor] of Object.entries(forensicSnap.storeState.vektors)) {
      await MerkleSeal.merkleTree.update(path, JSON.stringify(vektor));
    }

    // Add weights
    await MerkleSeal.merkleTree.update('weights.endogenous', JSON.stringify(forensicSnap.weights.endogenous));
    await MerkleSeal.merkleTree.update('weights.exogenous', JSON.stringify(forensicSnap.weights.exogenous));

    // Add trade data
    await MerkleSeal.merkleTree.update('trade', JSON.stringify(tradeData));

    // Rebuild tree and get merkle root
    const merkleRoot = await MerkleSeal.merkleTree.rebuildFull();

    // Create the payload for hashing (includes previous hash for chaining)
    const payload = JSON.stringify({
      previousHash,
      timestamp,
      tradeData,
      forensicSnapId: forensicSnap.id,
      merkleRoot,
      nonce
    });

    // Generate the entry hash
    const hash = await MerkleSeal.sha256(payload);

    // Create sealed entry
    const entry: SealedEntry = {
      hash,
      previousHash,
      timestamp,
      tradeData,
      forensicSnap,
      merkleRoot,
      nonce
    };

    // Update chain state
    MerkleSeal.previousRootHash = hash;
    MerkleSeal.chainLength++;

    console.log(`[MerkleSeal] Sealed entry #${MerkleSeal.chainLength}: ${hash.substring(0, 16)}...`);

    if (!isGenesis) {
      console.log(`[MerkleSeal] Chained to previous: ${previousHash.substring(0, 16)}...`);
    }

    return {
      entry,
      isGenesis,
      chainLength: MerkleSeal.chainLength
    };
  }

  /**
   * Verify the integrity of a sealed entry
   * @param entry The sealed entry to verify
   * @param expectedPreviousHash The expected previous hash
   * @returns Promise resolving to verification result
   */
  static async verify(
    entry: SealedEntry,
    expectedPreviousHash: string
  ): Promise<{ valid: boolean; reason?: string }> {
    // Verify previous hash matches
    if (entry.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        reason: `Previous hash mismatch: expected ${expectedPreviousHash}, got ${entry.previousHash}`
      };
    }

    // Reconstruct the payload
    const payload = JSON.stringify({
      previousHash: entry.previousHash,
      timestamp: entry.timestamp,
      tradeData: entry.tradeData,
      forensicSnapId: entry.forensicSnap.id,
      merkleRoot: entry.merkleRoot,
      nonce: entry.nonce
    });

    // Verify hash
    const expectedHash = await MerkleSeal.sha256(payload);
    if (entry.hash !== expectedHash) {
      return {
        valid: false,
        reason: `Hash mismatch: expected ${expectedHash}, got ${entry.hash}`
      };
    }

    return { valid: true };
  }

  /**
   * Verify an entire chain of sealed entries
   * @param entries Array of sealed entries in order
   * @returns Promise resolving to verification result
   */
  static async verifyChain(
    entries: SealedEntry[]
  ): Promise<{ valid: boolean; invalidIndex?: number; reason?: string }> {
    if (entries.length === 0) {
      return { valid: true };
    }

    // Genesis block should have empty previous hash
    if (entries[0].previousHash !== '') {
      return {
        valid: false,
        invalidIndex: 0,
        reason: 'Genesis block should have empty previous hash'
      };
    }

    // Verify each entry
    for (let i = 0; i < entries.length; i++) {
      const expectedPrevious = i === 0 ? '' : entries[i - 1].hash;
      const result = await MerkleSeal.verify(entries[i], expectedPrevious);

      if (!result.valid) {
        return {
          valid: false,
          invalidIndex: i,
          reason: result.reason
        };
      }
    }

    return { valid: true };
  }

  /**
   * Seals the current state by hashing all trades (legacy method)
   * @param trades Array of trade entries
   * @returns Merkle hash of the state
   */
  static async sealState(trades: unknown[]): Promise<string> {
    MerkleSeal.merkleTree.clear();

    for (let i = 0; i < trades.length; i++) {
      const tradePath = `trade.${i}`;
      const tradeData = JSON.stringify(trades[i]);
      await MerkleSeal.merkleTree.update(tradePath, tradeData);
    }

    const rootHash = await MerkleSeal.merkleTree.rebuildFull();
    return rootHash;
  }

  /**
   * Seals a single trade entry (legacy method)
   * @param tradeId Trade ID
   * @param tradeData Trade data
   * @returns Merkle hash
   */
  static async sealTrade(tradeId: string, tradeData: unknown): Promise<string> {
    const path = `trade.${tradeId}`;
    const data = JSON.stringify(tradeData);

    await MerkleSeal.merkleTree.update(path, data);
    return await MerkleSeal.merkleTree.rebuildDirty();
  }

  /**
   * Verifies the integrity of a state against a known hash (legacy method)
   */
  static async verifyState(
    trades: unknown[],
    expectedHash: string
  ): Promise<boolean> {
    const currentHash = await MerkleSeal.sealState(trades);
    return currentHash === expectedHash;
  }

  /**
   * Gets the current root hash
   */
  static getCurrentHash(): string {
    return MerkleSeal.merkleTree.getRootHash();
  }

  /**
   * Gets the previous root hash (for chaining)
   */
  static getPreviousRootHash(): string {
    return MerkleSeal.previousRootHash;
  }

  /**
   * Gets the current chain length
   */
  static getChainLength(): number {
    return MerkleSeal.chainLength;
  }

  /**
   * Calculates the convergence vector (0-100)
   */
  static calculateConvergenceVector(
    modelConvergence: number,
    toxicity: number,
    risk: number
  ): number {
    const weights = {
      convergence: 0.5,
      toxicity: 0.3,
      risk: 0.2
    };

    const normalizedConvergence = Math.max(0, Math.min(1, modelConvergence));
    const normalizedToxicity = Math.max(0, Math.min(1, toxicity));
    const normalizedRisk = Math.max(0, Math.min(1, risk));

    const score =
      normalizedConvergence * weights.convergence +
      (1 - normalizedToxicity) * weights.toxicity +
      (1 - normalizedRisk) * weights.risk;

    return Math.round(score * 100);
  }

  /**
   * Resets the Merkle tree and chain
   */
  static reset(): void {
    MerkleSeal.merkleTree.clear();
    MerkleSeal.previousRootHash = '';
    MerkleSeal.chainLength = 0;
  }
}
