/**
 * [1.2] Shamir's Secret Sharing (SSS)
 * Splits a Master Key into 3 shards using 2-of-3 threshold scheme.
 * 
 * Protocol: Re-constitution requires 2-of-3 availability.
 * This ensures recovery after a crash without ever writing the full key to disk.
 */

/**
 * A secret shard containing the share value and index
 */
export interface SecretShard {
  /** Shard index (1, 2, or 3) */
  index: number;
  /** The share value (hex string) */
  share: string;
}

/**
 * Prime modulus for finite field arithmetic (large prime for security)
 * Using a 256-bit prime for AES-256-GCM key compatibility
 */
const PRIME: bigint = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');

/**
 * Generates a random polynomial of degree (threshold - 1) with the secret as the constant term
 * @param secret The secret value (as BigInt)
 * @param threshold Number of shares needed to reconstruct (2)
 * @returns Array of polynomial coefficients [a0, a1, ..., a(threshold-1)]
 */
function generatePolynomial(secret: bigint, threshold: number): bigint[] {
  const coefficients: bigint[] = [secret]; // a0 = secret
  
  // Generate random coefficients a1, a2, ..., a(threshold-1)
  for (let i = 1; i < threshold; i++) {
    // Generate random coefficient in range [1, PRIME-1]
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const randomBigInt = BigInt('0x' + Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
    coefficients.push(randomBigInt % (PRIME - BigInt(1)) + BigInt(1));
  }
  
  return coefficients;
}

/**
 * Evaluates a polynomial at a given point x using Horner's method
 * @param coefficients Polynomial coefficients [a0, a1, ..., an]
 * @param x The point to evaluate at
 * @returns f(x) = a0 + a1*x + a2*x^2 + ... + an*x^n (mod PRIME)
 */
function evaluatePolynomial(coefficients: bigint[], x: bigint): bigint {
  let result = BigInt(0);
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = (result * x + coefficients[i]) % PRIME;
  }
  return result;
}

/**
 * Splits a secret string into 3 shards using Shamir's Secret Sharing (2-of-3)
 * @param secret The master key as a string (will be converted to BigInt)
 * @returns Array of 3 SecretShard objects
 */
export function splitSecret(secret: string): SecretShard[] {
  // Convert secret string to BigInt
  const secretBytes = new TextEncoder().encode(secret);
  const secretHex = '0x' + Array.from(secretBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const secretBigInt = BigInt(secretHex);
  
  // Ensure secret is less than PRIME
  const secretMod = secretBigInt % PRIME;
  
  // Generate polynomial with threshold = 2 (need 2 of 3 shares)
  const threshold = 2;
  const coefficients = generatePolynomial(secretMod, threshold);
  
  // Generate 3 shares (evaluate at x = 1, 2, 3)
  const shards: SecretShard[] = [];
  for (let i = 1; i <= 3; i++) {
    const x = BigInt(i);
    const shareValue = evaluatePolynomial(coefficients, x);
    shards.push({
      index: i,
      share: shareValue.toString(16).padStart(64, '0') // 256-bit hex string
    });
  }
  
  return shards;
}

/**
 * Reconstructs the secret from 2 or more shards using Lagrange interpolation
 * @param shards Array of at least 2 SecretShard objects
 * @returns The reconstructed secret as a string
 * @throws Error if fewer than 2 shards are provided
 */
export function reconstructSecret(shards: SecretShard[]): string {
  if (shards.length < 2) {
    throw new Error('At least 2 shards are required to reconstruct the secret');
  }
  
  // Use first 2 shards (or more if available)
  const usedShards = shards.slice(0, 2);
  
  // Convert share strings to BigInt
  const points = usedShards.map(shard => ({
    x: BigInt(shard.index),
    y: BigInt('0x' + shard.share)
  }));
  
  // Lagrange interpolation to find f(0) = secret
  let secret = BigInt(0);
  
  for (let i = 0; i < points.length; i++) {
    let numerator = BigInt(1);
    let denominator = BigInt(1);
    
    for (let j = 0; j < points.length; j++) {
      if (i !== j) {
        numerator = (numerator * (-points[j].x)) % PRIME;
        denominator = (denominator * (points[i].x - points[j].x)) % PRIME;
      }
    }
    
    // Modular inverse for division
    const inv = modInverse(denominator, PRIME);
    const lagrangeBasis = (numerator * inv) % PRIME;
    secret = (secret + (points[i].y * lagrangeBasis) % PRIME) % PRIME;
  }
  
  // Ensure positive result
  if (secret < 0) {
    secret = (secret + PRIME) % PRIME;
  }
  
  // Convert BigInt back to string
  const secretHex = secret.toString(16).padStart(64, '0');
  const secretBytes = new Uint8Array(
    secretHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );
  
  // Remove leading zeros and convert to string
  let result = '';
  let foundNonZero = false;
  for (const byte of secretBytes) {
    if (byte !== 0 || foundNonZero) {
      foundNonZero = true;
      result += String.fromCharCode(byte);
    }
  }
  
  return result || String.fromCharCode(0);
}

/**
 * Computes the modular inverse using extended Euclidean algorithm
 * @param a The number to invert
 * @param m The modulus
 * @returns The modular inverse of a mod m
 */
function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [a, m];
  let [oldS, s] = [BigInt(1), BigInt(0)];
  
  while (r !== BigInt(0)) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }
  
  if (oldR > BigInt(1)) {
    throw new Error('Modular inverse does not exist');
  }
  
  return oldS < 0 ? (oldS + m) % m : oldS;
}
