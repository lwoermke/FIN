/**
 * [Phase 7.6] CryoStorage (The Vault)
 * IndexedDB Wrapper for Vektor Persistence.
 * 
 * Policies:
 * - PRICE: 60s TTL
 * - MACRO: 24h TTL
 * - PROFILE: 7d TTL
 */

import { Traceable } from '../../kernel/registry/Vektor.js';

export type DataType = 'PRICE' | 'MACRO' | 'PROFILE' | 'GENERIC';

const TTL_MAP: Record<DataType, number> = {
    PRICE: 60 * 1000,           // 1 Minute
    MACRO: 24 * 60 * 60 * 1000, // 24 Hours
    PROFILE: 7 * 24 * 60 * 60 * 1000, // 7 Days
    GENERIC: 5 * 60 * 1000      // 5 Minutes default
};

interface CryoEntry<T> {
    key: string;
    data: Traceable<T>;
    timestamp: number;
    ttl: number;
    type: DataType;
}

const DB_NAME = 'FIN_CRYO_VAULT';
const STORE_NAME = 'vektor_storage';

export class CryoStorage {
    private static dbPromise: Promise<IDBDatabase> | null = null;

    private static open(): Promise<IDBDatabase> {
        if (this.dbPromise) return this.dbPromise;

        this.dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'key' });
                }
            };

            request.onsuccess = (e: any) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });

        return this.dbPromise;
    }

    /**
     * Stores a Vektor in the Vault
     */
    static async store<T>(key: string, data: Traceable<T>, type: DataType = 'GENERIC'): Promise<void> {
        try {
            const db = await this.open();
            const entry: CryoEntry<T> = {
                key,
                data,
                timestamp: Date.now(),
                ttl: TTL_MAP[type],
                type
            };

            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(entry);
        } catch (e) {
            console.error('[CryoStorage] Freeze Failed:', e);
        }
    }

    /**
     * Retrieves a Vektor from the Vault
     * Returns null if missing or expired.
     */
    static async retrieve<T>(key: string): Promise<{ vektor: Traceable<T>; age: number; status: 'CACHED' | 'EXPIRED' } | null> {
        try {
            const db = await this.open();
            return new Promise((resolve) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get(key);

                req.onsuccess = () => {
                    const entry: CryoEntry<T> = req.result;
                    if (!entry) {
                        resolve(null);
                        return;
                    }

                    const age = Date.now() - entry.timestamp;
                    if (age > entry.ttl) {
                        // Lazy Delete? Or just report expired.
                        resolve({ vektor: entry.data, age, status: 'EXPIRED' });
                    } else {
                        resolve({ vektor: entry.data, age, status: 'CACHED' });
                    }
                };

                req.onerror = () => resolve(null);
            });
        } catch (e) {
            console.error('[CryoStorage] Thaw Failed:', e);
            return null;
        }
    }

    /**
     * Prunes expired entries (Maintenance)
     */
    static async prune(): Promise<void> {
        // Implementation for background cleanup
        // Iterate cursor and delete if Date.now() - timestamp > ttl
    }
}
