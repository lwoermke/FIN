/**
 * [UI] Global Design Tokens (Gravity Glass)
 * 
 * Centralized palette and typography for the FIN interface.
 * Based on Operations Manual specs.
 */

export const DesignTokens = {
    colors: {
        OBSIDIAN_VOID: '#050505',
        ELECTRIC_CYAN: '#00F3FF',
        EXECUTION_RED: '#FF0F0F',
        ENTROPY_YELLOW: '#FAFF00',
        GLASS_FROST: 'rgba(255, 255, 255, 0.05)',
        SPECTRAL_BLUE: 'rgba(0, 243, 255, 0.6)',

        // Semantic Aliases
        background: '#050505',
        primary: '#00F3FF', // Safe / Links / Active
        danger: '#FF0F0F',  // Risk / Error / Sell
        warning: '#FAFF00', // Shock / Caution / New
        dim: 'rgba(255, 255, 255, 0.4)',
        border: 'rgba(0, 243, 255, 0.1)', // Faint Cyan
        glass: 'rgba(10, 10, 20, 0.6)',
    },
    typography: {
        fontData: "'IBM Plex Mono', monospace", // Data / Numbers
        fontLabel: "'Inter', sans-serif",       // UI Labels
        trackingHeader: '-0.02em',
        trackingData: '+0.05em',
    },
    borders: {
        default: '1px solid rgba(0, 243, 255, 0.1)',
        active: '1px solid #00F3FF',
        danger: '1px solid #FF0F0F',
    },
    animation: {
        flicker: `
            @keyframes flicker {
                0% { opacity: 1; }
                5% { opacity: 0.5; }
                10% { opacity: 1; }
                15% { opacity: 0.8; }
                20% { opacity: 1; }
                100% { opacity: 1; }
            }
        `
    }
} as const;

// Inject Animations
const style = document.createElement('style');
style.textContent = DesignTokens.animation.flicker;
document.head.appendChild(style);
