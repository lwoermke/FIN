/**
 * [1.2] IndexedDB Encryption Wrapper
 * AES-256-GCM wrapper for Shard 3 storage in ephemeral Browser IndexedDB.
 * 
 * Shard 3 is stored encrypted in IndexedDB and will be cleared on browser data wipe.
 */

const DB_NAME = 'FIN_SECURE_STORE';
const DB_VERSION = 1;
const STORE_NAME = 'shards';
const SHARD_3_KEY = 'shard_3';

/**
 * Opens the IndexedDB database
 * @returns Promise resolving to IDBDatabase instance
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Generates or retrieves the encryption key for Shard 3
 * @returns Promise resolving to CryptoKey for AES-256-GCM
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const KEY_NAME = 'FIN_SHARD_3_ENCRYPTION_KEY';
  const keyData = sessionStorage.getItem(KEY_NAME);
  
  if (keyData) {
    // Import existing key
    const keyBytes = Uint8Array.from(JSON.parse(keyData));
    return await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  } else {
    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Export and store in sessionStorage (ephemeral)
    const exported = await crypto.subtle.exportKey('raw', key);
    sessionStorage.setItem(KEY_NAME, JSON.stringify(Array.from(new Uint8Array(exported))));
    
    return key;
  }
}

/**
 * Stores Shard 3 in encrypted IndexedDB
 * @param shard The shard string to store
 * @returns Promise resolving to true if successful
 */
export async function storeShard3(shard: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    const key = await getEncryptionKey();
    
    // Encrypt the shard
    const encoder = new TextEncoder();
    const data = encoder.encode(shard);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );
    
    // Store encrypted data with IV
    const storageData = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
      timestamp: Date.now()
    };
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(storageData, SHARD_3_KEY);
      
      request.onsuccess = () => {
        console.log('[FIN] Shard 3 stored in IndexedDB (encrypted)');
        resolve(true);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FIN] Failed to store Shard 3 in IndexedDB:', error);
    return false;
  }
}

/**
 * Retrieves Shard 3 from encrypted IndexedDB
 * @returns Promise resolving to the shard string or null if not found
 */
export async function retrieveShard3(): Promise<string | null> {
  try {
    const db = await openDatabase();
    const key = await getEncryptionKey();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(SHARD_3_KEY);
      
      request.onsuccess = async () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }
        
        try {
          // Decrypt the shard
          const iv = new Uint8Array(result.iv);
          const encrypted = new Uint8Array(result.data);
          
          const decrypted = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv: iv
            },
            key,
            encrypted
          );
          
          const decoder = new TextDecoder();
          resolve(decoder.decode(decrypted));
        } catch (error) {
          console.error('[FIN] Failed to decrypt Shard 3:', error);
          reject(error);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FIN] Failed to retrieve Shard 3 from IndexedDB:', error);
    return null;
  }
}

/**
 * Clears Shard 3 from IndexedDB
 * @returns Promise resolving to true if successful
 */
export async function clearShard3(): Promise<boolean> {
  try {
    const db = await openDatabase();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(SHARD_3_KEY);
      
      request.onsuccess = () => {
        console.log('[FIN] Shard 3 cleared from IndexedDB');
        resolve(true);
      };
      
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[FIN] Failed to clear Shard 3 from IndexedDB:', error);
    return false;
  }
}

/**
 * Checks if IndexedDB is available
 * @returns True if IndexedDB is supported
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}
