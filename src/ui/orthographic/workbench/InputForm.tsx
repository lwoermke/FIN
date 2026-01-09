/**
 * [Workbench] Input Form
 * "Asset DNA" Entry
 * 
 * Features:
 * - Real-time ticker validation (simulated).
 * - Visual Feedback: Cyan (Valid) vs Red Voltage Drop (Invalid).
 * - Hardware Handshake simulation on input.
 */

import React, { useState, useEffect } from 'react';
import { store } from '../../../kernel/registry/Store.js';
import { DesignTokens } from '../../styles/DesignTokens.js';

export function InputForm() {
    const [ticker, setTicker] = useState('');
    const [amount, setAmount] = useState('');
    const [isValid, setIsValid] = useState<boolean | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [errorAnim, setErrorAnim] = useState(false);

    // Simulate Hardware Handshake / Validation
    useEffect(() => {
        if (!ticker) {
            setIsValid(null);
            return;
        }

        setIsChecking(true);
        const timeout = setTimeout(() => {
            // Mock Validation: Ticker must be 3-4 chars
            const valid = /^[A-Z]{3,4}$/.test(ticker.toUpperCase());
            setIsValid(valid);
            setIsChecking(false);

            if (!valid && ticker.length >= 3) {
                // Trigger voltage drop
                setErrorAnim(true);
                setTimeout(() => setErrorAnim(false), 400); // Reset anim
            }
        }, 500); // 500ms latency

        return () => clearTimeout(timeout);
    }, [ticker]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isValid && amount) {
            console.log(`[Workbench] Submitting Asset: ${ticker} x ${amount}`);
            // Logic to add to Store would go here
            setTicker('');
            setAmount('');
            setIsValid(null);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
            <h3 className="text-sm font-label text-primary tracking-wide uppercase mb-2">
                Asset DNA
            </h3>

            {/* Ticker Input */}
            <div className="relative">
                <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    placeholder="TICKER"
                    className="
                        w-full bg-surface/50 outline-none p-3 text-lg transition-all duration-200
                        bg-[rgba(5,5,10,0.8)]
                    "
                    style={{
                        fontFamily: DesignTokens.typography.fontData,
                        color: isValid === false ? DesignTokens.colors.EXECUTION_RED : 'white',
                        border: isValid === false
                            ? DesignTokens.borders.danger
                            : isValid === true
                                ? DesignTokens.borders.active
                                : DesignTokens.borders.default,
                        boxShadow: isValid === true ? `0 0 10px ${DesignTokens.colors.ELECTRIC_CYAN}40` : 'none',
                        animation: errorAnim ? 'voltage-drop 0.4s ease' : 'none'
                    }}
                />
                {isChecking && (
                    <div
                        className="absolute right-3 top-3 w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: DesignTokens.colors.ENTROPY_YELLOW, borderTopColor: 'transparent' }}
                    />
                )}
            </div>

            {/* Amount Input */}
            <div className="relative">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="QTY"
                    className="w-full bg-[rgba(5,5,10,0.8)] outline-none p-3 text-lg transition-colors"
                    style={{
                        fontFamily: DesignTokens.typography.fontData,
                        border: DesignTokens.borders.default,
                        color: 'white'
                    }}
                />
            </div>

            {/* Strategy Select (Mock) */}
            <div className="flex gap-2">
                {['LONG', 'SHORT'].map(strat => (
                    <button
                        key={strat}
                        type="button"
                        className="flex-1 p-2 text-xs uppercase transition-colors"
                        style={{
                            fontFamily: DesignTokens.typography.fontLabel,
                            border: DesignTokens.borders.default,
                            color: DesignTokens.colors.dim,
                            // Hover handled via CSS or state (simplified here)
                        }}
                    >
                        {strat}
                    </button>
                ))}
            </div>

            <button
                type="submit"
                disabled={!isValid || !amount}
                className="mt-4 p-3 text-sm uppercase tracking-wider transition-all duration-300"
                style={{
                    fontFamily: DesignTokens.typography.fontLabel,
                    backgroundColor: isValid && amount ? 'rgba(0, 243, 255, 0.1)' : 'rgba(255,255,255,0.05)',
                    border: isValid && amount ? DesignTokens.borders.active : '1px solid transparent',
                    color: isValid && amount ? DesignTokens.colors.ELECTRIC_CYAN : DesignTokens.colors.dim,
                    cursor: isValid && amount ? 'pointer' : 'not-allowed',
                    opacity: isValid && amount ? 1 : 0.5
                }}
            >
                Initialize Asset
            </button>
        </form>
    );
}
