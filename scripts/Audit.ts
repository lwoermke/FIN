/**
 * [GATEKEEPER] Audit Tool (Cognitive Dominion)
 * 
 * Enforces strict code standards to ensure no simulated reality leaks into the system.
 * 
 * Forbidden:
 * - Math.random() (except allowed modules)
 * - "mock", "fake", "stub" (Variable names or comments)
 * 
 * Usage: tsx scripts/Audit.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../src');

// Whitelist for Math.random() (Entropy Sources or Visual Noise)
const RANDOM_WHITELIST = [
    'GranularSynth.ts',
    'lattice_vertex.glsl',
    'lattice_frag.glsl',
    'MempoolSpace.ts', // Need random for simulation? No, Mempool should be real. Check.
    // Actually, let's keep it strict. 
    'NetworkPulse.ts' // Maybe for jitter?
];

// Patterns to ban
const FORBIDDEN_PATTERNS = [
    { regex: /Math\.random\(\)/g, message: 'Math.random() detected. Use deterministic or cryptographic entropy.' },
    { regex: /mock/i, message: '"Mock" detected. Reality is not mocked.' },
    { regex: /fake/i, message: '"Fake" detected. Cognitive Dominion violation.' },
    { regex: /stub/i, message: '"Stub" detected. Implement or remove.' }
];

let violationCount = 0;

function scanDirectory(dir: string) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'tests' || file === '__tests__') continue; // Skip tests
            scanDirectory(fullPath);
        } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.glsl'))) {
            checkFile(fullPath, file);
        }
    }
}

function checkFile(filePath: string, fileName: string) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // 1. Check Random
    if (content.includes('Math.random()')) {
        if (!RANDOM_WHITELIST.includes(fileName)) {
            console.error(`[VIOLATION] ${fileName}: Math.random() found in restricted context.`);
            violationCount++;
        }
    }

    // 2. Check Forbidden Words
    FORBIDDEN_PATTERNS.forEach(rule => {
        // Skip regex check for random if we already checked it with whitelist logic? 
        // No, regex is fine. But "Math.random" is covered above.
        // Let's check the others.
        if (rule.regex.source.includes('Math.random')) return;

        if (rule.regex.test(content)) {
            // Context check: allow "mock" in strictly test files? We skip tests dir.
            // But what if it's "mockup"? "hammock"?
            // We should use word boundaries \b
            const betterRegex = new RegExp(`\\b${rule.regex.source}\\b`, 'i');
            if (betterRegex.test(content)) {
                console.error(`[VIOLATION] ${fileName}: ${rule.message}`);
                violationCount++;
            }
        }
    });

    // 3. Hardcoded Financial Objects (Heuristic)
    // Looking for { ticker: '...' }
    if (/\{.*ticker:.*['"].*['"].*\}/.test(content)) {
        console.warn(`[WARNING] ${fileName}: Potential hardcoded financial object detected.`);
    }
}

console.log('--- INITIATING COGNITIVE DOMINION SCAN ---');
scanDirectory(ROOT_DIR);

if (violationCount > 0) {
    console.error(`\nFATAL: ${violationCount} Violations Found. Commit Blocked.`);
    console.error('REALITY IS NOT MOCKED.');
    process.exit(1);
} else {
    console.log('\n[PASS] No cognitive dissidents detected.');
    process.exit(0);
}
