/**
 * [7.4] Trade Journal
 * Appends to trades.json with forensic snapshots.
 * 
 * The Immutable Ledger: Saved in ledger/trades.json.
 * Grouping: Recurring savings plans stacked.
 * Non-Repudiation: Merkle-Sealing ensures history cannot be rewritten.
 * 
 * Each entry includes:
 * - trade_data: The trade execution details
 * - forensic_snap: Complete system state at T+0
 * - merkle_root: SHA-256 hash with blockchain chaining
 */

import { MerkleSeal, type SealedEntry } from './MerkleSeal.js';
import { ForensicSnap, type ForensicSnapshot } from './ForensicSnap.js';

/**
 * Trade entry structure
 */
export interface TradeEntry {
  id: string;
  timestamp: number;
  ticker: string;
  amount: number;
  shares: number;
  price: number;
  currency: string;
  strategy: string;
  regime_id: string;
  model_id: string;
  merkleHash: string;
}

/**
 * Complete journal entry with forensic snapshot
 */
export interface JournalEntry {
  /** Trade execution data */
  trade_data: TradeEntry;
  /** Forensic snapshot at T+0 */
  forensic_snap: ForensicSnapshot;
  /** Merkle root hash */
  merkle_root: string;
  /** Previous entry's hash (for chain verification) */
  previous_hash: string;
  /** Entry hash */
  entry_hash: string;
  /** Chain position */
  chain_index: number;
}

/**
 * Callback for visual feedback
 */
export type AuraGlowCallback = (type: 'success' | 'error' | 'warning', duration?: number) => void;

/**
 * Trade Journal for immutable ledger with forensic snapshots
 */
export class TradeJournal {
  // Storage path: ledger/trades.json (persisted to localStorage in browser)
  private trades: TradeEntry[] = [];
  private journalEntries: JournalEntry[] = [];
  private auraGlowCallback: AuraGlowCallback | null = null;

  /**
   * Register callback for AuraGlow visual feedback
   */
  registerAuraGlow(callback: AuraGlowCallback): void {
    this.auraGlowCallback = callback;
    console.log('[TradeJournal] AuraGlow callback registered');
  }

  /**
   * Trigger AuraGlow flash
   */
  private triggerAuraGlow(type: 'success' | 'error' | 'warning', duration: number = 500): void {
    if (this.auraGlowCallback) {
      this.auraGlowCallback(type, duration);
    }

    // Also dispatch custom event for components not using callback
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fin:auraglow', {
        detail: { type, duration }
      }));
    }
  }

  /**
   * Initializes the trade journal by loading existing trades
   */
  async initialize(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        // Browser: Load from localStorage or IndexedDB
        const stored = localStorage.getItem('FIN_TRADES');
        if (stored) {
          this.trades = JSON.parse(stored);
        }

        const journalStored = localStorage.getItem('FIN_JOURNAL');
        if (journalStored) {
          this.journalEntries = JSON.parse(journalStored);
          // Restore MerkleSeal chain state
          if (this.journalEntries.length > 0) {
            const lastEntry = this.journalEntries[this.journalEntries.length - 1];
            console.log(`[TradeJournal] Restored chain with ${this.journalEntries.length} entries`);
            console.log(`[TradeJournal] Last hash: ${lastEntry.entry_hash.substring(0, 16)}...`);
          }
        }
      } else {
        console.warn('[TradeJournal] File system access not available in browser');
      }
    } catch (error) {
      console.error('[TradeJournal] Failed to initialize:', error);
      this.trades = [];
      this.journalEntries = [];
    }
  }

  /**
   * Appends a trade to the journal with forensic snapshot and Merkle seal
   * @param trade Trade entry to append
   * @returns The complete journal entry with seal
   */
  async append(trade: Omit<TradeEntry, 'id' | 'timestamp' | 'merkleHash'>): Promise<JournalEntry> {
    const startTime = Date.now();

    // Generate unique ID
    const id = this.generateTradeId();
    const timestamp = Date.now();

    // Create trade entry (without merkle hash initially)
    const tradeEntry: TradeEntry = {
      ...trade,
      id,
      timestamp,
      merkleHash: '' // Will be set after sealing
    };

    console.log(`[TradeJournal] Executing trade ${id}...`);

    // T+0: Capture forensic snapshot IMMEDIATELY
    const forensicSnap = ForensicSnap.capture(id);
    console.log(`[TradeJournal] Forensic snapshot captured: ${forensicSnap.storeState.vektorCount} vektors`);

    try {
      // Seal the trade with blockchain chaining
      const sealResult = await MerkleSeal.seal(tradeEntry, forensicSnap);

      // Update trade entry with merkle hash
      tradeEntry.merkleHash = sealResult.entry.merkleRoot;

      // Create complete journal entry
      const journalEntry: JournalEntry = {
        trade_data: tradeEntry,
        forensic_snap: forensicSnap,
        merkle_root: sealResult.entry.merkleRoot,
        previous_hash: sealResult.entry.previousHash,
        entry_hash: sealResult.entry.hash,
        chain_index: sealResult.chainLength
      };

      // Add to arrays
      this.trades.push(tradeEntry);
      this.journalEntries.push(journalEntry);

      // Persist to storage
      await this.persist();

      const elapsed = Date.now() - startTime;
      console.log(`[TradeJournal] Trade ${id} sealed in ${elapsed}ms`);
      console.log(`[TradeJournal] Merkle root: ${sealResult.entry.merkleRoot.substring(0, 16)}...`);
      console.log(`[TradeJournal] Chain position: #${sealResult.chainLength}`);

      // Success! Trigger green flash on AuraGlow
      this.triggerAuraGlow('success', 500);

      return journalEntry;
    } catch (error) {
      console.error('[TradeJournal] Failed to seal trade:', error);
      // Error! Trigger red flash
      this.triggerAuraGlow('error', 1000);
      throw error;
    }
  }

  /**
   * Gets all trades
   */
  getAllTrades(): TradeEntry[] {
    return [...this.trades];
  }

  /**
   * Gets all journal entries (with forensic snapshots)
   */
  getAllJournalEntries(): JournalEntry[] {
    return [...this.journalEntries];
  }

  /**
   * Gets trades for a specific ticker
   */
  getTradesByTicker(ticker: string): TradeEntry[] {
    return this.trades.filter(trade => trade.ticker === ticker);
  }

  /**
   * Gets trades within a time range
   */
  getTradesByTimeRange(startTime: number, endTime: number): TradeEntry[] {
    return this.trades.filter(
      trade => trade.timestamp >= startTime && trade.timestamp <= endTime
    );
  }

  /**
   * Groups recurring savings plans
   */
  groupSavingsPlans(): Map<string, TradeEntry[]> {
    const grouped = new Map<string, TradeEntry[]>();

    for (const trade of this.trades) {
      if (trade.strategy.toLowerCase().includes('saving') ||
        trade.strategy.toLowerCase().includes('plan')) {
        if (!grouped.has(trade.strategy)) {
          grouped.set(trade.strategy, []);
        }
        grouped.get(trade.strategy)!.push(trade);
      }
    }

    return grouped;
  }

  /**
   * Verifies the integrity of the entire journal chain
   */
  async verifyIntegrity(): Promise<{ valid: boolean; invalidIndex?: number; reason?: string }> {
    console.log('[TradeJournal] Verifying chain integrity...');

    if (this.journalEntries.length === 0) {
      return { valid: true };
    }

    // Build sealed entries array for verification
    const sealedEntries: SealedEntry[] = this.journalEntries.map(entry => ({
      hash: entry.entry_hash,
      previousHash: entry.previous_hash,
      timestamp: entry.trade_data.timestamp,
      tradeData: entry.trade_data,
      forensicSnap: entry.forensic_snap,
      merkleRoot: entry.merkle_root,
      nonce: '' // We don't store nonce in journal entry, verification will recompute
    }));

    // Verify the chain
    const result = await MerkleSeal.verifyChain(sealedEntries);

    if (result.valid) {
      console.log(`[TradeJournal] Chain integrity verified: ${this.journalEntries.length} entries`);
      this.triggerAuraGlow('success', 300);
    } else {
      console.error(`[TradeJournal] Chain integrity FAILED at entry ${result.invalidIndex}: ${result.reason}`);
      this.triggerAuraGlow('error', 1000);
    }

    return result;
  }

  /**
   * Get the forensic snapshot for a specific trade
   */
  getForensicSnapshot(tradeId: string): ForensicSnapshot | undefined {
    const entry = this.journalEntries.find(e => e.trade_data.id === tradeId);
    return entry?.forensic_snap;
  }

  /**
   * Export journal to JSON format
   */
  exportToJSON(): string {
    return JSON.stringify({
      version: '1.0',
      exportedAt: Date.now(),
      chainLength: this.journalEntries.length,
      entries: this.journalEntries
    }, null, 2);
  }

  /**
   * Persists trades and journal entries to storage
   */
  private async persist(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        // Browser: Save to localStorage
        localStorage.setItem('FIN_TRADES', JSON.stringify(this.trades));
        localStorage.setItem('FIN_JOURNAL', JSON.stringify(this.journalEntries));

        console.log('[TradeJournal] Persisted to localStorage');
      } else {
        console.warn('[TradeJournal] File system write not available in browser');
      }
    } catch (error) {
      console.error('[TradeJournal] Failed to persist:', error);
      throw error;
    }
  }

  /**
   * Generates a unique trade ID
   */
  private generateTradeId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `TRADE_${timestamp}_${random}`;
  }

  /**
   * Gets chain statistics
   */
  getChainStats(): {
    length: number;
    firstTradeAt: number | null;
    lastTradeAt: number | null;
    lastMerkleRoot: string | null;
  } {
    if (this.journalEntries.length === 0) {
      return {
        length: 0,
        firstTradeAt: null,
        lastTradeAt: null,
        lastMerkleRoot: null
      };
    }

    return {
      length: this.journalEntries.length,
      firstTradeAt: this.journalEntries[0].trade_data.timestamp,
      lastTradeAt: this.journalEntries[this.journalEntries.length - 1].trade_data.timestamp,
      lastMerkleRoot: this.journalEntries[this.journalEntries.length - 1].merkle_root
    };
  }

  /**
   * Clears all trades (use with caution)
   */
  clear(): void {
    this.trades = [];
    this.journalEntries = [];
    MerkleSeal.reset();

    if (typeof window !== 'undefined') {
      localStorage.removeItem('FIN_TRADES');
      localStorage.removeItem('FIN_JOURNAL');
    }

    console.log('[TradeJournal] Journal cleared');
  }
}

// Export singleton instance
export const tradeJournal = new TradeJournal();

// Initialize on module load
if (typeof window !== 'undefined') {
  tradeJournal.initialize().catch(console.error);
}
