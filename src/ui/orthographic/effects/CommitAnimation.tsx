/**
 * [Effects] Commit Animation
 * 
 * Visual sequence when COMMIT is pressed:
 * 1. Freeze terrain animation
 * 2. Hash state with SHA-256
 * 3. Radial shockwave from center
 * 4. White flash (1 frame) → Gold fade
 * 5. Persist to ledger
 */

import React, { useState, useEffect, useCallback } from 'react';
import { store } from '../../../kernel/registry/Store.js';
import { createVektor } from '../../../kernel/registry/Vektor.js';

export interface SealResult {
    hash: string;
    timestamp: number;
    chainLength: number;
}

interface CommitAnimationProps {
    isActive: boolean;
    onComplete: (result: SealResult) => void;
}

// Animation phases
type Phase = 'idle' | 'freeze' | 'hash' | 'shockwave' | 'flash' | 'gold' | 'complete';

export function CommitAnimation({ isActive, onComplete }: CommitAnimationProps) {
    const [phase, setPhase] = useState<Phase>('idle');
    const [shockwaveScale, setShockwaveScale] = useState(0);
    const [flashOpacity, setFlashOpacity] = useState(0);
    const [goldOpacity, setGoldOpacity] = useState(0);
    const [hash, setHash] = useState<string>('');

    // SHA-256 hash function
    const computeHash = async (data: string): Promise<string> => {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // Run animation sequence
    const runSequence = useCallback(async () => {
        // Phase 1: Freeze
        setPhase('freeze');
        store.set('system.animation.frozen', createVektor([1], 'COMMIT', 'freeze', 'active', [1, 1]));
        await new Promise(r => setTimeout(r, 200));

        // Phase 2: Hash
        setPhase('hash');
        const snapshot = store.getSnapshot();
        const stateString = JSON.stringify(Array.from(snapshot.entries()));
        const computedHash = await computeHash(stateString);
        setHash(computedHash);
        await new Promise(r => setTimeout(r, 300));

        // Phase 3: Shockwave
        setPhase('shockwave');
        const shockwaveStart = Date.now();
        const animateShockwave = () => {
            const elapsed = Date.now() - shockwaveStart;
            const progress = Math.min(1, elapsed / 600);
            setShockwaveScale(progress * 3);
            if (progress < 1) {
                requestAnimationFrame(animateShockwave);
            }
        };
        animateShockwave();
        await new Promise(r => setTimeout(r, 400));

        // Phase 4: White Flash
        setPhase('flash');
        setFlashOpacity(1);
        await new Promise(r => setTimeout(r, 50)); // 1 frame at 60fps

        // Phase 5: Gold Fade
        setPhase('gold');
        setFlashOpacity(0);
        setGoldOpacity(1);

        const goldStart = Date.now();
        const animateGold = () => {
            const elapsed = Date.now() - goldStart;
            const progress = Math.min(1, elapsed / 800);
            setGoldOpacity(1 - progress);
            if (progress < 1) {
                requestAnimationFrame(animateGold);
            }
        };
        animateGold();
        await new Promise(r => setTimeout(r, 800));

        // Phase 6: Complete
        setPhase('complete');
        store.set('system.animation.frozen', createVektor([0], 'COMMIT', 'unfreeze', 'complete', [1, 1]));

        // Persist to store
        const result: SealResult = {
            hash: computedHash,
            timestamp: Date.now(),
            chainLength: (store.getValue<number>('ledger.chainLength') || 0) + 1,
        };

        // Store the sealed entry
        store.set('ledger.lastSeal', createVektor(
            [result.timestamp, result.chainLength],
            'MERKLE_SEAL',
            'sealed_entry',
            'complete',
            [1, 1]
        ));

        store.set('ledger.chainLength', createVektor(
            [result.chainLength],
            'MERKLE_SEAL',
            'chain_length',
            'complete',
            [1, 1]
        ));

        onComplete(result);

        // Reset after animation
        setTimeout(() => {
            setPhase('idle');
            setShockwaveScale(0);
            setFlashOpacity(0);
            setGoldOpacity(0);
        }, 500);

    }, [onComplete]);

    // Trigger sequence when active
    useEffect(() => {
        if (isActive && phase === 'idle') {
            runSequence();
        }
    }, [isActive, phase, runSequence]);

    if (phase === 'idle') return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 9999,
            }}
        >
            {/* Shockwave Ring */}
            {(phase === 'shockwave' || phase === 'flash' || phase === 'gold') && (
                <div
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) scale(${shockwaveScale})`,
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        border: '4px solid #00F3FF',
                        boxShadow: '0 0 40px #00F3FF, inset 0 0 40px rgba(0, 243, 255, 0.3)',
                        opacity: 1 - (shockwaveScale / 3),
                        transition: 'none',
                    }}
                />
            )}

            {/* White Flash */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#FFFFFF',
                    opacity: flashOpacity,
                    transition: 'opacity 0.05s ease-out',
                }}
            />

            {/* Gold Fade */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to bottom, #FFD700 0%, #FFA500 100%)',
                    opacity: goldOpacity * 0.6,
                    transition: 'opacity 0.1s ease-out',
                }}
            />

            {/* Hash Display */}
            {(phase === 'gold' || phase === 'complete') && hash && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '20%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '0.75rem',
                        color: '#FFD700',
                        textShadow: '0 0 10px #FFD700',
                        opacity: goldOpacity > 0 ? 1 : 0,
                        transition: 'opacity 0.3s ease-out',
                    }}
                >
                    SEALED: {hash.substring(0, 16)}...
                </div>
            )}

            {/* Status Indicator */}
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '1rem',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    color: phase === 'freeze' ? '#00F3FF' : '#FFD700',
                    textShadow: `0 0 20px ${phase === 'freeze' ? '#00F3FF' : '#FFD700'}`,
                    opacity: phase === 'hash' || phase === 'freeze' ? 1 : 0,
                    transition: 'opacity 0.2s ease-out',
                }}
            >
                {phase === 'freeze' && 'FREEZING STATE...'}
                {phase === 'hash' && 'COMPUTING HASH...'}
            </div>
        </div>
    );
}

/**
 * Hook to trigger commit animation
 */
export function useCommitAnimation() {
    const [isAnimating, setIsAnimating] = useState(false);
    const [lastResult, setLastResult] = useState<SealResult | null>(null);

    const triggerCommit = useCallback(() => {
        setIsAnimating(true);
    }, []);

    const handleComplete = useCallback((result: SealResult) => {
        setLastResult(result);
        setIsAnimating(false);
        console.log('[CommitAnimation] Seal complete:', result.hash.substring(0, 16));
    }, []);

    return {
        isAnimating,
        lastResult,
        triggerCommit,
        handleComplete,
    };
}
