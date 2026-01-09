/**
 * [1.2] Secure Enclave Bridge
 * Bridge to TPM (Trusted Platform Module) for Shard 2 storage.
 * 
 * This is a stub implementation that will be extended with actual TPM access
 * when running in environments that support it (e.g., WebAuthn, TPM APIs).
 */

/**
 * Interface for Secure Enclave operations
 */
export interface SecureEnclaveInterface {
  /** Stores a shard in the secure enclave */
  storeShard(shard: string): Promise<boolean>;
  /** Retrieves a shard from the secure enclave */
  retrieveShard(): Promise<string | null>;
  /** Checks if secure enclave is available */
  isAvailable(): Promise<boolean>;
  /** Clears the stored shard */
  clearShard(): Promise<boolean>;
}

/**
 * Secure Enclave implementation (stub)
 * 
 * In a production environment, this would interface with:
 * - WebAuthn API for platform authenticators
 * - TPM 2.0 APIs (if available in browser context)
 * - Hardware security modules (HSM)
 * 
 * For now, this provides a stub that simulates secure storage
 * using Web Crypto API with persistent keys.
 */
class SecureEnclave implements SecureEnclaveInterface {
  private readonly KEY_NAME = 'FIN_SHARD_2_KEY';
  private readonly STORAGE_KEY = 'FIN_SHARD_2_ENCRYPTED';
  private cryptoKey: CryptoKey | null = null;

  /**
   * Initializes the secure enclave and generates/retrieves the encryption key
   */
  private async initialize(): Promise<boolean> {
    try {
      // Try to retrieve existing key
      const keyData = localStorage.getItem(this.STORAGE_KEY);
      if (keyData) {
        // In a real implementation, this would use WebAuthn or TPM
        // For now, we use a fallback approach
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(keyData),
          { name: 'PBKDF2' },
          false,
          ['deriveKey']
        );
        
        this.cryptoKey = await crypto.subtle.deriveKey(
          {
            name: 'PBKDF2',
            salt: new TextEncoder().encode('FIN_SHARD_2_SALT'),
            iterations: 100000,
            hash: 'SHA-256'
          },
          keyMaterial,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
      } else {
        // Generate new key
        this.cryptoKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
      }
      
      return true;
    } catch (error) {
      console.error('[FIN] Secure Enclave initialization failed:', error);
      return false;
    }
  }

  /**
   * Checks if secure enclave is available
   * @returns Promise resolving to true if available
   */
  async isAvailable(): Promise<boolean> {
    // Check for WebAuthn support
    if (typeof PublicKeyCredential !== 'undefined') {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          return true;
        }
      } catch (error) {
        console.warn('[FIN] WebAuthn check failed:', error);
      }
    }
    
    // Fallback: Check for Web Crypto API
    return typeof crypto !== 'undefined' && 
           typeof crypto.subtle !== 'undefined';
  }

  /**
   * Stores a shard in the secure enclave
   * @param shard The shard string to store
   * @returns Promise resolving to true if successful
   */
  async storeShard(shard: string): Promise<boolean> {
    if (!await this.isAvailable()) {
      console.error('[FIN] Secure Enclave not available');
      return false;
    }

    if (!this.cryptoKey) {
      const initialized = await this.initialize();
      if (!initialized || !this.cryptoKey) {
        return false;
      }
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(shard);
      const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.cryptoKey,
        data
      );
      
      // Store encrypted data with IV
      const storageData = {
        iv: Array.from(iv),
        data: Array.from(new Uint8Array(encrypted))
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storageData));
      
      console.log('[FIN] Shard 2 stored in Secure Enclave (stub)');
      return true;
    } catch (error) {
      console.error('[FIN] Failed to store shard in Secure Enclave:', error);
      return false;
    }
  }

  /**
   * Retrieves a shard from the secure enclave
   * @returns Promise resolving to the shard string or null if not found
   */
  async retrieveShard(): Promise<string | null> {
    if (!await this.isAvailable()) {
      return null;
    }

    if (!this.cryptoKey) {
      const initialized = await this.initialize();
      if (!initialized || !this.cryptoKey) {
        return null;
      }
    }

    try {
      const storageData = localStorage.getItem(this.STORAGE_KEY);
      if (!storageData) {
        return null;
      }

      const parsed = JSON.parse(storageData);
      const iv = new Uint8Array(parsed.iv);
      const encrypted = new Uint8Array(parsed.data);
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        this.cryptoKey!,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('[FIN] Failed to retrieve shard from Secure Enclave:', error);
      return null;
    }
  }

  /**
   * Clears the stored shard from the secure enclave
   * @returns Promise resolving to true if successful
   */
  async clearShard(): Promise<boolean> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.cryptoKey = null;
      console.log('[FIN] Shard 2 cleared from Secure Enclave');
      return true;
    } catch (error) {
      console.error('[FIN] Failed to clear shard from Secure Enclave:', error);
      return false;
    }
  }
}

// Export singleton instance
export const secureEnclave = new SecureEnclave();
